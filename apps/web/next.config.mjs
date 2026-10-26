import { fileURLToPath } from "node:url";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone server bundle for Docker: copies only the traced
  // node_modules subset into .next/standalone, no need to ship the whole
  // monorepo node_modules into the runtime image.
  output: "standalone",
  // Monorepo: trace file dependencies from the repo root (two levels up),
  // not just apps/web, so npm workspace hoisted deps resolve correctly.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // @gc-stats/db and @gc-stats/storage ship raw .ts source (no build step) —
  // Next.js otherwise skips transpiling anything resolved from
  // node_modules/workspace symlinks.
  transpilePackages: ["@gc-stats/db", "@gc-stats/storage"],
  // sharp ships native (.node) bindings — must stay a real require() on the
  // server, not get pulled into a webpack/turbopack bundle.
  serverExternalPackages: ["sharp"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Build-time CDN host for /_next/static (a pull zone whose origin is the app). Unset = served by the app.
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  // Old endpoint kept temporarly
  async rewrites() {
    return [{ source: "/api/:version(v\\d+)/:path*", destination: "/api/valorant/:version/:path*" }];
  },
  async headers() {
    return [
      // Fonts and chunks fetched cross-origin from the CDN host need CORS.
      ...(process.env.ASSET_PREFIX
        ? [{ source: "/_next/static/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }]
        : []),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        // Anti clickjacking everywhere (OAuth consent, admin, dashboard).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  experimental: {
    // Enables the forbidden()/unauthorized() functions and their
    // forbidden.tsx/unauthorized.tsx pages.
    authInterrupts: true,
    // Default is 1 MB; image uploads accept up to 10 MB (MAX_IMAGE_BYTES) plus multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default withNextIntl(nextConfig);
