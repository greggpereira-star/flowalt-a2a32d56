import React, { useMemo, useCallback, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  History,
  Send,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RichTextEditor, type MentionSuggestion } from '@/components/ui/rich-text-editor';
import { RichTextViewer, isRichTextEmpty } from '@/components/ui/rich-text-viewer';
import { toast } from 'sonner';

interface CardActivityPanelProps {
  cardId: string;
}

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [newComment, setNewComment] = useState('');
  const [currentMentions, setCurrentMentions] = useState<string[]>([]);
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(cardId);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const createComment = useCreateComment();

  // Convert workspace members to mention suggestions
  const mentionSuggestions: MentionSuggestion[] = useMemo(() => {
    if (!workspaceMembers) return [];
    return workspaceMembers
      .filter(member => member.profile)
      .map(member => ({
        id: member.user_id,
        name: member.profile?.full_name || member.profile?.email || 'Usuário',
        avatar_url: member.profile?.avatar_url,
      }));
  }, [workspaceMembers]);

  // Create a map for resolving mentions in viewer
  const mentionResolver = useCallback((id: string) => {
    const member = workspaceMembers?.find(m => m.user_id === id);
    if (member?.profile) {
      return {
        name: member.profile.full_name || member.profile.email || 'Usuário',
        avatar_url: member.profile.avatar_url,
      };
    }
    return undefined;
  }, [workspaceMembers]);

  const handleSubmit = async () => {
    if (isRichTextEmpty(newComment)) return;

    if (!user?.id) {
      toast.error('Você precisa estar logado para enviar mensagens.');
      return;
    }

    try {
      await createComment.mutateAsync({
        card_id: cardId,
        content: newComment,
        mentions: currentMentions,
      });

      setNewComment('');
      setCurrentMentions([]);
    } catch (err) {
      console.error('Erro ao enviar comentário:', err);
      toast.error('Não foi possível enviar a mensagem. Tente novamente.');
    }
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
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Minimal Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              activeTab === 'comments' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              activeTab === 'history' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Log
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {activeTab === 'comments' ? (
            isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
              </div>
            ) : comments?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 opacity-40" />
                </div>
                <p className="text-sm font-medium">Nenhuma mensagem</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Inicie a conversa</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments?.map((comment) => (
                  <div 
                    key={comment.id} 
                    className="group flex gap-3 p-2 -mx-2 rounded-xl hover:bg-muted/30 transition-colors duration-200"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background shadow-sm">
                      {comment.user?.avatar_url && (
                        <AvatarImage src={comment.user.avatar_url} className="object-cover" />
                      )}
                      <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                        {getInitials(comment.user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {comment.user?.full_name || 'Usuário'}
                        </span>
                        <span
                          className="text-[11px] text-muted-foreground/70 font-medium"
                          title={format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        >
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: false,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed">
                        <RichTextViewer 
                          content={comment.content} 
                          mentionResolver={mentionResolver}
                          className="text-sm [&_p]:leading-relaxed [&_.mention]:font-semibold [&_.mention]:text-primary"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                <History className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Em breve</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Histórico de atividades</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="flex-shrink-0 p-3 border-t border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background p-2 shadow-lg focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition-all duration-200">
          <div className="flex-1 min-w-0">
            <RichTextEditor
              value={newComment}
              onChange={setNewComment}
              placeholder="Escreva uma mensagem... (@ para mencionar)"
              minHeight="32px"
              maxHeight="120px"
              mentionSuggestions={mentionSuggestions}
              onMentionsChange={setCurrentMentions}
              showToolbar={false}
              className="border-0 bg-transparent shadow-none focus-within:ring-0 focus-within:border-transparent [&>div]:rounded-xl"
              contentClassName="px-3 py-2 text-sm leading-relaxed"
            />
          </div>

          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-10 w-10 rounded-xl p-0 flex-shrink-0 transition-all duration-200",
              !isRichTextEmpty(newComment) && !createComment.isPending
                ? "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl hover:scale-105"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={handleSubmit}
            disabled={!user?.id || isRichTextEmpty(newComment) || createComment.isPending}
            aria-label="Enviar mensagem"
            title={!user?.id ? 'Faça login para enviar' : 'Enviar'}
          >
            {createComment.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
