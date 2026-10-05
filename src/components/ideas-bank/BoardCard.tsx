import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IdeaBoard, useIdeaBoards } from '@/hooks/useIdeaBoards';
import { MoreHorizontal, Archive, Trash2, Layers, Lightbulb } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSkinNovo } from '@/components/ui/skin-novo';
import { cn } from '@/lib/utils';

interface Props {
  board: IdeaBoard;
  onOpen: () => void;
}

export const BoardCard: React.FC<Props> = ({ board, onOpen }) => {
  const novo = useSkinNovo();
  const { archive, remove } = useIdeaBoards();
  const thumbs = board.preview_thumbs || [];
  const [capaQuebrada, setCapaQuebrada] = useState(false);
  const cover = capaQuebrada ? undefined : (board.cover_url || thumbs[0]);

  return (
    <div
      onClick={onOpen}
      className={cn('group rounded-2xl overflow-hidden border bg-card hover:shadow-md transition-all cursor-pointer flex flex-col', novo && 'border-border/60 p-2 hover:border-foreground/20 hover:shadow-none')}
    >
      {/* Cover: collage of up to 4 thumbs or single cover */}
      <div className={cn('aspect-[4/3] relative bg-muted/40', novo && 'overflow-hidden rounded-xl')}>
        {cover ? (
          thumbs.length >= 4 ? (
            <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
              {thumbs.slice(0, 4).map((src, i) => (
                <img key={i} src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
              ))}
            </div>
          ) : (
            <img src={cover} alt={board.name} className="w-full h-full object-cover" loading="lazy" onError={() => setCapaQuebrada(true)} />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <Lightbulb className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-7 w-7 bg-background/80 backdrop-blur"
                onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => archive.mutate(board.id)}>
                <Archive className="h-4 w-4 mr-2" />Arquivar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Excluir a pasta "${board.name}" e todas as suas referências?`)) {
                    remove.mutate(board.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn('p-3 flex-1', novo && 'px-2 pb-2 pt-3')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold text-sm line-clamp-1', novo && 'text-[14.5px] tracking-tight')}>{board.name}</h3>
          {board.category && <Badge variant="outline" className={cn('text-[10px]', novo && 'shrink-0 rounded-full border-0 bg-muted px-2 font-semibold text-muted-foreground')}>{board.category}</Badge>}
        </div>
        {board.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{board.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{board.reference_count ?? 0}</span>
          <span>·</span>
          <span>atualizado {formatDistanceToNow(new Date(board.updated_at), { locale: ptBR, addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
};
