import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
  CalendarIcon,
  Clock,
  Hash,
  Image as ImageIcon,
  Video,
  LayoutGrid,
  FileText,
  Sparkles,
  Loader2,
  Link as LinkIcon,
  Upload,
  X,
  Plus,
  AlertCircle,
  Edit,
  MapPin,
  AtSign,
  Eye,
  Music,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  useCreateSocialPost,
  useUpdateSocialPost,
  useSocialPost,
  type SocialPlatform,
  type SocialContentType,
  type ContentPillar,
  type FunnelStage,
  type CreateSocialPostInput,
  type UpdateSocialPostInput,
} from '@/hooks/useSocialPosts';
import { usePostableAssets, type AssetWithConnection } from '@/hooks/usePlatformAssets';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaFile {
  id: string;
  file?: File;
  url: string;
  type: 'image' | 'video';
  preview: string;
  uploading?: boolean;
  uploaded?: boolean;
}

interface CreateSocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId?: string;
  clientId?: string;
  editPostId?: string; // If provided, opens in edit mode
  defaultPlatform?: SocialPlatform;
  onSuccess?: () => void;
}

const platformConfig: Record<SocialPlatform, { name: string; icon: React.ElementType; color: string }> = {
  instagram: { name: 'Instagram', icon: Instagram, color: '#E4405F' },
  facebook: { name: 'Facebook', icon: Facebook, color: '#1877F2' },
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  tiktok: { name: 'TikTok', icon: Video, color: '#000000' },
  youtube: { name: 'YouTube', icon: Youtube, color: '#FF0000' },
  twitter: { name: 'X', icon: Twitter, color: '#000000' },
};

const contentTypeConfig: Record<SocialContentType, { name: string; icon: React.ElementType; description: string }> = {
  feed: { name: 'Feed', icon: ImageIcon, description: 'Postagem no feed principal' },
  story: { name: 'Story', icon: Clock, description: 'Conteúdo temporário (24h)' },
  reels: { name: 'Reels', icon: Video, description: 'Vídeo curto vertical' },
  carousel: { name: 'Carrossel', icon: LayoutGrid, description: 'Múltiplas imagens' },
  video: { name: 'Vídeo', icon: Video, description: 'Vídeo longo' },
  short: { name: 'Short', icon: Video, description: 'YouTube Shorts' },
  article: { name: 'Artigo', icon: FileText, description: 'Artigo LinkedIn' },
};

const pillarOptions: { value: ContentPillar; label: string }[] = [
  { value: 'educational', label: 'Educativo' },
  { value: 'sales', label: 'Vendas' },
  { value: 'entertainment', label: 'Entretenimento' },
  { value: 'relationship', label: 'Relacionamento' },
  { value: 'institutional', label: 'Institucional' },
  { value: 'other', label: 'Outro' },
];

const funnelOptions: { value: FunnelStage; label: string; description: string }[] = [
  { value: 'tofu', label: 'ToFu', description: 'Topo do funil - Awareness' },
  { value: 'mofu', label: 'MoFu', description: 'Meio do funil - Consideração' },
  { value: 'bofu', label: 'BoFu', description: 'Fundo do funil - Decisão' },
];

export const CreateSocialPostDialog: React.FC<CreateSocialPostDialogProps> = ({
  open,
  onOpenChange,
  cardId,
  clientId,
  editPostId,
  defaultPlatform,
  onSuccess,
}) => {
  const createPost = useCreateSocialPost();
  const updatePost = useUpdateSocialPost();
  const { has } = useEntitlementRegistry();
  const { currentWorkspace } = useWorkspace();
  
  // Fetch existing post if in edit mode
  const { data: existingPost, isLoading: isLoadingPost } = useSocialPost(editPostId || null);

  const [platform, setPlatform] = useState<SocialPlatform | ''>(defaultPlatform || '');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [contentType, setContentType] = useState<SocialContentType | ''>('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [contentPillar, setContentPillar] = useState<ContentPillar | ''>('');
  const [funnelStage, setFunnelStage] = useState<FunnelStage | ''>('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Engagement fields
  const [locationName, setLocationName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [userTagsInput, setUserTagsInput] = useState('');
  const [altText, setAltText] = useState('');

  const hasUtmBuilder = has('social_utm_builder');
  const hasSchedule = has('social_schedule');
  
  const isEditMode = !!editPostId;
  const isSubmitting = createPost.isPending || updatePost.isPending;

  // Get postable assets filtered by platform
  const { data: availableAssets, isLoading: isLoadingAssets } = usePostableAssets(platform as SocialPlatform || null);
  
  // Get all platform connections to check for pending ones
  const { data: allPlatforms } = useSocialPlatforms();
  
  // Check if selected platform has a pending_assets connection
  const hasPendingConnection = platform && allPlatforms?.some(
    p => p.platform === platform && p.connection_status === 'pending_assets' && p.is_active
  );

  // Load existing post data when editing
  useEffect(() => {
    if (existingPost && isEditMode) {
      setPlatform(existingPost.platform);
      setContentType(existingPost.content_type);
      setTitle(existingPost.title || '');
      setCaption(existingPost.caption || '');
      setHashtagsInput((existingPost.hashtags || []).join(', '));
      setContentPillar(existingPost.content_pillar || '');
      setFunnelStage(existingPost.funnel_stage || '');
      // Load engagement fields
      setLocationName(existingPost.location_name || '');
      setLocationId(existingPost.location_id || '');
      setAltText(existingPost.alt_text || '');
      if (existingPost.user_tags && existingPost.user_tags.length > 0) {
        setUserTagsInput(existingPost.user_tags.map((t: any) => t.username).join(', '));
      }
      
      if (existingPost.utm_params) {
        setUtmSource(existingPost.utm_params.utm_source || '');
        setUtmMedium(existingPost.utm_params.utm_medium || '');
        setUtmCampaign(existingPost.utm_params.utm_campaign || '');
      }
      
      if (existingPost.scheduled_at) {
        const date = new Date(existingPost.scheduled_at);
        setScheduledDate(date);
        setScheduledTime(format(date, 'HH:mm'));
      }
      
      // Load existing media
      const existingMedia = (existingPost.media_urls as any[]) || [];
      setMedia(existingMedia.map((m: any, idx: number) => ({
        id: `existing-${idx}`,
        url: m.url,
        type: m.type as 'image' | 'video',
        preview: m.url,
        uploaded: true,
      })));
    }
  }, [existingPost, isEditMode]);

  // Set asset ID when editing and assets are loaded
  useEffect(() => {
    if (isEditMode && existingPost?.platform_connection_id && availableAssets && availableAssets.length > 0) {
      // Find asset that matches the platform_connection_id
      const matchingAsset = availableAssets.find(
        a => a.platform_connection_id === existingPost.platform_connection_id
      );
      if (matchingAsset) {
        setSelectedAssetId(matchingAsset.id);
      }
    }
  }, [isEditMode, existingPost?.platform_connection_id, availableAssets]);

  // Reset form when dialog opens (for create mode)
  useEffect(() => {
    if (open && !isEditMode) {
      setPlatform(defaultPlatform || '');
      setSelectedAssetId('');
      setContentType('');
      setTitle('');
      setCaption('');
      setHashtagsInput('');
      setScheduledDate(undefined);
      setScheduledTime('12:00');
      setContentPillar('');
      setFunnelStage('');
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
      setMedia([]);
      setIsUploading(false);
      // Reset engagement fields
      setLocationName('');
      setLocationId('');
      setUserTagsInput('');
      setAltText('');
    }
  }, [open, defaultPlatform, isEditMode]);

  // Auto-select asset when platform changes and only one asset exists
  useEffect(() => {
    if (platform && availableAssets && availableAssets.length === 1) {
      setSelectedAssetId(availableAssets[0].id);
    } else if (!platform || !availableAssets || availableAssets.length === 0) {
      setSelectedAssetId('');
    }
  }, [platform, availableAssets]);

  // Upload media to Supabase Storage
  const uploadMedia = useCallback(async (file: File): Promise<string | null> => {
    if (!currentWorkspace?.id) return null;
    
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${currentWorkspace.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('social-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('social-media')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }, [currentWorkspace?.id]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const preview = URL.createObjectURL(file);
        const tempId = crypto.randomUUID();

        // Add to state with uploading indicator
        setMedia(prev => [...prev, {
          id: tempId,
          file,
          url: '',
          type: isVideo ? 'video' : 'image',
          preview,
          uploading: true,
          uploaded: false,
        }]);

        // Upload to storage
        const publicUrl = await uploadMedia(file);
        
        if (publicUrl) {
          // Update with real URL
          setMedia(prev => prev.map(m => 
            m.id === tempId 
              ? { ...m, url: publicUrl, uploading: false, uploaded: true }
              : m
          ));
        } else {
          // Remove failed upload
          setMedia(prev => prev.filter(m => m.id !== tempId));
          toast.error(`Falha ao enviar ${file.name}`);
        }
      }
    } catch (error: any) {
      toast.error('Erro ao enviar mídia: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (id: string) => {
    const item = media.find(m => m.id === id);
    if (item?.preview && !item.preview.startsWith('http')) {
      URL.revokeObjectURL(item.preview);
    }
    setMedia(media.filter(m => m.id !== id));
  };

  // Validation: check if content type requires media
  const requiresMedia = (type: SocialContentType) => {
    return ['story', 'reels', 'carousel', 'video', 'short'].includes(type);
  };

  const getMinMediaCount = () => {
    if (contentType === 'carousel') return 2;
    if (requiresMedia(contentType as SocialContentType)) return 1;
    return 0;
  };

  const getMaxMediaCount = () => {
    if (contentType === 'carousel') return 10;
    if (['story', 'reels', 'video', 'short'].includes(contentType)) return 1;
    return 10;
  };

  const mediaValidation = () => {
    const min = getMinMediaCount();
    const uploadedMedia = media.filter(m => m.uploaded);
    if (uploadedMedia.length < min) {
      if (contentType === 'carousel') return 'Carrossel requer no mínimo 2 mídias';
      if (contentType === 'story') return 'Story requer uma imagem ou vídeo';
      if (contentType === 'reels') return 'Reels requer um vídeo';
      if (contentType === 'video') return 'Vídeo requer um arquivo de vídeo';
      return null;
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!platform || !contentType) {
      toast.error('Selecione a plataforma e o tipo de conteúdo');
      return;
    }

    if (!selectedAssetId) {
      toast.error('Selecione uma página/conta para publicar');
      return;
    }

    // Validate media requirements
    const mediaError = mediaValidation();
    if (mediaError) {
      toast.error(mediaError);
      return;
    }

    // Check if any media is still uploading
    if (media.some(m => m.uploading)) {
      toast.error('Aguarde o upload das mídias terminar');
      return;
    }

    const hashtags = hashtagsInput
      .split(/[,\s#]+/)
      .map(h => h.trim())
      .filter(h => h.length > 0)
      .map(h => (h.startsWith('#') ? h : `#${h}`));

    let scheduledAt: string | undefined;
    if (scheduledDate && hasSchedule) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduled = new Date(scheduledDate);
      scheduled.setHours(hours, minutes, 0, 0);
      scheduledAt = scheduled.toISOString();
    }

    const utmParams = hasUtmBuilder && (utmSource || utmMedium || utmCampaign)
      ? {
          utm_source: utmSource || platform,
          utm_medium: utmMedium || 'social',
          utm_campaign: utmCampaign || title || 'campanha',
        }
      : undefined;

    // Build media_urls array with uploaded URLs
    const uploadedMedia = media
      .filter(m => m.uploaded && m.url)
      .map((m, index) => ({
        url: m.url,
        type: m.type,
        order: index,
      }));

    // Get the selected asset to find the platform_connection_id
    const selectedAsset = availableAssets?.find(a => a.id === selectedAssetId);
    if (!selectedAsset) {
      toast.error('Conta selecionada não encontrada');
      return;
    }

    try {
      if (isEditMode && editPostId) {
        // Update existing post
        const updateInput: UpdateSocialPostInput = {
          platform: platform as SocialPlatform,
          content_type: contentType as SocialContentType,
          title: title || undefined,
          caption,
          hashtags,
          media_urls: uploadedMedia.length > 0 ? uploadedMedia : undefined,
          scheduled_at: scheduledAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          content_pillar: contentPillar as ContentPillar || undefined,
          funnel_stage: funnelStage as FunnelStage || undefined,
          campaign_name: title || undefined,
          utm_params: utmParams,
          // Engagement fields
          location_id: locationId || undefined,
          location_name: locationName || undefined,
          user_tags: userTagsInput ? userTagsInput.split(',').map(u => ({ username: u.trim().replace('@', ''), x: 0.5, y: 0.5 })) : undefined,
          alt_text: altText || undefined,
          // Reset status to scheduled if there's a scheduled time
          status: scheduledAt ? 'scheduled' : 'draft',
        };

        await updatePost.mutateAsync({ postId: editPostId, input: updateInput });
        toast.success('Postagem atualizada e reagendada');
      } else {
        // Create new post
        const input: CreateSocialPostInput = {
          card_id: cardId || null,
          client_id: clientId || null,
          platform_connection_id: selectedAsset.platform_connection_id,
          platform: platform as SocialPlatform,
          content_type: contentType as SocialContentType,
          title: title || undefined,
          caption,
          hashtags,
          media_urls: uploadedMedia.length > 0 ? uploadedMedia : undefined,
          scheduled_at: scheduledAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          content_pillar: contentPillar as ContentPillar || undefined,
          funnel_stage: funnelStage as FunnelStage || undefined,
          campaign_name: title || undefined,
          utm_params: utmParams,
          // Engagement fields
          location_id: locationId || undefined,
          location_name: locationName || undefined,
          user_tags: userTagsInput ? userTagsInput.split(',').map(u => ({ username: u.trim().replace('@', ''), x: 0.5, y: 0.5 })) : undefined,
          alt_text: altText || undefined,
        };

        await createPost.mutateAsync(input);
      }
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getAvailableContentTypes = () => {
    if (!platform) return [];
    
    const platformContentTypes: Record<SocialPlatform, SocialContentType[]> = {
      instagram: ['feed', 'story', 'reels', 'carousel'],
      facebook: ['feed', 'story', 'video', 'reels'],
      linkedin: ['feed', 'article', 'video', 'carousel'],
      tiktok: ['video'],
      youtube: ['video', 'short'],
      twitter: ['feed', 'video'],
    };

    return platformContentTypes[platform as SocialPlatform] || [];
  };

  const renderAssetSelector = () => {
    if (!platform) return null;
    
    if (isLoadingAssets) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando contas...</span>
        </div>
      );
    }

    if (!availableAssets || availableAssets.length === 0) {
      // Check if there's a pending connection that needs asset selection
      if (hasPendingConnection) {
        return (
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-amber-500/50 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                Conexão {platformConfig[platform as SocialPlatform]?.name} pendente de configuração
              </span>
            </div>
            <p className="text-xs">
              Complete a seleção de páginas/contas clicando em "Selecionar ativo" na página de Redes Sociais.
            </p>
            <Link 
              to="/settings?tab=social" 
              className="text-xs font-medium underline hover:no-underline"
              onClick={() => onOpenChange(false)}
            >
              Ir para Configurações → Redes Sociais
            </Link>
          </div>
        );
      }
      
      return (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">
              Nenhuma conta {platformConfig[platform as SocialPlatform]?.name} conectada
            </span>
          </div>
          <p className="text-xs">
            Conecte uma conta e selecione as páginas/contas que deseja usar para postagens.
          </p>
          <Link 
            to="/settings?tab=social" 
            className="text-xs font-medium underline hover:no-underline"
            onClick={() => onOpenChange(false)}
          >
            Ir para Configurações → Redes Sociais
          </Link>
        </div>
      );
    }

    // Helper to render asset avatar/icon
    const renderAssetAvatar = (asset: AssetWithConnection, size: 'sm' | 'md' = 'sm') => {
      const PlatformIcon = platformConfig[platform as SocialPlatform]?.icon;
      const platformColor = platformConfig[platform as SocialPlatform]?.color;
      const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
      const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
      
      if (asset.asset_meta?.profile_picture_url) {
        return (
          <div className="relative">
            <img 
              src={asset.asset_meta.profile_picture_url} 
              alt={asset.asset_name}
              className={cn(sizeClasses, "rounded-full object-cover border-2 border-background shadow-sm")}
              onError={(e) => {
                // Fallback to icon on error
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className={cn(sizeClasses, "rounded-full flex items-center justify-center hidden")} style={{ backgroundColor: platformColor + '20' }}>
              {PlatformIcon && <PlatformIcon className={iconSize} style={{ color: platformColor }} />}
            </div>
            <div 
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background"
              style={{ backgroundColor: platformColor }}
            >
              {PlatformIcon && <PlatformIcon className="h-2.5 w-2.5 text-white" />}
            </div>
          </div>
        );
      }
      
      return (
        <div className="relative">
          <div 
            className={cn(sizeClasses, "rounded-full flex items-center justify-center")} 
            style={{ backgroundColor: platformColor + '20' }}
          >
            {PlatformIcon && <PlatformIcon className={iconSize} style={{ color: platformColor }} />}
          </div>
          <div 
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background"
            style={{ backgroundColor: platformColor }}
          >
            {PlatformIcon && <PlatformIcon className="h-2.5 w-2.5 text-white" />}
          </div>
        </div>
      );
    };

    // Format asset type label
    const getAssetTypeLabel = (assetType: string) => {
      const labels: Record<string, string> = {
        'facebook_page': 'Página do Facebook',
        'instagram_business': 'Instagram Business',
        'linkedin_company': 'Empresa LinkedIn',
        'youtube_channel': 'Canal YouTube',
        'tiktok_account': 'Conta TikTok',
        'twitter_account': 'Conta X',
      };
      return labels[assetType] || assetType.replace('_', ' ');
    };

    if (availableAssets.length === 1) {
      const asset = availableAssets[0];
      return (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/50 bg-primary/5">
          {renderAssetAvatar(asset, 'md')}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium block truncate">{asset.asset_name}</span>
            <span className="text-xs text-muted-foreground block">
              {getAssetTypeLabel(asset.asset_type)}
            </span>
          </div>
          <Badge variant="outline" className="text-xs shrink-0 bg-primary/10 text-primary border-primary/30">
            Conectado
          </Badge>
        </div>
      );
    }

    // Get currently selected asset for display in trigger
    const selectedAsset = availableAssets.find(a => a.id === selectedAssetId);

    return (
      <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
        <SelectTrigger className="h-auto min-h-[48px]">
          {selectedAsset ? (
            <div className="flex items-center gap-3 py-1">
              {renderAssetAvatar(selectedAsset)}
              <div className="flex-1 min-w-0 text-left">
                <span className="text-sm font-medium block truncate">{selectedAsset.asset_name}</span>
                <span className="text-xs text-muted-foreground block">
                  {getAssetTypeLabel(selectedAsset.asset_type)}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Selecionar página/conta</span>
          )}
        </SelectTrigger>
        <SelectContent>
          {availableAssets.map((asset) => (
            <SelectItem key={asset.id} value={asset.id} className="py-2">
              <div className="flex items-center gap-3">
                {renderAssetAvatar(asset)}
                <div className="flex-1 min-w-0">
                  <span className="font-medium block truncate">{asset.asset_name}</span>
                  <span className="text-xs text-muted-foreground block">
                    {getAssetTypeLabel(asset.asset_type)}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  if (isEditMode && isLoadingPost) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Edit className="h-5 w-5 text-primary" />
                Editar Postagem
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                Nova Postagem Social
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Edite os dados da postagem. Alterações serão reenviadas para agendamento.'
              : 'Crie uma nova postagem para suas redes sociais'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Platform Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Plataforma *</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(platformConfig) as [SocialPlatform, typeof platformConfig.instagram][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPlatform(key);
                        setContentType('');
                        setSelectedAssetId('');
                      }}
                      disabled={isEditMode} // Can't change platform in edit mode
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border transition-all",
                        platform === key
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
                        isEditMode && platform !== key && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Icon className="h-5 w-5" style={{ color: config.color }} />
                      <span className="text-sm font-medium">{config.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Type Selection */}
            {platform && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de Conteúdo *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {getAvailableContentTypes().map((type) => {
                    const config = contentTypeConfig[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setContentType(type)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                          contentType === type
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium block">{config.name}</span>
                          <span className="text-xs text-muted-foreground">{config.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Account/Page Selection */}
            {platform && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Página/Conta para publicação *</Label>
                {renderAssetSelector()}
              </div>
            )}

            {/* Media Upload Section */}
            {contentType && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Mídia {requiresMedia(contentType as SocialContentType) && '*'}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {media.filter(m => m.uploaded).length}/{getMaxMediaCount()} arquivos
                  </span>
                </div>

                {/* Media requirement info */}
                {requiresMedia(contentType as SocialContentType) && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      {contentType === 'carousel' && 'Carrossel requer entre 2 e 10 imagens ou vídeos'}
                      {contentType === 'story' && 'Story requer uma imagem (9:16) ou vídeo (até 60s)'}
                      {contentType === 'reels' && 'Reels requer um vídeo vertical (9:16, até 90s)'}
                      {contentType === 'video' && 'Vídeo requer um arquivo de vídeo'}
                      {contentType === 'short' && 'Short requer um vídeo vertical (9:16, até 60s)'}
                    </span>
                  </div>
                )}

                {/* Media preview grid */}
                <div className="flex flex-wrap gap-3">
                  {media.map(item => (
                    <div key={item.id} className="relative group">
                      {item.type === 'image' ? (
                        <img
                          src={item.preview}
                          alt="Preview"
                          className={cn(
                            "w-20 h-20 object-cover rounded-lg border",
                            item.uploading && "opacity-50"
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "w-20 h-20 bg-muted rounded-lg flex items-center justify-center border",
                          item.uploading && "opacity-50"
                        )}>
                          <Video className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Uploading indicator */}
                      {item.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}

                      {/* Uploaded checkmark */}
                      {item.uploaded && (
                        <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      {/* Remove button */}
                      {!item.uploading && (
                        <button
                          onClick={() => handleRemoveMedia(item.id)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Upload button */}
                  {media.length < getMaxMediaCount() && (
                    <label className={cn(
                      "w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors",
                      isUploading && "opacity-50 cursor-not-allowed"
                    )}>
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept={contentType === 'reels' || contentType === 'video' || contentType === 'short' 
                          ? 'video/mp4,video/quicktime,video/webm' 
                          : 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm'
                        }
                        multiple={contentType === 'carousel'}
                        onChange={handleMediaUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Validation error */}
                {mediaValidation() && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {mediaValidation()}
                  </div>
                )}

                {/* Music tip banner for videos */}
                {media.some(m => m.type === 'video') && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200/50 dark:border-purple-800/50">
                    <Music className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        Dica: Adicione música ao vídeo
                      </p>
                      <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">
                        A música deve ser inserida diretamente no arquivo de vídeo antes do upload. A API não suporta adição de músicas licenciadas do Instagram.
                      </p>
                    </div>
                  </div>
                )}

                {/* Alt Text for accessibility */}
                {media.some(m => m.type === 'image') && contentType !== 'story' && contentType !== 'reels' && (
                  <div className="space-y-2">
                    <Label htmlFor="altText" className="text-xs text-muted-foreground flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5" />
                      Texto Alternativo (Acessibilidade)
                    </Label>
                    <Input
                      id="altText"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Descreva a imagem para pessoas com deficiência visual..."
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground">
                      Melhora a acessibilidade e o SEO da sua postagem.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Title - for calendar display */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Título da Postagem
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Lançamento Nova Coleção, Promoção Black Friday..."
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Este título aparecerá no calendário para facilitar a identificação da postagem.
              </p>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption" className="text-sm font-medium">Legenda</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escreva a legenda da sua postagem..."
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {caption.length} caracteres
              </p>
            </div>

            {/* Hashtags */}
            <div className="space-y-2">
              <Label htmlFor="hashtags" className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Hashtags
              </Label>
              <Input
                id="hashtags"
                value={hashtagsInput}
                onChange={(e) => setHashtagsInput(e.target.value)}
                placeholder="marketing, socialmedia, dicas (separadas por vírgula ou espaço)"
              />
              {hashtagsInput && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hashtagsInput
                    .split(/[,\s#]+/)
                    .filter(h => h.trim())
                    .map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{tag.trim()}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localização
              </Label>
              <Input
                id="location"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ex: São Paulo, Brasil ou nome do estabelecimento..."
              />
              <p className="text-xs text-muted-foreground">
                Posts com localização têm em média 79% mais engajamento.
              </p>
            </div>

            {/* User Tags */}
            {(contentType === 'feed' || contentType === 'carousel') && (
              <div className="space-y-2">
                <Label htmlFor="userTags" className="text-sm font-medium flex items-center gap-2">
                  <AtSign className="h-4 w-4" />
                  Marcar Pessoas
                </Label>
                <Input
                  id="userTags"
                  value={userTagsInput}
                  onChange={(e) => setUserTagsInput(e.target.value)}
                  placeholder="@usuario1, @usuario2 (separados por vírgula)"
                />
                {userTagsInput && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {userTagsInput
                      .split(',')
                      .filter(u => u.trim())
                      .map((user, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          @{user.trim().replace('@', '')}
                        </Badge>
                      ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Os usuários marcados receberão uma notificação.
                </p>
              </div>
            )}

            <Separator />

            {/* Scheduling */}
            {has('social_schedule') && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Agendamento
                </Label>
                <div className="flex gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        locale={ptBR}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-[120px]"
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Marketing Intelligence */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Inteligência de Marketing</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pillar" className="text-xs text-muted-foreground">Pilar de Conteúdo</Label>
                  <Select value={contentPillar} onValueChange={(v) => setContentPillar(v as ContentPillar)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {pillarOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="funnel" className="text-xs text-muted-foreground">Etapa do Funil</Label>
                  <Select value={funnelStage} onValueChange={(v) => setFunnelStage(v as FunnelStage)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {funnelOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </div>

            {/* UTM Builder */}
            {hasUtmBuilder && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    UTM Builder
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Source</Label>
                      <Input
                        value={utmSource}
                        onChange={(e) => setUtmSource(e.target.value)}
                        placeholder={platform || 'instagram'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Medium</Label>
                      <Input
                        value={utmMedium}
                        onChange={(e) => setUtmMedium(e.target.value)}
                        placeholder="social"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Campaign</Label>
                      <Input
                        value={utmCampaign}
                        onChange={(e) => setUtmCampaign(e.target.value)}
                        placeholder={title || 'campanha'}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !platform || 
              !contentType ||
              !selectedAssetId ||
              isSubmitting || 
              isUploading || 
              media.some(m => m.uploading) ||
              !!mediaValidation()
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode 
              ? 'Salvar Alterações' 
              : scheduledDate && hasSchedule 
                ? 'Agendar Postagem' 
                : 'Criar Postagem'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
