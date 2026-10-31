/**
 * GC-Stats - discord-template-editor
 *
 * Visual editor of an alert image: place, resize, rotate and style the layers on a canvas,
 * show them only under conditions, then check the exact server rendering before saving.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { closestCenter, DndContext, pointerWithin, type CollisionDetection, type Modifier, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Send,
  Shapes,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/admin/form-field";
import { saveDiscordTemplate, sendDiscordTestAlert } from "@/actions/discord-bot";
import { assignFolder, buildLayerRows, dropLayerRow, FOLDER_ROW_PREFIX, isLayerLocked } from "@/lib/discord-bot/layer-folders";
import type { PreviewData } from "@/lib/discord-bot/preview";
import type { DiscordBotChannel, DiscordBotEvent } from "@/lib/discord-bot/shared";
import { buildAlertFields, buildAlertImages, SAMPLE_MAPS, sampleMatch, type AlertKind, type Translate } from "@/lib/discord-bot/variables";
import {
  conditionValues,
  createDefaultTemplate,
  fontSupportsWeight,
  presetsOf,
  MAP_KEYS,
  imageCategoryOf,
  newImageLayer,
  newShapeLayer,
  newTextLayer,
  fitLayerInside,
  textAnchorX,
  textBoxX,
  toFreeText,
  TEMPLATE_ARTWORK_SOURCES,
  TEMPLATE_CANVAS,
  TEMPLATE_CONDITION_GROUPS,
  TEMPLATE_CONDITION_KEYS,
  TEMPLATE_FONTS,
  TEMPLATE_FOOTER_HEIGHT,
  TEMPLATE_IMAGE_CATEGORIES,
  TEMPLATE_IMAGE_URL_MAX,
  TEMPLATE_LIMITS,
  TEMPLATE_TIMEZONES,
  TEMPLATE_VARIABLE_GROUPS,
  VETO_KEYS,
  type AlertTemplate,
  type TemplateCondition,
  type TemplateFontId,
  type TemplatePreset,
  type TemplateImageSource,
  type TemplateFolder,
  type TemplateLayer,
  type TemplateTextLayer,
  type TemplateTimezone,
} from "@/lib/discord-bot/template";

// Konva needs the browser, and the editor is only opened on demand.
const Canvas = dynamic(() => import("@/components/dashboard/discord-template-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[5/2] w-full" />,
});

const HISTORY_LIMIT = 50;
// Fixed bottom row of the layer list, it holds the settings of the image itself.
const LAYOUT_ID = "layout";
const EVENT_KIND: Record<DiscordBotEvent, AlertKind> = {
  match_live: "live",
  match_finished: "finished",
  map_finished: "map",
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1 transition-opacity active:opacity-70"
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function NumberField({ id, label, value, min, max, step = 1, onChange }: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <FormField label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        value={Number.isInteger(step) ? Math.round(value) : value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </FormField>
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <FormField label={`${label} (${display})`} htmlFor={id}>
      <Slider id={id} value={value} min={min} max={max} step={step} onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? value) : (v as number))} />
    </FormField>
  );
}

function SimpleSelect<T extends string>({ id, label, value, items, onChange }: { id: string; label: string; value: T; items: Record<string, string>; onChange: (value: T) => void }) {
  return (
    <FormField label={label} htmlFor={id}>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function Chip({ active, onClick, children, mono }: { active: boolean; onClick: () => void; children: React.ReactNode; mono?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2 py-1 text-xs transition-colors active:scale-95 ${mono ? "font-mono" : "font-medium"} ${active ? "border-primary bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

function GroupedSelect<T extends string>({
  id,
  label,
  value,
  groups,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  groups: { label: string; options: readonly string[] }[];
  labels: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <Select items={labels} value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {labels[option]}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

// The pointer decides the target row, the closest row only takes over outside every row.
const rowCollision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length > 0 ? under : closestCenter(args);
};

const noDisplacement: SortingStrategy = () => null;

// A dragged row only moves vertically and stays over the list, so it never widens the panel or adds a scrollbar.
function keepInList(list: React.RefObject<HTMLElement | null>): Modifier {
  return ({ transform, draggingNodeRect }) => {
    const box = list.current?.getBoundingClientRect();
    if (!box || !draggingNodeRect) return { ...transform, x: 0 };
    return { ...transform, x: 0, y: Math.min(Math.max(transform.y, box.top - draggingNodeRect.top), box.bottom - draggingNodeRect.bottom) };
  };
}

function LockButton({ locked, inherited, label, onToggle }: { locked: boolean; inherited?: boolean; label: string; onToggle: () => void }) {
  if (!locked && inherited) return <Lock className="mx-1.5 size-3.5 shrink-0 opacity-40" aria-hidden />;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      aria-label={label}
      title={label}
      className={`px-1.5 py-2 transition active:scale-90 ${locked ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
    >
      {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
    </button>
  );
}

function SortableLayerRow({
  id,
  active,
  indent,
  onSelect,
  trailing,
  children,
}: {
  id: string;
  active: boolean;
  indent?: boolean;
  onSelect: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging, isOver, index, activeIndex, active: dragged } = useSortable({ id });
  // Rows do not make room while dragging (a folder would slip away), the row under the pointer shows where the drop lands.
  // A layer coming from above lands inside the folder, one coming from below lands above it, like on any other row.
  const dropInto = isOver && !isDragging && id.startsWith(FOLDER_ROW_PREFIX) && !String(dragged?.id ?? "").startsWith(FOLDER_ROW_PREFIX) && activeIndex < index;
  const dropLine = isOver && !isDragging && !dropInto ? (activeIndex < index ? "shadow-[inset_0_-2px_0_var(--color-primary)]" : "shadow-[inset_0_2px_0_var(--color-primary)]") : "";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={`flex items-center rounded text-sm ${dropInto ? "ring-2 ring-primary" : ""} ${dropLine} ${indent ? "ml-4" : ""} ${isDragging ? "relative z-10 shadow-md" : ""} ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      <button ref={setActivatorNodeRef} type="button" className="cursor-grab touch-none px-1.5 py-2 opacity-60 hover:opacity-100 active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" onClick={onSelect} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left transition-transform active:scale-[0.99]">
        {children}
      </button>
      {trailing}
    </div>
  );
}

export function DiscordTemplateEditor({
  guildId,
  event,
  initial,
  backgroundUrl,
  channels,
  locale,
  open,
  onOpenChange,
}: {
  guildId: string;
  event: DiscordBotEvent;
  initial: AlertTemplate;
  backgroundUrl: string | null;
  /** Null when the bot cannot read the channels of the server. */
  channels: DiscordBotChannel[] | null;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.discord.editor");
  const tEvent = useTranslations("dashboard.discord.event");
  const tt = useTranslations("dashboard.discord.templates");
  const tm = useTranslations("discordBotMessages");
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [template, setTemplate] = useState(() => ({
    ...initial,
    layers: initial.layers.map(toFreeText),
  }));
  const [history, setHistory] = useState<AlertTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>(LAYOUT_ID);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "change"; id: string } | null>(null);
  const [pickerCategory, setPickerCategory] = useState<string>(TEMPLATE_IMAGE_CATEGORIES[0].category);
  const [testOpen, setTestOpen] = useState(false);
  const [testChannel, setTestChannel] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [isSendingTest, startSendingTest] = useTransition();
  const [customUrl, setCustomUrl] = useState("");
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listModifiers] = useState(() => [keepInList(listRef)]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [preset, setPreset] = useState<TemplatePreset | null>(null);
  const [variableGroup, setVariableGroup] = useState("match");
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [preview, setPreview] = useState<{
    state: "idle" | "loading" | "ready" | "error";
    url: string | null;
  }>({ state: "idle", url: null });
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [lastCoalesce] = useState(() => ({ current: null as string | null }));
  const selected = template.layers.find((l) => l.id === selectedId) ?? null;
  const selectedFolder = template.folders.find((f) => FOLDER_ROW_PREFIX + f.id === selectedId) ?? null;
  const selectedLocked = selected ? isLayerLocked(template, selected) : false;
  const kind = EVENT_KIND[event];

  // Sample data shown on the canvas: the sample match at first, then the preview match once loaded.
  const sample = useMemo(() => {
    const match = sampleMatch(kind);
    const map = kind === "map" ? SAMPLE_MAPS[0] : undefined;
    const translate = ((key: string, values?: Record<string, string | number>) => tm(key as never, values as never)) as Translate;
    return {
      fields: buildAlertFields(kind, match, translate, map),
      images: buildAlertImages(kind, match, map, ""),
    };
  }, [kind, tm]);
  const [loaded, setLoaded] = useState<PreviewData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const previewAbort = useRef<AbortController | null>(null);
  const { fields, images } = loaded ?? sample;

  useEffect(() => {
    if (!open) {
      setDataLoading(false);
      return;
    }
    const controller = new AbortController();
    // The previous alert's data would show fields of another kind or language while the new one loads.
    setLoaded(null);
    setDataLoading(true);
    fetch(`/api/discord-bot/preview-data?${new URLSearchParams({ guildId, event, locale })}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<PreviewData>) : null))
      .then((data) => data && setLoaded(data))
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setDataLoading(false));
    return () => controller.abort();
  }, [open, guildId, event, locale]);

  // `coalesce` merges a burst of edits of the same control (a drag, typing a number) into one undo step.
  function update(next: (prev: AlertTemplate) => AlertTemplate, coalesce?: string) {
    const value = next(template);
    if (value === template) return;
    if (!coalesce || lastCoalesce.current !== coalesce) setHistory((h) => [...h, template].slice(-HISTORY_LIMIT));
    lastCoalesce.current = coalesce ?? null;
    setTemplate(value);
  }

  function patchLayer(id: string, patch: Partial<TemplateLayer>, coalesce?: string) {
    update(
      (prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, ...patch } as TemplateLayer;
          return "x" in patch || "y" in patch || "width" in patch || "height" in patch ? fitLayerInside(next, prev.height) : next;
        }),
      }),
      coalesce,
    );
  }

  function addLayer(layer: TemplateLayer) {
    if (template.layers.length >= TEMPLATE_LIMITS.layers) {
      toast.error(t("tooManyLayers", { max: TEMPLATE_LIMITS.layers }));
      return;
    }
    update((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedId(layer.id);
  }

  const addText = () =>
    addLayer(
      newTextLayer(newId(), {
        field: "custom",
        text: t("sampleText"),
        x: 300,
        y: 160,
        width: 400,
        height: 60,
        fontSize: 36,
        fontWeight: 700,
        align: "center",
      }),
    );
  const addShape = () =>
    addLayer(
      newShapeLayer(newId(), {
        x: 300,
        y: 330,
        width: 400,
        height: 6,
        radius: 3,
      }),
    );

  function duplicate(layer: TemplateLayer) {
    addLayer(fitLayerInside({ ...layer, id: newId(), locked: false, x: layer.x + 20, y: layer.y + 20 }, template.height));
  }

  function remove(id: string) {
    const layer = template.layers.find((l) => l.id === id);
    if (id === LAYOUT_ID || !layer || isLayerLocked(template, layer)) return;
    update((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    setSelectedId(LAYOUT_ID);
  }

  // The list shows the front layer first, the template stores the back layer first.
  function handleReorder({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    update((prev) => dropLayerRow(prev, String(active.id), String(over.id)));
  }

  function addFolder() {
    if (template.folders.length >= TEMPLATE_LIMITS.folders) {
      toast.error(t("tooManyFolders", { max: TEMPLATE_LIMITS.folders }));
      return;
    }
    const id = newId();
    update((prev) => ({
      ...prev,
      folders: [
        ...prev.folders,
        {
          id,
          name: t("folderDefaultName", { n: prev.folders.length + 1 }),
          locked: false,
          collapsed: false,
          anchor: null,
        },
      ],
    }));
    setSelectedId(FOLDER_ROW_PREFIX + id);
  }

  function patchFolder(id: string, patch: Partial<TemplateFolder>, coalesce?: string) {
    update(
      (prev) => ({
        ...prev,
        folders: prev.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }),
      coalesce,
    );
  }

  // The layers of a deleted folder stay, they just leave it.
  function removeFolder(id: string) {
    update((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== id),
      layers: prev.layers.map((l) => (l.folderId === id ? { ...l, folderId: null } : l)),
    }));
    setSelectedId(LAYOUT_ID);
  }

  function handleSendTest() {
    setTestError(null);
    startSendingTest(async () => {
      try {
        const result = await sendDiscordTestAlert(guildId, event, testChannel, locale, template);
        if (result.ok) {
          toast.success(t("testSent"));
          setTestOpen(false);
          return;
        }
        if (result.fieldErrors) setTestError(t(`testError.${result.fieldErrors.channelId}`));
        else if (result.issues?.length) setTestError(result.issues.join(", "));
        else setTestError(result.error === "rateLimited" || result.error === "channelsUnavailable" || result.error === "sendFailed" ? t(`testError.${result.error}`) : t(`error.${result.error}`));
      } catch {
        setTestError(t("error.network"));
      }
    });
  }

  function openPicker(next: NonNullable<typeof picker>) {
    setCustomUrl("");
    setCustomUrlError(null);
    setPicker(next);
  }

  // A picture takes the size of its family, a layer keeps its own size when it stays in the same one.
  function choosePicture(source: TemplateImageSource, url = "") {
    const family = imageCategoryOf(source);
    if (picker?.mode === "change") {
      const layer = template.layers.find((l) => l.id === picker.id);
      if (layer?.type !== "image") return;
      const sameFamily = imageCategoryOf(layer.source) === family;
      patchLayer(layer.id, {
        source,
        url,
        ...(sameFamily ? {} : { ...family.size, fit: family.fit }),
      });
    } else {
      const { width, height } = family.size;
      addLayer(
        newImageLayer(newId(), {
          source,
          url,
          fit: family.fit,
          width,
          height,
          x: Math.round((TEMPLATE_CANVAS.width - width) / 2),
          y: Math.max(0, Math.round((template.height - height) / 2)),
        }),
      );
    }
    setPicker(null);
  }

  function submitCustomUrl() {
    const value = customUrl.trim();
    if (!value) return setCustomUrlError(t("customUrlRequired"));
    if (!isHttpsUrl(value)) return setCustomUrlError(t("customUrlInvalid"));
    choosePicture("custom", value);
  }

  function align(layer: TemplateLayer, axis: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") {
    const patch: Partial<TemplateLayer> = {
      left: { x: 0 },
      centerX: { x: Math.round((TEMPLATE_CANVAS.width - layer.width) / 2) },
      right: { x: TEMPLATE_CANVAS.width - layer.width },
      top: { y: 0 },
      centerY: { y: Math.round((template.height - layer.height) / 2) },
      bottom: { y: template.height - layer.height },
    }[axis];
    patchLayer(layer.id, {
      x: Math.max(0, layer.x),
      y: Math.max(0, layer.y),
      ...patch,
    });
  }

  // Switching the alignment keeps the anchor where it is, so the text does not jump.
  function changeTextAlign(layer: TemplateTextLayer, align: TemplateTextLayer["align"]) {
    patchLayer(layer.id, {
      align,
      x: textBoxX(layer, align, textAnchorX(layer)),
    });
  }

  const accentKey = event === "match_live" ? "live" : event === "map_finished" ? "map" : "finished";
  const presets = presetsOf(accentKey);
  const presetItems = Object.fromEntries(presets.map((p) => [p, tt(`preset.${p}`)]));

  // Replaces the whole design by a ready-made one, the stored background stays.
  function applyPreset() {
    const chosen = preset ?? presets.at(-1);
    if (!chosen) return;
    update((prev) => ({ ...createDefaultTemplate(accentKey, chosen), backgroundImageId: prev.backgroundImageId }));
    setSelectedId(LAYOUT_ID);
    toast.success(t("templateApplied"));
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setTemplate(previous);
    setHistory(history.slice(0, -1));
    lastCoalesce.current = null;
  }

  // Delete removes the selected layer and the arrows nudge it, unless the user is typing in a field.
  useEffect(() => {
    if (!open) return;
    function onKey(keyEvent: KeyboardEvent) {
      const target = keyEvent.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.getAttribute("role") === "combobox")) return;
      if (selectedId === LAYOUT_ID || selectedId.startsWith(FOLDER_ROW_PREFIX)) return;
      if (keyEvent.key === "Delete" || keyEvent.key === "Backspace") {
        // Backspace on a focused button or select belongs to that control.
        if (target?.closest("button, a, select, [role='button'], [role='menuitem'], [role='option']")) return;
        keyEvent.preventDefault();
        remove(selectedId);
        return;
      }
      const step = keyEvent.shiftKey ? 10 : 1;
      const delta = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[keyEvent.key];
      const layer = template.layers.find((l) => l.id === selectedId);
      if (!delta || !layer || isLayerLocked(template, layer)) return;
      keyEvent.preventDefault();
      patchLayer(
        layer.id,
        {
          x: Math.max(0, layer.x + (delta[0] ?? 0)),
          y: Math.max(0, layer.y + (delta[1] ?? 0)),
        },
        `nudge-${layer.id}`,
      );
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The handler reads the current template and selection, both listed through its closure refresh below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, template]);

  useEffect(() => {
    return () => {
      if (preview.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview.url]);

  async function handlePreview() {
    // A newer request replaces the one still running, so a slow older image cannot overwrite it.
    previewAbort.current?.abort();
    const controller = new AbortController();
    previewAbort.current = controller;
    setPreview((p) => ({ state: "loading", url: p.url }));
    try {
      const response = await fetch("/api/discord-bot/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, event, locale, template }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      if (controller.signal.aborted) return URL.revokeObjectURL(url);
      setPreview({ state: "ready", url });
    } catch {
      if (!controller.signal.aborted) setPreview((p) => ({ state: "error", url: p.url }));
    }
  }

  function handleSave() {
    setIssues([]);
    startSaving(async () => {
      try {
        const result = await saveDiscordTemplate(guildId, event, template);
        if (!result.ok) {
          setIssues(result.issues?.length ? result.issues : [t(`error.${result.error}`)]);
          return;
        }
        toast.success(t("saved"));
        onOpenChange(false);
        router.refresh();
      } catch {
        setIssues([t("error.network")]);
      }
    });
  }

  function insertVariable(layer: TemplateLayer, token: string) {
    if (layer.type !== "text") return;
    const area = textRef.current;
    const start = area?.selectionStart ?? layer.text.length;
    const end = area?.selectionEnd ?? start;
    const text = `${layer.text.slice(0, start)}{${token}}${layer.text.slice(end)}`.slice(0, TEMPLATE_LIMITS.customText);
    patchLayer(layer.id, { text });
    // Waits for the picker to close, which gives the focus back to its button.
    setTimeout(() => {
      area?.focus();
      const caret = start + token.length + 2;
      area?.setSelectionRange(caret, caret);
    }, 150);
  }

  const numberedLabel = (key: string) => {
    const mapIndex = (MAP_KEYS as readonly string[]).indexOf(key);
    if (mapIndex >= 0) return t("sourceMap", { n: mapIndex + 1 });
    const vetoIndex = (VETO_KEYS as readonly string[]).indexOf(key);
    if (vetoIndex >= 0) return t("sourceVeto", { n: vetoIndex + 1 });
    return null;
  };
  const sourceLabel = (source: string) => numberedLabel(source) ?? t(`source.${source}`);
  const groupLabel = (group: string) => numberedLabel(group) ?? t(`variableGroup.${group}`);
  const conditionValueLabel = (value: string) => t(`conditionValue.${value}`);

  const fontItems = Object.fromEntries(TEMPLATE_FONTS.map((f) => [f.id, f.name]));
  const conditionGroups = TEMPLATE_CONDITION_GROUPS.map((g) => ({
    label: groupLabel(g.group),
    options: g.keys,
  }));
  const timezoneItems = Object.fromEntries(TEMPLATE_TIMEZONES.map((z) => [z, z.replace(/_/g, " ")]));
  const alignItems = {
    left: t("align.left"),
    center: t("align.center"),
    right: t("align.right"),
  };
  const anchorItems = {
    left: t("anchor.left"),
    center: t("anchor.center"),
    right: t("anchor.right"),
  };
  const fitItems = { cover: t("fit.cover"), contain: t("fit.contain") };
  const artworkItems = Object.fromEntries(TEMPLATE_ARTWORK_SOURCES.map((s) => [s, sourceLabel(s)]));
  const opItems = {
    is: t("op.is"),
    isNot: t("op.isNot"),
    exists: t("op.exists"),
    empty: t("op.empty"),
  };
  // Categories of the variable picker: maps and vetos are numbered, they share one category with a number row.
  const numbered = {
    maps: MAP_KEYS as readonly string[],
    vetos: VETO_KEYS as readonly string[],
  };
  const categoryOf = (group: string) => (numbered.maps.includes(group) ? "maps" : numbered.vetos.includes(group) ? "vetos" : group);
  const categories = [...new Set(TEMPLATE_VARIABLE_GROUPS.map((g) => categoryOf(g.group)))];
  const category = categoryOf(variableGroup);
  const categoryLabel = (c: string) => t(`variableGroup.${c}`);
  // Full name of a variable, numbered ones (map3.score, veto2.team) share one label with the number filled in.
  const variableLabel = (key: string) => {
    const numberedKey = /^(map|veto)(\d)(?:\.(\w+))?$/.exec(key);
    if (numberedKey) {
      const [, kind, n, suffix] = numberedKey;
      return t(`variableName.${kind}_${suffix ?? "alias"}`, { n: Number(n) });
    }
    return t(`variableName.${key.replace(".", "_")}`);
  };
  const conditionKeyLabels = Object.fromEntries(TEMPLATE_CONDITION_KEYS.map((k) => [k, variableLabel(k)]));
  // The name of a map is listed once (`map1`), `map1.name` stays valid in saved templates.
  const pickerKeys = (TEMPLATE_VARIABLE_GROUPS.find((g) => g.group === variableGroup)?.keys ?? []).filter((k) => !/^map\d\.name$/.test(k));
  const layerName = (layer: TemplateLayer) => (layer.type === "text" ? layer.text.trim().slice(0, 28) || t("field.custom") : layer.type === "image" ? sourceLabel(layer.source) : t("shape"));
  const LayerIcon = (layer: TemplateLayer) => (layer.type === "text" ? Type : layer.type === "image" ? ImageIcon : Shapes);

  function patchCondition(layer: TemplateLayer, index: number, patch: Partial<TemplateCondition>) {
    const next = layer.visible.map((c, i) => (i === index ? { ...c, ...patch } : c));
    patchLayer(layer.id, { visible: next }, `cond-${layer.id}-${index}`);
  }

  function addCondition(layer: TemplateLayer) {
    if (layer.visible.length >= TEMPLATE_LIMITS.conditions) return;
    const key = TEMPLATE_CONDITION_KEYS[0] ?? "alert.kind";
    patchLayer(layer.id, {
      visible: [...layer.visible, { key, op: "is", value: conditionValues(key)?.[0] ?? "" }],
    });
  }

  const totalHeight = template.height + (template.footer ? TEMPLATE_FOOTER_HEIGHT : 0);
  const folderItems = {
    none: t("noFolder"),
    ...Object.fromEntries(template.folders.map((f) => [f.id, f.name])),
  };

  const listRows = buildLayerRows(template);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[97vw] max-w-[97vw] flex-col gap-3 sm:max-w-[97vw] xl:max-w-[1800px]">
        <DialogHeader>
          <DialogTitle>{t("title", { event: tEvent(event) })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[15rem_minmax(0,1fr)_24rem] lg:overflow-hidden">
          {/* Layers */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={addText}>
                <Type />
                {t("addText")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => openPicker({ mode: "add" })}>
                <ImageIcon />
                {t("addImage")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addShape}>
                <Shapes />
                {t("addShape")}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("layers")}</p>
              <Button type="button" variant="ghost" size="sm" onClick={addFolder}>
                <FolderPlus />
                {t("addFolder")}
              </Button>
            </div>
            <div ref={listRef} className="flex max-h-60 min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto rounded-md border p-1 lg:max-h-none">
              {/* Top of the list is the front layer. */}
              <DndContext sensors={sensors} collisionDetection={rowCollision} modifiers={listModifiers} onDragEnd={handleReorder}>
                <SortableContext items={listRows.map((r) => (r.kind === "folder" ? FOLDER_ROW_PREFIX + r.folder.id : r.layer.id))} strategy={noDisplacement}>
                  {listRows.map((row) => {
                    if (row.kind === "folder") {
                      const { folder } = row;
                      const rowId = FOLDER_ROW_PREFIX + folder.id;
                      const FolderIcon = folder.collapsed ? Folder : FolderOpen;
                      return (
                        <SortableLayerRow
                          key={rowId}
                          id={rowId}
                          active={rowId === selectedId}
                          onSelect={() => setSelectedId(rowId)}
                          trailing={
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  patchFolder(folder.id, {
                                    collapsed: !folder.collapsed,
                                  })
                                }
                                aria-expanded={!folder.collapsed}
                                aria-label={folder.collapsed ? t("folderExpand") : t("folderCollapse")}
                                title={folder.collapsed ? t("folderExpand") : t("folderCollapse")}
                                className="px-1 py-2 opacity-60 transition hover:opacity-100 active:scale-90"
                              >
                                {folder.collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                              </button>
                              <LockButton
                                locked={folder.locked}
                                label={folder.locked ? t("unlockFolder") : t("lockFolder")}
                                onToggle={() =>
                                  patchFolder(folder.id, {
                                    locked: !folder.locked,
                                  })
                                }
                              />
                            </>
                          }
                        >
                          <FolderIcon className="size-3.5 shrink-0" />
                          <span className="truncate font-medium">{folder.name}</span>
                        </SortableLayerRow>
                      );
                    }
                    const { layer } = row;
                    const Icon = LayerIcon(layer);
                    const inheritedLock = isLayerLocked(template, layer) && !layer.locked;
                    return (
                      <SortableLayerRow
                        key={layer.id}
                        id={layer.id}
                        indent={layer.folderId !== null}
                        active={layer.id === selectedId}
                        onSelect={() => setSelectedId(layer.id)}
                        trailing={
                          <LockButton
                            locked={layer.locked}
                            inherited={inheritedLock}
                            label={layer.locked ? t("unlockLayer") : t("lockLayer")}
                            onToggle={() => patchLayer(layer.id, { locked: !layer.locked })}
                          />
                        }
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{layerName(layer)}</span>
                        {layer.visible.length > 0 && <EyeOff className="ml-auto size-3.5 shrink-0 opacity-70" aria-label={t("conditional")} />}
                      </SortableLayerRow>
                    );
                  })}
                </SortableContext>
              </DndContext>
              {listRows.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("noLayers")}</p>}
              {/* The layout is always last, behind every layer, and cannot be removed. */}
              <button
                type="button"
                onClick={() => setSelectedId(LAYOUT_ID)}
                aria-pressed={selectedId === LAYOUT_ID}
                className={`mt-auto flex items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors active:scale-[0.99] ${selectedId === LAYOUT_ID ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"}`}
              >
                <Layers className="size-3.5 shrink-0" />
                <span className="truncate font-medium">{t("layoutLayer")}</span>
              </button>
            </div>
            {selected && (
              <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={selectedLocked} onClick={() => remove(selected.id)}>
                <Trash2 />
                {t("delete")}
              </Button>
            )}
          </div>

          {/* Canvas */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={history.length === 0}>
                <Undo2 />
                {t("undo")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {TEMPLATE_CANVAS.width} x {totalHeight}
              </span>
              {dataLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("loadingMatch")} />}
              <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={handlePreview} disabled={preview.state === "loading"}>
                {preview.state === "loading" ? <Loader2 className="animate-spin" /> : <Eye />}
                {t("previewServer")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTestOpen(true)} disabled={!channels || channels.length === 0}>
                <Send />
                {t("sendTest")}
              </Button>
            </div>

            <Canvas
              template={template}
              backgroundUrl={backgroundUrl}
              fields={fields}
              images={images}
              locale={locale}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id ?? LAYOUT_ID)}
              onChange={(id, box) => patchLayer(id, box, `box-${id}`)}
            />
            <p className="text-xs text-muted-foreground">{t("canvasHint")}</p>

            {preview.state !== "idle" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("previewTitle")}</p>
                <div
                  className="relative w-full overflow-hidden rounded-md border bg-muted"
                  style={{
                    aspectRatio: `${TEMPLATE_CANVAS.width} / ${totalHeight}`,
                  }}
                >
                  {preview.state === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {preview.state === "error" && <p className="absolute inset-0 flex items-center justify-center text-sm text-destructive">{t("previewError")}</p>}
                  {preview.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.url} alt={t("previewTitle")} className="size-full object-cover" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Properties */}
          <div className="flex min-h-0 min-w-0 flex-col lg:overflow-y-auto lg:pr-1">
            {selectedFolder ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{t("folder")}</p>
                <FormField label={t("folderName")} htmlFor="tpl-folder-name" required error={selectedFolder.name.trim() === "" ? t("folderNameRequired") : null}>
                  <Input
                    id="tpl-folder-name"
                    value={selectedFolder.name}
                    maxLength={TEMPLATE_LIMITS.folderName}
                    onChange={(e) => patchFolder(selectedFolder.id, { name: e.target.value }, `folder-name-${selectedFolder.id}`)}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={selectedFolder.locked} onCheckedChange={(locked) => patchFolder(selectedFolder.id, { locked })} />
                  {t("lockFolder")}
                </label>
                <p className="text-xs text-muted-foreground">{t("folderHint")}</p>
                <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeFolder(selectedFolder.id)}>
                  <Trash2 />
                  {t("deleteFolder")}
                </Button>
              </div>
            ) : selected ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{layerName(selected)}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={selected.locked ? t("unlockLayer") : t("lockLayer")}
                      aria-pressed={selected.locked}
                      title={selected.locked ? t("unlockLayer") : t("lockLayer")}
                      onClick={() => patchLayer(selected.id, { locked: !selected.locked })}
                    >
                      {selected.locked ? <Lock /> : <LockOpen />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t("duplicate")} onClick={() => duplicate(selected)}>
                      <Copy />
                    </Button>
                  </div>
                </div>

                {selectedLocked && <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">{selected.locked ? t("layerLockedHint") : t("folderLockedHint")}</p>}
                <fieldset disabled={selectedLocked} className="contents">
                  <Tabs defaultValue="content">
                    <TabsList className="w-full">
                      <TabsTrigger value="content">{t("tabContent")}</TabsTrigger>
                      <TabsTrigger value="layout">{t("tabLayout")}</TabsTrigger>
                      <TabsTrigger value="style">{t("tabStyle")}</TabsTrigger>
                      <TabsTrigger value="visibility">{t("tabVisibility")}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="flex flex-col gap-3 pt-2">
                      {selected.type === "text" && (
                        <>
                          <FormField label={t("customText")} htmlFor="tpl-text" hint={t.raw("customTextHint") as string}>
                            <Textarea
                              ref={textRef}
                              id="tpl-text"
                              rows={4}
                              value={selected.text}
                              maxLength={TEMPLATE_LIMITS.customText}
                              onChange={(e) => patchLayer(selected.id, { text: e.target.value }, `text-${selected.id}`)}
                            />
                          </FormField>
                          <Button type="button" variant="outline" size="sm" onClick={() => setVariablesOpen(true)}>
                            <Braces />
                            {t("insertVariable")}
                          </Button>
                          {/\{(date|time|dateTime)\}/.test(selected.text) && (
                            <SimpleSelect
                              id="tpl-timezone"
                              label={t("timezone")}
                              value={selected.timezone}
                              items={timezoneItems}
                              onChange={(timezone: TemplateTimezone) => patchLayer(selected.id, { timezone })}
                            />
                          )}
                        </>
                      )}
                      {selected.type === "image" && (
                        <>
                          <FormField label={t("sourceLabel")} htmlFor="tpl-source">
                            <Button id="tpl-source" type="button" variant="outline" className="justify-between" onClick={() => openPicker({ mode: "change", id: selected.id })}>
                              <span className="truncate">{sourceLabel(selected.source)}</span>
                              <ImageIcon />
                            </Button>
                          </FormField>
                          {selected.source === "custom" && (
                            <FormField label={t("customUrl")} htmlFor="tpl-custom-url" required error={selected.url === "" ? t("customUrlRequired") : null} hint={t("customUrlHint")}>
                              <Input
                                id="tpl-custom-url"
                                type="url"
                                value={selected.url}
                                maxLength={TEMPLATE_IMAGE_URL_MAX}
                                placeholder="https://"
                                onChange={(e) => patchLayer(selected.id, { url: e.target.value.trim() }, `url-${selected.id}`)}
                              />
                            </FormField>
                          )}
                          <SimpleSelect id="tpl-fit" label={t("fit.label")} value={selected.fit} items={fitItems} onChange={(fit: "cover" | "contain") => patchLayer(selected.id, { fit })} />
                          <p className="text-xs text-muted-foreground">{t("imageFallbackHint")}</p>
                        </>
                      )}
                      {selected.type === "shape" && <p className="text-xs text-muted-foreground">{t("shapeHint")}</p>}
                    </TabsContent>

                    <TabsContent value="layout" className="flex flex-col gap-3 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField id="tpl-x" label="X" value={selected.x} min={0} max={TEMPLATE_CANVAS.width - selected.width} onChange={(x) => patchLayer(selected.id, { x }, `x-${selected.id}`)} />
                        <NumberField id="tpl-y" label="Y" value={selected.y} min={0} max={template.height - selected.height} onChange={(y) => patchLayer(selected.id, { y }, `y-${selected.id}`)} />
                        <NumberField
                          id="tpl-w"
                          label={t("width")}
                          value={selected.width}
                          min={1}
                          max={TEMPLATE_CANVAS.width}
                          onChange={(width) => patchLayer(selected.id, { width }, `w-${selected.id}`)}
                        />
                        <NumberField
                          id="tpl-h"
                          label={t("height")}
                          value={selected.height}
                          min={1}
                          max={template.height}
                          onChange={(height) => patchLayer(selected.id, { height }, `h-${selected.id}`)}
                        />
                      </div>
                      {selected.type === "text" && (
                        <div className="flex flex-col gap-2 rounded-md border p-2">
                          <SimpleSelect
                            id="tpl-anchor-align"
                            label={t("anchorPoint")}
                            value={selected.align}
                            items={anchorItems}
                            onChange={(align: "left" | "center" | "right") => changeTextAlign(selected, align)}
                          />
                          <NumberField
                            id="tpl-anchor-x"
                            label={t("anchorX")}
                            value={textAnchorX(selected)}
                            min={0}
                            max={TEMPLATE_CANVAS.width}
                            onChange={(anchor) =>
                              patchLayer(
                                selected.id,
                                {
                                  x: textBoxX(selected, selected.align, anchor),
                                },
                                `anchor-${selected.id}`,
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground">{t("anchorHint")}</p>
                        </div>
                      )}
                      <NumberField
                        id="tpl-rotation"
                        label={t("rotation")}
                        value={selected.rotation}
                        min={-180}
                        max={180}
                        onChange={(rotation) => patchLayer(selected.id, { rotation }, `rot-${selected.id}`)}
                      />
                      <SliderField
                        id="tpl-opacity"
                        label={t("opacity")}
                        value={selected.opacity}
                        min={0}
                        max={1}
                        step={0.05}
                        display={`${Math.round(selected.opacity * 100)}%`}
                        onChange={(opacity) => patchLayer(selected.id, { opacity }, `opacity-${selected.id}`)}
                      />
                      {template.folders.length > 0 && (
                        <SimpleSelect
                          id="tpl-folder"
                          label={t("folder")}
                          value={selected.folderId ?? "none"}
                          items={folderItems}
                          onChange={(folderId: string) => update((prev) => assignFolder(prev, selected.id, folderId === "none" ? null : folderId))}
                        />
                      )}
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm font-medium">{t("alignTitle")}</p>
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              ["left", AlignStartVertical, "alignLeft"],
                              ["centerX", AlignCenterVertical, "alignCenterX"],
                              ["right", AlignEndVertical, "alignRight"],
                              ["top", AlignStartHorizontal, "alignTop"],
                              ["centerY", AlignCenterHorizontal, "alignCenterY"],
                              ["bottom", AlignEndHorizontal, "alignBottom"],
                            ] as const
                          ).map(([axis, Icon, label]) => (
                            <Button key={axis} type="button" variant="outline" size="icon-sm" aria-label={t(label)} title={t(label)} onClick={() => align(selected, axis)}>
                              <Icon />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="style" className="flex flex-col gap-3 pt-2">
                      {selected.type === "text" && (
                        <>
                          <FormField label={t("font")} htmlFor="tpl-font">
                            <Select
                              items={fontItems}
                              value={selected.font}
                              onValueChange={(v) => {
                                if (!v) return;
                                const font = v as TemplateFontId;
                                // A font without bold falls back to its regular weight.
                                patchLayer(selected.id, {
                                  font,
                                  fontWeight: fontSupportsWeight(font, selected.fontWeight) ? selected.fontWeight : 400,
                                });
                              }}
                            >
                              <SelectTrigger id="tpl-font" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TEMPLATE_FONTS.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    <span
                                      style={{
                                        fontFamily: `"${f.name}", sans-serif`,
                                      }}
                                    >
                                      {f.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                          <div className="grid grid-cols-2 gap-2">
                            <NumberField
                              id="tpl-size"
                              label={t("size")}
                              value={selected.fontSize}
                              min={TEMPLATE_LIMITS.minFontSize}
                              max={TEMPLATE_LIMITS.maxFontSize}
                              onChange={(fontSize) => patchLayer(selected.id, { fontSize }, `size-${selected.id}`)}
                            />
                            <SimpleSelect
                              id="tpl-align"
                              label={t("align.label")}
                              value={selected.align}
                              items={alignItems}
                              onChange={(align: "left" | "center" | "right") => changeTextAlign(selected, align)}
                            />
                            <NumberField
                              id="tpl-spacing"
                              label={t("letterSpacing")}
                              value={selected.letterSpacing}
                              min={-5}
                              max={40}
                              step={0.5}
                              onChange={(letterSpacing) => patchLayer(selected.id, { letterSpacing }, `spacing-${selected.id}`)}
                            />
                            <NumberField
                              id="tpl-line"
                              label={t("lineHeight")}
                              value={selected.lineHeight}
                              min={0.8}
                              max={3}
                              step={0.1}
                              onChange={(lineHeight) => patchLayer(selected.id, { lineHeight }, `line-${selected.id}`)}
                            />
                          </div>
                          <FormField label={t("color")} htmlFor="tpl-color">
                            <ColorInput id="tpl-color" value={selected.color} onChange={(color) => patchLayer(selected.id, { color }, `color-${selected.id}`)} />
                          </FormField>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Switch
                                checked={selected.fontWeight === 700}
                                disabled={!fontSupportsWeight(selected.font, 700)}
                                onCheckedChange={(on) =>
                                  patchLayer(selected.id, {
                                    fontWeight: on ? 700 : 400,
                                  })
                                }
                              />
                              {t("bold")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <Switch checked={selected.uppercase} onCheckedChange={(uppercase) => patchLayer(selected.id, { uppercase })} />
                              {t("uppercase")}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <Switch
                                checked={selected.shadow !== null}
                                onCheckedChange={(on) =>
                                  patchLayer(selected.id, {
                                    shadow: on
                                      ? {
                                          color: "#000000",
                                          blur: 6,
                                          x: 0,
                                          y: 2,
                                        }
                                      : null,
                                  })
                                }
                              />
                              {t("shadow")}
                            </label>
                          </div>
                          {selected.shadow && (
                            <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                              <div className="col-span-2">
                                <FormField label={t("shadowColor")} htmlFor="tpl-shadow-color">
                                  <ColorInput
                                    id="tpl-shadow-color"
                                    value={selected.shadow.color}
                                    onChange={(color) =>
                                      selected.shadow &&
                                      patchLayer(
                                        selected.id,
                                        {
                                          shadow: { ...selected.shadow, color },
                                        },
                                        `shadow-${selected.id}`,
                                      )
                                    }
                                  />
                                </FormField>
                              </div>
                              <NumberField
                                id="tpl-shadow-blur"
                                label={t("shadowBlur")}
                                value={selected.shadow.blur}
                                min={0}
                                max={40}
                                onChange={(blur) => selected.shadow && patchLayer(selected.id, { shadow: { ...selected.shadow, blur } }, `shadow-${selected.id}`)}
                              />
                              <NumberField
                                id="tpl-shadow-x"
                                label={t("shadowX")}
                                value={selected.shadow.x}
                                min={-30}
                                max={30}
                                onChange={(x) => selected.shadow && patchLayer(selected.id, { shadow: { ...selected.shadow, x } }, `shadow-${selected.id}`)}
                              />
                              <NumberField
                                id="tpl-shadow-y"
                                label={t("shadowY")}
                                value={selected.shadow.y}
                                min={-30}
                                max={30}
                                onChange={(y) => selected.shadow && patchLayer(selected.id, { shadow: { ...selected.shadow, y } }, `shadow-${selected.id}`)}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {selected.type === "image" && (
                        <>
                          <NumberField
                            id="tpl-radius"
                            label={t("radius")}
                            value={selected.radius}
                            min={0}
                            max={500}
                            onChange={(radius) => patchLayer(selected.id, { radius }, `radius-${selected.id}`)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <NumberField
                              id="tpl-border-width"
                              label={t("borderWidth")}
                              value={selected.borderWidth}
                              min={0}
                              max={30}
                              onChange={(borderWidth) => patchLayer(selected.id, { borderWidth }, `bw-${selected.id}`)}
                            />
                            <FormField label={t("borderColor")} htmlFor="tpl-border-color">
                              <ColorInput id="tpl-border-color" value={selected.borderColor} onChange={(borderColor) => patchLayer(selected.id, { borderColor }, `bc-${selected.id}`)} />
                            </FormField>
                          </div>
                        </>
                      )}

                      {selected.type === "shape" && (
                        <>
                          <FormField label={t("color")} htmlFor="tpl-shape-color">
                            <ColorInput id="tpl-shape-color" value={selected.color} onChange={(color) => patchLayer(selected.id, { color }, `color-${selected.id}`)} />
                          </FormField>
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={selected.color2 !== null}
                              onCheckedChange={(on) =>
                                patchLayer(selected.id, {
                                  color2: on ? "#000000" : null,
                                })
                              }
                            />
                            {t("gradient")}
                          </label>
                          {selected.color2 !== null && (
                            <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                              <FormField label={t("color2")} htmlFor="tpl-shape-color2">
                                <ColorInput id="tpl-shape-color2" value={selected.color2} onChange={(color2) => patchLayer(selected.id, { color2 }, `color2-${selected.id}`)} />
                              </FormField>
                              <NumberField
                                id="tpl-angle"
                                label={t("angle")}
                                value={selected.angle}
                                min={0}
                                max={360}
                                onChange={(angle) => patchLayer(selected.id, { angle }, `angle-${selected.id}`)}
                              />
                            </div>
                          )}
                          <NumberField
                            id="tpl-radius"
                            label={t("radius")}
                            value={selected.radius}
                            min={0}
                            max={500}
                            onChange={(radius) => patchLayer(selected.id, { radius }, `radius-${selected.id}`)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <NumberField
                              id="tpl-border-width"
                              label={t("borderWidth")}
                              value={selected.borderWidth}
                              min={0}
                              max={30}
                              onChange={(borderWidth) => patchLayer(selected.id, { borderWidth }, `bw-${selected.id}`)}
                            />
                            <FormField label={t("borderColor")} htmlFor="tpl-border-color">
                              <ColorInput id="tpl-border-color" value={selected.borderColor} onChange={(borderColor) => patchLayer(selected.id, { borderColor }, `bc-${selected.id}`)} />
                            </FormField>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="visibility" className="flex flex-col gap-3 pt-2">
                      <p className="text-xs text-muted-foreground">{t("conditionsHint")}</p>
                      {selected.visible.map((condition, index) => {
                        const values = conditionValues(condition.key);
                        const needsValue = condition.op === "is" || condition.op === "isNot";
                        return (
                          <div key={index} className="flex flex-col gap-2 rounded-md border p-2">
                            <div className="flex items-end gap-1">
                              <div className="min-w-0 flex-1">
                                <GroupedSelect
                                  id={`tpl-cond-key-${index}`}
                                  label={t("conditionKey")}
                                  value={condition.key}
                                  groups={conditionGroups}
                                  labels={conditionKeyLabels}
                                  onChange={(key) =>
                                    patchCondition(selected, index, {
                                      key,
                                      value: conditionValues(key)?.[0] ?? "",
                                    })
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("removeCondition")}
                                onClick={() =>
                                  patchLayer(selected.id, {
                                    visible: selected.visible.filter((_, i) => i !== index),
                                  })
                                }
                              >
                                <X />
                              </Button>
                            </div>
                            <SimpleSelect
                              id={`tpl-cond-op-${index}`}
                              label={t("conditionOp")}
                              value={condition.op}
                              items={opItems}
                              onChange={(op: TemplateCondition["op"]) => patchCondition(selected, index, { op })}
                            />
                            {needsValue &&
                              (values ? (
                                <SimpleSelect
                                  id={`tpl-cond-value-${index}`}
                                  label={t("conditionValueLabel")}
                                  value={values.includes(condition.value) ? condition.value : (values[0] ?? "")}
                                  items={Object.fromEntries(values.map((v) => [v, conditionValueLabel(v)]))}
                                  onChange={(value) => patchCondition(selected, index, { value })}
                                />
                              ) : (
                                <FormField label={t("conditionValueLabel")} htmlFor={`tpl-cond-value-${index}`}>
                                  <Input
                                    id={`tpl-cond-value-${index}`}
                                    value={condition.value}
                                    maxLength={100}
                                    onChange={(e) =>
                                      patchCondition(selected, index, {
                                        value: e.target.value,
                                      })
                                    }
                                  />
                                </FormField>
                              ))}
                          </div>
                        );
                      })}
                      <Button type="button" variant="outline" size="sm" onClick={() => addCondition(selected)} disabled={selected.visible.length >= TEMPLATE_LIMITS.conditions}>
                        <Plus />
                        {t("addCondition")}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </fieldset>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{t("layoutLayer")}</p>
                <div className="flex flex-col gap-2 rounded-md border p-2">
                  <SimpleSelect id="tpl-preset" label={t("templateLabel")} value={preset ?? presets.at(-1) ?? "score"} items={presetItems} onChange={(value: TemplatePreset) => setPreset(value)} />
                  <Button type="button" variant="outline" size="sm" onClick={applyPreset}>
                    <Layers />
                    {t("applyTemplate")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
                </div>
                <NumberField
                  id="tpl-canvas-height"
                  label={t("canvasHeight")}
                  value={template.height}
                  min={TEMPLATE_LIMITS.minHeight}
                  max={TEMPLATE_LIMITS.maxHeight}
                  onChange={(height) => update((prev) => ({ ...prev, height }), "canvas-height")}
                />
                <FormField label={t("backgroundColor")} htmlFor="tpl-bg">
                  <ColorInput id="tpl-bg" value={template.backgroundColor} onChange={(value) => update((prev) => ({ ...prev, backgroundColor: value }), "background")} />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={template.footer} onCheckedChange={(footer) => update((prev) => ({ ...prev, footer }))} />
                  {t("footer")}
                </label>

                <div className="flex flex-col gap-3 rounded-md border p-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Switch
                      checked={template.artwork.enabled}
                      onCheckedChange={(enabled) =>
                        update((prev) => ({
                          ...prev,
                          artwork: { ...prev.artwork, enabled },
                        }))
                      }
                    />
                    {t("artwork")}
                  </label>
                  {template.artwork.enabled && (
                    <>
                      <SimpleSelect
                        id="tpl-artwork-source"
                        label={t("artworkSource")}
                        value={template.artwork.source}
                        items={artworkItems}
                        onChange={(source) =>
                          update((prev) => ({
                            ...prev,
                            artwork: { ...prev.artwork, source },
                          }))
                        }
                      />
                      <SliderField
                        id="tpl-artwork-dim"
                        label={t("artworkDim")}
                        value={template.artwork.dim}
                        min={0}
                        max={1}
                        step={0.05}
                        display={`${Math.round(template.artwork.dim * 100)}%`}
                        onChange={(dim) =>
                          update(
                            (prev) => ({
                              ...prev,
                              artwork: { ...prev.artwork, dim },
                            }),
                            "artwork-dim",
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">{t("artworkHint")}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {issues.length > 0 && (
          <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
        <Dialog open={testOpen} onOpenChange={(next) => !isSendingTest && setTestOpen(next)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("sendTest")}</DialogTitle>
              <DialogDescription>{t("sendTestHint")}</DialogDescription>
            </DialogHeader>
            <FormField label={t("testChannel")} htmlFor="tpl-test-channel" required error={testError}>
              <Select
                items={Object.fromEntries((channels ?? []).map((c) => [c.id, `#${c.name}`]))}
                value={testChannel || null}
                onValueChange={(v) => {
                  if (!v) return;
                  setTestChannel(v);
                  setTestError(null);
                }}
              >
                <SelectTrigger id="tpl-test-channel" className="w-full" aria-invalid={!!testError}>
                  <SelectValue placeholder={t("testChannelPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(channels ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`#${c.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestOpen(false)} disabled={isSendingTest}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={handleSendTest} disabled={isSendingTest}>
                {isSendingTest ? <Loader2 className="animate-spin" /> : <Send />}
                {isSendingTest ? t("sending") : t("sendTestAction")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={picker !== null} onOpenChange={(next) => !next && setPicker(null)}>
          <DialogContent className="flex h-[70vh] flex-col gap-3 sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("pickImage")}</DialogTitle>
              <DialogDescription>{t("pickImageHint")}</DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <div className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-y-auto">
                {TEMPLATE_IMAGE_CATEGORIES.map((c) => (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => setPickerCategory(c.category)}
                    aria-pressed={c.category === pickerCategory}
                    className={`shrink-0 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors active:scale-[0.98] ${c.category === pickerCategory ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {t(`imageCategory.${c.category}`)}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                {pickerCategory === "custom" ? (
                  <div className="flex flex-col gap-3 rounded-md border p-3">
                    <FormField label={t("customUrl")} htmlFor="tpl-picker-url" required error={customUrlError} hint={t("customUrlHint")}>
                      <Input
                        id="tpl-picker-url"
                        type="url"
                        value={customUrl}
                        maxLength={TEMPLATE_IMAGE_URL_MAX}
                        placeholder="https://"
                        onChange={(e) => {
                          setCustomUrl(e.target.value);
                          setCustomUrlError(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && submitCustomUrl()}
                      />
                    </FormField>
                    <Button type="button" onClick={submitCustomUrl}>
                      {t("useImage")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-md border p-1">
                    {(TEMPLATE_IMAGE_CATEGORIES.find((c) => c.category === pickerCategory)?.sources ?? []).map((source) => {
                      const { size } = imageCategoryOf(source);
                      return (
                        <button
                          key={source}
                          type="button"
                          onClick={() => choosePicture(source)}
                          className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted active:scale-[0.99] active:bg-primary active:text-primary-foreground"
                        >
                          <span>{sourceLabel(source)}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{`${size.width} x ${size.height}`}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
          <DialogContent className="flex h-[70vh] flex-col gap-3 sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("insertVariable")}</DialogTitle>
              <DialogDescription>{t("insertVariableHint")}</DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <div className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-y-auto">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setVariableGroup(c === "maps" ? "map1" : c === "vetos" ? "veto1" : c)}
                    aria-pressed={c === category}
                    className={`shrink-0 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors active:scale-[0.98] ${c === category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {categoryLabel(c)}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                {(category === "maps" || category === "vetos") && (
                  <div className="flex flex-wrap gap-1">
                    {numbered[category].map((g, i) => (
                      <Chip key={g} active={g === variableGroup} onClick={() => setVariableGroup(g)}>
                        {i + 1}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-md border p-1">
                  {pickerKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (selected) insertVariable(selected, key);
                        setVariablesOpen(false);
                      }}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted active:scale-[0.99] active:bg-primary active:text-primary-foreground"
                    >
                      <span>{variableLabel(key)}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{`{${key}}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
