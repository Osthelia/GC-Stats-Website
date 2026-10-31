/**
 * GC-Stats - image
 *
 * Renders an alert template to a PNG: Satori lays the layers out as SVG, sharp rasterizes it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lookup as dnsLookup } from "node:dns";
import https from "node:https";
import { isIP } from "node:net";
import satori from "satori";
import sharp from "sharp";
import { discordBackgroundUrl } from "@gc-stats/storage";
import { loadRenderFonts } from "./fonts";
import { GCS_SITE_URL } from "./shared";
import { conditionsPass, TEMPLATE_CANVAS, TEMPLATE_FONTS, TEMPLATE_FOOTER_HEIGHT, textLayerValue, type AlertTemplate, type TemplateFontId, type TemplateLayer } from "./template";

const ASSET_TIMEOUT_MS = 5000;
const ASSET_MAX_BYTES = 10 * 1024 * 1024;
// Rendered at twice the canvas size so the image stays sharp on high density screens.
const PIXEL_RATIO = 2;

export type AlertImageData = {
  /** Texts and raw values of the alert, the source of text layers and conditions. */
  fields: Record<string, string>;
  /** Picture URL per image source, null when there is none. */
  images: Record<string, string | null>;
  /** Language of the date texts. */
  locale: string;
  /** Link shown on the right of the footer. */
  footerUrl?: string;
};

type Node = { type: string; props: { style?: Record<string, unknown>; children?: Node | Node[] | string; src?: string } };
type Resize = { width: number; height: number; fit: "cover" | "contain" };
type Box = { x: number; y: number; width: number; height: number; opacity: number; rotation: number };

/** Groups of an IPv6 address expanded to 8 numbers, null when malformed. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase().split("%")[0] ?? "";
  // A trailing dotted IPv4 becomes two hex groups.
  const dotted = text.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [, head = "", a = 0, b = 0, c = 0, d = 0] = dotted;
    text = `${head}${((Number(a) << 8) | Number(b)).toString(16)}:${((Number(c) << 8) | Number(d)).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const side = (part: string | undefined) => (part ? part.split(":") : []);
  const head = side(halves[0]);
  const tail = side(halves[1]);
  const missing = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (missing < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isPrivateIpv4(a: number, b: number): boolean {
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const g = ipv6Groups(address);
    if (!g) return true;
    const [g0 = 0, g1 = 0, , , , g5 = 0, g6 = 0] = g;
    const zeroPrefix = g.slice(0, 5).every((x) => x === 0);
    // IPv4-mapped, IPv4-compatible and NAT64 addresses carry an IPv4 address in their last 32 bits.
    if ((zeroPrefix && (g5 === 0xffff || g5 === 0)) || (g0 === 0x64 && g1 === 0xff9b)) return isPrivateIpv4(g6 >> 8, g6 & 0xff);
    // Unspecified, loopback, unique local (fc00::/7) and link local (fe80::/10).
    return g.every((x, i) => x === 0 || (i === 7 && x === 1)) || (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80;
  }
  const [a = 0, b = 0] = address.split(".").map(Number);
  return isPrivateIpv4(a, b);
}

/** Body of a fetch response, null when it is larger than the asset limit. */
async function readLimited(response: Response): Promise<Buffer | null> {
  if (Number(response.headers.get("content-length")) > ASSET_MAX_BYTES || !response.body) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ASSET_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Downloads a user supplied image: https only, no redirect, and the address is checked at connection time so DNS cannot swap it afterwards. */
function fetchExternalImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const target = new URL(url);
      const host = target.hostname.replace(/^\[|\]$/g, "");
      if (target.protocol !== "https:" || (isIP(host) && isPrivateAddress(host))) return resolve(null);
      const request = https.get(target, {
        timeout: ASSET_TIMEOUT_MS,
        signal: AbortSignal.timeout(ASSET_TIMEOUT_MS),
        lookup: (hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          dnsLookup(hostname, { all: true }, (error, addresses) => {
            if (error) return callback(error);
            if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) return callback(new Error("private address"));
            if (options.all) return callback(null, addresses);
            callback(null, addresses[0]?.address, addresses[0]?.family);
          });
        },
      } as https.RequestOptions);
      request.on("response", (res) => {
        if (res.statusCode !== 200 || Number(res.headers["content-length"]) > ASSET_MAX_BYTES) {
          request.destroy();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > ASSET_MAX_BYTES) {
            request.destroy();
            return resolve(null);
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      });
      request.on("timeout", () => request.destroy());
      request.on("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** Image as a data URI Satori can embed (it cannot read webp), null when unreachable. */
async function toDataUri(url: string, resize?: Resize, external = false): Promise<string | null> {
  try {
    let input: Buffer | null;
    if (external) input = await fetchExternalImage(url);
    else {
      const response = await fetch(url, { signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
      input = response.ok ? await readLimited(response) : null;
    }
    if (!input) return null;
    let pipeline = sharp(input);
    if (resize) pipeline = pipeline.resize(Math.round(resize.width * PIXEL_RATIO), Math.round(resize.height * PIXEL_RATIO), { fit: resize.fit, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    return `data:image/png;base64,${(await pipeline.png().toBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function absolute(layer: Box): Record<string, unknown> {
  return {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    display: "flex",
    ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}),
    ...(layer.rotation !== 0 ? { transform: `rotate(${layer.rotation}deg)` } : {}),
  };
}

// Field the fallback tile of an image source draws its initials from, other sources show an empty tile.
const FALLBACK_NAME: Record<string, string> = { teamA: "teamA", teamB: "teamB", mvp: "mvp.name", mvpAgent: "mvp.agent" };

function fallbackTile(layer: Box, name: string, radius: number): Node {
  const size = Math.min(layer.width, layer.height);
  return {
    type: "div",
    props: {
      style: { ...absolute(layer), alignItems: "center", justifyContent: "center", backgroundColor: "#2a2d38", color: "#b8bcc8", borderRadius: radius, fontSize: size / 3, fontWeight: 700 },
      children: name ? initials(name) : "",
    },
  };
}

function border(width: number, color: string): Record<string, unknown> {
  return width > 0 ? { border: `${width}px solid ${color}`, boxSizing: "border-box" } : {};
}

function renderLayer(layer: TemplateLayer, data: AlertImageData, uri: string | null): Node {
  if (layer.type === "shape") {
    const fill = layer.color2 ? { backgroundImage: `linear-gradient(${layer.angle}deg, ${layer.color}, ${layer.color2})` } : { backgroundColor: layer.color };
    return { type: "div", props: { style: { ...absolute(layer), ...fill, borderRadius: layer.radius, ...border(layer.borderWidth, layer.borderColor) } } };
  }

  if (layer.type === "image") {
    if (!uri) return fallbackTile(layer, data.fields[FALLBACK_NAME[layer.source] ?? ""] ?? "", layer.radius);
    const inner = { width: Math.max(1, layer.width - layer.borderWidth * 2), height: Math.max(1, layer.height - layer.borderWidth * 2) };
    return {
      type: "div",
      props: {
        style: { ...absolute(layer), overflow: "hidden", borderRadius: layer.radius, ...border(layer.borderWidth, layer.borderColor) },
        children: { type: "img", props: { src: uri, style: { ...inner, objectFit: layer.fit } } },
      },
    };
  }

  const value = textLayerValue(layer, data.fields, data.locale);
  return {
    type: "div",
    props: {
      style: {
        ...absolute(layer),
        alignItems: "center",
        justifyContent: layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
        textAlign: layer.align,
        fontFamily: TEMPLATE_FONTS.find((f) => f.id === layer.font)?.name ?? "Inter",
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        color: layer.color,
        letterSpacing: layer.letterSpacing,
        lineHeight: layer.lineHeight,
        ...(layer.shadow ? { textShadow: `${layer.shadow.x}px ${layer.shadow.y}px ${layer.shadow.blur}px ${layer.shadow.color}` } : {}),
        whiteSpace: "pre-wrap",
        overflow: "hidden",
      },
      children: layer.uppercase ? value.toUpperCase() : value,
    },
  };
}

const FOOTER_GOLD = "#e4ae22";
const FOOTER_MUTED = "#8a8a94";

function renderFooter(data: AlertImageData, logo: string | null, top: number, width: number): Node {
  const label = { fontFamily: "Oswald", fontWeight: 700, fontSize: 20, textTransform: "uppercase", letterSpacing: 3 };
  return {
    type: "div",
    props: {
      style: { position: "absolute", left: 0, top, width, height: TEMPLATE_FOOTER_HEIGHT, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px" },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center" },
            children: [
              ...(logo ? [{ type: "img", props: { src: logo, style: { width: 26, height: 26, marginRight: 12 } } } as Node] : []),
              { type: "div", props: { style: { ...label, color: FOOTER_GOLD }, children: "GC Stats" } } as Node,
            ],
          },
        } as Node,
        { type: "div", props: { style: { ...label, fontWeight: 400, letterSpacing: 1, textTransform: "none", color: FOOTER_MUTED }, children: data.footerUrl ?? "" } } as Node,
      ],
    },
  };
}

/** PNG of the template filled with the match data. */
export async function renderTemplateImage(template: AlertTemplate, data: AlertImageData): Promise<Buffer> {
  const { width } = TEMPLATE_CANVAS;
  const height = template.height + (template.footer ? TEMPLATE_FOOTER_HEIGHT : 0);
  // Layers whose conditions fail are neither drawn nor loaded.
  const layers = template.layers.filter((l) => conditionsPass(l.visible, data.fields));
  const usedFonts = new Set<TemplateFontId>(layers.flatMap((l) => (l.type === "text" ? [l.font] : [])));
  if (template.footer) usedFonts.add("oswald");

  const artworkUrl = template.artwork.enabled && !template.backgroundImageId ? (data.images[template.artwork.source] ?? null) : null;
  const backgroundUrl = template.backgroundImageId ? discordBackgroundUrl(template.backgroundImageId) : artworkUrl;

  // Layers showing the same picture at the same size share one download.
  const assets = new Map<string, Promise<string | null>>();
  const load = (url: string | null | undefined, resize: Resize, external = false): Promise<string | null> => {
    if (!url) return Promise.resolve(null);
    const key = `${url}|${resize.width}x${resize.height}|${resize.fit}`;
    let loaded = assets.get(key);
    if (!loaded) {
      loaded = toDataUri(url, resize, external);
      assets.set(key, loaded);
    }
    return loaded;
  };

  const [fonts, background, footerLogo, uris] = await Promise.all([
    loadRenderFonts(usedFonts),
    load(backgroundUrl, { width, height: template.height, fit: "cover" }),
    template.footer ? load(`${GCS_SITE_URL}/favicon.svg`, { width: 64, height: 64, fit: "contain" }) : null,
    Promise.all(
      layers.map((l) => {
        if (l.type === "image") return l.source === "custom" ? load(l.url, { width: l.width, height: l.height, fit: l.fit }, true) : load(data.images[l.source], { width: l.width, height: l.height, fit: l.fit });
        return null;
      }),
    ),
  ]);

  const dim = template.artwork.dim;
  const shade = (alpha: number) => `rgba(14,14,14,${Math.min(1, Math.max(0, alpha)).toFixed(2)})`;
  const root: Node = {
    type: "div",
    props: {
      style: { display: "flex", position: "relative", width, height, backgroundColor: template.backgroundColor, fontFamily: "Inter" },
      children: [
        ...(background ? [{ type: "img", props: { src: background, style: { position: "absolute", left: 0, top: 0, width, height: template.height } } } as Node] : []),
        // Darkens the artwork so the texts stay readable.
        ...(background && artworkUrl
          ? [{ type: "div", props: { style: { position: "absolute", left: 0, top: 0, width, height, display: "flex", backgroundImage: `linear-gradient(180deg, ${shade(dim - 0.15)} 0%, ${shade(dim + 0.15)} 100%)` } } } as Node]
          : []),
        ...layers.map((layer, i) => renderLayer(layer, data, uris[i] ?? null)),
        ...(template.footer ? [renderFooter(data, footerLogo, template.height, width)] : []),
      ],
    },
  };

  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts });
  return sharp(Buffer.from(svg), { density: 72 * PIXEL_RATIO }).png().toBuffer();
}
