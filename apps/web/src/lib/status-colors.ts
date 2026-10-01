/**
 * GC-Stats - status-colors
 *
 * Status badge colors reused verbatim from V1: finished/completed = neutral
 * gray, live = red, upcoming/active = green. Plain Tailwind class strings
 * (not shadcn Badge `variant`s) so every admin list/detail view applies the
 * exact same colors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const GRAY = "bg-white/5 text-gray-400";
const RED = "bg-red-500/10 text-red-400";
const GREEN = "bg-green-500/10 text-green-400";

export function tournamentStatusBadgeClass(status: string): string {
  if (status === "live") return RED;
  if (status === "finished") return GRAY;
  return GREEN; // upcoming
}

export function tournamentActiveBadgeClass(active: boolean): string {
  return active ? GREEN : RED;
}

export function matchStatusBadgeClass(status: string): string {
  if (status === "live") return RED;
  if (status === "completed") return GRAY;
  return GREEN; // pending (upcoming)
}

export function stageContainerStatusBadgeClass(status: string): string {
  if (status === "active") return RED;
  if (status === "completed") return GRAY;
  return GREEN; // pending
}

export function mapCompletedBadgeClass(isCompleted: boolean): string {
  return isCompleted ? GRAY : GREEN;
}
