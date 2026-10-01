// Docker build only (see next.config.mjs `resolveAlias`): @cf-wasm/photon's
// "workerd" entry imports a .wasm file the way Wrangler expects, which
// Turbopack can't bundle for a plain Node target. Aliased in so Next never
// resolves the real package (packages/storage/src/image.ts only reaches
// image-cloudflare.ts when DEPLOY_TARGET=cloudflare, never on Docker — but
// Turbopack still needs to compile the dynamically imported chunk).
export class PhotonImage {
  static new_from_byteslice() {
    throw new Error("@cf-wasm/photon is Cloudflare Workers only");
  }
  get_width() {
    throw new Error("@cf-wasm/photon is Cloudflare Workers only");
  }
  get_height() {
    throw new Error("@cf-wasm/photon is Cloudflare Workers only");
  }
  get_bytes_webp() {
    throw new Error("@cf-wasm/photon is Cloudflare Workers only");
  }
  free() {}
}

export const SamplingFilter = { Lanczos3: 5 };

export function resize() {
  throw new Error("@cf-wasm/photon is Cloudflare Workers only");
}

export function crop() {
  throw new Error("@cf-wasm/photon is Cloudflare Workers only");
}
