/**
 * GC-Stats - classifier
 *
 * Classifies one tweet with the Anthropic Messages API (forced tool use),
 * then enforces the verdict/topic invariants in code.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { CLASSIFIER_SYSTEM_PROMPT } from "./classifier-prompt";
import { getClassifierExamples } from "./classifier-examples";
import { TOPICS, VERDICTS, enforceInvariants, type Topic, type Verdict } from "./constants";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const SHORT_TEXT_THRESHOLD = 80;
const MAX_IMAGES = 4;

export type ClassifierMedia = { type: "photo" | "video"; url: string; previewUrl: string | null };
export type ClassifierInput = { text: string; media: ClassifierMedia[]; teamName: string };
export type ClassifierResult = {
  verdict: Verdict;
  topic: Topic;
  players: string[];
  reason: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export const CLASSIFY_TOOL = {
  name: "classify_tweet",
  description: "Record the classification of the tweet.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: [...VERDICTS] },
      topic: { type: "string", enum: [...TOPICS] },
      players: { type: "array", items: { type: "string" } },
      reason: { type: "string" },
    },
    required: ["verdict", "topic", "players", "reason"],
  },
} as const;

export function classifierModel(): string {
  return process.env.ROSTER_CLASSIFIER_MODEL || DEFAULT_MODEL;
}

/** Text left once mentions, hashtags and links are removed. */
export function visibleTextLength(text: string): number {
  return text.replace(/[@#]\w+|https?:\/\/\S+/g, "").trim().length;
}

/** Images are sent when the text alone says little, the video preview stands in for a video. */
export function imageUrlsForVision(input: ClassifierInput): string[] {
  if (visibleTextLength(input.text) >= SHORT_TEXT_THRESHOLD) return [];
  return input.media
    .map((item) => (item.type === "photo" ? item.url : item.previewUrl))
    .filter((url): url is string => !!url)
    .slice(0, MAX_IMAGES);
}

function buildSystemPrompt(): string {
  const examples = getClassifierExamples();
  if (examples.length === 0) return CLASSIFIER_SYSTEM_PROMPT;
  const lines = examples.map((example) => `Tweet: ${example.text}\nAnswer: ${example.verdict} / ${example.topic}`);
  return `${CLASSIFIER_SYSTEM_PROMPT}\n\nExamples:\n\n${lines.join("\n\n")}`;
}

type ToolInput = { verdict?: unknown; topic?: unknown; players?: unknown; reason?: unknown };

/** Validates the tool arguments and applies the invariants, throws on a malformed answer. */
export function normalizeToolInput(raw: ToolInput): Pick<ClassifierResult, "verdict" | "topic" | "players" | "reason"> {
  if (!(VERDICTS as readonly unknown[]).includes(raw.verdict) || !(TOPICS as readonly unknown[]).includes(raw.topic)) {
    throw new Error("Classifier returned an invalid verdict or topic");
  }
  const topic = raw.topic as Topic;
  const verdict = enforceInvariants(raw.verdict as Verdict, topic);
  const players = Array.isArray(raw.players) ? raw.players.filter((p): p is string => typeof p === "string").slice(0, 20) : [];
  const reason = typeof raw.reason === "string" ? raw.reason.slice(0, 500) : "";
  return { verdict, topic, players, reason };
}

type ApiResponse = {
  content?: { type: string; input?: ToolInput }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

class RetryableError extends Error {}
class ClientError extends Error {
  constructor(readonly status: number) {
    super(`Anthropic responded ${status}`);
  }
}

async function callOnce(input: ClassifierInput, model: string, apiKey: string, withImages: boolean): Promise<ClassifierResult> {
  const images = withImages ? imageUrlsForVision(input) : [];
  const content = [
    ...images.map((url) => ({ type: "image", source: { type: "url", url } })),
    { type: "text", text: `Team: ${input.teamName}\nTweet:\n${input.text}` },
  ];

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools: [CLASSIFY_TOOL],
        tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new RetryableError(`Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.status === 429 || response.status >= 500) throw new RetryableError(`Anthropic responded ${response.status}`);
  if (!response.ok) throw new ClientError(response.status);

  const body = (await response.json()) as ApiResponse;
  const toolUse = body.content?.find((block) => block.type === "tool_use");
  if (!toolUse?.input) throw new Error("Classifier returned no tool call");

  return {
    ...normalizeToolInput(toolUse.input),
    model,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  };
}

/** Exponential retry on rate limits, 5xx and network errors, anything else fails right away. */
export async function classifyTweet(
  input: ClassifierInput,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<ClassifierResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = classifierModel();

  let withImages = true;
  for (let attempt = 1; ; attempt++) {
    try {
      return await callOnce(input, model, apiKey, withImages);
    } catch (error) {
      // An unreachable or unsupported image makes the API answer 400, the text alone can still be classified.
      if (error instanceof ClientError && error.status === 400 && withImages && imageUrlsForVision(input).length > 0) {
        withImages = false;
        continue;
      }
      if (!(error instanceof RetryableError) || attempt >= MAX_ATTEMPTS) throw error;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
}
