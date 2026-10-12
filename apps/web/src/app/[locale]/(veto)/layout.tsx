/**
 * GC-Stats — layout
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// Bare layout: the veto screen is opened by teams from a private link, without the site header.
export default function VetoLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1">{children}</main>;
}
