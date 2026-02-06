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
        command({ id: item.id, label: item.name });
      }
    };

    const upHandler = () => {
      setSelectedIndex((selectedIndex + items.length - 1) % items.length);
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          Nenhum membro encontrado
        </div>
      );
    }

    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px] max-w-[300px]">
        <div className="p-1.5 max-h-[280px] overflow-y-auto">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors',
                'hover:bg-accent focus:outline-none',
                index === selectedIndex && 'bg-accent'
              )}
              onClick={() => selectItem(index)}
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                {item.avatar_url && <AvatarImage src={item.avatar_url} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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
