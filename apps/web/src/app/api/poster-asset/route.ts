/**
 * GC-Stats - route
 *
 * Same origin relay for logos hosted on the storage bucket. The screenshot capture
 * (components/match/match-poster-dialog.tsx) reads image bytes, which a cross origin
 * host without CORS headers would block. Only the configured bucket is relayed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

// The bucket serves everything as octet-stream, so the type comes from the extension.
const IMAGE_TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" };

export async function GET(request: Request) {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");
  const target = new URL(request.url).searchParams.get("u");
  if (!base || !target || !target.startsWith(`${base}/`)) return NextResponse.json({ error: "Forbidden asset" }, { status: 403 });

  // Rejects "..": a prefix check alone would let the path climb out of the bucket.
  if (new URL(target).pathname.split("/").includes("..")) return NextResponse.json({ error: "Forbidden asset" }, { status: 403 });

  const upstream = await fetch(target, { redirect: "error" }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "Asset unavailable" }, { status: 502 });

  const type = IMAGE_TYPES[new URL(target).pathname.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return NextResponse.json({ error: "Not an image" }, { status: 415 });

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: "Asset too large" }, { status: 413 });

  return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
}
