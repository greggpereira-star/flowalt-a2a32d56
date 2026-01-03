import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Plug,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Calendar,
  BarChart3,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyStateContext = 
  | 'calendar' 
  | 'metrics' 
  | 'scheduled' 
  | 'published' 
  | 'general';

interface EmptyPlatformStateProps {
  context?: EmptyStateContext;
  onConnectClick?: () => void;
  className?: string;
}

const contextConfig: Record<EmptyStateContext, {
  icon: React.ElementType;
  title: string;
  description: string;
  benefit: string;
}> = {
  calendar: {
    icon: Calendar,
    title: 'Conecte suas redes sociais',
    description: 'Para agendar posts no calendário editorial, você precisa conectar pelo menos uma plataforma.',
    benefit: 'Agende posts, organize seu conteúdo e publique automaticamente.',
  },
  metrics: {
    icon: BarChart3,
    title: 'Sem dados de métricas',
    description: 'Para visualizar métricas de performance, conecte suas plataformas e publique conteúdo.',
    benefit: 'Acompanhe alcance, engajamento e crescimento em tempo real.',
  },
  scheduled: {
    icon: Calendar,
    title: 'Nenhum post agendado',
    description: 'Conecte suas plataformas para começar a agendar publicações.',
    benefit: 'Planeje seu conteúdo com antecedência e mantenha consistência.',
  },
  published: {
    icon: Share2,
    title: 'Nenhum post publicado',
    description: 'Seus posts publicados aparecerão aqui após conectar suas plataformas.',
    benefit: 'Acompanhe todo seu histórico de publicações.',
  },
  general: {
    icon: Sparkles,
    title: 'Comece sua jornada no Marketing',
    description: 'Conecte suas redes sociais para desbloquear todas as funcionalidades.',
    benefit: 'Gerencie todas as suas redes em um só lugar.',
  },
};

export function EmptyPlatformState({
  context = 'general',
  onConnectClick,
  className,
}: EmptyPlatformStateProps) {
  const navigate = useNavigate();
  const config = contextConfig[context];
  const Icon = config.icon;

  const handleConnect = () => {
    if (onConnectClick) {
      onConnectClick();
    } else {
      // Navigate to platforms tab in marketing
      navigate('/marketing?tab=platforms');
    }
  };

  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Plug className="h-4 w-4 text-amber-600" />
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2">{config.title}</h3>
        <p className="text-muted-foreground max-w-md mb-4">
          {config.description}
        </p>

        <Alert className="max-w-md mb-6 text-left">
          <Sparkles className="h-4 w-4" />
          <AlertTitle className="text-sm">Benefício</AlertTitle>
          <AlertDescription className="text-xs">
            {config.benefit}
          </AlertDescription>
        </Alert>

        <Button onClick={handleConnect} size="lg" className="gap-2">
          <Plug className="h-4 w-4" />
          Conectar Plataformas
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          Suportamos Instagram, Facebook, LinkedIn, TikTok, YouTube e X (Twitter)
        </p>
      </CardContent>
    </Card>
  );
}

// Compact inline version for use within other components
interface EmptyStateInlineProps {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStateInline({
  message = 'Nenhuma plataforma conectada',
  actionLabel = 'Conectar',
  onAction,
}: EmptyStateInlineProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-8 rounded-lg border border-dashed bg-muted/20">
      <AlertCircle className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{message}</span>
      {onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
