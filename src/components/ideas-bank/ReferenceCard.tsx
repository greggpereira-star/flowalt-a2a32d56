import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IdeaReference } from '@/hooks/useIdeaReferences';
import { getTypeMeta } from './types';
import {
  ExternalLink, Star, MessageSquarePlus, GripVertical, FolderInput, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  reference: IdeaReference;
  onClick: () => void;
  onCreateCard: () => void;
  onFavorite: () => void;
  onMove?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  draggable?: boolean;
  pendingFavorite?: boolean;
}

export const ReferenceCard: React.FC<Props> = ({
  reference, onClick, onCreateCard, onFavorite, onMove,
  selectMode, selected, onToggleSelect, draggable, pendingFavorite,
}) => {
  const meta = getTypeMeta(reference.type);
  const Icon = meta.icon;
  const img = reference.thumbnail_url || reference.media_url;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: reference.id,
    data: { reference },
    disabled: !draggable || selectMode,
  });

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectMode) {
      e.preventDefault();
      onToggleSelect?.();
      return;
    }
    onClick();
  };

  const handleCardKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectMode) onToggleSelect?.();
      else onClick();
    }
  };

  const ariaLabel = `${meta.label}: ${reference.title}${selectMode ? (selected ? ' (selecionada)' : '') : ''}`;

  return (
    <article
      ref={setNodeRef}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selectMode ? !!selected : undefined}
      className={cn(
        'group relative break-inside-avoid mb-4 rounded-xl overflow-hidden border bg-card hover:shadow-lg transition-all cursor-pointer',
        selected && 'ring-2 ring-primary ring-offset-1',
        isDragging && 'opacity-40',
      )}
    >
      {/* Drag handle */}
      {draggable && !selectMode && (
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Arrastar ${reference.title} para outra pasta`}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 h-6 w-6 rounded-full bg-background/90 backdrop-blur opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {/* Select checkbox */}
      {selectMode && (
        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect?.()}
            aria-label={`Selecionar ${reference.title}`}
            className="bg-background/90 backdrop-blur"
          />
        </div>
      )}

      {img ? (
        reference.type === 'video' ? (
          <video src={img} className="w-full" muted aria-label={reference.title} />
        ) : (
          <img src={img} alt={reference.title} className="w-full block" loading="lazy" />
        )
      ) : (
        <div className="aspect-video flex items-center justify-center bg-muted/40">
          <Icon className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
        </div>
      )}

      {/* Type badge overlay */}
      {!selectMode && (
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="backdrop-blur bg-background/80 text-xs">
            <Icon className="h-3 w-3 mr-1" aria-hidden="true" />{meta.label}
          </Badge>
        </div>
      )}

      {/* Favorite */}
      {!selectMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); onFavorite(); }}
              disabled={pendingFavorite}
              aria-label={reference.is_favorite ? 'Remover dos favoritos' : 'Marcar como favorita'}
              aria-pressed={reference.is_favorite}
              className={cn(
                'absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors',
                reference.is_favorite && 'text-amber-500'
              )}
            >
              {pendingFavorite
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <Star className={cn('h-3.5 w-3.5', reference.is_favorite && 'fill-current')} aria-hidden="true" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{reference.is_favorite ? 'Desfavoritar' : 'Favoritar'}</TooltipContent>
        </Tooltip>
      )}

      {/* Title strip — always visible for clarity */}
      {!selectMode && (
        <div className="p-2.5 border-t bg-card">
          <p className="text-sm font-medium line-clamp-1">{reference.title}</p>
          {reference.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {reference.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
          {/* Primary actions: visible, accessible */}
          <div className="flex gap-1.5 mt-2">
            <Button
              size="sm" variant="default" className="h-7 text-xs flex-1"
              onClick={(e) => { e.stopPropagation(); onCreateCard(); }}
              aria-label={`Transformar "${reference.title}" em card`}
            >
              <MessageSquarePlus className="h-3 w-3 mr-1" aria-hidden="true" />Criar card
            </Button>
            {onMove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="outline" className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); onMove(); }}
                    aria-label={`Mover "${reference.title}" para outra pasta`}
                  >
                    <FolderInput className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover para pasta</TooltipContent>
              </Tooltip>
            )}
            {reference.source_url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="outline" className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); window.open(reference.source_url!, '_blank', 'noopener,noreferrer'); }}
                    aria-label={`Abrir link original de "${reference.title}" em nova aba`}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir link</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
