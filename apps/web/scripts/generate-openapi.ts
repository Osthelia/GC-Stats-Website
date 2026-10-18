import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { GAMES } from "@gc-stats/db/game";
import { registry } from "../src/lib/api/v1/openapi/registry";

const document = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "GC Stats API",
    version: "1.0.0",
    description: "Read only stats API for teams and players. Send an `x-api-key` header on every request, get a key from the dashboard.",
  },
  // One API per game: /api/valorant/v1/teams, /api/lol/v1/teams...
  servers: [{ url: "https://gc-stats.app/api/{game}", variables: { game: { default: "valorant", enum: [...GAMES], description: "Game the data belongs to. Maps, stats and veto endpoints only exist for valorant." } } }],
});

const outPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
