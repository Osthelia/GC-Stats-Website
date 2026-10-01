/**
 * GC-Stats - settings-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export function SettingsCard({
  heading,
  description,
  children,
}: {
  heading: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h2 className="text-[17px] font-semibold text-neutral-50">{heading}</h2>
      {description && <p className="mt-1 text-[13.5px] leading-[1.6] text-neutral-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
