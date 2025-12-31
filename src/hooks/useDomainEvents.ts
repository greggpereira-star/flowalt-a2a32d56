import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// ============================================================
// DOMAIN EVENTS HOOK - Arquitetura EDA
// ============================================================

export interface DomainEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  correlation_id?: string;
  causation_id?: string;
  version: number;
  is_processed: boolean;
  processed_at?: string;
  created_at: string;
}

// Event types for type safety
export type InventoryEventType = 
  | 'InventoryItemCreated'
  | 'InventoryItemUpdated'
  | 'InventoryItemDeleted'
  | 'InventoryStockChanged'
  | 'InventoryMovementCreated';

export type MaintenanceEventType =
  | 'MaintenanceRecordCreated'
  | 'MaintenanceRecordUpdated'
  | 'MaintenanceRecordResolved';

export type TransactionEventType =
  | 'TransactionCreated'
  | 'TransactionUpdated'
  | 'TransactionDeleted'
  | 'TransactionPaid'
  | 'TransactionCancelled';

export type DepreciationEventType =
  | 'DepreciationScheduleCreated';

export type AllEventTypes = 
  | InventoryEventType 
  | MaintenanceEventType 
  | TransactionEventType 
  | DepreciationEventType;

export type AggregateType = 
  | 'InventoryItem'
  | 'InventoryMovement'
  | 'MaintenanceRecord'
  | 'Transaction'
  | 'DepreciationSchedule';

interface EventFilters {
  aggregateType?: AggregateType;
  aggregateId?: string;
  eventType?: AllEventTypes;
  limit?: number;
  unprocessedOnly?: boolean;
}

/**
 * Hook para buscar eventos de domínio
 * Use para auditoria, replay, ou processamento assíncrono
 */
export function useDomainEvents(filters?: EventFilters) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['domain-events', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('domain_events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (filters?.aggregateType) {
        query = query.eq('aggregate_type', filters.aggregateType);
      }

      if (filters?.aggregateId) {
        query = query.eq('aggregate_id', filters.aggregateId);
      }

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.unprocessedOnly) {
        query = query.eq('is_processed', false);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DomainEvent[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook para buscar eventos de um agregado específico (timeline)
 */
export function useAggregateHistory(aggregateType: AggregateType, aggregateId: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['aggregate-history', aggregateType, aggregateId],
    queryFn: async () => {
      if (!currentWorkspace?.id || !aggregateId) return [];

      const { data, error } = await supabase
        .from('domain_events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('aggregate_type', aggregateType)
        .eq('aggregate_id', aggregateId)
        .order('version', { ascending: true });

      if (error) throw error;
      return data as DomainEvent[];
    },
    enabled: !!currentWorkspace?.id && !!aggregateId,
  });
}

/**
 * Hook para emitir eventos de domínio manualmente (caso necessário)
 * NOTA: A maioria dos eventos é emitida automaticamente via triggers
 */
export function useEmitDomainEvent() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      eventType: AllEventTypes;
      aggregateType: AggregateType;
      aggregateId: string;
      payload: Record<string, unknown>;
      correlationId?: string;
      causationId?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase.rpc('emit_domain_event', {
        p_workspace_id: currentWorkspace.id,
        p_event_type: params.eventType,
        p_aggregate_type: params.aggregateType,
        p_aggregate_id: params.aggregateId,
        p_payload: JSON.parse(JSON.stringify(params.payload)),
        p_correlation_id: params.correlationId,
        p_causation_id: params.causationId,
      });

      if (error) throw error;
      return data as string; // Returns event ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-events'] });
    },
  });
}

/**
 * Hook para marcar eventos como processados
 * Use quando implementar handlers de eventos
 */
export function useMarkEventsProcessed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { data, error } = await supabase.rpc('mark_events_processed', {
        p_event_ids: eventIds,
      });

      if (error) throw error;
      return data as number; // Returns count of processed events
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-events'] });
    },
  });
}

/**
 * Hook para buscar eventos não processados (para processamento batch)
 */
export function useUnprocessedEvents(limit: number = 100) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['unprocessed-events', currentWorkspace?.id, limit],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase.rpc('get_unprocessed_events', {
        p_workspace_id: currentWorkspace.id,
        p_limit: limit,
      });

      if (error) throw error;
      return data as DomainEvent[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

/**
 * Hook para estatísticas de eventos
 */
export function useEventStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['event-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('domain_events')
        .select('event_type, aggregate_type, is_processed')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const stats = {
        total: data.length,
        processed: data.filter(e => e.is_processed).length,
        unprocessed: data.filter(e => !e.is_processed).length,
        byType: {} as Record<string, number>,
        byAggregate: {} as Record<string, number>,
      };

      data.forEach(event => {
        stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
        stats.byAggregate[event.aggregate_type] = (stats.byAggregate[event.aggregate_type] || 0) + 1;
      });

      return stats;
    },
    enabled: !!currentWorkspace?.id,
  });
}
