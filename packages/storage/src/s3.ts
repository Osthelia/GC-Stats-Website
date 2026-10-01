/**
 * GC-Stats — s3 module
 *
 * Generic S3-compatible client (AWS S3, OVH Object Storage, Backblaze B2,
 * MinIO, ...), same approach as V1's `s3` disk, just not tied to a single
 * provider. Endpoint and path-style are optional so this also works
 * unmodified against real AWS S3.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";

let cachedClient: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} for @gc-stats/storage`);
  return value;
}

export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
    // Workers can only make outbound calls through `fetch` (no raw TCP
    // sockets) — the SDK's default Node handler opens keep-alive sockets via
    // `node:http`, which nodejs_compat doesn't back with real sockets on
    // Workers. Docker keeps the default handler (real pooled keep-alive).
    requestHandler: process.env.DEPLOY_TARGET === "cloudflare" ? new FetchHttpHandler() : undefined,
  });
  return cachedClient;
}

export function getBucket(): string {
  return requireEnv("S3_BUCKET");
}

/** Public read URL for a key — bucket's own public endpoint, or a CDN in front of it (mirrors V1's BunnyCDN pull zone). Throws if unconfigured — call after an actual upload, where S3 must already be set up. */
export function publicUrl(key: string): string {
  const base = requireEnv("S3_PUBLIC_URL").replace(/\/+$/, "");
  return `${base}/${key}`;
}

/** Same as publicUrl, but returns null instead of throwing when S3 isn't configured yet — for convention-based URL resolution on read paths (list/detail pages) that must keep rendering before a bucket exists. */
export function tryPublicUrl(key: string): string | null {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : null;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Not "immutable" — an edit can overwrite these bytes in place at the
      // same key (see replaceLogoFiles), so a long/immutable cache would
      // keep serving the old image for up to a year after an edit.
      CacheControl: "public, max-age=3600",
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await getS3Client().send(new DeleteObjectsCommand({ Bucket: getBucket(), Delete: { Objects: keys.map((Key) => ({ Key })) } }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw err;
  }
}

// A key's path segments need individual percent-encoding (spaces, accents —
// common here, French team/player names) but the "/" separators themselves
// must stay literal, both in the destination Key and in the CopySource
// header value S3 expects.
function encodeKeySegments(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Server-side copy within the same bucket (no download/re-upload) — used to move bytes already uploaded under one key to the key convention another entity type expects, e.g. reconciling a legacy folder name against the current one. */
export async function copyObjectWithinBucket(fromKey: string, toKey: string): Promise<void> {
  const bucket = getBucket();
  await getS3Client().send(
    new CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${encodeKeySegments(fromKey)}`, Key: toKey })
  );
}
