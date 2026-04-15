import React, { useState } from 'react';
import { ThumbsUp, Smile } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const QUICK_EMOJIS = ['👍', '🔥', '❤️', '🎉', '👀', '😂', '🚀', '💯', '😍', '🤔', '👏', '✅'];

interface Reaction {
  emoji: string;
  userIds: string[];
}

interface CommentReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggleReaction: (emoji: string) => void;
}

export const CommentReactions: React.FC<CommentReactionsProps> = ({
  reactions,
  currentUserId,
  onToggleReaction,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeReactions = reactions.filter(r => r.userIds.length > 0);

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {activeReactions.map((reaction) => {
        const hasReacted = reaction.userIds.includes(currentUserId);
        return (
          <button
            key={reaction.emoji}
            onClick={() => onToggleReaction(reaction.emoji)}
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs transition-all border',
              hasReacted
                ? 'bg-primary/10 border-primary/30 text-foreground'
                : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/60'
            )}
          >
            <span className="text-[13px]">{reaction.emoji}</span>
            <span className="tabular-nums text-[11px] font-medium">{reaction.userIds.length}</span>
          </button>
        );
      })}

      {/* Quick thumbs up */}
      <button
        onClick={() => onToggleReaction('👍')}
        className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted/60 transition-all text-muted-foreground"
        title="Curtir"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>

      {/* Emoji picker */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted/60 transition-all text-muted-foreground"
            title="Adicionar reação"
          >
            <Smile className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" side="top">
          <div className="grid grid-cols-6 gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggleReaction(emoji);
                  setPickerOpen(false);
                }}
                className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted/60 transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
