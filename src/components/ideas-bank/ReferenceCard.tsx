import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IdeaReference } from '@/hooks/useIdeaReferences';
import { getTypeMeta } from './types';
import { ExternalLink, Star, MessageSquarePlus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  reference: IdeaReference;
  onClick: () => void;
  onCreateCard: () => void;
  onFavorite: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  draggable?: boolean;
}

export const ReferenceCard: React.FC<Props> = ({
  reference, onClick, onCreateCard, onFavorite,
  selectMode, selected, onToggleSelect, draggable,
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

  return (
    <div
      ref={setNodeRef}
      onClick={handleCardClick}
      className={cn(
        'group relative break-inside-avoid mb-4 rounded-xl overflow-hidden border bg-card hover:shadow-lg transition-all cursor-pointer',
        selected && 'ring-2 ring-primary',
        isDragging && 'opacity-40',
      )}
    >
      {/* Drag handle */}
      {draggable && !selectMode && (
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 h-6 w-6 rounded-full bg-background/90 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {/* Select checkbox */}
      {selectMode && (
        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!selected} onCheckedChange={() => onToggleSelect?.()} className="bg-background/90 backdrop-blur" />
        </div>
      )}

      {img ? (
        reference.type === 'video' ? (
          <video src={img} className="w-full" muted />
        ) : (
          <img src={img} alt={reference.title} className="w-full block" loading="lazy" />
        )
      ) : (
        <div className="aspect-video flex items-center justify-center bg-muted/40">
          <Icon className="h-10 w-10 text-muted-foreground/50" />
        </div>
      )}

      {/* Type badge overlay */}
      {!selectMode && (
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="backdrop-blur bg-background/80 text-xs">
            <Icon className="h-3 w-3 mr-1" />{meta.label}
          </Badge>
        </div>
      )}

      {/* Favorite */}
      {!selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className={cn(
            "absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors",
            reference.is_favorite && "text-amber-500"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", reference.is_favorite && "fill-current")} />
        </button>
      )}

      {/* Hover actions */}
      {!selectMode && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-white">
            <p className="text-sm font-medium line-clamp-1">{reference.title}</p>
            {reference.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {reference.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">{t}</span>
                ))}
              </div>
            )}
            <div className="flex gap-1 mt-2">
              <Button
                size="sm" variant="secondary" className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); onCreateCard(); }}
              >
                <MessageSquarePlus className="h-3 w-3 mr-1" />Criar card
              </Button>
              {reference.source_url && (
                <Button
                  size="icon" variant="secondary" className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); window.open(reference.source_url!, '_blank'); }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Always-visible title for cards without image */}
      {!img && (
        <div className="p-3">
          <p className="font-medium text-sm line-clamp-2">{reference.title}</p>
          {reference.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{reference.description}</p>
          )}
        </div>
      )}
    </div>
  );
};
