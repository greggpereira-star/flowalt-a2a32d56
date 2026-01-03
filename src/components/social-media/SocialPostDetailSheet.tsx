import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
  Video,
  Calendar,
  Clock,
  Hash,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  Send,
  Edit,
  Trash2,
  ExternalLink,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SocialPost, SocialPlatform, SocialPostStatus } from '@/hooks/useSocialPosts';
import { useDeleteSocialPost, useApproveSocialPost, useScheduleSocialPost } from '@/hooks/useSocialPosts';

interface SocialPostDetailSheetProps {
  post: SocialPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

const platformIcons: Record<SocialPlatform, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Video,
  youtube: Youtube,
  twitter: Twitter,
};

const platformColors: Record<SocialPlatform, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#000000',
};

const statusConfig: Record<SocialPostStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Edit },
  pending_approval: { label: 'Aguardando Aprovação', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-800', icon: Calendar },
  publishing: { label: 'Publicando...', color: 'bg-purple-100 text-purple-800', icon: Send },
  published: { label: 'Publicado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  failed: { label: 'Erro', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800', icon: Edit },
};

const contentTypeLabels: Record<string, string> = {
  feed: 'Feed',
  story: 'Story',
  reels: 'Reels',
  carousel: 'Carrossel',
  video: 'Vídeo',
  short: 'Short',
  article: 'Artigo',
};

const pillarLabels: Record<string, string> = {
  educational: 'Educativo',
  sales: 'Vendas',
  entertainment: 'Entretenimento',
  relationship: 'Relacionamento',
  institutional: 'Institucional',
  other: 'Outro',
};

const funnelLabels: Record<string, string> = {
  tofu: 'Topo do Funil',
  mofu: 'Meio do Funil',
  bofu: 'Fundo do Funil',
};

export function SocialPostDetailSheet({
  post,
  open,
  onOpenChange,
  onEdit,
}: SocialPostDetailSheetProps) {
  const deletePost = useDeleteSocialPost();
  const approvePost = useApproveSocialPost();

  if (!post) return null;

  const PlatformIcon = platformIcons[post.platform];
  const statusInfo = statusConfig[post.status];
  const StatusIcon = statusInfo.icon;

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir esta postagem?')) {
      await deletePost.mutateAsync(post.id);
      onOpenChange(false);
    }
  };

  const handleApprove = async () => {
    await approvePost.mutateAsync(post.id);
  };

  const metrics = post.metrics || {};
  const hasMetrics = Object.keys(metrics).length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${platformColors[post.platform]}20` }}
              >
                <PlatformIcon className="h-6 w-6" style={{ color: platformColors[post.platform] }} />
              </div>
              <div>
                <SheetTitle className="text-left capitalize">{post.platform}</SheetTitle>
                <Badge variant="outline" className="text-xs mt-1">
                  {contentTypeLabels[post.content_type]}
                </Badge>
              </div>
            </div>
            <Badge className={cn("text-xs", statusInfo.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-6">
          <div className="space-y-6 pr-4">
            {/* Error Message */}
            {post.status === 'failed' && post.error_message && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Erro na publicação</p>
                    <p className="text-xs text-muted-foreground mt-1">{post.error_message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Caption */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Legenda
              </label>
              <div className="p-3 rounded-lg bg-muted/50 min-h-[80px]">
                <p className="text-sm whitespace-pre-wrap">
                  {post.caption || <span className="text-muted-foreground italic">Sem legenda</span>}
                </p>
              </div>
            </div>

            {/* Hashtags */}
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Hashtags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {post.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Schedule Info */}
            <div className="grid grid-cols-2 gap-4">
              {post.scheduled_at && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Agendado para
                  </label>
                  <p className="text-sm font-medium">
                    {format(new Date(post.scheduled_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}

              {post.published_at && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Publicado em
                  </label>
                  <p className="text-sm font-medium">
                    {format(new Date(post.published_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>

            {/* Marketing Intelligence */}
            {(post.content_pillar || post.funnel_stage || post.campaign_name) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Inteligência de Marketing
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {post.content_pillar && (
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">Pilar</p>
                        <p className="text-sm font-medium">{pillarLabels[post.content_pillar]}</p>
                      </div>
                    )}
                    {post.funnel_stage && (
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">Funil</p>
                        <p className="text-sm font-medium">{funnelLabels[post.funnel_stage]}</p>
                      </div>
                    )}
                    {post.campaign_name && (
                      <div className="p-2 rounded-lg bg-muted/50 col-span-2">
                        <p className="text-[10px] text-muted-foreground">Campanha</p>
                        <p className="text-sm font-medium">{post.campaign_name}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Metrics */}
            {hasMetrics && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Métricas
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {metrics.reach && (
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{metrics.reach.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Alcance</p>
                      </div>
                    )}
                    {metrics.likes && (
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{metrics.likes.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Curtidas</p>
                      </div>
                    )}
                    {metrics.comments && (
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <MessageCircle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{metrics.comments.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Comentários</p>
                      </div>
                    )}
                    {metrics.shares && (
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <Share2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{metrics.shares.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Compartilha.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* External Link */}
            {post.platform_url && (
              <>
                <Separator />
                <Button variant="outline" className="w-full" asChild>
                  <a href={post.platform_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver na Plataforma
                  </a>
                </Button>
              </>
            )}

            {/* Meta */}
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Criado em: {format(new Date(post.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              {post.approved_at && (
                <p>Aprovado em: {format(new Date(post.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="flex gap-2">
            {post.status === 'pending_approval' && (
              <Button onClick={handleApprove} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
            )}
            {['draft', 'pending_approval', 'approved'].includes(post.status) && (
              <Button variant="outline" onClick={onEdit} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            {!['published', 'publishing'].includes(post.status) && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
