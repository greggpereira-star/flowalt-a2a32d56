import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit2, Send, Loader2, AtSign, Paperclip, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  type Comment,
} from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RichTextEditor, type MentionSuggestion } from '@/components/ui/rich-text-editor';
import { RichTextViewer, isRichTextEmpty } from '@/components/ui/rich-text-viewer';

interface CommentsPanelProps {
  cardId: string;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({ cardId }) => {
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(cardId);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [currentMentions, setCurrentMentions] = useState<string[]>([]);
  
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const prevCommentsLength = useRef<number>(0);

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

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (comments && comments.length > prevCommentsLength.current) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCommentsLength.current = comments?.length || 0;
  }, [comments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    await createComment.mutateAsync({
      card_id: cardId,
      content: newComment,
      mentions: currentMentions,
    });

    setNewComment('');
    setCurrentMentions([]);
  };

  const handleEdit = async (comment: Comment) => {
    if (isRichTextEmpty(editContent)) return;

    await updateComment.mutateAsync({
      id: comment.id,
      card_id: cardId,
      content: editContent,
    });

    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (comment: Comment) => {
    await deleteComment.mutateAsync({
      id: comment.id,
      card_id: cardId,
    });
  };

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
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

  // Check if current user is mentioned in a comment
  const isUserMentioned = (comment: Comment): boolean => {
    if (!user?.id || !comment.mentions) return false;
    return comment.mentions.includes(user.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {comments?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum comentário ainda</p>
            <p className="text-xs mt-1">Seja o primeiro a comentar!</p>
          </div>
        ) : (
          <>
            {comments?.map((comment) => {
              const isOwner = comment.user_id === user?.id;
              const isEditing = editingId === comment.id;
              const isMentioned = isUserMentioned(comment);

              return (
                <div 
                  key={comment.id} 
                  className={cn(
                    'flex gap-3 group p-2 rounded-lg transition-colors',
                    isMentioned && 'bg-primary/5 border-l-2 border-primary'
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {comment.user?.avatar_url && (
                      <AvatarImage src={comment.user.avatar_url} />
                    )}
                    <AvatarFallback className="text-xs">
                      {getInitials(comment.user?.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {comment.user?.full_name || 'Usuário'}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        title={format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      >
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                      {comment.updated_at !== comment.created_at && (
                        <span className="text-xs text-muted-foreground">(editado)</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <RichTextEditor
                          value={editContent}
                          onChange={setEditContent}
                          minHeight="60px"
                          maxHeight="200px"
                          autoFocus
                          mentionSuggestions={mentionSuggestions}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEdit(comment)}
                            disabled={isRichTextEmpty(editContent) || updateComment.isPending}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditContent('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <RichTextViewer 
                          content={comment.content} 
                          mentionResolver={mentionResolver}
                        />
                      </div>
                    )}
                  </div>

                  {isOwner && !isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditing(comment)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(comment)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
            <div ref={commentsEndRef} />
          </>
        )}
      </div>

      {/* Comment Input - Simple inline design */}
      <div className="border-t border-border pt-4 mt-auto">
        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
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
            className="flex-1 bg-transparent border-none text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full">
              <AtSign className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full">
              <Smile className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              className="h-8 w-8 rounded-full ml-1"
              onClick={handleSubmit}
              disabled={!newComment.trim() || createComment.isPending}
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
    </div>
  );
};
