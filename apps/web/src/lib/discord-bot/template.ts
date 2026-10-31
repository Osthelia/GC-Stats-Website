/**
 * GC-Stats - template
 *
 * Model of an alert image: a background and positioned layers, validated on
 * every save. Shared by the renderer, the server actions and the editor.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { z } from "zod";
import { DISCORD_BOT_COLOR_PATTERN, type DiscordBotColorKey } from "./shared";

// `height` is the default one, each template stores its own (up to `maxHeight`).
export const TEMPLATE_CANVAS = { width: 1000, height: 400 } as const;
export const TEMPLATE_LIMITS = {
  layers: 80,
  folders: 20,
  folderName: 40,
  customText: 200,
  minFontSize: 8,
  maxFontSize: 300,
  minHeight: 300,
  maxHeight: 900,
  conditions: 5,
} as const;
// Extra band under the canvas when the footer is on.
export const TEMPLATE_FOOTER_HEIGHT = 48;

// Weights shipped for every font of the library.
export const TEMPLATE_FONT_WEIGHTS = [400, 700] as const;

export const MAP_KEYS = ["map1", "map2", "map3", "map4", "map5"] as const;
export const VETO_KEYS = ["veto1", "veto2", "veto3", "veto4", "veto5", "veto6", "veto7"] as const;
export type MapKey = (typeof MAP_KEYS)[number];
export type VetoKey = (typeof VETO_KEYS)[number];

// Ready made texts a text layer can show, grouped for the editor. "custom" builds its own from variables.
export const TEMPLATE_TEXT_FIELD_GROUPS = [
  {
    group: "match",
    fields: ["tournament", "stage", "status", "bestOf", "bestOfShort"],
  },
  { group: "teams", fields: ["teamA", "teamB", "teamAShort", "teamBShort"] },
  { group: "score", fields: ["score", "scoreA", "scoreB", "matchScore"] },
  {
    group: "maps",
    fields: ["map", ...MAP_KEYS, "maps", "mapsInline", "vetos"],
  },
  { group: "mvp", fields: ["mvp", "mvpA", "mvpB"] },
  { group: "schedule", fields: ["dateTime", "date", "time"] },
] as const;
export type TemplateTextField = (typeof TEMPLATE_TEXT_FIELD_GROUPS)[number]["fields"][number] | "custom";
export const TEMPLATE_TEXT_FIELDS = [...TEMPLATE_TEXT_FIELD_GROUPS.flatMap((g) => g.fields), "custom"] as unknown as [TemplateTextField, ...TemplateTextField[]];

// Zones offered for the date and time texts.
export const TEMPLATE_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
] as const;
export type TemplateTimezone = (typeof TEMPLATE_TIMEZONES)[number];

// Pictures an image layer (or the artwork) can show. "custom" is an external URL, nothing is uploaded.
export const TEMPLATE_IMAGE_SOURCES = ["teamA", "teamB", "mvp", "mvpAgent", "mapCurrent", ...MAP_KEYS, ...VETO_KEYS, "custom"] as const;
export type TemplateImageSource = (typeof TEMPLATE_IMAGE_SOURCES)[number];
export const TEMPLATE_ARTWORK_SOURCES = ["mapCurrent", ...MAP_KEYS, ...VETO_KEYS] as const;

type VariableGroup = { group: string; keys: readonly string[] };

// Picture families of the image picker, each one has its own default size.
export const TEMPLATE_IMAGE_CATEGORIES = [
  {
    category: "teams",
    sources: ["teamA", "teamB"],
    size: { width: 130, height: 130 },
    fit: "contain",
  },
  {
    category: "mvp",
    sources: ["mvp", "mvpAgent"],
    size: { width: 56, height: 56 },
    fit: "cover",
  },
  {
    category: "maps",
    sources: ["mapCurrent", ...MAP_KEYS],
    size: { width: 240, height: 135 },
    fit: "cover",
  },
  {
    category: "vetos",
    sources: [...VETO_KEYS],
    size: { width: 118, height: 72 },
    fit: "cover",
  },
  {
    category: "custom",
    sources: ["custom"],
    size: { width: 240, height: 135 },
    fit: "contain",
  },
] as const satisfies readonly {
  category: string;
  sources: readonly TemplateImageSource[];
  size: { width: number; height: number };
  fit: "cover" | "contain";
}[];

export function imageCategoryOf(source: TemplateImageSource) {
  return TEMPLATE_IMAGE_CATEGORIES.find((c) => (c.sources as readonly string[]).includes(source)) ?? TEMPLATE_IMAGE_CATEGORIES[0];
}

/** Largest custom image URL a layer stores. */
export const TEMPLATE_IMAGE_URL_MAX = 500;

/** Variables usable in a custom text as `{name}`, grouped for the editor. */
export const TEMPLATE_VARIABLE_GROUPS: readonly VariableGroup[] = [
  {
    group: "match",
    keys: ["tournament", "stage", "status", "bestOf", "bestOfShort", "score", "scoreA", "scoreB", "matchScore"],
  },
  { group: "teams", keys: ["teamA", "teamB", "teamAShort", "teamBShort"] },
  { group: "schedule", keys: ["dateTime", "date", "time"] },
  {
    group: "alert",
    keys: ["map", "currentMap.name", "currentMap.number", "maps", "mapsInline", "vetos"],
  },
  {
    group: "mvp",
    keys: ["mvp", "mvpA", "mvpB", "mvp.name", "mvp.acs", "mvp.agent", "mvpA.name", "mvpA.acs", "mvpA.agent", "mvpB.name", "mvpB.acs", "mvpB.agent"],
  },
  ...MAP_KEYS.map((k) => ({
    group: k,
    keys: [k, `${k}.name`, `${k}.score`, `${k}.scoreA`, `${k}.scoreB`],
  })),
  ...VETO_KEYS.map((k) => ({
    group: k,
    keys: [`${k}.map`, `${k}.action`, `${k}.team`, `${k}.side`],
  })),
];

// Date texts depend on the layer time zone, a condition tests the raw date instead.
const DATE_VARIABLES = new Set(["dateTime", "date", "time"]);
// Raw values that are only worth testing, the texts above already say them in words.
const CONDITION_ONLY_KEYS: Record<string, readonly string[]> = {
  alert: ["alert.kind"],
  ...Object.fromEntries(VETO_KEYS.map((k) => [k, [`${k}.type`]])),
};
export const TEMPLATE_CONDITION_GROUPS: readonly VariableGroup[] = TEMPLATE_VARIABLE_GROUPS.map((g) => ({
  ...g,
  keys: g.keys.filter((k) => !DATE_VARIABLES.has(k)),
})).map((g) => (g.group === "schedule" ? { ...g, keys: ["scheduledAt"] } : { ...g, keys: [...g.keys, ...(CONDITION_ONLY_KEYS[g.group] ?? [])] }));
export const TEMPLATE_CONDITION_KEYS: readonly string[] = TEMPLATE_CONDITION_GROUPS.flatMap((g) => g.keys);
const conditionKeySet = new Set(TEMPLATE_CONDITION_KEYS);

// Fixed values a visibility condition picks from, the other keys take free text.
const RAW_CONDITION_VALUES: Record<string, readonly string[]> = {
  "alert.kind": ["live", "finished", "map"],
  ...Object.fromEntries(VETO_KEYS.flatMap((k) => [[`${k}.type`, ["ban", "pick", "decider"]]])),
};

/** Values to pick from for a condition key, null when it takes free text. */
export function conditionValues(key: string): readonly string[] | null {
  return RAW_CONDITION_VALUES[key] ?? null;
}

export const TEMPLATE_FONTS = [
  { id: "inter", name: "Inter", pkg: "inter", weights: [400, 700] },
  { id: "roboto", name: "Roboto", pkg: "roboto", weights: [400, 700] },
  {
    id: "montserrat",
    name: "Montserrat",
    pkg: "montserrat",
    weights: [400, 700],
  },
  { id: "poppins", name: "Poppins", pkg: "poppins", weights: [400, 700] },
  { id: "oswald", name: "Oswald", pkg: "oswald", weights: [400, 700] },
  { id: "bebas-neue", name: "Bebas Neue", pkg: "bebas-neue", weights: [400] },
  { id: "rajdhani", name: "Rajdhani", pkg: "rajdhani", weights: [400, 700] },
  { id: "orbitron", name: "Orbitron", pkg: "orbitron", weights: [400, 700] },
  { id: "russo-one", name: "Russo One", pkg: "russo-one", weights: [400] },
  {
    id: "barlow-condensed",
    name: "Barlow Condensed",
    pkg: "barlow-condensed",
    weights: [400, 700],
  },
  { id: "teko", name: "Teko", pkg: "teko", weights: [400, 700] },
  { id: "anton", name: "Anton", pkg: "anton", weights: [400] },
] as const;
export type TemplateFontId = (typeof TEMPLATE_FONTS)[number]["id"];

const fontIds = TEMPLATE_FONTS.map((f) => f.id) as [TemplateFontId, ...TemplateFontId[]];
const color = z.string().regex(DISCORD_BOT_COLOR_PATTERN);
const coord = (max: number) => z.number().finite().min(0).max(max);
const box = {
  x: coord(TEMPLATE_CANVAS.width),
  y: coord(TEMPLATE_LIMITS.maxHeight),
  width: z.number().finite().min(1).max(TEMPLATE_CANVAS.width),
  height: z.number().finite().min(1).max(TEMPLATE_LIMITS.maxHeight),
};

const condition = z.object({
  key: z.string().refine((k) => conditionKeySet.has(k)),
  op: z.enum(["is", "isNot", "exists", "empty"]),
  // Only read by "is" and "isNot".
  value: z.string().max(40),
});
export type TemplateCondition = z.infer<typeof condition>;

const shadow = z
  .object({
    color,
    blur: z.number().finite().min(0).max(40),
    x: z.number().finite().min(-30).max(30),
    y: z.number().finite().min(-30).max(30),
  })
  .nullable()
  .default(null);

// Every layer can be faded, rotated, locked, put in a folder and shown only when all its conditions pass.
const common = {
  id: z.string().min(1).max(40),
  ...box,
  folderId: z.string().min(1).max(40).nullable().default(null),
  locked: z.boolean().default(false),
  opacity: z.number().finite().min(0).max(1).default(1),
  rotation: z.number().finite().min(-180).max(180).default(0),
  visible: z.array(condition).max(TEMPLATE_LIMITS.conditions).default([]),
};

const textLayer = z.object({
  ...common,
  type: z.literal("text"),
  field: z.enum(TEMPLATE_TEXT_FIELDS),
  // Only read when `field` is "custom", may contain `{variable}` tokens.
  text: z.string().max(TEMPLATE_LIMITS.customText),
  font: z.enum(fontIds),
  fontSize: z.number().finite().min(TEMPLATE_LIMITS.minFontSize).max(TEMPLATE_LIMITS.maxFontSize),
  fontWeight: z.union([z.literal(400), z.literal(700)]),
  color,
  align: z.enum(["left", "center", "right"]),
  uppercase: z.boolean(),
  // Zone of the date and time texts.
  timezone: z.enum(TEMPLATE_TIMEZONES).default("UTC"),
  letterSpacing: z.number().finite().min(-5).max(40).default(0),
  lineHeight: z.number().finite().min(0.8).max(3).default(1.2),
  shadow,
});

const imageLayer = z.object({
  ...common,
  type: z.literal("image"),
  source: z.enum(TEMPLATE_IMAGE_SOURCES),
  // Only read when `source` is "custom", an external https address.
  url: z.union([z.literal(""), z.string().max(TEMPLATE_IMAGE_URL_MAX).url().startsWith("https://")]).default(""),
  fit: z.enum(["cover", "contain"]),
  radius: z.number().finite().min(0).max(500),
  borderColor: color,
  borderWidth: z.number().finite().min(0).max(30),
});

const shapeLayer = z.object({
  ...common,
  type: z.literal("shape"),
  color,
  // Second color of a linear gradient, null for a flat shape.
  color2: color.nullable().default(null),
  angle: z.number().finite().min(0).max(360).default(90),
  radius: z.number().finite().min(0).max(500),
  borderColor: color.default("#ffffff"),
  borderWidth: z.number().finite().min(0).max(30).default(0),
});

// Team logos used to be their own layer type, they are now image layers.
function migrateLayer(layer: unknown): unknown {
  if (typeof layer !== "object" || layer === null || (layer as { type?: unknown }).type !== "logo") return layer;
  const { side, ...rest } = layer as { side?: string };
  return {
    ...rest,
    type: "image",
    source: side === "b" ? "teamB" : "teamA",
    fit: "contain",
    radius: 0,
    borderColor: "#ffffff",
    borderWidth: 0,
  };
}

const layerSchema = z.preprocess(migrateLayer, z.discriminatedUnion("type", [textLayer, imageLayer, shapeLayer]));

// Folders only group layers in the editor list (and lock them together), they do not change the drawing.
const folderSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(TEMPLATE_LIMITS.folderName),
  locked: z.boolean().default(false),
  collapsed: z.boolean().default(false),
  // Layer an empty folder is shown above in the list, null for the top.
  anchor: z.string().max(40).nullable().default(null),
});
export type TemplateFolder = z.infer<typeof folderSchema>;

export const templateSchema = z
  .object({
    // Templates saved before these fields existed keep the original canvas, without footer.
    height: z.number().int().min(TEMPLATE_LIMITS.minHeight).max(TEMPLATE_LIMITS.maxHeight).default(TEMPLATE_CANVAS.height),
    footer: z.boolean().default(false),
    // Picture behind the layers, darkened by `dim`. A custom background image wins over it.
    artwork: z
      .object({
        enabled: z.boolean(),
        source: z.enum(TEMPLATE_ARTWORK_SOURCES),
        dim: z.number().finite().min(0).max(1),
      })
      .default({ enabled: true, source: "mapCurrent", dim: 0.7 }),
    backgroundColor: color,
    // Custom background (custom bot only), a stored image id.
    backgroundImageId: z.string().uuid().nullable(),
    layers: z.array(layerSchema).max(TEMPLATE_LIMITS.layers),
    folders: z.array(folderSchema).max(TEMPLATE_LIMITS.folders).default([]),
  })
  .superRefine((template, ctx) => {
    const ids = new Set<string>();
    template.folders.forEach((folder, i) => {
      if (ids.has(folder.id))
        ctx.addIssue({
          code: "custom",
          path: ["folders", i, "id"],
          message: "Duplicate folder id",
        });
      ids.add(folder.id);
    });
    template.layers.forEach((layer, i) => {
      if (layer.folderId !== null && !ids.has(layer.folderId))
        ctx.addIssue({
          code: "custom",
          path: ["layers", i, "folderId"],
          message: "Unknown folder",
        });
    });
  });

export type AlertTemplate = z.infer<typeof templateSchema>;
export type TemplateLayer = AlertTemplate["layers"][number];
export type TemplateTextLayer = z.infer<typeof textLayer>;
export type TemplateImageLayer = z.infer<typeof imageLayer>;
export type TemplateShapeLayer = z.infer<typeof shapeLayer>;

export function fontSupportsWeight(font: TemplateFontId, weight: number): boolean {
  return (TEMPLATE_FONTS.find((f) => f.id === font)?.weights as readonly number[] | undefined)?.includes(weight) ?? false;
}

/** True when every condition of a layer passes for these values. */
export function conditionsPass(conditions: readonly TemplateCondition[], values: Record<string, string>): boolean {
  return conditions.every((c) => {
    const v = values[c.key] ?? "";
    if (c.op === "is") return v === c.value;
    if (c.op === "isNot") return v !== c.value;
    return c.op === "exists" ? v !== "" : v === "";
  });
}

/** Replaces `{variable}` tokens, unknown ones become empty. */
export function interpolate(text: string, values: Record<string, string>): string {
  return text.replace(/\{([\w.]+)\}/g, (_, key: string) => values[key] ?? "");
}

/** Date and time texts of a match start (ISO string) in a zone, empty when it is not scheduled. */
function scheduleValues(iso: string, timezone: string, locale: string): Record<string, string> {
  const empty = { date: "", time: "", dateTime: "" };
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return empty;
  try {
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: timezone,
    }).format(at);
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timezone,
    }).format(at);
    return { date, time, dateTime: `${date}, ${time}` };
  } catch {
    return empty;
  }
}

/** A text layer showing a ready made field becomes the equivalent free text, so the editor only deals with free text. */
export function toFreeText(layer: TemplateLayer): TemplateLayer {
  return layer.type === "text" && layer.field !== "custom" ? { ...layer, field: "custom", text: `{${layer.field}}` } : layer;
}

const ANCHOR_RATIO = { left: 0, center: 0.5, right: 1 } as const;

/** X where the text starts (left), is centered or ends (right), whatever its length. */
export function textAnchorX(layer: Pick<TemplateTextLayer, "x" | "width" | "align">): number {
  return Math.round(layer.x + layer.width * ANCHOR_RATIO[layer.align]);
}

/** Box position that puts the text anchor on `anchorX` for this alignment. */
export function textBoxX(layer: Pick<TemplateTextLayer, "width">, align: TemplateTextLayer["align"], anchorX: number): number {
  return Math.min(Math.max(0, Math.round(anchorX - layer.width * ANCHOR_RATIO[align])), TEMPLATE_CANVAS.width);
}

/** Layer with its box shrunk and moved so it stays inside the image. */
export function fitLayerInside<T extends { x: number; y: number; width: number; height: number }>(layer: T, canvasHeight: number): T {
  const width = Math.min(layer.width, TEMPLATE_CANVAS.width);
  const height = Math.min(layer.height, canvasHeight);
  return { ...layer, width, height, x: Math.min(Math.max(layer.x, 0), TEMPLATE_CANVAS.width - width), y: Math.min(Math.max(layer.y, 0), canvasHeight - height) };
}

/** Text a text layer shows for these alert fields. */
export function textLayerValue(layer: TemplateTextLayer, fields: Record<string, string>, locale: string): string {
  const values = {
    ...fields,
    ...scheduleValues(fields.scheduledAt ?? "", layer.timezone, locale),
  };
  return layer.field === "custom" ? interpolate(layer.text, values) : (values[layer.field] ?? "");
}

// Layer factories, shared by the editor and the default templates.
const base = {
  opacity: 1,
  rotation: 0,
  folderId: null as string | null,
  locked: false,
  visible: [] as TemplateCondition[],
};
const when = (key: string, op: TemplateCondition["op"], value = ""): TemplateCondition => ({ key, op, value });

type TextInit = Pick<TemplateTextLayer, "field" | "x" | "y" | "width" | "height" | "fontSize" | "fontWeight" | "align"> & Partial<TemplateTextLayer>;

export function newTextLayer(id: string, init: TextInit): TemplateTextLayer {
  return {
    ...base,
    id,
    type: "text",
    text: "",
    font: "inter",
    uppercase: false,
    timezone: "UTC",
    color: "#ffffff",
    letterSpacing: 0,
    lineHeight: 1.2,
    shadow: null,
    ...init,
  };
}

type ImageInit = Pick<TemplateImageLayer, "source" | "x" | "y" | "width" | "height"> & Partial<TemplateImageLayer>;

export function newImageLayer(id: string, init: ImageInit): TemplateImageLayer {
  return {
    ...base,
    id,
    type: "image",
    url: "",
    fit: "cover",
    radius: 0,
    borderColor: "#ffffff",
    borderWidth: 0,
    ...init,
  };
}

type ShapeInit = Pick<TemplateShapeLayer, "x" | "y" | "width" | "height"> & Partial<TemplateShapeLayer>;

export function newShapeLayer(id: string, init: ShapeInit): TemplateShapeLayer {
  return {
    ...base,
    id,
    type: "shape",
    color: "#e4ae22",
    color2: null,
    angle: 90,
    radius: 0,
    borderColor: "#ffffff",
    borderWidth: 0,
    ...init,
  };
}

export const TEMPLATE_ACCENT: Record<DiscordBotColorKey, string> = {
  live: "#e74c3c",
  finished: "#e4ae22",
  map: "#e4ae22",
};

// Information blocks a default template can show under the score.
export const TEMPLATE_BLOCKS = ["maps", "vetos", "mvp"] as const;
export type TemplateBlock = (typeof TEMPLATE_BLOCKS)[number];

// Default templates (information sets) per alert type, the first one is the simplest.
export const TEMPLATE_PRESETS = {
  live: {
    score: [],
    maps: ["maps"],
    vetos: ["vetos"],
    full: ["maps", "vetos"],
  },
  finished: {
    score: [],
    maps: ["maps"],
    vetos: ["vetos"],
    full: ["maps", "vetos", "mvp"],
  },
  map: { score: [], mvp: ["mvp"] },
} as const satisfies Record<DiscordBotColorKey, Record<string, readonly TemplateBlock[]>>;
export type TemplatePreset = {
  [K in DiscordBotColorKey]: keyof (typeof TEMPLATE_PRESETS)[K];
}[DiscordBotColorKey];

export function presetsOf(kind: DiscordBotColorKey): TemplatePreset[] {
  return Object.keys(TEMPLATE_PRESETS[kind]) as TemplatePreset[];
}

// Height of each block, in canvas pixels.
const BLOCK_HEIGHT: Record<TemplateBlock, number> = {
  maps: 56,
  vetos: 84,
  mvp: 56,
};
const BLOCKS_TOP = 296;
const BLOCK_GAP = 12;
const BOTTOM_PADDING = 24;

type Kind = DiscordBotColorKey;

function oswald(layer: TemplateTextLayer, uppercase = true): TemplateTextLayer {
  return { ...layer, font: "oswald", uppercase };
}

function mvpBlock(y: number, accent: string): TemplateLayer[] {
  const exists = [when("mvp.name", "exists")];
  return [
    newImageLayer("mvpImage", {
      source: "mvp",
      x: 300,
      y,
      width: BLOCK_HEIGHT.mvp,
      height: BLOCK_HEIGHT.mvp,
      radius: 10,
      borderColor: accent,
      borderWidth: 2,
      visible: exists,
    }),
    {
      ...oswald(
        newTextLayer("mvp", {
          field: "custom",
          text: "MVP  {mvp.name}  ({mvp.acs} ACS)",
          x: 372,
          y,
          width: 600,
          height: BLOCK_HEIGHT.mvp,
          fontSize: 28,
          fontWeight: 700,
          align: "left",
          color: accent,
        }),
      ),
      visible: exists,
    },
  ];
}

function mapsBlock(y: number): TemplateLayer[] {
  return [
    oswald(
      newTextLayer("maps", {
        field: "mapsInline",
        x: 40,
        y,
        width: 920,
        height: BLOCK_HEIGHT.maps,
        fontSize: 22,
        fontWeight: 700,
        align: "center",
      }),
    ),
  ];
}

// One card per veto: the map artwork, dimmed for a ban, outlined for a pick or the decider.
function vetosBlock(y: number, accent: string): TemplateLayer[] {
  const tile = { width: 118, height: 72, gap: 9, left: 60 };
  return VETO_KEYS.flatMap((key, i) => {
    const x = tile.left + i * (tile.width + tile.gap);
    const exists = when(`${key}.map`, "exists");
    const isBan = when(`${key}.type`, "is", "ban");
    const notBan = when(`${key}.type`, "isNot", "ban");
    const area = { x, y, width: tile.width, height: tile.height };
    return [
      newImageLayer(`${key}Ban`, {
        ...area,
        source: key,
        radius: 8,
        visible: [exists, isBan],
      }),
      newShapeLayer(`${key}Dim`, {
        ...area,
        color: "#000000",
        opacity: 0.6,
        radius: 8,
        visible: [exists, isBan],
      }),
      newImageLayer(`${key}Pick`, {
        ...area,
        source: key,
        radius: 8,
        borderColor: accent,
        borderWidth: 2,
        visible: [exists, notBan],
      }),
      newShapeLayer(`${key}Shade`, {
        ...area,
        y: y + tile.height - 30,
        height: 30,
        color: "#000000",
        opacity: 0.55,
        radius: 0,
        visible: [exists],
      }),
      oswald(
        newTextLayer(`${key}Action`, {
          field: "custom",
          text: "{" + key + ".action}",
          x: x + 6,
          y: y + 4,
          width: tile.width - 12,
          height: 20,
          fontSize: 13,
          fontWeight: 700,
          align: "left",
          color: "#e4e4e7",
          visible: [exists],
        }),
      ),
      oswald(
        newTextLayer(`${key}Map`, {
          field: "custom",
          text: "{" + key + ".map}",
          x: x + 4,
          y: y + tile.height - 28,
          width: tile.width - 8,
          height: 24,
          fontSize: 16,
          fontWeight: 700,
          align: "center",
          visible: [exists],
        }),
      ),
    ];
  });
}

/** Look of the GC Stats alerts: dark, gold, bold condensed names, then the requested information blocks. */
export function createGcsTemplate(accent: string, kind: Kind, blocks: readonly TemplateBlock[] = []): AlertTemplate {
  const name = {
    fontSize: 30,
    height: 40,
    y: 232,
    fontWeight: 700,
    align: "center",
  } as const;
  const isMap = kind === "map";
  const ordered = TEMPLATE_BLOCKS.filter((b) => blocks.includes(b));

  let y = BLOCKS_TOP;
  const blockLayers: TemplateLayer[] = [];
  for (const block of ordered) {
    blockLayers.push(...(block === "mvp" ? mvpBlock(y, accent) : block === "maps" ? mapsBlock(y) : vetosBlock(y, accent)));
    y += BLOCK_HEIGHT[block] + BLOCK_GAP;
  }
  // Without block the content ends with the sub lines of the score.
  const contentBottom = ordered.length ? y - BLOCK_GAP : BLOCKS_TOP - 10;

  return {
    height: Math.max(TEMPLATE_LIMITS.minHeight, contentBottom + BOTTOM_PADDING),
    footer: false,
    artwork: { enabled: true, source: "mapCurrent", dim: 0.7 },
    backgroundColor: "#0e0e0e",
    backgroundImageId: null,
    folders: [],
    layers: [
      newShapeLayer("bar", {
        x: 0,
        y: 0,
        width: TEMPLATE_CANVAS.width,
        height: 6,
        color: accent,
      }),
      oswald(
        newTextLayer("status", {
          field: "status",
          x: 40,
          y: 20,
          width: 920,
          height: 30,
          fontSize: 22,
          fontWeight: 700,
          align: "center",
          color: accent,
        }),
      ),
      oswald(
        newTextLayer("tournament", {
          field: "tournament",
          x: 40,
          y: 52,
          width: 920,
          height: 28,
          fontSize: 20,
          fontWeight: 400,
          align: "center",
          color: "#d4d4d4",
        }),
      ),
      newImageLayer("logoA", {
        source: "teamA",
        fit: "contain",
        x: 55,
        y: 96,
        width: 130,
        height: 130,
      }),
      newImageLayer("logoB", {
        source: "teamB",
        fit: "contain",
        x: 815,
        y: 96,
        width: 130,
        height: 130,
      }),
      oswald(newTextLayer("teamA", { ...name, field: "teamA", x: 0, width: 240 })),
      oswald(newTextLayer("teamB", { ...name, field: "teamB", x: 760, width: 240 })),
      oswald(
        newTextLayer("score", {
          field: "score",
          x: 270,
          y: 86,
          width: 460,
          height: 130,
          fontSize: 120,
          fontWeight: 700,
          align: "center",
        }),
        false,
      ),
      isMap
        ? oswald(
            newTextLayer("map", {
              field: "map",
              x: 270,
              y: 220,
              width: 460,
              height: 34,
              fontSize: 26,
              fontWeight: 700,
              align: "center",
            }),
          )
        : oswald(
            newTextLayer("bestOf", {
              field: "bestOf",
              x: 270,
              y: 220,
              width: 460,
              height: 34,
              fontSize: 24,
              fontWeight: 400,
              align: "center",
              color: "#b8bcc8",
            }),
          ),
      ...(isMap
        ? [
            oswald(
              newTextLayer("matchScore", {
                field: "matchScore",
                x: 270,
                y: 256,
                width: 460,
                height: 28,
                fontSize: 20,
                fontWeight: 400,
                align: "center",
                color: "#b8bcc8",
              }),
            ),
          ]
        : []),
      ...(ordered.length
        ? [
            newShapeLayer("divider", {
              x: 60,
              y: BLOCKS_TOP - 8,
              width: 880,
              height: 1,
              color: "#ffffff",
              opacity: 0.15,
            }),
          ]
        : []),
      ...blockLayers,
    ],
  };
}

/** Starting point of a new template, the editor tweaks it from there. */
export function createDefaultTemplate(kind: Kind, preset: TemplatePreset = "score"): AlertTemplate {
  const blocks = (TEMPLATE_PRESETS[kind] as Record<string, readonly TemplateBlock[]>)[preset] ?? [];
  return createGcsTemplate(TEMPLATE_ACCENT[kind], kind, blocks);
}
