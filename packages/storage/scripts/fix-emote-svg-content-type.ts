/**
 * GC-Stats — fix-emote-svg-content-type
 *
 * One-shot, replayable: migrate-old-storage.ts copied twemoji emote bytes
 * as-is from the old V1 storage (BunnyCDN), which never returned a real
 * per-object Content-Type (generic binary/octet-stream for everything). A
 * browser never sniffs an SVG for an <img> element (unlike PNG/WEBP, which
 * it detects by magic bytes); it requires the image/svg+xml header to
 * display it, otherwise the image silently stays broken. Hence "team
 * emotes (webp) work, twemoji SVGs don't" despite an otherwise correct URL.
 *
 * Fixes in place (S3 self-copy, MetadataDirective=REPLACE, no bytes
 * rewritten client side) the Content-Type of every `emotes/**.svg` object
 * in the current bucket to `image/svg+xml`.
 *
 * Usage: npx tsx packages/storage/scripts/fix-emote-svg-content-type.ts [--dry-run]
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import "dotenv/config";
import { ListObjectsV2Command, CopyObjectCommand, type _Object } from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "../src/s3";

const CONCURRENCY = 8;

function encodeKeySegments(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function listAllObjects(prefix: string): Promise<_Object[]> {
  const client = getS3Client();
  const bucket = getBucket();
  const objects: _Object[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
    objects.push(...(page.Contents ?? []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getS3Client();
  const bucket = getBucket();

  console.log(`Bucket : ${bucket}`);
  console.log("Listing des objets emotes/...");
  const objects = await listAllObjects("emotes/");
  const svgs = objects.filter((o) => o.Key?.toLowerCase().endsWith(".svg"));
  console.log(`${objects.length} objets trouvés, ${svgs.length} .svg à corriger.`);
  if (dryRun) {
    console.log("Mode --dry-run : rien ne sera écrit.");
    return;
  }

  let fixed = 0;
  let failed = 0;
  let done = 0;
  await runPool(svgs, CONCURRENCY, async (obj) => {
    const key = obj.Key!;
    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${encodeKeySegments(key)}`,
          Key: key,
          ContentType: "image/svg+xml",
          MetadataDirective: "REPLACE",
        })
      );
      fixed++;
    } catch (err) {
      failed++;
      console.error(`  echec ${key}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      done++;
      if (done % 200 === 0 || done === svgs.length) console.log(`  ${done}/${svgs.length} traites (corriges=${fixed}, echecs=${failed})`);
    }
  });

  console.log("");
  console.log(`Corriges : ${fixed}`);
  console.log(`Echecs   : ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
