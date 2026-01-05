/**
 * Real-time hook for social jobs with automatic updates
 * Provides live status updates for publishing jobs
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface SocialJob {
  id: string;
  workspace_id: string;
  post_id: string | null;
  action: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Error codes and their user-friendly translations
export const ERROR_TRANSLATIONS: Record<string, { 
  title: string; 
  description: string; 
  action: string;
  severity: 'warning' | 'error' | 'info';
  isRetryable: boolean;
}> = {
  // Meta/Facebook Errors
  'FB_STORY_PHOTO_PUBLISH_ERROR': {
    title: 'Falha temporária do Meta',
    description: 'A API do Meta está temporariamente indisponível. Isso é comum e resolve-se automaticamente.',
    action: 'Aguarde. O sistema tentará novamente em alguns minutos.',
    severity: 'warning',
    isRetryable: true,
  },
  'FB_API_TEMPORARILY_UNAVAILABLE': {
    title: 'Meta indisponível',
    description: 'Os servidores do Meta estão com alta demanda.',
    action: 'Aguarde alguns minutos e tente novamente.',
    severity: 'warning',
    isRetryable: true,
  },
  'FB_RATE_LIMIT': {
    title: 'Limite de publicações',
    description: 'Você atingiu o limite de publicações por hora.',
    action: 'Aguarde 15-30 minutos antes de publicar novamente.',
    severity: 'warning',
    isRetryable: true,
  },
  'FB_INVALID_TOKEN': {
    title: 'Token expirado',
    description: 'Sua conexão com o Meta precisa ser renovada.',
    action: 'Vá em Plataformas e reconecte sua conta.',
    severity: 'error',
    isRetryable: false,
  },
  'FB_PERMISSION_DENIED': {
    title: 'Permissão negada',
    description: 'A conta não tem permissão para publicar neste perfil.',
    action: 'Verifique as permissões no Meta Business Suite.',
    severity: 'error',
    isRetryable: false,
  },
  'FB_MEDIA_ERROR': {
    title: 'Erro na mídia',
    description: 'O arquivo de mídia não pôde ser processado.',
    action: 'Verifique se a imagem/vídeo atende aos requisitos.',
    severity: 'error',
    isRetryable: false,
  },
  'FB_DUPLICATE_POST': {
    title: 'Conteúdo duplicado',
    description: 'O Meta detectou que este conteúdo já foi publicado.',
    action: 'Altere o conteúdo ou aguarde alguns dias.',
    severity: 'info',
    isRetryable: false,
  },
  // Network Errors
  'NETWORK_ERROR': {
    title: 'Erro de conexão',
    description: 'Não foi possível conectar aos servidores.',
    action: 'Verifique sua conexão e tente novamente.',
    severity: 'warning',
    isRetryable: true,
  },
  'TIMEOUT': {
    title: 'Tempo esgotado',
    description: 'A operação demorou muito para responder.',
    action: 'O sistema tentará novamente automaticamente.',
    severity: 'warning',
    isRetryable: true,
  },
  // Configuration Errors
  'NO_CONNECTED_ACCOUNT': {
    title: 'Conta não conectada',
    description: 'Não há conta configurada para esta plataforma.',
    action: 'Conecte uma conta em Plataformas.',
    severity: 'error',
    isRetryable: false,
  },
  'INVALID_MEDIA_URL': {
    title: 'URL inválida',
    description: 'A URL da mídia não está acessível.',
    action: 'Faça upload do arquivo novamente.',
    severity: 'error',
    isRetryable: false,
  },
  'NO_ASSET_SELECTED': {
    title: 'Nenhum perfil selecionado',
    description: 'Você precisa selecionar onde publicar.',
    action: 'Edite o post e selecione um perfil.',
    severity: 'error',
    isRetryable: false,
  },
};

export function getErrorInfo(errorCode: string | null, errorMessage: string | null) {
  if (errorCode && ERROR_TRANSLATIONS[errorCode]) {
    return ERROR_TRANSLATIONS[errorCode];
  }

  // Try to infer from error message
  if (errorMessage) {
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('temporarily unavailable') || lowerMessage.includes('service unavailable')) {
      return ERROR_TRANSLATIONS['FB_API_TEMPORARILY_UNAVAILABLE'];
    }
    if (lowerMessage.includes('rate limit')) {
      return ERROR_TRANSLATIONS['FB_RATE_LIMIT'];
    }
    if (lowerMessage.includes('token') || lowerMessage.includes('access')) {
      return ERROR_TRANSLATIONS['FB_INVALID_TOKEN'];
    }
  }

  // Default fallback
  return {
    title: 'Erro desconhecido',
    description: errorMessage || 'Ocorreu um erro ao processar a operação.',
    action: 'Entre em contato com o suporte se o problema persistir.',
    severity: 'error' as const,
    isRetryable: false,
  };
}

export function useRealtimeSocialJobs(limit = 50) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Stable query key
  const queryKey = useMemo(
    () => ['social-jobs-realtime', currentWorkspace?.id],
    [currentWorkspace?.id]
  );

  // Use ref to track if subscription is active
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial data fetch
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('social_jobs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as SocialJob[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Set up realtime subscription with stable dependencies
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    // Don't recreate if already subscribed
    if (subscriptionRef.current) return;

    const channelName = `social-jobs-${currentWorkspace.id}`;
    console.log('[Realtime] Setting up social_jobs subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_jobs',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        (payload) => {
          console.log('[Realtime] Received job update:', payload.eventType);
          
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['social-jobs-realtime'] });
          
          // Also invalidate related queries (posts may have changed status)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const job = payload.new as SocialJob;
            if (job.status === 'completed' || job.status === 'failed') {
              queryClient.invalidateQueries({ queryKey: ['social-posts'] });
              queryClient.invalidateQueries({ queryKey: ['social-posts-realtime'] });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Jobs subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        console.log('[Realtime] Cleaning up social_jobs subscription');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [currentWorkspace?.id]); // Only workspace ID as dependency

  // Group jobs by status for dashboard display
  const jobStats = useMemo(() => ({
    pending: jobs?.filter(j => j.status === 'pending').length || 0,
    processing: jobs?.filter(j => j.status === 'processing').length || 0,
    completed: jobs?.filter(j => j.status === 'completed').length || 0,
    failed: jobs?.filter(j => j.status === 'failed').length || 0,
    total: jobs?.length || 0,
  }), [jobs]);

  // Get recent failures with enhanced error info
  const recentFailures = useMemo(() => 
    jobs
      ?.filter(j => j.status === 'failed')
      .slice(0, 5)
      .map(job => ({
        ...job,
        errorInfo: getErrorInfo(job.error_code, job.error_message),
      })) || [],
    [jobs]
  );

  return {
    jobs,
    jobStats,
    recentFailures,
    isLoading,
    error,
    refetch,
    realtimeStatus,
  };
}

export default useRealtimeSocialJobs;
