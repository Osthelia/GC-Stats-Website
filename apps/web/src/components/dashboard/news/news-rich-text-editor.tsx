/**
 * GC-Stats - news-rich-text-editor
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImageIcon,
  Code,
  Loader2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Tiptap (headless, MIT) rather than TinyMCE like V1, a much simpler React
 * integration for this stack (an existing maintained library for a complex
 * visual, not reinvented). Output stays inside lib/news-content-sanitize.ts's
 * server-side allow-list regardless of what this toolbar can produce.
 *
 * Image insertion needs an already-saved article (news_images rows FK to
 * news.id), pass `onUploadImage` only once the article exists; omitted
 * (create/draft-not-saved-yet) the image button stays disabled with a
 * tooltip, mirrors V1's same create, save, then upload images flow.
 */
export function NewsRichTextEditor({
  content,
  onChange,
  onUploadImage,
  disabled,
}: {
  content: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.news.editor.toolbar");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      TextStyle,
      Color,
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      ImageExtension.configure({ inline: false }),
    ],
    content,
    editorProps: {
      attributes: { class: "news-content max-w-none focus:outline-none min-h-[320px] px-3 py-2" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // Only resync when the article identity changes underneath us (parent
    // swaps in a freshly-loaded article), not on every keystroke, which
    // would fight the editor's own cursor position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  async function handleImagePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadImage || uploading) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) editor?.chain().focus().setImage({ src: url }).run();
    } finally {
      setUploading(false);
    }
  }

  function openLinkDialog() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    setLinkValue(previousUrl ?? "");
    setLinkDialogOpen(true);
  }

  function applyLink() {
    const url = linkValue.trim();
    if (!url) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
  }

  return (
    <div className={cn("rounded-lg border border-input", disabled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input p-1">
        <ToolbarButton title={t("bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t("italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t("underline")} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t("strike")} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title={t("h2")} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarButton>
        <ToolbarButton title={t("h3")} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title={t("bulletList")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t("orderedList")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={t("blockquote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title={t("link")} active={editor.isActive("link")} onClick={openLinkDialog}>
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton title={onUploadImage ? t("image") : t("imageDisabled")} disabled={!onUploadImage || uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2Icon className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
        </ToolbarButton>
        <ToolbarButton title={t("code")} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code className="size-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      </div>
      <EditorContent editor={editor} />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("link")}</DialogTitle>
          </DialogHeader>
          <FormField label={t("linkPrompt")} htmlFor="news-link-url">
            <Input
              id="news-link-url"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              {t("linkCancel")}
            </Button>
            <Button onClick={applyLink}>{t("linkApply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
