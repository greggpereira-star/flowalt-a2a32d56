import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextViewer, isRichTextEmpty } from '@/components/ui/rich-text-viewer';
import { Sparkles, Check, Pencil, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardDescriptionSectionProps {
  description: string;
  onChange: (description: string) => void;
  onSave: () => void;
  isDirty: boolean;
}

/**
 * CardDescriptionSection
 * ----------------------------------------------------------------------------
 * Two modes:
 *  - Reader (default): renders the description through RichTextViewer with an
 *    elegant max-height + fade mask. A "Ler mais"/"Ler menos" toggle expands
 *    inline so the parent layout never jumps abruptly.
 *  - Editor: TipTap editor for inline editing; mounted only on demand to keep
 *    the modal lightweight when only reading.
 *
 * Empty state shows a single CTA so users always have a clear next step
 * without consuming visual real estate.
 */

const COLLAPSED_MAX_HEIGHT = 220; // px — keeps preview compact but readable

export const CardDescriptionSection: React.FC<CardDescriptionSectionProps> = ({
  description,
  onChange,
  onSave,
  isDirty,
}) => {
  const [mode, setMode] = useState<'reader' | 'editor'>('reader');
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const empty = isRichTextEmpty(description);

  // Detect if the rendered preview overflows the collapsed max height.
  useEffect(() => {
    if (mode !== 'reader' || empty) return;
    const el = previewRef.current;
    if (!el) return;
    // Use scrollHeight on the inner content wrapper.
    const inner = el.firstElementChild as HTMLElement | null;
    const contentHeight = inner?.scrollHeight ?? el.scrollHeight;
    setIsOverflowing(contentHeight > COLLAPSED_MAX_HEIGHT + 4);
  }, [description, mode, empty]);

  // When user enters editor mode, reset expanded so returning to reader is clean.
  const enterEditor = () => {
    setMode('editor');
    setExpanded(false);
  };

  const handleSave = () => {
    onSave();
    setMode('reader');
  };

  const handleCancel = () => {
    setMode('reader');
  };

  // ---------- Editor mode ----------
  if (mode === 'editor') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            Escrever com IA
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-7 gap-1.5 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
            className="h-7 gap-1.5 text-xs"
          >
            <Check className="h-3 w-3" />
            Salvar
          </Button>
        </div>

        <div
          className={cn(
            'rounded-lg border transition-all',
            'border-border/60 focus-within:border-primary/40',
          )}
        >
          <RichTextEditor
            value={description}
            onChange={onChange}
            placeholder="Adicione uma descrição detalhada para este card..."
            minHeight="140px"
            maxHeight="360px"
          />
        </div>
      </div>
    );
  }

  // ---------- Reader mode ----------
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={enterEditor}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          {empty ? 'Adicionar' : 'Editar'}
        </Button>
      </div>

      {empty ? (
        <button
          type="button"
          onClick={enterEditor}
          className={cn(
            'w-full text-left rounded-lg border border-dashed border-border/60',
            'px-4 py-6 text-sm text-muted-foreground',
            'hover:border-primary/40 hover:bg-muted/30 transition-colors',
          )}
        >
          Adicione uma descrição detalhada para este card...
        </button>
      ) : (
        <div
          className={cn(
            'group relative rounded-lg border border-border/50 bg-card px-4 py-3',
            'cursor-text transition-colors hover:border-border',
          )}
          onDoubleClick={enterEditor}
        >
          <div
            ref={previewRef}
            className={cn(
              'relative overflow-hidden transition-[max-height] duration-300 ease-out',
            )}
            style={{
              maxHeight: expanded ? '4000px' : `${COLLAPSED_MAX_HEIGHT}px`,
            }}
          >
            <div>
              <RichTextViewer content={description} />
            </div>

            {/* Fade mask — only when overflowing & collapsed */}
            {isOverflowing && !expanded && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
              />
            )}
          </div>

          {isOverflowing && (
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Ler menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Ler mais
                  </>
                )}
              </button>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Duplo clique para editar
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
