import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, MoreHorizontal, Trash2, Copy, Archive, Sparkles, Hash, ExternalLink, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}) => {
  const shortId = cardId.substring(0, 8);

  return (
    <div className="flex-shrink-0">
      {/* Compact top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Card type indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn(
              "w-2 h-2 rounded-full",
              cardType === 'quick' ? "bg-warning" : "bg-primary"
            )} />
            <span className="font-medium">
              {cardType === 'quick' ? 'Card Rápido' : 'Demanda'}
            </span>
          </div>
          
          <span className="text-muted-foreground/40">•</span>
          
          {/* Card ID - copyable */}
          <button 
            onClick={() => navigator.clipboard.writeText(cardId)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            title="Copiar ID"
          >
            <Hash className="h-3 w-3" />
            {shortId}
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          {/* AI Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">IA</span>
          </Button>

          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
            className="h-7 w-7 p-0 ml-1"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title area - Clean and prominent */}
      <div className="px-5 py-4">
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/50"
          placeholder="Título do card..."
        />
      </div>
    </div>
  );
};
