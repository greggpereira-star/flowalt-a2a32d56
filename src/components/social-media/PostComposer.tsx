/**
 * Post Composer Component
 * Create and edit social media posts with multi-platform support
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Video, 
  Calendar as CalendarIcon, 
  Hash, 
  Send,
  Clock,
  X,
  Plus,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { useCreateSocialPost, type SocialPlatform, type SocialContentType } from '@/hooks/useSocialPosts';
import { useToast } from '@/hooks/use-toast';

interface MediaFile {
  id: string;
  file?: File;
  url: string;
  type: 'image' | 'video';
  preview: string;
}

interface PostComposerProps {
  onClose?: () => void;
  editPostId?: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
};

const CONTENT_TYPES: { value: SocialContentType; label: string }[] = [
  { value: 'feed', label: 'Feed Post' },
  { value: 'story', label: 'Story' },
  { value: 'reels', label: 'Reels' },
  { value: 'carousel', label: 'Carousel' },
];

const CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  twitter: 280,
  tiktok: 2200,
  youtube: 5000,
};

export function PostComposer({ onClose, editPostId }: PostComposerProps) {
  const { toast } = useToast();
  const { data: platforms, isLoading: platformsLoading } = useSocialPlatforms();
  const { mutateAsync: createPost, isPending: isCreating } = useCreateSocialPost();

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [contentType, setContentType] = useState<SocialContentType>('feed');
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | ''>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [activeTab, setActiveTab] = useState('compose');

  const activePlatforms = platforms?.filter(p => p.is_active) || [];

  const handleAddHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  }, [hashtagInput, hashtags]);

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag));
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newMedia: MediaFile[] = [];
    Array.from(files).forEach(file => {
      const isVideo = file.type.startsWith('video/');
      const preview = URL.createObjectURL(file);
      newMedia.push({
        id: crypto.randomUUID(),
        file,
        url: preview,
        type: isVideo ? 'video' : 'image',
        preview,
      });
    });

    setMedia([...media, ...newMedia]);
  };

  const handleRemoveMedia = (id: string) => {
    const item = media.find(m => m.id === id);
    if (item?.preview) {
      URL.revokeObjectURL(item.preview);
    }
    setMedia(media.filter(m => m.id !== id));
  };

  const getCaptionLength = () => caption.length;

  const getMinCaptionLimit = () => {
    if (!selectedPlatform) return 2200;
    return CAPTION_LIMITS[selectedPlatform] || 2200;
  };

  const isOverLimit = getCaptionLength() > getMinCaptionLimit();

  const handleSubmit = async (publish: boolean = false) => {
    if (!selectedPlatform) {
      toast({
        title: 'Selecione uma plataforma',
        variant: 'destructive',
      });
      return;
    }

    if (!caption.trim() && media.length === 0) {
      toast({
        title: 'Adicione conteúdo ao post',
        description: 'Escreva uma legenda ou adicione mídia',
        variant: 'destructive',
      });
      return;
    }

    try {
      let scheduledAt: string | undefined;
      if (isScheduled && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':');
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        scheduledAt = scheduled.toISOString();
      }

      await createPost({
        platform: selectedPlatform,
        caption,
        hashtags,
        content_type: contentType,
        first_comment: firstComment || undefined,
        scheduled_at: scheduledAt,
        media_urls: media.map((m, i) => ({ url: m.url, type: m.type, order: i })),
      });

      toast({
        title: publish ? 'Publicando...' : 'Rascunho salvo',
        description: publish 
          ? 'Seu post está sendo publicado' 
          : 'Você pode continuar editando depois',
      });

      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Criar Post</CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose">Compor</TabsTrigger>
            <TabsTrigger value="schedule">Agendar</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6 mt-6">
            {/* Platform Selection */}
            <div className="space-y-3">
              <Label>Publicar em</Label>
              <div className="flex flex-wrap gap-2">
                {platformsLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando plataformas...</div>
                ) : activePlatforms.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma plataforma conectada. Vá em Plataformas para conectar.
                  </div>
                ) : (
                  activePlatforms.map(platform => (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.platform)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                        selectedPlatform === platform.platform
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {PLATFORM_ICONS[platform.platform]}
                      <span className="text-sm">{platform.account_name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Content Type */}
            <div className="space-y-3">
              <Label>Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as SocialContentType)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Media Upload */}
            <div className="space-y-3">
              <Label>Mídia</Label>
              <div className="flex flex-wrap gap-3">
                {media.map(item => (
                  <div key={item.id} className="relative group">
                    {item.type === 'image' ? (
                      <img
                        src={item.preview}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveMedia(item.id)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Legenda</Label>
                <span className={cn(
                  'text-xs',
                  isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {getCaptionLength()}/{getMinCaptionLimit()}
                </span>
              </div>
              <Textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Escreva sua legenda..."
                className="min-h-32 resize-none"
              />
              {isOverLimit && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Legenda excede o limite da plataforma selecionada
                </div>
              )}
            </div>

            {/* Hashtags */}
            <div className="space-y-3">
              <Label>Hashtags</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={hashtagInput}
                    onChange={e => setHashtagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddHashtag())}
                    placeholder="Adicionar hashtag"
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleAddHashtag} variant="outline">
                  Adicionar
                </Button>
              </div>
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hashtags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button onClick={() => handleRemoveHashtag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* First Comment */}
            <div className="space-y-3">
              <Label>Primeiro Comentário (opcional)</Label>
              <Textarea
                value={firstComment}
                onChange={e => setFirstComment(e.target.value)}
                placeholder="Adicione hashtags extras ou menções..."
                className="min-h-20 resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6 mt-6">
            <div className="flex items-center gap-3">
              <Checkbox
                id="schedule"
                checked={isScheduled}
                onCheckedChange={(checked) => setIsScheduled(!!checked)}
              />
              <Label htmlFor="schedule" className="cursor-pointer">
                Agendar publicação
              </Label>
            </div>

            {isScheduled && (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate 
                          ? format(scheduledDate, 'PPP', { locale: ptBR })
                          : 'Selecionar data'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <Label>Horário</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {isScheduled && scheduledDate && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  Seu post será publicado em{' '}
                  <strong>
                    {format(scheduledDate, "dd 'de' MMMM 'às' ", { locale: ptBR })}
                    {scheduledTime}
                  </strong>
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Instagram Preview */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    <span className="font-medium">Instagram</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {media.length > 0 && (
                    <div className="aspect-square bg-muted">
                      <img
                        src={media[0].preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {caption}
                      {hashtags.length > 0 && (
                        <span className="text-primary">
                          {'\n\n'}
                          {hashtags.map(h => `#${h}`).join(' ')}
                        </span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Facebook Preview */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4" />
                    <span className="font-medium">Facebook</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-4 pb-2">
                    <p className="text-sm whitespace-pre-wrap">
                      {caption}
                      {hashtags.length > 0 && (
                        <span className="text-primary">
                          {' '}
                          {hashtags.map(h => `#${h}`).join(' ')}
                        </span>
                      )}
                    </p>
                  </div>
                  {media.length > 0 && (
                    <div className="aspect-video bg-muted">
                      <img
                        src={media[0].preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => handleSubmit(false)} disabled={isCreating}>
            Salvar Rascunho
          </Button>
          <div className="flex gap-3">
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button onClick={() => handleSubmit(true)} disabled={isCreating || isOverLimit}>
              {isScheduled ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Agendar
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Publicar Agora
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
