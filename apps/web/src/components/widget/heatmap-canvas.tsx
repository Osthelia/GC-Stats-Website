/**
 * GC-Stats - heatmap-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef } from "react";
import type { HeatmapPosition } from "@/lib/widget-data";

/**
 * Player position heatmap renderer — ported 1:1 from V1's
 * resources/js/public/heatmap/index.js. Density is a real 2D histogram, not
 * a canvas-compositing trick: points are binned into a coarse grid,
 * box-blurred a few passes (cheap stand-in for a gaussian blur), then every
 * cell is colored relative to the single busiest cell in this render (cell
 * density / max density) — a zone with half the traffic of the hottest zone
 * always renders at ~50% intensity, whether the filtered dataset has 300
 * points or 30,000. See V1's file for the full rationale (alpha-compositing
 * an earlier version tried saturates too easily on a lightly-filtered set).
 */

// Higher resolution than a first pass (96) — smoothing comes from finer
// cells + a gentle blur (mainly anti-aliasing cell boundaries) rather than a
// wide blur kernel, which was inflating the highlighted area past the
// actual data footprint.
const GRID_SIZE = 160;

// Below this fraction of the busiest cell, a cell is noise (a stray point)
// and hidden outright rather than compressed.
const NOISE_FLOOR = 0.015;

// Gamma applied to the max-relative ratio before the color ramp. A linear
// ratio makes secondary zones vanish (a third-as-busy route reads as
// empty); gamma < 1 (sqrt) lifts low/mid ratios more than high ones without
// touching the endpoints, so the hottest zone still reads as the peak while
// secondary zones stay visible.
const CONTRAST_GAMMA = 0.5;

const DEFAULT_COLOR = "2a78d6";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixToward(rgb: Rgb, target: Rgb, t: number): Rgb {
  return rgb.map((c, i) => c + (target[i]! - c) * t) as Rgb;
}

type RampStop = { stop: number; rgb: Rgb; alpha: number };

function buildRamp(baseHex: string): RampStop[] {
  const base = hexToRgb(baseHex) ?? hexToRgb(DEFAULT_COLOR)!;
  const white: Rgb = [255, 255, 255];
  const black: Rgb = [0, 0, 0];

  return [
    { stop: 0, rgb: mixToward(base, white, 0.82), alpha: 0 },
    { stop: 0.15, rgb: mixToward(base, white, 0.62), alpha: 0.25 },
    { stop: 0.35, rgb: mixToward(base, white, 0.32), alpha: 0.45 },
    { stop: 0.55, rgb: base, alpha: 0.65 },
    { stop: 0.75, rgb: mixToward(base, black, 0.25), alpha: 0.8 },
    { stop: 1, rgb: mixToward(base, black, 0.55), alpha: 0.92 },
  ];
}

function rampColor(ramp: RampStop[], t: number): { r: number; g: number; b: number; a: number } {
  t = Math.max(0, Math.min(1, t));
  let lower = ramp[0]!;
  let upper = ramp[ramp.length - 1]!;

  for (let i = 0; i < ramp.length - 1; i++) {
    if (t >= ramp[i]!.stop && t <= ramp[i + 1]!.stop) {
      lower = ramp[i]!;
      upper = ramp[i + 1]!;
      break;
    }
  }

  const span = upper.stop - lower.stop || 1;
  const localT = (t - lower.stop) / span;

  return {
    r: lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * localT,
    g: lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * localT,
    b: lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * localT,
    a: lower.alpha + (upper.alpha - lower.alpha) * localT,
  };
}

// Separable box blur (radius-tap), applied a few times — approximates a
// gaussian blur far cheaper than a real kernel at this grid resolution.
function boxBlur(grid: Float32Array<ArrayBuffer>, size: number, radius: number): Float32Array<ArrayBuffer> {
  const horizontal = new Float32Array(grid.length);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= size) continue;
        sum += grid[y * size + nx]!;
        count++;
      }
      horizontal[y * size + x] = sum / count;
    }
  }

  const blurred = new Float32Array(grid.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= size) continue;
        sum += horizontal[ny * size + x]!;
        count++;
      }
      blurred[y * size + x] = sum / count;
    }
  }

  return blurred;
}

function buildDensityGrid(positions: HeatmapPosition[]): Float32Array<ArrayBuffer> {
  let density = new Float32Array(GRID_SIZE * GRID_SIZE);

  for (const point of positions) {
    const gx = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(point.x * GRID_SIZE)));
    const gy = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(point.y * GRID_SIZE)));
    density[gy * GRID_SIZE + gx]! += 1;
  }

  for (let pass = 0; pass < 4; pass++) {
    density = boxBlur(density, GRID_SIZE, 1);
  }

  return density;
}

function render(canvas: HTMLCanvasElement, positions: HeatmapPosition[], ramp: RampStop[]) {
  const wrapper = canvas.parentElement;
  if (!wrapper) return;
  const size = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size.width * dpr;
  canvas.height = size.height * dpr;
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (positions.length === 0) return;

  const density = buildDensityGrid(positions);

  let max = 0;
  for (let i = 0; i < density.length; i++) if (density[i]! > max) max = density[i]!;
  if (max === 0) return;

  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = GRID_SIZE;
  gridCanvas.height = GRID_SIZE;
  const gridCtx = gridCanvas.getContext("2d");
  if (!gridCtx) return;
  const imageData = gridCtx.createImageData(GRID_SIZE, GRID_SIZE);
  const data = imageData.data;

  for (let i = 0; i < density.length; i++) {
    const rawRatio = density[i]! / max;
    const o = i * 4;

    if (rawRatio <= NOISE_FLOOR) {
      data[o + 3] = 0;
      continue;
    }

    const color = rampColor(ramp, Math.pow(rawRatio, CONTRAST_GAMMA));
    data[o] = color.r;
    data[o + 1] = color.g;
    data[o + 2] = color.b;
    data[o + 3] = color.a * 255;
  }

  gridCtx.putImageData(imageData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(gridCanvas, 0, 0, canvas.width, canvas.height);

  // A light native blur on top of the upscaled grid — cheap
  // (GPU-composited), just enough to anti-alias the last hard cell edges.
  // Kept small and non-scaling: a size-relative blur previously grew the
  // highlighted area well past where the data actually is.
  canvas.style.filter = "blur(3.5px)";
}

export function HeatmapCanvas({ positions, color, label }: { positions: HeatmapPosition[]; color: string | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ramp = buildRamp(color || DEFAULT_COLOR);

    render(canvas, positions, ramp);
    const onResize = () => render(canvas, positions, ramp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [positions, color]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className="absolute inset-0 h-full w-full" />;
}
