import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
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
import { useCallback, useEffect, useState } from 'react';

// Emojis mais utilizados organizados por categoria
const EMOJI_CATEGORIES = {
  'Frequentes': ['👍', '👎', '❤️', '🔥', '✅', '❌', '⚠️', '💡', '🎯', '📌'],
  'Rostos': ['😀', '😊', '🤔', '😅', '🙌', '👏', '🤝', '💪', '🎉', '✨'],
  'Objetos': ['📝', '📋', '📎', '📁', '🗂️', '💼', '🔧', '⚙️', '🔑', '🏷️'],
  'Status': ['🚀', '⏳', '⏰', '📅', '✔️', '❗', '🔔', '💬', '📊', '📈'],
};

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  autoFocus?: boolean;
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

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Escreva aqui...',
  disabled = false,
  className,
  minHeight = '120px',
  maxHeight = '400px',
  autoFocus = false,
}: RichTextEditorProps) {
  // Helper to safely parse content - handles both JSON and plain text
  const parseContent = useCallback((content: string) => {
    if (!content) return '';
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, treat as plain text
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
    ],
    content: parseContent(value),
    editable: !disabled,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChange?.(json);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value) {
      try {
        const parsed = JSON.parse(value);
        const currentContent = editor.getJSON();
        if (JSON.stringify(parsed) !== JSON.stringify(currentContent)) {
          editor.commands.setContent(parsed);
        }
      } catch {
        // If not valid JSON, treat as plain text
        if (value !== editor.getText()) {
          editor.commands.setContent(value);
        }
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
      'rounded-md border border-input bg-background transition-colors',
      'focus-within:ring-1 focus-within:ring-ring focus-within:border-ring',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      <EditorToolbar editor={editor} disabled={disabled} />
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'px-3 py-2 overflow-y-auto',
          '[&_.ProseMirror]:outline-none',
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
  const { value = '', onChange, placeholder, disabled, autoFocus } = options;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
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
    ],
    content: (() => {
      if (!value) return '';
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    })(),
    editable: !disabled,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChange?.(json);
    },
  });

  return editor;
}

export default RichTextEditor;
