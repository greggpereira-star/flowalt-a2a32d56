import React, { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
  Video,
  Calendar as CalendarIcon,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendarPosts, type SocialPost, type SocialPlatform, type SocialContentType, type SocialPostStatus } from '@/hooks/useSocialPosts';
import { CreateSocialPostDialog } from './CreateSocialPostDialog';
import { SocialPostDetailSheet } from './SocialPostDetailSheet';
import { EmptyPlatformState } from './EmptyPlatformState';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';

type ViewMode = 'month' | 'week';

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

const contentTypeIcons: Record<SocialContentType, React.ElementType> = {
  feed: ImageIcon,
  story: Clock,
  reels: Video,
  carousel: LayoutGrid,
  video: Video,
  short: Video,
  article: FileText,
};

const statusStyles: Record<SocialPostStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground', icon: FileText, label: 'Rascunho' },
  pending_approval: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Aprovação' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2, label: 'Aprovado' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', icon: CalendarIcon, label: 'Agendado' },
  publishing: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Loader2, label: 'Publicando' },
  published: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2, label: 'Publicado' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle, label: 'Erro' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-800', icon: FileText, label: 'Arquivado' },
};

interface SocialCalendarProps {
  clientId?: string;
  onPostClick?: (post: SocialPost) => void;
}

export function SocialCalendar({ clientId, onPostClick }: SocialCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | 'all'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Check for connected platforms
  const { data: connectedPlatforms, isLoading: platformsLoading } = useSocialPlatforms();
  const hasConnectedPlatforms = connectedPlatforms && connectedPlatforms.length > 0;

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 0 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
  }, [currentDate, viewMode]);

  const { data: posts, isLoading } = useCalendarPosts(
    dateRange.start.toISOString(),
    dateRange.end.toISOString()
  );

  // Generate days array
  const days = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Group posts by date
  const postsByDate = useMemo(() => {
    if (!posts) return new Map<string, SocialPost[]>();

    let filtered = posts;

    if (platformFilter !== 'all') {
      filtered = filtered.filter(p => p.platform === platformFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (clientId) {
      filtered = filtered.filter(p => p.client_id === clientId);
    }

    const map = new Map<string, SocialPost[]>();
    filtered.forEach(post => {
      const dateKey = format(new Date(post.scheduled_at || post.published_at || post.created_at), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, post]);
    });

    return map;
  }, [posts, platformFilter, statusFilter, clientId]);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const handlePostClick = (post: SocialPost) => {
    setSelectedPost(post);
    onPostClick?.(post);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setCreateDialogOpen(true);
  };

  const renderPost = (post: SocialPost) => {
    const PlatformIcon = platformIcons[post.platform];
    const statusStyle = statusStyles[post.status];
    const StatusIcon = statusStyle.icon;
    
    // Display title if available, otherwise fall back to caption snippet
    const displayText = post.title || post.caption?.substring(0, 25) || 'Sem título';

    return (
      <TooltipProvider key={post.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePostClick(post);
              }}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all hover:opacity-80",
                statusStyle.bg
              )}
            >
              <PlatformIcon className="h-3 w-3 flex-shrink-0" style={{ color: platformColors[post.platform] }} />
              <StatusIcon className={cn("h-3 w-3 flex-shrink-0", statusStyle.text)} />
              <span className={cn("truncate flex-1 text-left", statusStyle.text)}>
                {displayText}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PlatformIcon className="h-4 w-4" style={{ color: platformColors[post.platform] }} />
                <span className="font-medium capitalize">{post.platform}</span>
                <Badge variant="outline" className="text-[10px]">{post.content_type}</Badge>
              </div>
              {post.title && (
                <p className="font-medium text-sm">{post.title}</p>
              )}
              {post.caption && (
                <p className="text-xs text-muted-foreground line-clamp-3">{post.caption}</p>
              )}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(post.scheduled_at || post.created_at), "HH:mm", { locale: ptBR })}
                </div>
                <Badge className={cn("text-[10px]", statusStyle.bg, statusStyle.text)}>
                  {statusStyle.label}
                </Badge>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Show empty state if no platforms connected
  if (!platformsLoading && !hasConnectedPlatforms) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <EmptyPlatformState context="calendar" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => handleNavigate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleNavigate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold">
            {format(currentDate, viewMode === 'month' ? "MMMM 'de' yyyy" : "'Semana de' dd/MM", { locale: ptBR })}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as SocialPlatform | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="twitter">X (Twitter)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SocialPostStatus | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
              <SelectItem value="failed">Erro</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Postagem
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <ScrollArea className="flex-1">
              <div className={cn(
                "grid grid-cols-7",
                viewMode === 'week' ? 'h-full' : ''
              )}>
                {days.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayPosts = postsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "min-h-[100px] p-1 border-r border-b last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors",
                        viewMode === 'week' && 'min-h-[300px]',
                        !isCurrentMonth && 'bg-muted/20'
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-full text-sm mb-1",
                        isCurrentDay && "bg-primary text-primary-foreground font-bold",
                        !isCurrentMonth && "text-muted-foreground"
                      )}>
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-1">
                        {dayPosts.slice(0, viewMode === 'week' ? 10 : 3).map(renderPost)}
                        {dayPosts.length > (viewMode === 'week' ? 10 : 3) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Could open a popover with all posts
                            }}
                            className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-0.5"
                          >
                            +{dayPosts.length - (viewMode === 'week' ? 10 : 3)} mais
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateSocialPostDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clientId={clientId}
      />

      {/* Edit Dialog */}
      <CreateSocialPostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editPostId={selectedPost?.id}
        clientId={clientId}
        onSuccess={() => {
          setEditDialogOpen(false);
          setSelectedPost(null);
        }}
      />

      <SocialPostDetailSheet
        post={selectedPost}
        open={!!selectedPost && !editDialogOpen}
        onOpenChange={(open) => !open && setSelectedPost(null)}
        onEdit={() => {
          setEditDialogOpen(true);
        }}
      />
    </div>
  );
};
