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

    await createComment.mutateAsync({
      card_id: cardId,
      content: newComment,
      mentions: currentMentions,
    });

    setNewComment('');
    setCurrentMentions([]);
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
    <div className="h-full flex flex-col bg-background/50">
      {/* Minimal Header */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/30 rounded-md">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all",
              activeTab === 'comments' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="h-3 w-3" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all",
              activeTab === 'history' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3 w-3" />
            Log
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {activeTab === 'comments' ? (
            isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <MessageCircle className="h-5 w-5 mx-auto mb-1 opacity-40" />
                <p className="text-[10px]">Sem mensagens</p>
              </div>
            ) : (
              <div className="space-y-2">
                {comments?.map((comment) => (
                  <div key={comment.id} className="group flex gap-1.5 hover:bg-muted/20 rounded p-1 -mx-1 transition-colors">
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      {comment.user?.avatar_url && (
                        <AvatarImage src={comment.user.avatar_url} />
                      )}
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                        {getInitials(comment.user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-semibold text-foreground/90 truncate">
                          {comment.user?.full_name?.split(' ')[0] || 'User'}
                        </span>
                        <span
                          className="text-[9px] text-muted-foreground/60"
                          title={format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        >
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: false,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-foreground/80 leading-relaxed">
                        <RichTextViewer 
                          content={comment.content} 
                          mentionResolver={mentionResolver}
                          className="text-[11px] [&_p]:leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <History className="h-4 w-4 text-muted-foreground/40 mb-1" />
              <p className="text-[10px] text-muted-foreground/60">Em breve</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Premium Composer */}
      <div className="flex-shrink-0 px-2 py-2 bg-gradient-to-t from-background to-transparent">
        <div className="mx-auto w-full">
          <div className="flex items-end gap-1.5 rounded-full border border-border/40 bg-muted/30 pl-2.5 pr-1.5 py-1.5 focus-within:border-primary/25 focus-within:bg-muted/40 transition-colors">
            <div className="flex-1 min-w-0">
              <RichTextEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="Mensagem… (@ para mencionar)"
                minHeight="22px"
                maxHeight="96px"
                mentionSuggestions={mentionSuggestions}
                onMentionsChange={setCurrentMentions}
                showToolbar={false}
                className="border-0 bg-transparent shadow-none focus-within:ring-0 focus-within:border-transparent"
                contentClassName="px-2 py-1"
              />
            </div>

            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 rounded-full flex-shrink-0 transition-colors",
                !isRichTextEmpty(newComment) && !createComment.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={handleSubmit}
              disabled={isRichTextEmpty(newComment) || createComment.isPending}
              aria-label="Enviar mensagem"
              title="Enviar"
            >
              {createComment.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
