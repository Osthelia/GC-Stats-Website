/**
 * GC-Stats - discord-template-canvas
 *
 * Konva canvas of the alert template editor: draws the layers and lets the user move, resize and rotate them.
 * Loaded on demand only (Konva needs the browser).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/oswald/latin-400.css";
import "@fontsource/oswald/latin-700.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-700.css";
import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/russo-one/latin-400.css";
import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/teko/latin-400.css";
import "@fontsource/teko/latin-700.css";
import "@fontsource/anton/latin-400.css";

import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { isLayerLocked } from "@/lib/discord-bot/layer-folders";
import { conditionsPass, TEMPLATE_CANVAS, TEMPLATE_FONTS, TEMPLATE_FOOTER_HEIGHT, textLayerValue, type AlertTemplate, type TemplateLayer } from "@/lib/discord-bot/template";

const SELECTION_COLOR = "#3b82f6";
const MIN_SIZE = 10;
// Layers hidden by their conditions for the sample data stay editable, only faded.
const HIDDEN_OPACITY = 0.25;
// Distance (canvas pixels) under which a dragged layer sticks to a guide.
const SNAP_DISTANCE = 6;
const GUIDE_COLOR = "#ec4899";

export type LayerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type CanvasProps = {
  template: AlertTemplate;
  /** Public URL of the custom background image. */
  backgroundUrl: string | null;
  /** Sample values of the texts and conditions. */
  fields: Record<string, string>;
  /** Sample picture per image source. */
  images: Record<string, string | null>;
  /** Language of the date texts. */
  locale: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called with the new box of a layer after a drag, a resize or a rotation. */
  onChange: (id: string, box: LayerBox) => void;
};

function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [state, setState] = useState<{
    url: string;
    image: HTMLImageElement;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    const image = new window.Image();
    image.onload = () => setState({ url, image });
    image.src = url;
  }, [url]);
  return url && state?.url === url ? state.image : null;
}

/** Bumps once the fonts used by the layers are ready, so Konva redraws text with the right face. */
function useFontsReady(template: AlertTemplate): number {
  const [ready, setReady] = useState(0);
  const key = template.layers.map((l) => (l.type === "text" ? `${l.font}:${l.fontWeight}` : "")).join("|");
  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(template.layers.flatMap((l) => (l.type === "text" ? [`${l.fontWeight} 20px "${TEMPLATE_FONTS.find((f) => f.id === l.font)?.name}"`] : [])));
    Promise.all([...wanted].map((font) => document.fonts.load(font).catch(() => []))).then(() => {
      if (!cancelled) setReady((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // `key` is the font signature of the layers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || ""
  );
}

// CSS linear-gradient angle (0 = to top, clockwise) to Konva start and end points.
function gradientPoints(angle: number, width: number, height: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return {
    start: { x: cx - dx * half, y: cy - dy * half },
    end: { x: cx + dx * half, y: cy + dy * half },
  };
}

// Crop of a picture so it covers a box of the given ratio.
function coverCrop(image: HTMLImageElement, ratio: number) {
  const natural = image.naturalWidth / image.naturalHeight;
  const width = natural > ratio ? image.naturalHeight * ratio : image.naturalWidth;
  const height = natural > ratio ? image.naturalHeight : image.naturalWidth / ratio;
  return {
    x: (image.naturalWidth - width) / 2,
    y: (image.naturalHeight - height) / 2,
    width,
    height,
  };
}

function Tile({ width, height, radius, label }: { width: number; height: number; radius: number; label: string }) {
  return (
    <>
      <Rect width={width} height={height} fill="#2a2d38" cornerRadius={radius} />
      {label && <Text width={width} height={height} text={label} align="center" verticalAlign="middle" fontStyle="bold" fontSize={Math.min(width, height) / 3} fill="#b8bcc8" />}
    </>
  );
}

/** Sample picture of an image layer, a tile with the initials when there is none. */
function PictureNode({ url, width, height, fit, radius, label }: { url: string | null; width: number; height: number; fit: "cover" | "contain"; radius: number; label: string }) {
  const image = useLoadedImage(url);
  if (!image) return <Tile width={width} height={height} radius={radius} label={label} />;

  if (fit === "contain") {
    const natural = image.naturalWidth / image.naturalHeight;
    const w = natural > width / height ? width : height * natural;
    const h = natural > width / height ? width / natural : height;
    return <KonvaImage image={image} x={(width - w) / 2} y={(height - h) / 2} width={w} height={h} cornerRadius={radius} />;
  }
  return <KonvaImage image={image} width={width} height={height} cornerRadius={radius} crop={coverCrop(image, width / height)} />;
}

function LayerContent({ layer, fields, images, locale }: { layer: TemplateLayer; fields: Record<string, string>; images: Record<string, string | null>; locale: string }) {
  const { width, height } = layer;

  if (layer.type === "shape") {
    const gradient = layer.color2 ? gradientPoints(layer.angle, width, height) : null;
    return (
      <Rect
        width={width}
        height={height}
        cornerRadius={layer.radius}
        {...(gradient
          ? {
              fillLinearGradientStartPoint: gradient.start,
              fillLinearGradientEndPoint: gradient.end,
              fillLinearGradientColorStops: [0, layer.color, 1, layer.color2 as string],
            }
          : { fill: layer.color })}
        stroke={layer.borderWidth > 0 ? layer.borderColor : undefined}
        strokeWidth={layer.borderWidth}
      />
    );
  }

  if (layer.type === "image") {
    const label =
      layer.source === "teamA" || layer.source === "teamB"
        ? initials(fields[layer.source] ?? "")
        : layer.source === "mvp"
          ? initials(fields["mvp.name"] ?? "")
          : layer.source === "mvpAgent"
            ? initials(fields["mvp.agent"] ?? "")
            : "";
    return (
      <>
        <PictureNode url={(layer.source === "custom" ? layer.url : images[layer.source]) || null} width={width} height={height} fit={layer.fit} radius={layer.radius} label={label} />
        {layer.borderWidth > 0 && <Rect width={width} height={height} cornerRadius={layer.radius} stroke={layer.borderColor} strokeWidth={layer.borderWidth} listening={false} />}
      </>
    );
  }

  const value = textLayerValue(layer, fields, locale);
  return (
    <Text
      width={width}
      height={height}
      text={layer.uppercase ? value.toUpperCase() : value}
      align={layer.align}
      verticalAlign="middle"
      fontSize={layer.fontSize}
      fontStyle={layer.fontWeight === 700 ? "bold" : "normal"}
      fontFamily={`"${TEMPLATE_FONTS.find((f) => f.id === layer.font)?.name ?? "Inter"}", sans-serif`}
      fill={layer.color}
      letterSpacing={layer.letterSpacing}
      lineHeight={layer.lineHeight}
      {...(layer.shadow
        ? {
            shadowColor: layer.shadow.color,
            shadowBlur: layer.shadow.blur,
            shadowOffsetX: layer.shadow.x,
            shadowOffsetY: layer.shadow.y,
            shadowOpacity: 1,
          }
        : {})}
    />
  );
}

export default function DiscordTemplateCanvas({ template, backgroundUrl, fields, images, locale, selectedId, onSelect, onChange }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const [width, setWidth] = useState<number>(TEMPLATE_CANVAS.width);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const background = useLoadedImage(template.backgroundImageId ? backgroundUrl : null);
  const artwork = useLoadedImage(template.artwork.enabled && !template.backgroundImageId ? (images[template.artwork.source] ?? null) : null);
  const fontsReady = useFontsReady(template);
  const scale = width / TEMPLATE_CANVAS.width;
  const totalHeight = template.height + (template.footer ? TEMPLATE_FOOTER_HEIGHT : 0);
  const selectedLayer = template.layers.find((l) => l.id === selectedId);
  const selectedLocked = selectedLayer ? isLayerLocked(template, selectedLayer) : false;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(element.clientWidth, 200)));
    observer.observe(element);
    setWidth(Math.max(element.clientWidth, 200));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    transformerRef.current?.nodes(node ? [node] : []);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedId, template.layers.length]);

  function commit(layer: TemplateLayer, node: Konva.Node) {
    // The transformer scales the node, bake the scale into the box. The node origin is the center of the layer.
    const w = Math.max(MIN_SIZE, node.width() * node.scaleX());
    const h = Math.max(MIN_SIZE, node.height() * node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    const cx = Math.min(Math.max(node.x(), 0), TEMPLATE_CANVAS.width);
    const cy = Math.min(Math.max(node.y(), 0), template.height);
    let rotation = Math.round(node.rotation());
    if (rotation > 180) rotation -= 360;
    if (rotation < -180) rotation += 360;
    const boxWidth = Math.round(Math.min(w, TEMPLATE_CANVAS.width));
    const boxHeight = Math.round(Math.min(h, template.height));
    onChange(layer.id, {
      x: Math.min(Math.max(Math.round(cx - boxWidth / 2), 0), TEMPLATE_CANVAS.width - boxWidth),
      y: Math.min(Math.max(Math.round(cy - boxHeight / 2), 0), template.height - boxHeight),
      width: boxWidth,
      height: boxHeight,
      rotation,
    });
  }

  // Snaps the dragged layer edges and center to the canvas and the other layers, and shows the matching guides.
  // Keeps a dragged layer box inside the image.
  function keepInside(layer: TemplateLayer, node: Konva.Node) {
    const halfW = layer.width / 2;
    const halfH = layer.height / 2;
    node.x(Math.min(Math.max(node.x(), halfW), TEMPLATE_CANVAS.width - halfW));
    node.y(Math.min(Math.max(node.y(), halfH), template.height - halfH));
  }

  function snap(layer: TemplateLayer, node: Konva.Node) {
    keepInside(layer, node);
    if (layer.rotation !== 0) return;
    const xs = [0, TEMPLATE_CANVAS.width / 2, TEMPLATE_CANVAS.width];
    const ys = [0, template.height / 2, template.height];
    for (const other of template.layers) {
      if (other.id === layer.id || other.rotation !== 0) continue;
      xs.push(other.x, other.x + other.width / 2, other.x + other.width);
      ys.push(other.y, other.y + other.height / 2, other.y + other.height);
    }
    const closest = (own: number[], targets: number[]) => {
      let best: { delta: number; at: number } | null = null;
      for (const value of own) {
        for (const target of targets) {
          const delta = target - value;
          if (Math.abs(delta) <= SNAP_DISTANCE && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: target };
        }
      }
      return best;
    };
    const left = node.x() - layer.width / 2;
    const top = node.y() - layer.height / 2;
    const snapX = closest([left, left + layer.width / 2, left + layer.width], xs);
    const snapY = closest([top, top + layer.height / 2, top + layer.height], ys);
    if (snapX) node.x(node.x() + snapX.delta);
    if (snapY) node.y(node.y() + snapY.delta);
    keepInside(layer, node);
    setGuides({ x: snapX?.at ?? null, y: snapY?.at ?? null });
  }

  function register(id: string) {
    return (node: Konva.Node | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    };
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-md border bg-muted" style={{ height: totalHeight * scale }}>
      <Stage
        width={width}
        height={totalHeight * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(event) => event.target === event.target.getStage() && onSelect(null)}
        onTouchStart={(event) => event.target === event.target.getStage() && onSelect(null)}
      >
        <Layer key={fontsReady}>
          <Rect width={TEMPLATE_CANVAS.width} height={totalHeight} fill={template.backgroundColor} onMouseDown={() => onSelect(null)} />
          {background && <KonvaImage image={background} width={TEMPLATE_CANVAS.width} height={template.height} listening={false} />}
          {artwork && (
            <>
              <KonvaImage image={artwork} width={TEMPLATE_CANVAS.width} height={template.height} listening={false} crop={coverCrop(artwork, TEMPLATE_CANVAS.width / template.height)} />
              <Rect width={TEMPLATE_CANVAS.width} height={template.height} fill="#0e0e0e" opacity={template.artwork.dim} listening={false} />
            </>
          )}

          {template.layers.map((layer) => (
            <Group
              key={layer.id}
              ref={register(layer.id)}
              x={layer.x + layer.width / 2}
              y={layer.y + layer.height / 2}
              offsetX={layer.width / 2}
              offsetY={layer.height / 2}
              width={layer.width}
              height={layer.height}
              rotation={layer.rotation}
              opacity={layer.opacity * (conditionsPass(layer.visible, fields) ? 1 : HIDDEN_OPACITY)}
              draggable={!isLayerLocked(template, layer)}
              onMouseDown={() => onSelect(layer.id)}
              onTouchStart={() => onSelect(layer.id)}
              onDragMove={(event) => snap(layer, event.target)}
              onDragEnd={(event) => {
                setGuides({ x: null, y: null });
                commit(layer, event.target);
              }}
              onTransformEnd={(event) => commit(layer, event.target)}
            >
              {/* Hit area, so empty or thin layers stay easy to grab. */}
              <Rect width={layer.width} height={layer.height} fill="rgba(0,0,0,0.001)" />
              <LayerContent layer={layer} fields={fields} images={images} locale={locale} />
            </Group>
          ))}

          {template.footer && (
            <>
              <Text
                x={40}
                y={template.height}
                width={400}
                height={TEMPLATE_FOOTER_HEIGHT}
                verticalAlign="middle"
                text="GC STATS"
                fontSize={20}
                fontStyle="bold"
                fontFamily='"Oswald", sans-serif'
                fill="#e4ae22"
                listening={false}
              />
              <Text
                x={460}
                y={template.height}
                width={500}
                height={TEMPLATE_FOOTER_HEIGHT}
                verticalAlign="middle"
                align="right"
                text={`${window.location.host}/match/0`}
                fontSize={20}
                fontFamily='"Oswald", sans-serif'
                fill="#8a8a94"
                listening={false}
              />
            </>
          )}

          {guides.x !== null && <Line points={[guides.x, 0, guides.x, totalHeight]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} dash={[4 / scale, 4 / scale]} listening={false} />}
          {guides.y !== null && <Line points={[0, guides.y, TEMPLATE_CANVAS.width, guides.y]} stroke={GUIDE_COLOR} strokeWidth={1 / scale} dash={[4 / scale, 4 / scale]} listening={false} />}

          <Transformer
            ref={transformerRef}
            rotateEnabled={!selectedLocked}
            resizeEnabled={!selectedLocked}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            flipEnabled={false}
            borderStroke={SELECTION_COLOR}
            anchorStroke={SELECTION_COLOR}
            anchorSize={9}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) return oldBox;
              // The box is in screen pixels, a resize cannot push an upright layer out of the image.
              const outside = newBox.x < -0.5 || newBox.y < -0.5 || newBox.x + newBox.width > TEMPLATE_CANVAS.width * scale + 0.5 || newBox.y + newBox.height > template.height * scale + 0.5;
              return newBox.rotation === 0 && outside ? oldBox : newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
