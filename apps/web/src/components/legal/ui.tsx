/**
 * GC-Stats - ui
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";

export function LegalPageHeader({ title, lastUpdated }: { title: string; lastUpdated?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">{title}</h1>
      {lastUpdated && (
        <span className="rounded-full border border-neutral-800 bg-[var(--gcs-surface)] px-3 py-1 text-xs font-medium text-neutral-500">{lastUpdated}</span>
      )}
    </div>
  );
}

export function LegalIntro({ children }: { children: ReactNode }) {
  return <p className="mx-auto max-w-xl text-center text-[15px] leading-relaxed text-neutral-400">{children}</p>;
}

/** Small rounded icon tile — same shape language as team/tournament badges on the home page. */
function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22]">
      {children}
    </span>
  );
}

export function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <SectionIcon>{icon}</SectionIcon>
        <h2 className="text-base font-semibold tracking-tight text-neutral-50">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function SectionText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-neutral-400">{children}</p>;
}

export function SectionList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-400">
          <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#e4ae22]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-l-2 border-[#e4ae22] bg-black/25 px-4 py-3">
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

export function SmallCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-6">
      <h3 className="mb-2.5 text-sm font-semibold tracking-tight text-neutral-50">{title}</h3>
      <div className="text-sm leading-relaxed text-neutral-400">{children}</div>
    </div>
  );
}

export function InfoBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e4ae22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs leading-relaxed text-neutral-500">{children}</p>
    </div>
  );
}

export const icons = {
  id: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M14 10h4M14 14h4" />
    </svg>
  ),
  shield: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V6l8-3z" />
    </svg>
  ),
  database: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  ),
  server: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  ),
  cookie: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 109 9c-2 0-3-1-3-3s1.5-2.5.5-4C17.5 3.5 15 3 12 3z" />
      <path d="M8.5 10.5h.01M11 14h.01M14.5 15.5h.01" />
    </svg>
  ),
  heart: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  gavel: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6l4 4M5.5 14.5l4-4 4 4-4 4-4-4zM17.5 3.5l3 3-2 2-3-3 2-2zM3 21h9" />
    </svg>
  ),
  mail: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  chart: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10m7 10V4m7 16v-7" />
    </svg>
  ),
  link: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 15l6-6M8.5 8.5L10 7a3.5 3.5 0 015 5l-1.5 1.5M15.5 15.5L14 17a3.5 3.5 0 01-5-5l1.5-1.5" />
    </svg>
  ),
  layers: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />
    </svg>
  ),
  info: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </svg>
  ),
  key: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 4l3 3M13 7l2.5 2.5" />
    </svg>
  ),
  ban: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  ),
  code: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" />
    </svg>
  ),
  globe: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z" />
    </svg>
  ),
  discord: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  ),
  github: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58l-.01-2.04c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1-.11-.78.41-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.11-3.17 0 0 1-.33 3.3 1.23a11.5 11.5 0 016 0c2.28-1.56 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.21.69.82.57A12 12 0 0012 .3z" />
    </svg>
  ),
  coffee: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </svg>
  ),
  users: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  scale: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M7 21h10M5 7l-3 6a3.5 3.5 0 007 0L6 7zM19 7l-3 6a3.5 3.5 0 007 0l-4-6zM5 7h14M12 3l-3 4h6l-3-4z" />
    </svg>
  ),
};

export function ChannelCard({ icon, title, value, href }: { icon: ReactNode; title: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-4 rounded-2xl border border-neutral-800 bg-[var(--gcs-surface)] p-5 transition-colors hover:border-[#e4ae22]/60"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] text-[#e4ae22] transition-transform group-hover:scale-110">
        {icon}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold tracking-tight text-neutral-50">{title}</h4>
        <p className="truncate text-xs text-neutral-500">{value}</p>
      </div>
    </a>
  );
}
