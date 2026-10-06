/**
 * GC-Stats — component
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/** Affiche un texte brut en transformant les URLs en vrais liens cliquables. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) => {
        if (index % 2 === 0) return part;
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <span key={index}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#e4ae22] underline underline-offset-2 transition-colors hover:text-[#f5c542] active:text-[#c99a1c]"
            >
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
