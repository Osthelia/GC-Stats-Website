/**
 * GC-Stats - personal-data
 *
 * Building blocks of the /data page: principles, hosting providers and personal data categories.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">{children}</span>
  );
}

export function PrincipleCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-black/25 p-5">
      <div className="flex items-center gap-3">
        <IconTile>{icon}</IconTile>
        <h3 className="text-sm font-semibold tracking-tight text-neutral-50">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

export function HostingCard({ icon, name, location, children }: { icon: ReactNode; name: string; location: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-black/25 p-5">
      <div className="flex items-center gap-3">
        <IconTile>{icon}</IconTile>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-neutral-50">{name}</h3>
          <p className="text-[11px] font-medium text-neutral-500">{location}</p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

export function DataGroupHeading({ title, badge, isPublic, children }: { title: string; badge: string; isPublic: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight text-neutral-50">{title}</h2>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${
            isPublic ? "border-[#e4ae22]/40 text-[#e4ae22]" : "border-neutral-800 text-neutral-500"
          }`}
        >
          {badge}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

export type PersonalDataGroup = { label: string; items: string[] };
export type PersonalDataDetail = { label: string; value: string };

export function PersonalDataCard({ icon, title, groups, details }: { icon: ReactNode; title: string; groups: PersonalDataGroup[]; details: PersonalDataDetail[] }) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <IconTile>{icon}</IconTile>
        <h3 className="text-base font-semibold tracking-tight text-neutral-50">{title}</h3>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${groups.length > 1 ? "md:grid-cols-2" : ""}`}>
        {groups.map((group) => (
          <div key={group.label} className="rounded-xl bg-black/25 p-4">
            <p className="mb-2.5 text-[10px] font-bold tracking-wide text-neutral-500 uppercase">{group.label}</p>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-300">
                  <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#e4ae22]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <dl className="space-y-3 border-t border-neutral-800 pt-5">
        {details.map((detail) => (
          <div key={detail.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
            <dt className="text-[10px] font-bold tracking-wide text-neutral-500 uppercase sm:pt-0.5">{detail.label}</dt>
            <dd className="text-[13px] leading-relaxed text-neutral-400">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
