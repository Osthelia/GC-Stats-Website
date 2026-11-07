/**
 * GC-Stats - rating-value
 *
 * GCS rating display, colored like HLTV: green above 1.10, red under 0.90.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const RATING_GOOD = 1.1;
export const RATING_BAD = 0.9;

export function ratingTone(rating: number): string {
  if (rating >= RATING_GOOD) return "text-green-400";
  if (rating <= RATING_BAD) return "text-red-400/80";
  return "text-[var(--gcs-text)]";
}

export function RatingValue({ rating, className = "" }: { rating: number | null | undefined; className?: string }) {
  if (rating == null || !Number.isFinite(rating)) return <span className={`text-neutral-600 ${className}`}>-</span>;
  return <span className={`font-mono font-bold tabular-nums ${ratingTone(rating)} ${className}`}>{rating.toFixed(2)}</span>;
}
