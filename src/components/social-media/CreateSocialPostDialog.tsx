import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useCreateSocialPost,
  useUpdateSocialPost,
  type SocialPlatform,
  type SocialContentType,
  type ContentPillar,
  type FunnelStage,
  type CreateSocialPostInput,
} from '@/hooks/useSocialPosts';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { toast } from 'sonner';

interface CreateSocialPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId?: string;
  clientId?: string;
  editPostId?: string;
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
  defaultPlatform,
  onSuccess,
}) => {
  const createPost = useCreateSocialPost();
  const { has } = useEntitlementRegistry();

  const [platform, setPlatform] = useState<SocialPlatform | ''>(defaultPlatform || '');
  const [contentType, setContentType] = useState<SocialContentType | ''>('');
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [contentPillar, setContentPillar] = useState<ContentPillar | ''>('');
  const [funnelStage, setFunnelStage] = useState<FunnelStage | ''>('');
  const [campaignName, setCampaignName] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');

  const hasUtmBuilder = has('social_utm_builder');
  const hasSchedule = has('social_schedule');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPlatform(defaultPlatform || '');
      setContentType('');
      setCaption('');
      setHashtagsInput('');
      setScheduledDate(undefined);
      setScheduledTime('12:00');
      setContentPillar('');
      setFunnelStage('');
      setCampaignName('');
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
    }
  }, [open, defaultPlatform]);

  const handleSubmit = async (asDraft: boolean = true) => {
    if (!platform || !contentType) {
      toast.error('Selecione a plataforma e o tipo de conteúdo');
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
          utm_campaign: utmCampaign || campaignName,
        }
      : undefined;

    const input: CreateSocialPostInput = {
      card_id: cardId || null,
      client_id: clientId || null,
      platform: platform as SocialPlatform,
      content_type: contentType as SocialContentType,
      caption,
      hashtags,
      scheduled_at: scheduledAt,
      content_pillar: contentPillar as ContentPillar || undefined,
      funnel_stage: funnelStage as FunnelStage || undefined,
      campaign_name: campaignName || undefined,
      utm_params: utmParams,
    };

    try {
      await createPost.mutateAsync(input);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Postagem Social
          </DialogTitle>
          <DialogDescription>
            Crie uma nova postagem para suas redes sociais
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
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border transition-all",
                        platform === key
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
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

            <Separator />

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

              <div className="space-y-2">
                <Label htmlFor="campaign" className="text-xs text-muted-foreground">Nome da Campanha</Label>
                <Input
                  id="campaign"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Black Friday 2024"
                />
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
                        placeholder={campaignName || 'campanha'}
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
            onClick={() => handleSubmit(true)}
            disabled={!platform || !contentType || createPost.isPending}
          >
            {createPost.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scheduledDate && hasSchedule ? 'Agendar Postagem' : 'Salvar como Rascunho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
