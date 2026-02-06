import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CommentsPanel } from '../CommentsPanel';
import {
  MessageCircle,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardActivityPanelProps {
  cardId: string;
}

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = React.useState<'comments' | 'history'>('comments');

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

      {/* Content - full height for CommentsPanel to manage its own scroll and input */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'comments' ? (
          <div className="h-full p-4">
            <CommentsPanel cardId={cardId} />
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4">
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
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
