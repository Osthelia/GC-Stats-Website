// Cloudflare Workers build only (see next.config.mjs `resolveAlias`): sharp
// has native bindings and can never run on workerd. Aliased in so Next never
// resolves the real package (images.unoptimized means this should never be
// called at runtime — if it is, fail loudly instead of silently misbehaving).
export default function sharpStub() {
  throw new Error("sharp is not available on Cloudflare Workers");
}
