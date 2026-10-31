/**
 * GC-Stats - use-image-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ImageCropDialog, type ImageFieldVariant } from "@/components/forms/image-crop-dialog";
import { IMAGE_PRESETS, checkImageSource, type ImagePresetName, type ImageSourceError } from "@/lib/image-upload";

type Source = { name: string; url: string };

/**
 * File choice, constraint check and crop dialog, shared by the upload field and by
 * the buttons that upload straight away (news images). `onPick` receives the cropped file.
 */
export function useImagePicker({ preset: presetName, variant = "app", onPick }: { preset: ImagePresetName; variant?: ImageFieldVariant; onPick: (file: File) => void }) {
  const preset = IMAGE_PRESETS[presetName];
  const inputRef = useRef<HTMLInputElement>(null);
  // `source` is the original behind the current result, `pending` a file picked but not cropped yet.
  const [source, setSource] = useState<Source | null>(null);
  const [pending, setPending] = useState<Source | null>(null);
  const [cropping, setCropping] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ImageSourceError | null>(null);
  const urls = useRef({ source: null as Source | null, pending: null as Source | null });
  urls.current = { source, pending };

  useEffect(() => {
    return () => {
      for (const entry of [urls.current.source, urls.current.pending]) if (entry) URL.revokeObjectURL(entry.url);
    };
  }, []);

  async function handleFile(picked: File | null) {
    if (!picked) return;
    setError(null);
    setChecking(true);
    const result = await checkImageSource(picked, preset);
    setChecking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (preset.keepGif && picked.type === "image/gif") {
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      onPick(picked);
      return;
    }
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { name: picked.name, url: URL.createObjectURL(picked) };
    });
    setCropping(true);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    void handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  /** Drops every original and closes the crop, used when the parent clears its value. */
  const reset = useCallback(() => {
    setCropping(false);
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const active = pending ?? source;

  const element: ReactNode = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={preset.accept.join(",")}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {cropping && active && (
        <ImageCropDialog
          src={active.url}
          fileName={active.name}
          preset={preset}
          variant={variant}
          onCancel={() => {
            setCropping(false);
            // Cancelling a new pick keeps the previous result and its original.
            setPending((prev) => {
              if (prev) URL.revokeObjectURL(prev.url);
              return null;
            });
          }}
          onConfirm={(cropped) => {
            setCropping(false);
            setError(null);
            if (pending) {
              setSource((prev) => {
                if (prev) URL.revokeObjectURL(prev.url);
                return pending;
              });
              setPending(null);
            }
            onPick(cropped);
          }}
        />
      )}
    </>
  );

  return {
    preset,
    element,
    checking,
    error,
    clearError: () => setError(null),
    /** True once an original is kept, so the crop of the current file can be reopened. */
    canRecrop: source !== null,
    recrop: () => setCropping(true),
    reset,
    openFilePicker: () => inputRef.current?.click(),
    handleDrop,
  };
}
