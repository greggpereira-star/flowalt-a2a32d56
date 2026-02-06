import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, MoreHorizontal, Trash2, Copy, Archive, Sparkles, Hash } from 'lucide-react';
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
    <div className="flex-shrink-0 border-b">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Card type badge */}
          <Badge variant="outline" className="h-6 gap-1.5 text-xs font-normal">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            {cardType === 'quick' ? 'Rápido' : 'Tarefa'}
          </Badge>
          
          {/* Card ID */}
          <Badge variant="secondary" className="h-6 gap-1 text-xs font-mono">
            <Hash className="h-3 w-3" />
            {shortId}
          </Badge>
          
          {/* AI Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            Pergunte à IA
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <Copy className="h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  {hasHistory ? (
                    <>
                      <Archive className="h-4 w-4" />
                      Arquivar
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="px-6 py-4">
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          className="text-2xl font-bold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          placeholder="Título do card..."
        />
      </div>
    </div>
  );
};
