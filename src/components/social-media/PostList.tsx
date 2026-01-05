/**
 * Post List Component
 * Display social media posts in a list format with actions
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Instagram, 
  Facebook, 
  Linkedin, 
  Youtube, 
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Send,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  User,
  Calendar as CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SocialPost, SocialPlatform, SocialPostStatus } from '@/hooks/useSocialPosts';
import { useDeleteSocialPost, useUpdateSocialPost } from '@/hooks/useSocialPosts';

interface PostListProps {
  posts: SocialPost[];
  onEdit?: (postId: string) => void;
  showActions?: boolean;
  emptyMessage?: string;
}

const PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  tiktok: <div className="h-4 w-4 flex items-center justify-center text-xs font-bold">T</div>,
  twitter: <div className="h-4 w-4 flex items-center justify-center text-xs font-bold">X</div>,
};

const STATUS_CONFIG: Record<SocialPostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: <Edit className="h-3 w-3" /> },
  pending_approval: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Aprovado', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  scheduled: { label: 'Agendado', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  publishing: { label: 'Publicando', variant: 'default', icon: <Send className="h-3 w-3" /> },
  published: { label: 'Publicado', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: 'Falhou', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  archived: { label: 'Arquivado', variant: 'secondary', icon: <AlertCircle className="h-3 w-3" /> },
};

export function PostList({ posts, onEdit, showActions = true, emptyMessage }: PostListProps) {
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const { mutate: deletePost, isPending: isDeleting } = useDeleteSocialPost();
  const { mutate: updatePost } = useUpdateSocialPost();

  const handleDelete = () => {
    if (deletePostId) {
      deletePost(deletePostId, {
        onSuccess: () => setDeletePostId(null),
      });
    }
  };

  const handlePublishNow = (post: SocialPost) => {
    updatePost({
      postId: post.id,
      input: { status: 'publishing' },
    });
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage || 'Nenhuma postagem encontrada'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {posts.map(post => {
          const statusConfig = STATUS_CONFIG[post.status];
          const firstMedia = post.media_urls?.[0];

          return (
            <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Media Preview */}
                  <div className="w-32 h-32 flex-shrink-0 bg-muted">
                    {firstMedia ? (
                      <img 
                        src={firstMedia.url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Platform & Status */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            {PLATFORM_ICONS[post.platform]}
                            <span className="text-xs capitalize">{post.platform}</span>
                          </div>
                          <Badge variant={statusConfig.variant} className="gap-1 text-xs">
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                          {post.content_type && (
                            <Badge variant="outline" className="text-xs">
                              {post.content_type}
                            </Badge>
                          )}
                        </div>

                        {/* Caption */}
                        <p className="text-sm line-clamp-2 mb-2">
                          {post.caption || <span className="text-muted-foreground italic">Sem legenda</span>}
                        </p>

                        {/* Hashtags */}
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {post.hashtags.slice(0, 5).map(tag => (
                              <span key={tag} className="text-xs text-primary">
                                #{tag}
                              </span>
                            ))}
                            {post.hashtags.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{post.hashtags.length - 5}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Date Info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {post.scheduled_at && post.status === 'scheduled' && (
                            <span className="flex items-center gap-1 font-medium text-blue-600">
                              <Clock className="h-3 w-3" />
                              Agendado para {format(new Date(post.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          {post.scheduled_at && post.status !== 'scheduled' && post.status !== 'published' && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Previsto para {format(new Date(post.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          {post.published_at && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Publicado em {format(new Date(post.published_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>

                        {/* Audit Info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          {post.creator && (
                            <span className="flex items-center gap-1" title={`Criado por ${post.creator.full_name || post.creator.email}`}>
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">
                                {post.creator.full_name || post.creator.email?.split('@')[0]}
                              </span>
                            </span>
                          )}
                          {post.created_at && (
                            <span className="flex items-center gap-1" title="Data de criação do agendamento">
                              <CalendarIcon className="h-3 w-3" />
                              Criado em {format(new Date(post.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          {post.retry_count > 0 && (
                            <span className="flex items-center gap-1 text-amber-600" title="Tentativas de publicação">
                              <RefreshCw className="h-3 w-3" />
                              {post.retry_count} tentativa{post.retry_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Error Message */}
                        {post.error_message && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{post.error_message}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {showActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {post.platform_url && (
                              <DropdownMenuItem asChild>
                                <a href={post.platform_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Ver no {post.platform}
                                </a>
                              </DropdownMenuItem>
                            )}
                            {onEdit && ['draft', 'pending_approval', 'scheduled'].includes(post.status) && (
                              <DropdownMenuItem onClick={() => onEdit(post.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {['draft', 'approved', 'scheduled'].includes(post.status) && (
                              <DropdownMenuItem onClick={() => handlePublishNow(post)}>
                                <Send className="h-4 w-4 mr-2" />
                                Publicar agora
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setDeletePostId(post.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePostId} onOpenChange={(open) => !open && setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir postagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A postagem será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
