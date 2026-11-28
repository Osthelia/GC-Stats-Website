import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/lib/api/v1/openapi/registry";

const document = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "GC Stats API",
    version: "1.0.0",
    description: "Read only stats API for teams and players. Send an `x-api-key` header on every request, get a key from the dashboard.",
  },
  servers: [{ url: "https://gc-stats.app/api" }],
});

const outPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
