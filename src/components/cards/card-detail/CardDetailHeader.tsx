import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  X,
  MoreHorizontal,
  Trash2,
  Copy,
  Archive,
  Sparkles,
  Hash,
  ExternalLink,
  Star,
  LayoutGrid,
  CheckSquare,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CardDetailHeaderProps {
  title: string;
  cardId: string;
  cardType?: string;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onClose: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  hasHistory?: boolean;
  createdAt?: string;
  spaceName?: string;
}

export const CardDetailHeader: React.FC<CardDetailHeaderProps> = ({
  title,
  cardId,
  cardType = 'task',
  onTitleChange,
  onTitleBlur,
  onClose,
  onDelete,
  canDelete = false,
  hasHistory = false,
  createdAt,
  spaceName,
}) => {
  const shortId = cardId.substring(0, 8);

  return (
    <div className="flex-shrink-0">
      {/* Top bar - Breadcrumb + Actions */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-border/40 bg-muted/20">
        {/* Left: Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LayoutGrid className="h-3 w-3" />
          {spaceName && (
            <>
              <span className="hover:text-foreground cursor-pointer transition-colors">{spaceName}</span>
              <span className="text-muted-foreground/40">/</span>
            </>
          )}
          <button 
            onClick={() => navigator.clipboard.writeText(cardId)}
            className="flex items-center gap-1 hover:text-foreground transition-colors font-mono"
            title="Copiar ID"
          >
            <Hash className="h-3 w-3" />
            {shortId}
          </button>
          {createdAt && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground/70">
                Criada em {format(new Date(createdAt), "dd MMM", { locale: ptBR })}
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 gap-1.5 text-xs text-primary/80 hover:text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pergunte à IA</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Assistente IA</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Star className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Favoritar</TooltipContent>
          </Tooltip>

          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="gap-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir em nova aba
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar card
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  {hasHistory ? (
                    <>
                      <Archive className="h-3.5 w-3.5" />
                      Arquivar card
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir card
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Task type badge + Title */}
      <div className="px-6 pt-4 pb-2">
        {/* Type badge */}
        <div className="inline-flex items-center gap-1.5 mb-2">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border",
            cardType === 'quick' 
              ? "bg-warning/10 text-warning border-warning/20" 
              : "bg-muted/50 text-muted-foreground border-border/50"
          )}>
            <CheckSquare className="h-3 w-3" />
            {cardType === 'quick' ? 'Card Rápido' : 'Demanda'}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <RefreshCw className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Converter tipo</TooltipContent>
          </Tooltip>
        </div>

        {/* Title - Large and editable */}
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          className="text-2xl font-bold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/30 leading-tight"
          placeholder="Nome da tarefa..."
        />
      </div>
    </div>
  );
};
