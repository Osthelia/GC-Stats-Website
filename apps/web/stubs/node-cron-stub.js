// Cloudflare Workers build only (see next.config.mjs `resolveAlias`):
// node-cron crashes at Worker startup just by being bundled — its
// background-scheduled-task.ts calls fileURLToPath(import.meta.url) at
// module scope, unsupported under workerd. Never actually reached at
// runtime there (instrumentation.ts guards it behind DEPLOY_TARGET), but
// Cloudflare validates the whole bundle's module-scope code on deploy.
export default {
  schedule() {
    throw new Error("node-cron is not available on Cloudflare Workers");
  },
};
