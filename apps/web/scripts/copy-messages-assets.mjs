// Cloudflare build only: ships src/messages/*.json as static assets, read at
// runtime by src/i18n/load-messages.cloudflare.ts instead of being bundled.
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".open-next/assets/_gcs/messages");

await mkdir(target, { recursive: true });
await cp(path.join(root, "src/messages"), target, { recursive: true });
console.log(`[copy-messages-assets] copied to ${path.relative(root, target)}`);
