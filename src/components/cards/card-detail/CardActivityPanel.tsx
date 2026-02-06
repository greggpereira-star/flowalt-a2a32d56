import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommentsPanel } from '../CommentsPanel';
import {
  MessageCircle,
  History,
  Send,
  Paperclip,
  AtSign,
  Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardActivityPanelProps {
  cardId: string;
}

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = React.useState<'comments' | 'history'>('comments');
  const [comment, setComment] = React.useState('');

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Header with tabs */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === 'comments' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Comentários
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === 'history' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Histórico
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'comments' ? (
            <CommentsPanel cardId={cardId} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Histórico em breve
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Acompanhe todas as alterações do card
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Comment input - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escreva um comentário..."
            className="flex-1 border-none bg-transparent h-8 text-sm focus-visible:ring-0 px-2"
          />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <AtSign className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Smile className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              className="h-7 w-7 ml-1"
              disabled={!comment.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
