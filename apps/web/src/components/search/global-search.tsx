/**
 * GC-Stats - global-search
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { stripAccents } from "@/lib/search-typo";
import type { SearchResultItem, SearchResultType, SearchResults } from "@/lib/search";

const EMPTY_RESULTS: SearchResults = { team: [], player: [], tournament: [], organization: [] };
const TYPE_ORDER: SearchResultType[] = ["team", "player", "tournament", "organization"];
const RECENT_KEY = "gcs_recent_searches";
const RECENT_MAX = 5;
const MIN_QUERY_LENGTH = 2;

type RecentEntry = { title: string; path: string; type: SearchResultType };

function loadRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private browsing, quota): recent search history is a convenience, not a requirement, so silently skip persisting it.
  }
}

/** Splits `title` around the first case/accent-insensitive occurrence of `query`, for a <mark>-style highlight without dangerouslySetInnerHTML. */
function splitMatch(title: string, query: string): [string, string, string] | null {
  if (query.length < MIN_QUERY_LENGTH) return null;
  const normalizedTitle = stripAccents(title.toLowerCase());
  const normalizedQuery = stripAccents(query.toLowerCase());
  const index = normalizedTitle.indexOf(normalizedQuery);
  if (index === -1) return null;
  return [title.slice(0, index), title.slice(index, index + normalizedQuery.length), title.slice(index + normalizedQuery.length)];
}

function ResultAvatar({ item }: { item: SearchResultItem }) {
  const [failed, setFailed] = useState(false);
  const avatarClass = "h-7 w-7 flex-none rounded-md border border-neutral-800 bg-[var(--gcs-surface-2)] object-contain";
  const light = item.logoUrlLight ?? item.logoUrl;

  if (item.logoUrl && !failed) {
    if (light && light !== item.logoUrl) {
      return (
        <>
          <img src={item.logoUrl} alt="" loading="lazy" className={`${avatarClass} site-light:hidden`} onError={() => setFailed(true)} />
          <img src={light} alt="" loading="lazy" className={`hidden ${avatarClass} site-light:block`} onError={() => setFailed(true)} />
        </>
      );
    }
    return <img src={item.logoUrl} alt="" loading="lazy" className={avatarClass} onError={() => setFailed(true)} />;
  }

  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-neutral-800 bg-[var(--gcs-surface-2)] text-[11px] font-black text-neutral-500 uppercase">
      {item.title.charAt(0)}
    </span>
  );
}

function ResultRow({
  item,
  query,
  active,
  onNavigate,
  onHover,
}: {
  item: SearchResultItem;
  query: string;
  active: boolean;
  onNavigate: (item: SearchResultItem) => void;
  onHover: () => void;
}) {
  const match = splitMatch(item.title, query);

  return (
    <button
      type="button"
      data-search-item
      onMouseDown={(e) => {
        e.preventDefault();
        onNavigate(item);
      }}
      onMouseEnter={onHover}
      className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-3.5 py-2.5 text-left text-[13px] text-[var(--gcs-text-dim)] transition-colors hover:border-[#e4ae22]/50 hover:bg-[var(--gcs-hover-2)] hover:text-[var(--gcs-text)]"
      style={active ? { borderLeftColor: "#e4ae22", background: "var(--gcs-hover)", color: "var(--gcs-text)" } : undefined}
    >
      <ResultAvatar item={item} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        {match ? (
          <>
            {match[0]}
            <mark className="bg-transparent text-[#e4ae22]">{match[1]}</mark>
            {match[2]}
          </>
        ) : (
          item.title
        )}
      </span>
      {item.subtitle && <span className="flex-none truncate text-xs text-[var(--gcs-text-tertiary)]">{item.subtitle}</span>}
    </button>
  );
}

export function GlobalSearch() {
  const t = useTranslations("globalSearch");
  const tTypes = useTranslations("globalSearch.type");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setRecent(loadRecent()), []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

  // "/" and Ctrl/Cmd+K jump focus into the search box from anywhere on the
  // page, same shortcuts as V1's global search bar, skipped while another
  // input/textarea already has focus so "/" still types normally there.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Search failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults({ ...EMPTY_RESULTS, ...(data as Partial<SearchResults>) });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults(EMPTY_RESULTS);
        })
        .finally(() => {
          // Une requête obsolète ne doit pas couper le chargement de la requête en cours
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const flatItems = query.trim().length >= MIN_QUERY_LENGTH ? TYPE_ORDER.flatMap((type) => results[type]) : [];
  const totalResults = flatItems.length;

  function pushRecent(entry: RecentEntry) {
    const updated = [entry, ...recent.filter((r) => r.path !== entry.path)].slice(0, RECENT_MAX);
    setRecent(updated);
    saveRecent(updated);
  }

  function goTo(path: string) {
    setOpen(false);
    setActiveIndex(-1);
    setQuery("");
    router.push(`/${path}`);
  }

  function navigateToItem(item: SearchResultItem) {
    pushRecent({ title: item.title, path: item.path, type: item.type });
    goTo(item.path);
  }

  function navigateToRecent(entry: RecentEntry) {
    pushRecent(entry);
    goTo(entry.path);
  }

  function submitSearch() {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    const showingRecent = query.trim().length < MIN_QUERY_LENGTH;
    const count = showingRecent ? recent.length : flatItems.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count > 0) setActiveIndex((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count > 0) setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && showingRecent && recent[activeIndex]) navigateToRecent(recent[activeIndex]);
      else if (activeIndex >= 0 && !showingRecent && flatItems[activeIndex]) navigateToItem(flatItems[activeIndex]);
      else submitSearch();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  const showRecentPanel = open && query.trim().length < MIN_QUERY_LENGTH && recent.length > 0;
  const showResultsPanel = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={rootRef} className="relative flex h-[38px] min-w-10 flex-[0_1_480px]">
      <div className="group relative flex w-full items-center">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gcs-text-tertiary)"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3.5 flex-none group-focus-within:stroke-[#e4ae22]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.6-3.6" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showRecentPanel || showResultsPanel}
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-label={t("ariaLabel")}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          className="h-[38px] w-full min-w-0 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] py-2 pr-16 pl-9 text-sm text-neutral-50 outline-none placeholder:text-[var(--gcs-text-tertiary)] focus:border-[#e4ae22]/40"
        />

        {loading ? (
          <span className="absolute right-3 h-3 w-3 flex-none animate-spin rounded-full border-2 border-[#e4ae22] border-t-transparent" role="status" aria-label={t("searching")} />
        ) : (
          !open && (
            <kbd className="pointer-events-none absolute right-3 hidden rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] leading-none text-neutral-600 lg:block">Ctrl K</kbd>
          )
        )}
      </div>

      {showRecentPanel && (
        <div
          id="global-search-results"
          className="absolute top-[46px] right-0 left-0 z-[70] overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-3.5 py-2">
            <span className="text-[10px] font-black tracking-[0.2em] text-[#e4ae22]/80 uppercase">{t("recentSearches")}</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setRecent([]);
                saveRecent([]);
              }}
              className="text-[10px] tracking-widest text-neutral-600 uppercase transition-colors hover:text-neutral-400"
            >
              {t("clear")}
            </button>
          </div>
          {recent.map((entry, i) => (
            <button
              key={entry.path}
              type="button"
              data-search-item
              onMouseDown={(e) => {
                e.preventDefault();
                navigateToRecent(entry);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-3.5 py-2.5 text-left text-[13px] font-semibold text-[var(--gcs-text-dim)] transition-colors hover:border-[#e4ae22]/50 hover:bg-[var(--gcs-hover-2)] hover:text-[var(--gcs-text)]"
              style={activeIndex === i ? { borderLeftColor: "#e4ae22", background: "var(--gcs-hover)", color: "var(--gcs-text)" } : undefined}
            >
              <span className="min-w-0 flex-1 truncate">{entry.title}</span>
              <span className="flex-none text-[10px] tracking-widest text-neutral-600 uppercase">{tTypes(entry.type)}</span>
            </button>
          ))}
        </div>
      )}

      {showResultsPanel && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label={t("ariaLabel")}
          className="absolute top-[46px] right-0 left-0 z-[70] max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-[var(--gcs-surface-3)] shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
        >
          {totalResults === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-[13px] font-semibold text-neutral-500">{t("noResults", { query: query.trim() })}</div>
          ) : (
            <>
              {TYPE_ORDER.map((type) => {
                const items = results[type];
                if (items.length === 0) return null;
                let indexOffset = 0;
                for (const t2 of TYPE_ORDER) {
                  if (t2 === type) break;
                  indexOffset += results[t2].length;
                }
                return (
                  <div key={type}>
                    <div className="border-b border-neutral-800 bg-white/[0.02] px-3.5 py-1.5 text-[10px] font-black tracking-[0.2em] text-[#e4ae22]/80 uppercase">{tTypes(type)}</div>
                    {items.map((item, i) => (
                      <ResultRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        query={query}
                        active={activeIndex === indexOffset + i}
                        onNavigate={navigateToItem}
                        onHover={() => setActiveIndex(indexOffset + i)}
                      />
                    ))}
                  </div>
                );
              })}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submitSearch();
                }}
                className="flex w-full items-center justify-center gap-2 border-t border-neutral-800 bg-white/[0.02] px-4 py-2.5 text-[11px] font-black tracking-widest text-[#e4ae22] uppercase transition-colors hover:bg-[var(--gcs-hover)]"
              >
                {t("seeMore")}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
