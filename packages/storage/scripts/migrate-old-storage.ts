/**
 * GC-Stats — migrate-old-storage
 *
 * One-shot, replayable: copies every object from the old V1 storage
 * (BunnyCDN Edge Storage, S3-compatible API) to the new S3-compatible
 * bucket used by @gc-stats/storage (R2 in dev, see packages/storage/src/s3.ts).
 * Pure file transfer, identical key source to destination, no conversion or
 * DB write (logos/news_images/emotes rows were migrated but their files
 * never were).
 *
 * Source (old storage, set in packages/storage/.env or the shell env):
 *   OLD_S3_ENDPOINT           e.g. https://de-s3.storage.bunnycdn.com
 *   OLD_S3_REGION             e.g. de (optional, BunnyCDN ignores it)
 *   OLD_S3_BUCKET             storage zone name (e.g. gcs-images)
 *   OLD_S3_ACCESS_KEY_ID      storage zone name (BunnyCDN: access key = zone name)
 *   OLD_S3_SECRET_ACCESS_KEY  storage zone password / API key
 *   OLD_S3_FORCE_PATH_STYLE   "true" if needed (defaults to true, BunnyCDN requires it)
 *
 * Destination: same S3_* variables as the rest of @gc-stats/storage.
 *
 * Usage: npx tsx packages/storage/scripts/migrate-old-storage.ts [--dry-run] [--prefix=teams/]
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import "dotenv/config";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type _Object,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getS3Client as getNewClient, getBucket as getNewBucket } from "../src/s3";

const CONCURRENCY = 8;
// Skip anything absurdly large (this migration only ever expects images) —
// prevents one bad object from ballooning memory (we buffer whole objects).
const MAX_OBJECT_BYTES = 200 * 1024 * 1024;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 500;

// BunnyCDN's S3-compatible endpoint never returns a real per-object
// Content-Type (generic binary/octet-stream for everything, see
// fix-emote-svg-content-type.ts) — trusting got.ContentType silently copied
// that wrong type forward. Extension wins whenever it's recognized; only an
// unknown extension falls back to whatever the source reported.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function resolveContentType(key: string, sourceContentType: string | undefined): string | undefined {
  const ext = key.split(".").pop()?.toLowerCase();
  const byExtension = ext ? CONTENT_TYPE_BY_EXTENSION[ext] : undefined;
  return byExtension ?? sourceContentType;
}

function errorStatusCode(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function errorCode(err: unknown): string | undefined {
  return (err as { name?: string; code?: string })?.code ?? (err as { name?: string })?.name;
}

// BunnyCDN's S3-compatible endpoint throttles aggressively per storage zone —
// 429/500/503 and raw socket resets under concurrency are transient, not real
// failures. Retried with exponential backoff + jitter before giving up.
function isRetryable(err: unknown): boolean {
  const status = errorStatusCode(err);
  if (status !== undefined) return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  const code = errorCode(err);
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE" || code === "ThrottlingException" || code === "SlowDown";
}

function describeError(err: unknown): string {
  const status = errorStatusCode(err);
  const code = errorCode(err);
  const message = err instanceof Error ? err.message : String(err);
  return `${status ? `HTTP ${status} ` : ""}${code ? `[${code}] ` : ""}${message}`;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function getOldClient(): S3Client {
  return new S3Client({
    region: process.env.OLD_S3_REGION || "de",
    endpoint: requireEnv("OLD_S3_ENDPOINT"),
    forcePathStyle: process.env.OLD_S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: requireEnv("OLD_S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("OLD_S3_SECRET_ACCESS_KEY"),
    },
  });
}

function getOldBucket(): string {
  return requireEnv("OLD_S3_BUCKET");
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function listAllObjects(client: S3Client, bucket: string, prefix?: string): Promise<_Object[]> {
  const objects: _Object[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    objects.push(...(page.Contents ?? []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function alreadyMigrated(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw err;
  }
}

// BunnyCDN's S3-compatible ListObjectsV2 includes folder placeholder entries
// (key ending in "/", size 0) alongside real files when listed recursively
// without a Delimiter — these aren't fetchable objects, just directories.
function isFolderPlaceholder(key: string, size: number): boolean {
  return key.endsWith("/") && size === 0;
}

// Some object stores round-trip accented filenames (common here — French team/
// player names) through a different Unicode normalization form than the one
// ListObjectsV2 reports, so GetObject 404s on the exact listed key. Retried
// once with the NFC and NFD forms of the key before giving up for real.
async function getObjectWithNormalizedFallback(
  client: S3Client,
  bucket: string,
  key: string
): Promise<GetObjectCommandOutput> {
  try {
    return await withRetry(() => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })));
  } catch (err) {
    if (errorStatusCode(err) !== 404) throw err;
    for (const candidate of [key.normalize("NFC"), key.normalize("NFD")]) {
      if (candidate === key) continue;
      try {
        return await withRetry(() => client.send(new GetObjectCommand({ Bucket: bucket, Key: candidate })));
      } catch {
        // keep trying other forms / fall through to the original error
      }
    }
    throw err;
  }
}

async function copyOne(
  oldClient: S3Client,
  oldBucket: string,
  newClient: S3Client,
  newBucket: string,
  key: string,
  size: number,
  dryRun: boolean
): Promise<"copied" | "skipped-exists" | "skipped-too-large" | "skipped-folder"> {
  if (isFolderPlaceholder(key, size)) return "skipped-folder";
  if (size > MAX_OBJECT_BYTES) return "skipped-too-large";

  if (await withRetry(() => alreadyMigrated(newClient, newBucket, key))) return "skipped-exists";
  if (dryRun) return "copied";

  const got = await getObjectWithNormalizedFallback(oldClient, oldBucket, key);
  const body = await streamToBuffer(got.Body as NodeJS.ReadableStream);

  await withRetry(() =>
    newClient.send(
      new PutObjectCommand({
        Bucket: newBucket,
        Key: key,
        Body: body,
        ContentType: resolveContentType(key, got.ContentType),
        CacheControl: got.CacheControl,
      })
    )
  );
  return "copied";
}

async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const prefixArg = args.find((a) => a.startsWith("--prefix="));
  const prefix = prefixArg ? prefixArg.slice("--prefix=".length) : undefined;

  const oldClient = getOldClient();
  const oldBucket = getOldBucket();
  const newClient = getNewClient();
  const newBucket = getNewBucket();

  console.log(`Source : ${oldBucket} (${process.env.OLD_S3_ENDPOINT})`);
  console.log(`Cible  : ${newBucket} (${process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "?"})`);
  if (prefix) console.log(`Filtre : prefix="${prefix}"`);
  if (dryRun) console.log("Mode --dry-run : rien ne sera écrit.");

  console.log("Listing des objets source...");
  const objects = await listAllObjects(oldClient, oldBucket, prefix);
  console.log(`${objects.length} objets trouvés côté source.`);

  let copied = 0;
  let skippedExists = 0;
  let skippedTooLarge = 0;
  let skippedFolder = 0;
  const failed: { key: string; error: string; status?: number; code?: string }[] = [];
  let done = 0;

  await runPool(objects, CONCURRENCY, async (obj) => {
    const key = obj.Key;
    if (!key) return;
    try {
      const result = await copyOne(oldClient, oldBucket, newClient, newBucket, key, obj.Size ?? 0, dryRun);
      if (result === "copied") copied++;
      else if (result === "skipped-exists") skippedExists++;
      else if (result === "skipped-folder") skippedFolder++;
      else skippedTooLarge++;
    } catch (err) {
      failed.push({ key, error: describeError(err), status: errorStatusCode(err), code: errorCode(err) });
    } finally {
      done++;
      if (done % 100 === 0 || done === objects.length) {
        console.log(`  ${done}/${objects.length} traités (copiés=${copied}, déjà présents=${skippedExists}, échecs=${failed.length})`);
      }
    }
  });

  console.log("");
  console.log("=== Résumé ===");
  console.log(`Copiés            : ${copied}${dryRun ? " (dry-run, rien écrit)" : ""}`);
  console.log(`Déjà présents     : ${skippedExists}`);
  console.log(`Dossiers ignorés (marqueurs de dossier, pas de vrais fichiers) : ${skippedFolder}`);
  console.log(`Ignorés (trop gros >${MAX_OBJECT_BYTES} octets) : ${skippedTooLarge}`);
  console.log(`Échecs            : ${failed.length}`);
  if (failed.length > 0) {
    const byStatus = new Map<string, number>();
    for (const f of failed) {
      const label = f.status ? `HTTP ${f.status}` : f.code ?? "inconnu";
      byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    }
    console.log("");
    console.log("Répartition des échecs par cause (429/503/ECONNRESET répétés = rate limit côté source ou destination) :");
    for (const [label, count] of byStatus) console.log(`  - ${label}: ${count}`);
    console.log("");
    console.log("Clés en échec, après épuisement des tentatives (à rejouer : relancer le script, il est idempotent) :");
    for (const f of failed.slice(0, 50)) console.log(`  - ${f.key}: ${f.error}`);
    if (failed.length > 50) console.log(`  ... et ${failed.length - 50} de plus`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
