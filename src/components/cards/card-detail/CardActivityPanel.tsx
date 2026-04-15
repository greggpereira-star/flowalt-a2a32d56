import React, { useMemo, useCallback, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  History,
  Send,
  Loader2,
  ListFilter,
  Paperclip,
  Image,
  AtSign,
  Smile,
  CheckSquare,
  Film,
  Mic,
  Link,
  Lock,
  Type,
  Sparkles,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useComments';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RichTextEditor, type MentionSuggestion } from '@/components/ui/rich-text-editor';
import { RichTextViewer, isRichTextEmpty } from '@/components/ui/rich-text-viewer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CommentContextMenu } from './CommentContextMenu';
import { CommentReactions } from './CommentReactions';

interface CardActivityPanelProps {
  cardId: string;
}

type ActivityTab = 'all' | 'comments' | 'history';

export const CardActivityPanel: React.FC<CardActivityPanelProps> = ({
  cardId,
}) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('all');
  const [newComment, setNewComment] = useState('');
  const [currentMentions, setCurrentMentions] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  // Local reactions state (not persisted to DB yet — UI-only for now)
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string[]>>>({});
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(cardId);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

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
      toast.error('Não foi possível enviar a mensagem.');
    }
  };

  const handleEditSave = async (commentId: string) => {
    if (isRichTextEmpty(editContent)) return;
    try {
      await updateComment.mutateAsync({
        id: commentId,
        card_id: cardId,
        content: editContent,
      });
      setEditingCommentId(null);
      setEditContent('');
      toast.success('Comentário atualizado');
    } catch {
      toast.error('Erro ao editar comentário');
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync({ id: commentId, card_id: cardId });
      toast.success('Comentário excluído');
    } catch {
      toast.error('Erro ao excluir comentário');
    }
  };

  const handleToggleReaction = (commentId: string, emoji: string) => {
    if (!user?.id) return;
    setLocalReactions(prev => {
      const commentReactions = { ...(prev[commentId] || {}) };
      const users = [...(commentReactions[emoji] || [])];
      const idx = users.indexOf(user.id);
      if (idx >= 0) {
        users.splice(idx, 1);
      } else {
        users.push(user.id);
      }
      commentReactions[emoji] = users;
      return { ...prev, [commentId]: commentReactions };
    });
  };

  const getReactionsForComment = (commentId: string) => {
    const cr = localReactions[commentId] || {};
    return Object.entries(cr)
      .map(([emoji, userIds]) => ({ emoji, userIds }))
      .filter(r => r.userIds.length > 0);
  };

  const startEdit = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditContent(content);
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const tabs: { id: ActivityTab; label: string; count?: number }[] = [
    { id: 'all', label: 'Tudo' },
    { id: 'comments', label: 'Comentários', count: comments?.length },
    { id: 'history', label: 'Histórico' },
  ];

  const toolbarItems = [
    { icon: Plus, tooltip: 'Mais opções' },
    { icon: Sparkles, tooltip: 'IA', special: true },
    { icon: Paperclip, tooltip: 'Anexar arquivo' },
    { icon: Image, tooltip: 'Imagem' },
    { icon: AtSign, tooltip: 'Mencionar' },
    { icon: Smile, tooltip: 'Emoji' },
    { icon: CheckSquare, tooltip: 'Checklist' },
    { icon: Film, tooltip: 'GIF' },
    { icon: Mic, tooltip: 'Áudio' },
    { icon: Link, tooltip: 'Vincular tarefa' },
    { icon: Lock, tooltip: 'Privado' },
    { icon: Type, tooltip: 'Formatação' },
  ];

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/40 bg-background">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Atividade</h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
            <ListFilter className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border/40 -mb-3 -mx-4 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-2.5 pb-2 pt-0.5 text-xs font-medium transition-all border-b-2",
                activeTab === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1 px-1 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3">
          {(activeTab === 'all' || activeTab === 'comments') ? (
            isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Nenhum comentário ainda</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Seja o primeiro a comentar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments?.map((comment) => {
                  const isAuthor = comment.user_id === user?.id;
                  const isEditing = editingCommentId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className="group rounded-lg bg-background border border-border/30 hover:border-border/60 transition-colors overflow-hidden"
                    >
                      <div className="border-l-[3px] border-primary/60 pl-3 pr-3 py-2.5">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <Avatar className="h-5 w-5">
                            {comment.user?.avatar_url && (
                              <AvatarImage src={comment.user.avatar_url} />
                            )}
                            <AvatarFallback className="text-[8px] bg-primary/15 text-primary font-semibold">
                              {getInitials(comment.user?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-foreground/90">
                            {comment.user?.full_name?.split(' ')[0] || 'User'}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground/50 cursor-default">
                                {formatDistanceToNow(new Date(comment.created_at), {
                                  addSuffix: false,
                                  locale: ptBR,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-foreground text-background text-[11px]">
                              {format(new Date(comment.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                          {comment.updated_at !== comment.created_at && (
                            <span className="text-[10px] text-muted-foreground/40 italic">(editado)</span>
                          )}

                          {/* Context Menu */}
                          <div className="ml-auto">
                            <CommentContextMenu
                              commentId={comment.id}
                              isAuthor={isAuthor}
                              onEdit={() => startEdit(comment.id, comment.content)}
                              onDelete={() => handleDelete(comment.id)}
                            />
                          </div>
                        </div>

                        {/* Body or Edit Mode */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="rounded-md border border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
                              <RichTextEditor
                                value={editContent}
                                onChange={setEditContent}
                                placeholder="Editar comentário..."
                                minHeight="36px"
                                maxHeight="120px"
                                showToolbar={false}
                                className="border-0 bg-transparent shadow-none focus-within:ring-0"
                                contentClassName="px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-6 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => handleEditSave(comment.id)}
                                disabled={updateComment.isPending}
                              >
                                {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-3 text-xs"
                                onClick={() => { setEditingCommentId(null); setEditContent(''); }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[13px] text-foreground/80 leading-relaxed">
                            <RichTextViewer
                              content={comment.content}
                              mentionResolver={mentionResolver}
                              className="text-[13px] [&_p]:leading-relaxed"
                            />
                          </div>
                        )}

                        {/* Reactions */}
                        {!isEditing && user?.id && (
                          <CommentReactions
                            reactions={getReactionsForComment(comment.id)}
                            currentUserId={user.id}
                            onToggleReaction={(emoji) => handleToggleReaction(comment.id, emoji)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-5 w-5 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/60">Em breve</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Comment Input - Enhanced */}
      <div className="flex-shrink-0 p-3 border-t border-border/40 bg-background">
        <div className="rounded-lg border border-border/50 bg-muted/20 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <RichTextEditor
            value={newComment}
            onChange={setNewComment}
            placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
            minHeight="36px"
            maxHeight="120px"
            mentionSuggestions={mentionSuggestions}
            onMentionsChange={setCurrentMentions}
            showToolbar={false}
            onSubmit={handleSubmit}
            className="border-0 bg-transparent shadow-none focus-within:ring-0 focus-within:border-transparent"
            contentClassName="px-3 py-2 text-sm leading-relaxed"
          />
          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 pb-1.5 border-t border-border/20 pt-1">
            <div className="flex items-center gap-0">
              {toolbarItems.slice(0, 8).map((item, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "h-6 w-6 rounded flex items-center justify-center transition-colors",
                        item.special
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">{item.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Button
              size="sm"
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium gap-1.5 transition-all",
                !isRichTextEmpty(newComment) && !createComment.isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
              onClick={handleSubmit}
              disabled={!user?.id || isRichTextEmpty(newComment) || createComment.isPending}
            >
              {createComment.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
