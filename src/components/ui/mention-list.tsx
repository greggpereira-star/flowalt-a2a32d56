import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface MentionSuggestion {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface MentionListProps {
  items: MentionSuggestion[];
  command: (item: { id: string; label: string }) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        // IMPORTANT: o TipTap Suggestion espera que o command rode de forma síncrona.
        // Se atrasarmos (setTimeout), o suggestion pode sair/blur antes e a menção não insere.
        command({ id: item.id, label: item.name });
      }
    };

    const upHandler = () => {
      if (items.length === 0) return;
      setSelectedIndex((prevIndex) => (prevIndex + items.length - 1) % items.length);
    };

    const downHandler = () => {
      if (items.length === 0) return;
      setSelectedIndex((prevIndex) => (prevIndex + 1) % items.length);
    };

    const enterHandler = () => {
      if (items.length === 0) return;
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-background border border-border/40 rounded-xl shadow-xl p-4 text-sm text-muted-foreground">
          Nenhum membro encontrado
        </div>
      );
    }

    return (
      <div className="bg-background border border-border/40 rounded-xl shadow-xl overflow-hidden min-w-[220px] max-w-[320px]">
        <div className="px-3 py-2 border-b border-border/30">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mencionar
          </span>
        </div>
        <div className="p-1.5 max-h-[280px] overflow-y-auto">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                'hover:bg-primary/10 focus:outline-none',
                index === selectedIndex 
                  ? 'bg-primary/15 text-foreground shadow-sm' 
                  : 'text-foreground/90'
              )}
              // Mantém o foco no editor para o TipTap conseguir inserir a menção corretamente
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => selectItem(index)}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background shadow-sm">
                {item.avatar_url && <AvatarImage src={item.avatar_url} />}
                <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  {getInitials(item.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';

export default MentionList;
