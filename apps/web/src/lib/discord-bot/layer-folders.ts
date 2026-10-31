/**
 * GC-Stats - layer-folders
 *
 * Folder and lock rules of the template layers, shared by the editor list and the canvas.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AlertTemplate, TemplateFolder, TemplateLayer } from "./template";

/** Prefix of the sortable id of a folder row, to tell it from a layer id. */
export const FOLDER_ROW_PREFIX = "folder:";
/** Anchor of an empty folder shown under every layer. */
export const FOLDER_ANCHOR_END = "@end";

export type LayerRow = { kind: "folder"; folder: TemplateFolder } | { kind: "layer"; layer: TemplateLayer };

/** True when the layer or its folder is locked. */
export function isLayerLocked(template: Pick<AlertTemplate, "folders">, layer: Pick<TemplateLayer, "locked" | "folderId">): boolean {
  return layer.locked || (layer.folderId !== null && (template.folders.find((f) => f.id === layer.folderId)?.locked ?? false));
}

// Gathers the members of each folder at the position of its first member.
function gather(layers: TemplateLayer[]): TemplateLayer[] {
  const done = new Set<string>();
  return layers.flatMap((layer) => {
    if (layer.folderId === null) return [layer];
    if (done.has(layer.folderId)) return [];
    done.add(layer.folderId);
    return layers.filter((l) => l.folderId === layer.folderId);
  });
}

// Index (front first) of the layer an empty folder is shown above, moved to the start of its folder block.
function emptySlot(shown: TemplateLayer[], folder: TemplateFolder): number {
  if (folder.anchor === FOLDER_ANCHOR_END) return shown.length;
  let index = Math.max(
    0,
    shown.findIndex((l) => l.id === folder.anchor),
  );
  while (index > 0 && shown[index]?.folderId && shown[index - 1]?.folderId === shown[index]?.folderId) index--;
  return index;
}

/** Rows of the layers list, front first. A folder row comes before its layers, an empty folder sits at its anchor. */
export function buildLayerRows(template: AlertTemplate): LayerRow[] {
  const shown = [...template.layers].reverse();
  const empties = template.folders.filter((f) => !shown.some((l) => l.folderId === f.id)).map((folder) => ({ folder, slot: emptySlot(shown, folder) }));
  const rows: LayerRow[] = [];
  const pushEmpties = (slot: number) => empties.filter((e) => e.slot === slot).forEach((e) => rows.push({ kind: "folder", folder: e.folder }));
  const seen = new Set<string>();
  shown.forEach((layer, i) => {
    pushEmpties(i);
    const folder = layer.folderId ? template.folders.find((f) => f.id === layer.folderId) : undefined;
    if (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      rows.push({ kind: "folder", folder });
    }
    if (!folder?.collapsed) rows.push({ kind: "layer", layer });
  });
  pushEmpties(shown.length);
  return rows;
}

/** Puts a layer in a folder (or out of it with null), next to the other members. */
export function assignFolder(template: AlertTemplate, layerId: string, folderId: string | null): AlertTemplate {
  const layers = template.layers.map((l) => (l.id === layerId ? { ...l, folderId } : l));
  return { ...template, layers: gather(layers) };
}

// An empty folder has no layer to follow: it moves by changing the layer it is shown above.
function moveEmptyFolder(template: AlertTemplate, shown: TemplateLayer[], folder: TemplateFolder, overId: string, overFolderId: string | null): AlertTemplate {
  const setAnchor = (anchor: string, folders = template.folders): AlertTemplate => ({ ...template, folders: folders.map((f) => (f.id === folder.id ? { ...f, anchor } : f)) });
  const overFolder = overFolderId !== null ? template.folders.find((f) => f.id === overFolderId) : undefined;

  if (overFolder) {
    if (overFolder.id === folder.id) return template;
    const top = shown.find((l) => l.folderId === overFolder.id);
    if (top) return setAnchor(top.id);
    // Two empty folders swap their place in the list.
    const folders = template.folders.filter((f) => f.id !== folder.id);
    folders.splice(
      folders.findIndex((f) => f.id === overFolder.id),
      0,
      folder,
    );
    return setAnchor(overFolder.anchor ?? shown[0]?.id ?? FOLDER_ANCHOR_END, folders);
  }

  const target = shown.find((l) => l.id === overId);
  if (!target) return template;
  const inBlock = (l: TemplateLayer | undefined) => target.folderId !== null && l?.folderId === target.folderId;
  let start = shown.indexOf(target);
  while (start > 0 && inBlock(shown[start - 1])) start--;
  let end = shown.indexOf(target);
  while (end + 1 < shown.length && inBlock(shown[end + 1])) end++;
  const movingDown = emptySlot(shown, folder) <= start;
  return setAnchor(movingDown ? (shown[end + 1]?.id ?? FOLDER_ANCHOR_END) : (shown[start]?.id ?? FOLDER_ANCHOR_END));
}

/**
 * Applies a drag in the layers list. Rows are shown front first, `over` is a layer id or a folder row id.
 * A layer takes the folder of the row it lands on (coming from below, a folder row means just above the folder),
 * a folder row moves the whole folder.
 */
export function dropLayerRow(template: AlertTemplate, activeId: string, overId: string): AlertTemplate {
  const folderOf = (id: string) => (id.startsWith(FOLDER_ROW_PREFIX) ? id.slice(FOLDER_ROW_PREFIX.length) : null);
  const shown = [...template.layers].reverse();
  const activeFolder = folderOf(activeId);
  const overFolder = folderOf(overId);
  const finish = (list: TemplateLayer[]): AlertTemplate => ({ ...template, layers: gather(list).reverse() });

  if (activeFolder !== null) {
    const folder = template.folders.find((f) => f.id === activeFolder);
    if (!folder) return template;
    const group = shown.filter((l) => l.folderId === activeFolder);
    const groupTop = group[0];
    if (!groupTop) return moveEmptyFolder(template, shown, folder, overId, overFolder);
    const target = overFolder !== null ? shown.find((l) => l.folderId === overFolder) : shown.find((l) => l.id === overId);
    if (!target || target.folderId === activeFolder) return template;
    const block = target.folderId !== null ? shown.filter((l) => l.folderId === target.folderId) : [target];
    const rest = shown.filter((l) => l.folderId !== activeFolder);
    // Dropping on the lower neighbor goes under its whole block, on the upper one goes above it.
    const down = shown.indexOf(groupTop) < shown.indexOf(target);
    rest.splice(rest.indexOf(block[0] ?? target) + (down ? block.length : 0), 0, ...group);
    return finish(rest);
  }

  const layer = shown.find((l) => l.id === activeId);
  if (!layer) return template;

  if (overFolder !== null) {
    const rest = shown.filter((l) => l !== layer);
    const first = rest.find((l) => l.folderId === overFolder);
    // An empty folder has no place in the stack, the layer keeps its own.
    if (!first) return finish(shown.map((l) => (l === layer ? { ...l, folderId: overFolder } : l)));
    // From below the folder the layer goes just above it, from above (or from inside) it opens the folder.
    const fromBelow = layer.folderId !== overFolder && shown.indexOf(layer) > shown.indexOf(first);
    rest.splice(rest.indexOf(first), 0, { ...layer, folderId: fromBelow ? null : overFolder });
    return finish(rest);
  }

  const target = shown.find((l) => l.id === overId);
  if (!target || target === layer) return template;
  const moved = { ...layer, folderId: target.folderId };
  const down = shown.indexOf(layer) < shown.indexOf(target);
  const rest = shown.filter((l) => l !== layer);
  rest.splice(rest.indexOf(target) + (down ? 1 : 0), 0, moved);
  return finish(rest);
}
