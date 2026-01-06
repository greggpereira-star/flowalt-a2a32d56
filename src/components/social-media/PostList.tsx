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
  RefreshCw,
  Sparkles,
  PartyPopper,
  Video
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SocialPost, SocialPlatform, SocialPostStatus, MediaItem } from '@/hooks/useSocialPosts';
import { useDeleteSocialPost, useUpdateSocialPost } from '@/hooks/useSocialPosts';

// Helper function to safely parse media_urls
const getMediaItems = (mediaUrls: unknown): MediaItem[] => {
  if (!mediaUrls || !Array.isArray(mediaUrls)) return [];
  return mediaUrls as MediaItem[];
};

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

// Map technical error codes to user-friendly messages
const getErrorMessage = (errorCode: string | null, errorMessage: string | null): { message: string; isRetrying: boolean } => {
  const retryableErrors = [
    'FB_STORY_PHOTO_PUBLISH_ERROR',
    'FB_API_TEMPORARILY_UNAVAILABLE',
    'FB_RATE_LIMIT',
    'NETWORK_ERROR',
    'TIMEOUT',
  ];
  
  const isRetrying = errorCode ? retryableErrors.includes(errorCode) : false;
  
  const errorMessages: Record<string, string> = {
    'FB_STORY_PHOTO_PUBLISH_ERROR': 'Falha temporária na API do Meta. O sistema tentará novamente automaticamente.',
    'FB_API_TEMPORARILY_UNAVAILABLE': 'API do Meta temporariamente indisponível. Aguardando nova tentativa.',
    'FB_RATE_LIMIT': 'Limite de publicações atingido. Aguardando para tentar novamente.',
    'FB_INVALID_TOKEN': 'Token de acesso expirado. Reconecte sua conta nas configurações.',
    'FB_PERMISSION_DENIED': 'Permissão negada. Verifique as permissões da conta conectada.',
    'FB_MEDIA_ERROR': 'Erro ao processar mídia. Verifique se o arquivo é válido.',
    'FB_DUPLICATE_POST': 'Conteúdo duplicado detectado pelo Facebook.',
    'NETWORK_ERROR': 'Erro de conexão. O sistema tentará novamente.',
    'TIMEOUT': 'Tempo limite excedido. Tentando novamente em breve.',
    'INVALID_MEDIA_URL': 'URL da mídia inválida ou inacessível.',
    'NO_CONNECTED_ACCOUNT': 'Nenhuma conta conectada para esta plataforma.',
  };
  
  if (errorCode && errorMessages[errorCode]) {
    return { message: errorMessages[errorCode], isRetrying };
  }
  
  // For unknown errors, show a generic message instead of technical details
  if (errorMessage?.toLowerCase().includes('temporarily unavailable') || 
      errorMessage?.toLowerCase().includes('service unavailable')) {
    return { message: 'Serviço temporariamente indisponível. O sistema tentará novamente.', isRetrying: true };
  }
  
  return { message: errorMessage || 'Ocorreu um erro ao publicar.', isRetrying: false };
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
          const mediaItems = getMediaItems(post.media_urls);
          const firstMedia = mediaItems[0];
          const isPublished = post.status === 'published';
          const isFailed = post.status === 'failed';
          const isScheduled = post.status === 'scheduled';
          const isVideo = firstMedia?.type === 'video';

          return (
            <Card 
              key={post.id} 
              className={cn(
                "overflow-hidden transition-all",
                isPublished && "border-green-200 bg-gradient-to-r from-green-50/50 to-transparent shadow-sm dark:border-green-800/50 dark:from-green-950/30",
                isFailed && "border-red-200 bg-gradient-to-r from-red-50/30 to-transparent dark:border-red-800/50 dark:from-red-950/30",
                isScheduled && "border-blue-200 bg-gradient-to-r from-blue-50/30 to-transparent dark:border-blue-800/50 dark:from-blue-950/30",
                !isPublished && !isFailed && !isScheduled && "hover:shadow-md"
              )}
            >
              <CardContent className="p-0">
                <div className="flex">
                  {/* Media Preview with status indicator */}
                  <div className="relative w-32 h-32 flex-shrink-0 bg-muted overflow-hidden">
                    {firstMedia ? (
                      isVideo ? (
                        <div className="w-full h-full relative">
                          <video
                            src={firstMedia.url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="bg-black/60 rounded-full p-2">
                              <Video className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          {mediaItems.length > 1 && (
                            <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              +{mediaItems.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full relative">
                          <img 
                            src={firstMedia.url} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.classList.add('fallback');
                            }}
                          />
                          {mediaItems.length > 1 && (
                            <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              +{mediaItems.length - 1}
                            </span>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Success overlay indicator */}
                    {isPublished && (
                      <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                        <div className="absolute bottom-2 right-2 bg-green-500 rounded-full p-1.5 shadow-lg">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                    
                    {/* Scheduled indicator */}
                    {isScheduled && (
                      <div className="absolute bottom-2 right-2 bg-blue-500 rounded-full p-1.5 shadow-lg">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    {/* Failed indicator */}
                    {isFailed && (
                      <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5 shadow-lg">
                        <XCircle className="h-4 w-4 text-white" />
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
                          <Badge 
                            variant={statusConfig.variant} 
                            className={cn(
                              "gap-1 text-xs",
                              isPublished && "bg-green-500 hover:bg-green-600 text-white",
                              isScheduled && "bg-blue-500 hover:bg-blue-600 text-white"
                            )}
                          >
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

                        {/* Success Message - Only for published posts */}
                        {isPublished && (
                          <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-800">
                                Publicado com sucesso!
                              </p>
                              <p className="text-xs text-green-600">
                                {post.published_at && format(new Date(post.published_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            {post.platform_url && (
                              <a 
                                href={post.platform_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 px-2 py-1 rounded transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver post
                              </a>
                            )}
                          </div>
                        )}

                        {/* Error Message - Only for failed posts or posts with errors */}
                        {!isPublished && (post.error_message || post.error_code) && (
                          (() => {
                            const { message, isRetrying } = getErrorMessage(post.error_code, post.error_message);
                            return (
                              <div className={cn(
                                "mt-2 p-2 rounded text-xs flex items-start gap-2",
                                isRetrying ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-destructive/10 text-destructive"
                              )}>
                                {isRetrying ? (
                                  <RefreshCw className="h-3 w-3 mt-0.5 flex-shrink-0 animate-spin" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                )}
                                <span>{message}</span>
                              </div>
                            );
                          })()
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
