import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CommentsPanel } from '../CommentsPanel';
import {
  Search,
  Bell,
  Filter,
  Plus,
  Paperclip,
  AtSign,
  MoreHorizontal,
  Send,
  ChevronDown,
  Activity,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardActivityPanelProps {
  cardId: string;
}

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = React.useState<'activity' | 'comments'>('comments');

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Atividade</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          <Button
            variant={activeTab === 'comments' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setActiveTab('comments')}
          >
            <MessageCircle className="h-3 w-3" />
            Comentários
          </Button>
          <Button
            variant={activeTab === 'activity' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setActiveTab('activity')}
          >
            <Activity className="h-3 w-3" />
            Histórico
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'comments' ? (
            <CommentsPanel cardId={cardId} />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground text-center py-8">
                Histórico de atividades em breve...
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick add section */}
      <div className="flex-shrink-0 border-t bg-background p-3">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Escreva um comentário..."
            className="border-none bg-transparent h-7 text-sm focus-visible:ring-0 px-0"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <AtSign className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" className="h-6 w-6">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sparkles icon for the input
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);
