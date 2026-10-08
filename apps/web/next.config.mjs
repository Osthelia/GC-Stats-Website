import { fileURLToPath } from "node:url";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cloudflare Workers can't run sharp at all (native .node bindings, no
// workerd equivalent) — Next's own image optimizer must be fully disabled
// there (unoptimized: true) so no code path ever requires it, otherwise
// Next's output tracing still copies it in and wrangler's bundler fails to
// resolve it. Docker keeps real server side optimization via sharp.
//
// Deliberately a separate flag from `DEPLOY_TARGET` (only set by
// `cf-build`/`cross-env`, never at runtime): `DEPLOY_TARGET` is read by
// packages/db/src/client.ts and instrumentation.ts to pick Hyperdrive/Cron
// Triggers at REQUEST time — if it were also true during `next build`'s
// page-data collection (which executes route modules, e.g. `auth.ts`'s
// top level `DrizzleAdapter(db, ...)`), that code would try to reach
// `getCloudflareContext()` outside of any real request and crash the build.
const isCloudflareBuild = process.env.OPENNEXT_BUILD_TARGET === "cloudflare";

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
  images: isCloudflareBuild ? { unoptimized: true } : undefined,
  // sharp ships native (.node) bindings — must stay a real require() on the
  // server, not get pulled into a webpack/turbopack bundle.
  // pg-cloudflare and @cf-wasm/photon both have a "workerd" conditional
  // export (real implementation vs. a Node/default no-op or a .wasm file
  // Turbopack can't bundle at all) that Next's own file tracing/bundling
  // can't see — bundling them ourselves resolves to the wrong condition (or
  // fails outright on the .wasm import). Externalizing makes Next copy the
  // whole package instead and defers actual resolution to wrangler's own
  // bundling pass, which does understand the workerd condition and .wasm.
  serverExternalPackages: isCloudflareBuild ? ["pg", "pg-cloudflare", "@cf-wasm/photon"] : ["sharp"],
  turbopack: {
    resolveAlias: isCloudflareBuild
      ? {
          // `next/image`'s shared server chunk requires sharp regardless of
          // `images.unoptimized` (it's bundled into a chunk shared by every
          // page using next/image, not eliminated at build time) — Turbopack
          // has no way to tree-shake a `require()` away, so alias it to a
          // stub instead. Real native sharp can't be bundled for workerd.
          sharp: "./stubs/sharp-stub.js",
          // instrumentation.ts dynamically imports registry.ts (node-cron)
          // behind a `DEPLOY_TARGET !== "cloudflare"` runtime guard, but
          // Cloudflare validates the whole bundle's module-scope code on
          // deploy — merely being reachable in the bundle is enough for
          // node-cron's background-scheduled-task.ts to crash at startup.
          "node-cron": "./stubs/node-cron-stub.js",
          // Messages are fetched from static assets instead of bundled, see load-messages.cloudflare.ts.
          "@/i18n/load-messages": "./src/i18n/load-messages.cloudflare.ts",
        }
      : // @cf-wasm/photon/workerd (packages/storage/src/image-cloudflare.ts,
        // only reached at runtime when DEPLOY_TARGET=cloudflare) imports a
        // .wasm file the way Wrangler expects, which Turbopack can't bundle
        // for the Docker/Node target even behind a dynamic import — it still
        // needs to compile the chunk.
        { "@cf-wasm/photon/workerd": "./stubs/photon-stub.js", "@cf-wasm/photon": "./stubs/photon-stub.js" },
  },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [
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
  },
};

export default withNextIntl(nextConfig);
