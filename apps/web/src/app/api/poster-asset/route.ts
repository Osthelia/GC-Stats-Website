/**
 * GC-Stats - route
 *
 * Same origin relay for logos hosted on the storage bucket. The screenshot capture
 * (components/match/match-poster-dialog.tsx) reads image bytes, which a cross origin
 * host without CORS headers would block. Only the configured bucket is relayed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

// The bucket serves everything as octet-stream, so the type comes from the extension.
const IMAGE_TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" };

function parseUrl(value: string | null | undefined): URL | null {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

// Compares parsed URLs: the pathname is already normalized, so ".." cannot climb out of the bucket.
function isInBucket(url: URL, bucket: URL): boolean {
  const bucketPath = `${bucket.pathname.replace(/\/+$/, "")}/`;
  return url.origin === bucket.origin && url.pathname.startsWith(bucketPath);
}

export async function GET(request: Request) {
  const bucket = parseUrl(process.env.S3_PUBLIC_URL);
  const target = parseUrl(new URL(request.url).searchParams.get("u"));
  if (!bucket || !target || !isInBucket(target, bucket)) return NextResponse.json({ error: "Forbidden asset" }, { status: 403 });

  // Redirects are followed (a CDN may add one), but only a response still on the bucket is relayed.
  const upstream = await fetch(target.href, { headers: { "User-Agent": "GCStats-PosterAsset", Accept: "image/*" } }).catch((error) => {
    console.warn("[poster-asset] Fetch failed", target.href, error);
    return null;
  });
  const upstreamUrl = parseUrl(upstream?.url);
  if (!upstream?.ok || !upstreamUrl || !isInBucket(upstreamUrl, bucket)) {
    console.warn("[poster-asset] Upstream refused", target.href, upstream?.status, upstream?.url);
    return NextResponse.json({ error: "Asset unavailable", upstreamStatus: upstream?.status ?? null }, { status: 502 });
  }

  const type = IMAGE_TYPES[target.pathname.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return NextResponse.json({ error: "Not an image" }, { status: 415 });

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: "Asset too large" }, { status: 413 });

  return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
}
