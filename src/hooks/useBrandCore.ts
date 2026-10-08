import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { DadosDoItem, SECOES, TipoDeItem, limparDados } from '@/lib/brandCore/campos';
import { toast } from 'sonner';

// A tabela ainda nao esta em integrations/supabase/types.ts; usamos um cliente sem tipos e declaramos a forma aqui.
const db = supabase as any;

export interface ItemDoBrandCore {
  id: string;
  client_id: string;
  kind: TipoDeItem;
  position: number;
  data: DadosDoItem;
  updated_at: string;
  updated_by: string | null;
}

const chaveDoCliente = (clientId?: string) => ['brand-core', clientId] as const;

/** Todos os itens do Brand Core de um cliente (de todos os tipos), em tempo real. A tela filtra por tipo. */
export function useBrandCore(clientId: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  useRealtimeSubscription({
    table: 'client_brand_items',
    filter: clientId ? `client_id=eq.${clientId}` : undefined,
    queryKeys: [chaveDoCliente(clientId)],
    enabled: !!clientId,
  });

  return useQuery({
    queryKey: chaveDoCliente(clientId),
    enabled: !!clientId && !!currentWorkspace?.id,
    queryFn: async (): Promise<ItemDoBrandCore[]> => {
      const { data, error } = await db
        .from('client_brand_items')
        .select('id, client_id, kind, position, data, updated_at, updated_by')
        .eq('client_id', clientId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemDoBrandCore[];
    },
  });
}

export function useSalvarItemDoBrandCore(clientId: string) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id?: string; tipo: TipoDeItem; dados: DadosDoItem; position?: number }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não carregado.');
      const dados = limparDados(SECOES[p.tipo], p.dados);
      if (Object.keys(dados).length === 0) throw new Error('Preencha pelo menos um campo antes de salvar.');
      if (p.id) {
        const { error } = await db.from('client_brand_items').update({ data: dados }).eq('id', p.id);
        if (error) throw error;
        return p.id;
      }
      const { data, error } = await db
        .from('client_brand_items')
        .insert({ workspace_id: currentWorkspace.id, client_id: clientId, kind: p.tipo, position: p.position ?? 0, data: dados })
        .select('id')
        .single();
      if (error) {
        if (String(error.message).includes('uq_client_brand_items_diagnosis')) throw new Error('Este cliente já tem diagnóstico. Atualize a tela.');
        throw error;
      }
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaveDoCliente(clientId) });
      toast.success('Salvo.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar.'),
  });
}

export function useExcluirItemDoBrandCore(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('client_brand_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaveDoCliente(clientId) });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível remover.'),
  });
}
