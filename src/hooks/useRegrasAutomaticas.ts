import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { RegraAutomatica } from '@/lib/automacoes/regras';

// automation_rules e automation_rule_runs ainda não estão nos tipos gerados; mesmo contorno de useApprovals.
const db = supabase as any;

export interface ExecucaoDeRegra {
  id: string;
  rule_name: string;
  card_id: string | null;
  card_title: string | null;
  trigger_event: string;
  outcome: 'done' | 'error';
  detail: string | null;
  ran_at: string;
}

export function useRegrasAutomaticas() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['regras-automaticas', wsId],
    enabled: !!wsId,
    queryFn: async (): Promise<RegraAutomatica[]> => {
      const { data, error } = await db.from('automation_rules').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }).order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExecucoesDeRegras(limite = 20) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['regras-execucoes', wsId, limite],
    enabled: !!wsId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<ExecucaoDeRegra[]> => {
      const { data, error } = await db
        .from('automation_rule_runs')
        .select('id, rule_name, card_id, card_title, trigger_event, outcome, detail, ran_at')
        .eq('workspace_id', wsId)
        .order('ran_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCriarRegra() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  return useMutation({
    mutationFn: async (regra: Omit<RegraAutomatica, 'id' | 'workspace_id' | 'created_at' | 'description'>) => {
      if (!user || !currentWorkspace) throw new Error('Sessão inválida');
      const { error } = await db.from('automation_rules').insert({ ...regra, workspace_id: currentWorkspace.id, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras-automaticas'] });
      toast.success('Regra criada, desligada. Ligue quando quiser.');
    },
    onError: () => toast.error('Não consegui criar a regra.'),
  });
}

export function useAlternarRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await db.from('automation_rules').update({ is_active: ativa }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-automaticas'] }),
    onError: () => toast.error('Não consegui mudar a regra.'),
  });
}

export function useExcluirRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regras-automaticas'] }),
    onError: () => toast.error('Não consegui excluir a regra.'),
  });
}
