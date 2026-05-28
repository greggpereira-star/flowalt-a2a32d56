import { useEditor, EditorContent, Editor, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  RemoveFormatting,
  Smile
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState, useRef } from 'react';
import { MentionList, MentionListRef, type MentionSuggestion } from './mention-list';

// Re-export MentionSuggestion type
// URL detector for legacy content (no `link` mark). Mirrors the regex
// used in rich-text-viewer.ts so behaviour is consistent across read & edit.
const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>()`!?,.;:'"])/gi;

interface TipTapNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
}

/**
 * Walks a TipTap JSON document and, for any `text` node that contains a
 * URL but lacks the `link` mark, splits it into multiple nodes so the URL
 * portion carries the `link` mark. This makes legacy content clickable
 * without forcing the user to re-edit it.
 */
function linkifyJSON<T>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const node = doc as unknown as TipTapNode;

  if (node.type === 'text' && typeof node.text === 'string') {
    const hasLink = node.marks?.some((m) => m.type === 'link');
    if (hasLink) return doc;
    URL_REGEX.lastIndex = 0;
    if (!URL_REGEX.test(node.text)) return doc;

    URL_REGEX.lastIndex = 0;
    const out: TipTapNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_REGEX.exec(node.text)) !== null) {
      const [url] = match;
      if (match.index > last) {
        out.push({ type: 'text', text: node.text.slice(last, match.index), marks: node.marks });
      }
      const href = url.startsWith('http') ? url : `https://${url}`;
      out.push({
        type: 'text',
        text: url,
        marks: [...(node.marks ?? []), { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } }],
      });
      last = match.index + url.length;
    }
    if (last < node.text.length) {
      out.push({ type: 'text', text: node.text.slice(last), marks: node.marks });
    }
    // Returning a fragment isn't valid; caller handles arrays via `content` walk below.
    return out as unknown as T;
  }

  if (Array.isArray(node.content)) {
    const newContent: TipTapNode[] = [];
    for (const child of node.content) {
      const processed = linkifyJSON(child) as unknown;
      if (Array.isArray(processed)) newContent.push(...(processed as TipTapNode[]));
      else newContent.push(processed as TipTapNode);
    }
    return { ...node, content: newContent } as unknown as T;
  }

  return doc;
}

export type { MentionSuggestion } from './mention-list';

// Emojis mais utilizados organizados por categoria
const EMOJI_CATEGORIES = {
  'Frequentes': ['👍', '👎', '❤️', '🔥', '✅', '❌', '⚠️', '💡', '🎯', '📌'],
  'Rostos': ['😀', '😊', '🤔', '😅', '🙌', '👏', '🤝', '💪', '🎉', '✨'],
  'Objetos': ['📝', '📋', '📎', '📁', '🗂️', '💼', '🔧', '⚙️', '🔑', '🏷️'],
  'Status': ['🚀', '⏳', '⏰', '📅', '✔️', '❗', '🔔', '💬', '📊', '📈'],
};

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Controla a barra de ferramentas (útil para modo chat/composer). */
  showToolbar?: boolean;
  /** Classes extras aplicadas ao EditorContent (padding/densidade). */
  contentClassName?: string;
  minHeight?: string;
  maxHeight?: string;
  autoFocus?: boolean;
  mentionSuggestions?: MentionSuggestion[];
  onMentionsChange?: (mentionIds: string[]) => void;
  /** Callback chamado ao pressionar Enter (sem Shift). Útil para envio de mensagens. */
  onSubmit?: () => void;
}

interface ToolbarButtonProps {
  editor: Editor;
  action: () => void;
  isActive?: boolean;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
}

const ToolbarButton = ({ action, isActive, icon, title, disabled }: ToolbarButtonProps) => (
  <Toggle
    size="sm"
    pressed={isActive}
    onPressedChange={action}
    disabled={disabled}
    title={title}
    className="h-8 w-8 p-0 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
  >
    {icon}
  </Toggle>
);

const EmojiPicker = ({ onSelect, disabled }: { onSelect: (emoji: string) => void; disabled?: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0"
          title="Inserir emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="space-y-2">
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category}>
              <p className="text-xs text-muted-foreground mb-1 px-1">{category}</p>
              <div className="grid grid-cols-10 gap-0.5">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-base transition-colors"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const EditorToolbar = ({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) => {
  if (!editor) return null;

  const insertEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30 rounded-t-md">
      {/* Formatação básica */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={<Bold className="h-4 w-4" />}
        title="Negrito (Ctrl+B)"
        disabled={disabled}
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={<Italic className="h-4 w-4" />}
        title="Itálico (Ctrl+I)"
        disabled={disabled}
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        icon={<UnderlineIcon className="h-4 w-4" />}
        title="Sublinhado (Ctrl+U)"
        disabled={disabled}
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        icon={<Strikethrough className="h-4 w-4" />}
        title="Tachado"
        disabled={disabled}
      />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Destaque */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        icon={<Highlighter className="h-4 w-4" />}
        title="Destacar texto"
        disabled={disabled}
      />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Listas */}
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={<List className="h-4 w-4" />}
        title="Lista com marcadores"
        disabled={disabled}
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={<ListOrdered className="h-4 w-4" />}
        title="Lista numerada"
        disabled={disabled}
      />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Emoji e limpar */}
      <EmojiPicker onSelect={insertEmoji} disabled={disabled} />
      
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="h-8 w-8 p-0"
        title="Limpar formatação"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        <RemoveFormatting className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Create the mention suggestion configuration with a ref for dynamic updates
const createMentionSuggestion = (suggestionsRef: React.MutableRefObject<MentionSuggestion[]>) => ({
  items: ({ query }: { query: string }) => {
    const suggestions = suggestionsRef.current;
    return suggestions
      .filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8);
  },

  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props: SuggestionProps<MentionSuggestion>) => {
        component = new ReactRenderer(MentionList, {
          props: {
            items: props.items || [],
            command: props.command,
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        const editorDom = props.editor?.view?.dom as HTMLElement | null;
        const dialogContent = editorDom?.closest?.('[data-radix-dialog-content]') as HTMLElement | null;
        const fallbackContainer = editorDom?.parentElement as HTMLElement | null;
        const container = dialogContent || fallbackContainer || document.body;

        popup = tippy(container, {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => container,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          zIndex: 100000,
          // Remove o tema padrão escuro do Tippy
          theme: 'light-clean',
          arrow: false,
        });
      },

      onUpdate(props: SuggestionProps<MentionSuggestion>) {
        component?.updateProps({
          items: props.items || [],
          command: props.command,
        });

        if (!props.clientRect) {
          return;
        }

        popup?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup?.hide();
          return true;
        }

        return component?.ref?.onKeyDown(props) || false;
      },

      onExit() {
        popup?.destroy();
        component?.destroy();
      },
    };
  },
});

// Extract mention IDs from editor content
const extractMentionIds = (editor: Editor | null): string[] => {
  if (!editor) return [];
  
  const mentions: string[] = [];
  const json = editor.getJSON();
  
  const traverse = (node: { type?: string; attrs?: { id?: string }; content?: unknown[] }) => {
    if (node.type === 'mention' && node.attrs?.id) {
      mentions.push(node.attrs.id);
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };
  
  traverse(json);
  return [...new Set(mentions)];
};

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Escreva aqui...',
  disabled = false,
  className,
  showToolbar = true,
  contentClassName,
  minHeight = '120px',
  maxHeight = '400px',
  autoFocus = false,
  mentionSuggestions = [],
  onMentionsChange,
  onSubmit,
}: RichTextEditorProps) {
  const mentionsRef = useRef<string[]>([]);
  const suggestionsRef = useRef<MentionSuggestion[]>(mentionSuggestions);
  const onMentionsChangeRef = useRef(onMentionsChange);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  
  // Keep refs in sync with props
  useEffect(() => {
    suggestionsRef.current = mentionSuggestions;
  }, [mentionSuggestions]);
  
  useEffect(() => {
    onMentionsChangeRef.current = onMentionsChange;
  }, [onMentionsChange]);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);
  
  // Helper to safely parse content - handles both JSON and plain text.
  // Also runs autolink on legacy content where URLs were saved as plain text
  // without a `link` mark, so they become clickable as soon as the editor mounts.
  const parseContent = useCallback((content: string) => {
    if (!content) return '';
    try {
      return linkifyJSON(JSON.parse(content));
    } catch {
      return content;
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: false, // configured separately below to avoid duplicate autolink plugin
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-warning/30 rounded px-0.5',
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: 'text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary cursor-pointer break-all',
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-chip bg-primary/15 text-primary font-medium px-1.5 py-0.5 rounded-md inline-block cursor-default',
        },
        suggestion: createMentionSuggestion(suggestionsRef),
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
      }),
    ],
    content: parseContent(value),
    editable: !disabled,
    autofocus: autoFocus,
    editorProps: {
      handleKeyDown: (view, event) => {
        // Submit on Enter (without Shift) if onSubmit is provided
        if (event.key === 'Enter' && !event.shiftKey && onSubmitRef.current) {
          event.preventDefault();
          onSubmitRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChangeRef.current?.(json);
      
      // Track mentions
      const newMentions = extractMentionIds(editor);
      if (JSON.stringify(newMentions) !== JSON.stringify(mentionsRef.current)) {
        mentionsRef.current = newMentions;
        onMentionsChangeRef.current?.(newMentions);
      }
    },
  });

    // Sync external value changes (including clearing) without emitting
    // onUpdate. Programmatic sync must not be treated as user input; otherwise
    // changing steps/cards can write an empty editor back into the briefing.
  useEffect(() => {
    if (!editor) return;
    
    // Handle clearing the editor when value is empty
    if (!value || value === '' || value === '""') {
      const currentText = editor.getText().trim();
      if (currentText !== '') {
          editor.commands.clearContent(false);
      }
      return;
    }
    
    try {
      const parsed = linkifyJSON(JSON.parse(value));
      const currentContent = editor.getJSON();
      if (JSON.stringify(parsed) !== JSON.stringify(currentContent)) {
        editor.commands.setContent(parsed, { emitUpdate: false });
      }
    } catch {
      // If not valid JSON, treat as plain text
      if (value !== editor.getText()) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div className={cn(
      'rounded-md bg-background transition-colors',
      !className?.includes('border-0') && 'border border-input',
      !className?.includes('focus-within:ring-0') && 'focus-within:ring-1 focus-within:ring-ring focus-within:border-ring',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      {showToolbar ? <EditorToolbar editor={editor} disabled={disabled} /> : null}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'px-3 py-2 overflow-y-auto',
          '[&_.ProseMirror]:outline-none',
          // No composer de chat (sem toolbar), removemos o focus ring global (:focus-visible)
          !showToolbar && '[&_.ProseMirror:focus-visible]:ring-0 [&_.ProseMirror:focus-visible]:ring-offset-0 [&_.ProseMirror:focus-visible]:outline-none',
          '[&_.ProseMirror]:min-h-[var(--min-height)]',
          '[&_.ProseMirror]:max-h-[var(--max-height)]',
          '[&_.ProseMirror.is-editor-empty]:before:content-[attr(data-placeholder)]',
          '[&_.ProseMirror.is-editor-empty]:before:text-muted-foreground',
          '[&_.ProseMirror.is-editor-empty]:before:float-left',
          '[&_.ProseMirror.is-editor-empty]:before:h-0',
          '[&_.ProseMirror.is-editor-empty]:before:pointer-events-none',
          '[&_.ProseMirror_p]:my-1',
          '[&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ul]:pl-5',
          '[&_.ProseMirror_ol]:my-1 [&_.ProseMirror_ol]:pl-5',
          '[&_.ProseMirror_li]:my-0.5',
          '[&_.mention-chip]:bg-primary/15 [&_.mention-chip]:text-primary',
          contentClassName,
        )}
        style={{
          '--min-height': minHeight,
          '--max-height': maxHeight,
        } as React.CSSProperties}
      />
    </div>
  );
}

// Hook para usar o editor em contextos mais avançados
export function useRichTextEditor(options: Omit<RichTextEditorProps, 'className'>) {
  const { value = '', onChange, placeholder, disabled, autoFocus, mentionSuggestions = [] } = options;
  
  const suggestionsRef = useRef<MentionSuggestion[]>(mentionSuggestions);
  const onChangeRef = useRef(onChange);
  
  useEffect(() => {
    suggestionsRef.current = mentionSuggestions;
  }, [mentionSuggestions]);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: false, // configured separately below to avoid duplicate autolink plugin
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-warning/30 rounded px-0.5',
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder || 'Escreva aqui...',
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: 'text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary cursor-pointer break-all',
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-chip bg-primary/15 text-primary font-medium px-1.5 py-0.5 rounded-md inline-block cursor-default',
        },
        suggestion: createMentionSuggestion(suggestionsRef),
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
      }),
    ],
    content: (() => {
      if (!value) return '';
      try {
        return linkifyJSON(JSON.parse(value));
      } catch {
        return value;
      }
    })(),
    editable: !disabled,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChangeRef.current?.(json);
    },
  });

  return editor;
}

export default RichTextEditor;
