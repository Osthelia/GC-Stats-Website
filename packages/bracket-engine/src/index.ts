/**
 * GC-Stats — Tournament bracket engine
 *
 * Generates and validates bracket formats (single/double/triple elimination,
 * round-robin, GSL, Swiss), computes standings, and resolves match outcomes.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export * from "./graph/types";
export * from "./graph/validate";
export * from "./graph/seed-order";
export * from "./generators/single-elimination";
export * from "./generators/double-elimination";
export * from "./generators/triple-elimination";
export * from "./generators/cascade";
export * from "./generators/round-robin";
export * from "./generators/gsl-group";
export * from "./generators/swiss-pairing-engine";
export * from "./standings/types";
export * from "./standings/round-robin";
export * from "./standings/swiss";
export * from "./resolution/resolve-match";
