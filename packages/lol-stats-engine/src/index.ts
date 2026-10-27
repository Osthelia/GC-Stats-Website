/**
 * GC-Stats — index module
 *
 * Package entrypoint: re-exports the Riot Match-V5 DTO types and the pure
 * mappers that turn a match and its timeline into LoL rows.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export * from "./types";
export * from "./champion-catalog";
export * from "./match-id";
export * from "./game-summary";
export * from "./infer-roles";
export * from "./timeline-rows";
export * from "./timeline-stats";
export * from "./validate-import";
