import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type QueryKey = readonly unknown[];

interface RealtimeSubscriptionOptions {
  table: string;
  schema?: string;
  event?: PostgresEvent;
  filter?: string;
  queryKeys: QueryKey[];
  enabled?: boolean;
  onPayload?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Hook para subscrever a mudanças em tempo real de uma tabela
 * e invalidar queries automaticamente quando ocorrem mudanças
 */
export function useRealtimeSubscription({
  table,
  schema = 'public',
  event = '*',
  filter,
  queryKeys,
  enabled = true,
  onPayload,
}: RealtimeSubscriptionOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`;
    
    const channelConfig: {
      event: PostgresEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as const,
        channelConfig as any,
        (payload: any) => {
          console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
          
          // Invalidar todas as query keys fornecidas
          queryKeys.forEach(queryKey => {
            queryClient.invalidateQueries({ queryKey });
          });
          
          // Callback customizado se fornecido
          onPayload?.(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${table} subscription status:`, status);
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, schema, event, filter, enabled, queryClient]);
}

/**
 * Hook para subscrever a múltiplas tabelas de uma vez
 */
export function useMultipleRealtimeSubscriptions(
  subscriptions: RealtimeSubscriptionOptions[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = subscriptions
      .filter(sub => sub.enabled !== false)
      .map(sub => {
        const channelName = `realtime-${sub.table}-${sub.filter || 'all'}-${Date.now()}-${Math.random()}`;
        
        const channelConfig: {
          event: PostgresEvent;
          schema: string;
          table: string;
          filter?: string;
        } = {
          event: sub.event || '*',
          schema: sub.schema || 'public',
          table: sub.table,
        };

        if (sub.filter) {
          channelConfig.filter = sub.filter;
        }

        return supabase
          .channel(channelName)
          .on(
            'postgres_changes' as const,
            channelConfig as any,
            (payload: any) => {
              console.log(`[Realtime] ${sub.table} ${payload.eventType}:`, payload);
              
              sub.queryKeys.forEach(queryKey => {
                queryClient.invalidateQueries({ queryKey });
              });
              
              sub.onPayload?.(payload);
            }
          )
          .subscribe();
      });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [subscriptions.map(s => `${s.table}-${s.filter}-${s.enabled}`).join(',')]);
}
