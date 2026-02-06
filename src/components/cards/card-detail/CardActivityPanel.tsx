import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  History,
  AtSign,
  Paperclip,
  Smile,
  Send,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CardActivityPanelProps {
  cardId: string;
}

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = React.useState<'comments' | 'history'>('comments');
  const [newComment, setNewComment] = React.useState('');
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(cardId);
  const createComment = useCreateComment();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    await createComment.mutateAsync({
      card_id: cardId,
      content: newComment,
      mentions: [],
    });

    setNewComment('');
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-background/80">
        <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
              activeTab === 'comments' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-3 w-3" />
            Comentários
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
              activeTab === 'history' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3 w-3" />
            Histórico
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {activeTab === 'comments' ? (
            isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-xs">Nenhum comentário ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments?.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      {comment.user?.avatar_url && (
                        <AvatarImage src={comment.user.avatar_url} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {getInitials(comment.user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium">
                          {comment.user?.full_name || 'Usuário'}
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        >
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 mt-0.5 break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Histórico em breve
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Comment Input - Compact design */}
      <div className="flex-shrink-0 border-t bg-background p-2">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 focus-within:border-primary/50 transition-colors">
          <input
            type="text"
            placeholder="Escreva um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="flex-1 min-w-0 bg-transparent border-none text-xs placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full">
              <AtSign className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full">
              <Smile className="h-3.5 w-3.5" />
            </Button>
            <Button 
              size="icon" 
              className="h-6 w-6 rounded-full ml-0.5"
              onClick={handleSubmit}
              disabled={!newComment.trim() || createComment.isPending}
            >
              {createComment.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
