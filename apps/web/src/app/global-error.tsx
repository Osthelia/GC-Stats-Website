/**
 * GC-Stats - global-error
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

/**
 * Root-level fallback, only rendered if [locale]/layout.tsx itself throws.
 * No next-intl context reachable here, so both languages are shown at once
 * rather than guessing the locale.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "2rem",
          textAlign: "center",
          backgroundColor: "#0e0e0e",
          color: "#f2f2f2",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <style>{`.gcs-global-error-btn:hover { background-color: #1f1f1f; } .gcs-global-error-btn:active { transform: translateY(1px); }`}</style>
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.1em", color: "#7a7a7a" }}>500</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          Something went wrong / Une erreur est survenue
        </h1>
        <p style={{ color: "#9a9a9a", maxWidth: "28rem" }}>
          Please reload the page. / Veuillez recharger la page.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="gcs-global-error-btn"
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #232323",
            backgroundColor: "#161616",
            color: "#f2f2f2",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
          }}
        >
          Reload / Recharger
        </button>
      </body>
    </html>
  );
}
