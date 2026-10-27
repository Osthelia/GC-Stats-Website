/**
 * GC-Stats - leaguepedia-client
 *
 * Reads wiki pages from Leaguepedia (lol.fandom.com), where the LoL game data comes from. The login
 * and the request policy follow leaguepedia-v5-export: a bot login (`Name@BotName`), the session
 * cookie kept between requests, `assert=user` on every query, one request at a time with a pause
 * between them, 429 and maxlag waited out by Retry-After (3 retries), and any other HTTP or network
 * failure stops at once. The cookie is stored encrypted in `external_api_sessions`, because a Worker
 * keeps nothing between requests. Never throws: failures come back as typed errors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { externalApiSessions } from "@gc-stats/db";
import { adminDb as db } from "@gc-stats/db/client";
import packageJson from "../../package.json";
import { decrypt, encrypt } from "./encryption";

const API_URL = "https://lol.fandom.com/api.php";
const SERVICE = "leaguepedia";
const FETCH_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 500;
const MAXLAG_SECONDS = 5;
const MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_RATE_LIMIT_WAIT_MS = 30000;
const CARGO_PAGE_SIZE = 500;

export type LeaguepediaError =
  | { kind: "missingConfig" }
  | { kind: "loginFailed" }
  | { kind: "rateLimited" }
  | { kind: "httpError"; status: number }
  | { kind: "apiError"; code: string }
  | { kind: "networkError" }
  | { kind: "invalidResponse" }
  | { kind: "unexpected" };

export type LeaguepediaResult<T> = { ok: true; data: T } | { ok: false; error: LeaguepediaError };

export interface LeaguepediaPage {
  /** Title as the wiki normalises it (underscores become spaces). */
  title: string;
  /** null when the page does not exist. */
  wikitext: string | null;
}

interface BotConfig {
  username: string;
  password: string;
  userAgent: string;
}

interface QueryPage {
  title: string;
  missing?: boolean;
  revisions?: { slots?: { main?: { content?: string } } }[];
}

interface QueryPagesBody {
  query?: { pages?: QueryPage[] };
  continue?: Record<string, string>;
}

interface TokenBody {
  query?: { tokens?: { logintoken?: string } };
}

interface LoginBody {
  login?: { result?: string };
}

/** One Cargo result row: every value is a string, keyed by the alias given in `fields`. */
export type CargoRow = Record<string, string>;

export interface CargoQuery {
  /** e.g. "MatchScheduleGame=MSG,MatchSchedule=MS" */
  tables: string;
  /** e.g. "MSG.GameId=GameId, MSG.Blue=Blue" (the aliases are the keys of each row) */
  fields: string;
  joinOn?: string;
  where?: string;
  orderBy?: string;
}

interface CargoBody {
  cargoquery?: { title: CargoRow }[];
}

/** Every API answer, with the `error` field MediaWiki puts on failures. */
type ApiBody<T> = T & { error?: { code: string } };

interface ApiCall<T> {
  body: ApiBody<T>;
  cookie: string;
}

interface Session {
  cookie: string | null;
}

/** Internal: thrown inside the client and turned into a typed error at the public boundary. */
class LeaguepediaFailure extends Error {
  constructor(readonly error: LeaguepediaError) {
    super(error.kind);
  }
}

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Public entry points queue behind each other, so the bot never sends two requests at once. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

/** Fetches the wikitext of the given titles in one request. Titles are joined with "|", so keep the list short. */
export function fetchLeaguepediaPages(titles: string[]): Promise<LeaguepediaResult<LeaguepediaPage[]>> {
  return serialized(async (): Promise<LeaguepediaResult<LeaguepediaPage[]>> => {
    const config = botConfig();
    if (!config) return { ok: false, error: { kind: "missingConfig" } };
    try {
      const session: Session = { cookie: await readStoredCookie() };
      const pages = new Map<string, LeaguepediaPage>();
      let continueParams: Record<string, string> = {};
      let previous: string | null = null;
      for (;;) {
        const body = await queryWithSession<QueryPagesBody>(config, session, {
          action: "query",
          prop: "revisions",
          rvprop: "content",
          rvslots: "main",
          formatversion: "2",
          titles: titles.join("|"),
          ...continueParams,
        });
        for (const page of body.query?.pages ?? []) {
          const next = toPage(page);
          // A missing page only counts as missing if no earlier answer had its content.
          if (next.wikitext !== null || !pages.has(next.title)) pages.set(next.title, next);
        }
        if (!body.continue) return { ok: true, data: [...pages.values()] };
        const key = JSON.stringify(body.continue);
        if (key === previous) throw new LeaguepediaFailure({ kind: "invalidResponse" });
        previous = key;
        continueParams = body.continue;
      }
    } catch (err) {
      return { ok: false, error: toLeaguepediaError(err) };
    }
  });
}

/** Every row of a cargoquery, read page by page. A page shorter than the limit is the last one. */
export function fetchLeaguepediaCargo(query: CargoQuery, pageSize = CARGO_PAGE_SIZE): Promise<LeaguepediaResult<CargoRow[]>> {
  return serialized(async (): Promise<LeaguepediaResult<CargoRow[]>> => {
    const config = botConfig();
    if (!config) return { ok: false, error: { kind: "missingConfig" } };
    try {
      const session: Session = { cookie: await readStoredCookie() };
      const rows: CargoRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const body = await queryWithSession<CargoBody>(config, session, {
          action: "cargoquery",
          tables: query.tables,
          fields: query.fields,
          ...(query.joinOn ? { join_on: query.joinOn } : {}),
          ...(query.where ? { where: query.where } : {}),
          ...(query.orderBy ? { order_by: query.orderBy } : {}),
          limit: String(pageSize),
          offset: String(offset),
        });
        const page = (body.cargoquery ?? []).map((item) => item.title);
        rows.push(...page);
        if (page.length < pageSize) return { ok: true, data: rows };
      }
    } catch (err) {
      return { ok: false, error: toLeaguepediaError(err) };
    }
  });
}

/** LEAGUEPEDIA_BOT_USERNAME is `Name@BotName`, from Special:BotPasswords. */
function botConfig(): BotConfig | null {
  const username = process.env.LEAGUEPEDIA_BOT_USERNAME;
  const password = process.env.LEAGUEPEDIA_BOT_PASSWORD;
  if (!username?.includes("@") || !password) return null;
  return {
    username,
    password,
    userAgent: process.env.LEAGUEPEDIA_USER_AGENT ?? `GC-Stats/${packageJson.version} (https://github.com/Osthelia/GC-Stats-Website)`,
  };
}

/** Query the api with the stored cookie or logs in when there is none */
async function queryWithSession<T>(config: BotConfig, session: Session, params: Record<string, string>): Promise<ApiBody<T>> {
  if (session.cookie !== null) {
    try {
      return (await callApi<T>(config, session.cookie, { ...params, assert: "user" }, "GET")).body;
    } catch (err) {
      if (!isAssertUserFailed(err)) throw err;
    }
  }
  session.cookie = await logIn(config);
  return (await callApi<T>(config, session.cookie, { ...params, assert: "user" }, "GET")).body;
}

/** Login to leaguepedia and save the cookie */
async function logIn(config: BotConfig): Promise<string> {
  const token = await callApi<TokenBody>(config, "", { action: "query", meta: "tokens", type: "login" }, "GET");
  const logintoken = token.body.query?.tokens?.logintoken;
  if (!logintoken) throw new LeaguepediaFailure({ kind: "invalidResponse" });

  const login = await callApi<LoginBody>(
    config,
    token.cookie,
    { action: "login", lgname: config.username, lgpassword: config.password, lgtoken: logintoken },
    "POST"
  );
  if (login.body.login?.result !== "Success") throw new LeaguepediaFailure({ kind: "loginFailed" });

  await saveCookie(login.cookie);
  return login.cookie;
}

async function callApi<T>(config: BotConfig, cookie: string, params: Record<string, string>, method: "GET" | "POST"): Promise<ApiCall<T>> {
  const body = new URLSearchParams({ ...params, format: "json", maxlag: String(MAXLAG_SECONDS) });
  const headers: Record<string, string> = { "User-Agent": config.userAgent };
  if (cookie) headers.Cookie = cookie;

  for (let retries = 0; ; retries++) {
    const response = await send(method, body, headers);

    if (response.status === 429) {
      if (retries < MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs(response));
        continue;
      }
      throw new LeaguepediaFailure({ kind: "rateLimited" });
    }
    if (!response.ok) throw new LeaguepediaFailure({ kind: "httpError", status: response.status });

    const json = await readJson<T>(response);
    if (json.error?.code === "maxlag") {
      if (retries < MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs(response));
        continue;
      }
      throw new LeaguepediaFailure({ kind: "rateLimited" });
    }
    if (json.error) throw new LeaguepediaFailure({ kind: "apiError", code: json.error.code });

    return { body: json, cookie: mergeCookies(cookie, response) };
  }
}

async function send(method: "GET" | "POST", body: URLSearchParams, headers: Record<string, string>): Promise<Response> {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  try {
    return await fetch(method === "GET" ? `${API_URL}?${body}` : API_URL, {
      method,
      headers,
      body: method === "POST" ? body : undefined,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new LeaguepediaFailure({ kind: "networkError" });
  }
}

async function readJson<T>(response: Response): Promise<ApiBody<T>> {
  try {
    return (await response.json()) as ApiBody<T>;
  } catch {
    throw new LeaguepediaFailure({ kind: "invalidResponse" });
  }
}

function isAssertUserFailed(err: unknown): boolean {
  return err instanceof LeaguepediaFailure && err.error.kind === "apiError" && err.error.code === "assertuserfailed";
}

function toLeaguepediaError(err: unknown): LeaguepediaError {
  if (err instanceof LeaguepediaFailure) {
    // Still not logged in right after logging in: the bot account or its rights are wrong.
    return isAssertUserFailed(err) ? { kind: "loginFailed" } : err.error;
  }
  console.warn(`[leaguepedia] ${err instanceof Error ? err.message : String(err)}`);
  return { kind: "unexpected" };
}

function toPage(page: QueryPage): LeaguepediaPage {
  const wikitext = page.missing ? null : (page.revisions?.[0]?.slots?.main?.content ?? null);
  return { title: page.title, wikitext };
}

/** Retry-After as milliseconds: seconds or an HTTP date. 30 s when missing or unreadable. */
function retryAfterMs(response: Response): number {
  const header = response.headers.get("retry-after");
  if (header === null) return DEFAULT_RATE_LIMIT_WAIT_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return DEFAULT_RATE_LIMIT_WAIT_MS;
}

/** Carries the response's Set-Cookie values into a `Cookie` header value. Attributes (Path, Expires, ...) are dropped. */
function mergeCookies(cookie: string, response: Response): string {
  const jar = new Map<string, string>();
  for (const pair of cookie.split(";")) addPair(jar, pair);
  for (const header of response.headers.getSetCookie()) addPair(jar, header.split(";")[0] ?? "");
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function addPair(jar: Map<string, string>, pair: string): void {
  const eq = pair.indexOf("=");
  if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStoredCookie(): Promise<string | null> {
  const [row] = await db.select().from(externalApiSessions).where(eq(externalApiSessions.service, SERVICE));
  return row ? decrypt(row.cookieEncrypted) : null;
}

async function saveCookie(cookie: string): Promise<void> {
  const cookieEncrypted = encrypt(cookie);
  const updatedAt = new Date();
  await db
    .insert(externalApiSessions)
    .values({ service: SERVICE, cookieEncrypted, updatedAt })
    .onConflictDoUpdate({ target: externalApiSessions.service, set: { cookieEncrypted, updatedAt } });
}
