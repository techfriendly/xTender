"use client";

import clsx from "clsx";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Table2
} from "lucide-react";
import { marked } from "marked";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export type RichEditorSelection = {
  text: string;
  characters: number;
};

export type ChapterRichEditorHandle = {
  getSelectedText: () => string;
  beginSelectionReplacement: (sessionId: string) => void;
  updateSelectionReplacement: (markdown: string, sessionId: string) => void;
  resetSelectionReplacement: () => void;
};

type ChapterRichEditorProps = {
  markdown: string;
  disabled?: boolean;
  placeholder: string;
  labels: Record<string, string>;
  onMarkdownChange: (markdown: string) => void;
  onSelectionChange: (selection: RichEditorSelection) => void;
};

type ReplacementRange = {
  sessionId: string;
  from: number;
  to: number;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**"
});

turndown.use(gfm);
turndown.addRule("lineBreak", {
  filter: "br",
  replacement: () => "\n"
});

export const ChapterRichEditor = forwardRef<ChapterRichEditorHandle, ChapterRichEditorProps>(function ChapterRichEditor(
  { markdown, disabled = false, placeholder, labels, onMarkdownChange, onSelectionChange },
  ref
) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const lastMarkdownRef = useRef(normalizeMarkdown(markdown));
  const replacementRef = useRef<ReplacementRange | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: {
          autolink: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank"
          }
        }
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: markdownToHtml(markdown),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        "aria-label": labels.editorVisualTitle ?? "Editor visual"
      }
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      emitSelection(currentEditor, onSelectionChange);
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextMarkdown = htmlToMarkdown(currentEditor.getHTML());
      lastMarkdownRef.current = nextMarkdown;
      onMarkdownChange(nextMarkdown);
      emitSelection(currentEditor, onSelectionChange);
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextMarkdown = normalizeMarkdown(markdown);
    if (nextMarkdown === lastMarkdownRef.current) return;
    editor.commands.setContent(markdownToHtml(nextMarkdown), { emitUpdate: false });
    lastMarkdownRef.current = nextMarkdown;
    replacementRef.current = null;
    emitSelection(editor, onSelectionChange);
  }, [editor, markdown, onSelectionChange]);

  useImperativeHandle(
    ref,
    () => ({
      getSelectedText: () => readSelectedText(editor),
      beginSelectionReplacement: (sessionId: string) => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        replacementRef.current = { sessionId, from, to };
      },
      updateSelectionReplacement: (nextMarkdown: string, sessionId: string) => {
        if (!editor) return;
        const currentRange = replacementRef.current;
        const range = currentRange?.sessionId === sessionId
          ? currentRange
          : { sessionId, from: editor.state.selection.from, to: editor.state.selection.to };
        editor
          .chain()
          .focus()
          .insertContentAt({ from: range.from, to: range.to }, markdownToHtml(nextMarkdown))
          .run();
        const nextTo = editor.state.selection.from;
        replacementRef.current = { sessionId, from: range.from, to: Math.max(range.from, nextTo) };
        const fullMarkdown = htmlToMarkdown(editor.getHTML());
        lastMarkdownRef.current = fullMarkdown;
        onMarkdownChange(fullMarkdown);
        emitSelection(editor, onSelectionChange);
      },
      resetSelectionReplacement: () => {
        replacementRef.current = null;
      }
    }),
    [editor, onMarkdownChange, onSelectionChange]
  );

  function runToolbarAction(action: (currentEditor: Editor) => void) {
    if (!editor || disabled) return;
    action(editor);
    editor.commands.focus();
  }

  function setLink() {
    if (!editor || disabled) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(labels.toolbarLinkPrompt ?? "URL", previousUrl ?? "");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="rich-editor-shell">
      <div className="rich-editor-header">
        <div className="editor-subtitle">
          <Pilcrow size={16} aria-hidden="true" />
          <strong>{labels.editorVisualTitle}</strong>
        </div>
        <button
          type="button"
          className="markdown-toggle tooltip-wrap"
          data-tooltip={sourceOpen ? labels.markdownHideTooltip : labels.markdownShowTooltip}
          onClick={() => setSourceOpen((value) => !value)}
          disabled={disabled}
        >
          <Code2 size={15} aria-hidden="true" />
          {labels.markdownToggle}
        </button>
      </div>

      <div className="rich-editor-toolbar" aria-label={labels.editorToolbar}>
        <ToolbarButton label={labels.toolbarBold} active={editor?.isActive("bold")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleBold().run())}>
          <Bold size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarItalic} active={editor?.isActive("italic")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleItalic().run())}>
          <Italic size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarHeading2} active={editor?.isActive("heading", { level: 2 })} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleHeading({ level: 2 }).run())}>
          <Heading2 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarHeading3} active={editor?.isActive("heading", { level: 3 })} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleHeading({ level: 3 }).run())}>
          <Heading3 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarBulletList} active={editor?.isActive("bulletList")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleBulletList().run())}>
          <List size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarOrderedList} active={editor?.isActive("orderedList")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleOrderedList().run())}>
          <ListOrdered size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarQuote} active={editor?.isActive("blockquote")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().toggleBlockquote().run())}>
          <Quote size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarLink} active={editor?.isActive("link")} disabled={disabled || !editor} onClick={setLink}>
          <Link2 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarTable} active={editor?.isActive("table")} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
          <Table2 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label={labels.toolbarClear} disabled={disabled || !editor} onClick={() => runToolbarAction((item) => item.chain().focus().unsetAllMarks().clearNodes().run())}>
          <RemoveFormatting size={16} aria-hidden="true" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      {sourceOpen && (
        <label className="markdown-source-drawer">
          <span>{labels.markdownTitle}</span>
          <textarea
            value={markdown}
            onChange={(event) => onMarkdownChange(event.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
        </label>
      )}
    </div>
  );
});

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx("rich-toolbar-button tooltip-wrap", active && "active")}
      data-tooltip={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function markdownToHtml(value: string) {
  const clean = normalizeMarkdown(value);
  if (!clean) return "";
  const safeMarkdown = clean.replace(/<([a-zA-Z!/][^>]*)>/g, (match) => escapeHtml(match));
  const html = marked.parse(safeMarkdown, { async: false, gfm: true, breaks: false });
  return typeof html === "string" ? html : "";
}

function htmlToMarkdown(value: string) {
  const markdown = turndown
    .turndown(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalizeMarkdown(markdown);
}

function normalizeMarkdown(value: string) {
  return (value || "").replace(/\r\n/g, "\n").trimEnd();
}

function readSelectedText(editor: Editor | null) {
  if (!editor) return "";
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n\n", " ").trim();
}

function emitSelection(editor: Editor, onSelectionChange: (selection: RichEditorSelection) => void) {
  const text = readSelectedText(editor);
  onSelectionChange({ text, characters: text.length });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default ChapterRichEditor;
