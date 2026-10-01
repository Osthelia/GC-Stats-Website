/**
 * GC-Stats — run-phase
 *
 * Ad hoc runner: `npx tsx scripts/migrate-v1/run-phase.ts <phaseFile>
 * <exportName>` invokes a single named export from a migrate-v1 module
 * directly, without running the full phase list in index.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { closeConnections } from "./connection";

const [, , mod, fn] = process.argv;
if (!mod || !fn) throw new Error("usage: run-phase.ts <module-without-ts> <exportName>");

const imported = await import(`./${mod}.ts`);
const target = imported[fn];
if (typeof target !== "function") throw new Error(`${fn} is not exported by ${mod}`);
await target();
await closeConnections();
