/**
 * GC-Stats - gc-stats-wordmark
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const STATS_LETTERS = "Stats".split("");

/**
 * "GC Stats" wordmark shared by the header and footer logos. "Stats" is
 * split into per-letter spans so the pride accent (accents/pride.css) can
 * tint each one, the classic letter-by-letter pride-logo treatment.
 */
export function GcStatsWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      GC{" "}
      <span className="gcs-wordmark">
        {STATS_LETTERS.map((letter, i) => (
          <span key={i} className="gcs-letter">
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
