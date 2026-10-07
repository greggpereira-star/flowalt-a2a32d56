import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { STATUS_ENCERRADOS } from '@/lib/metrics/definicoes';
import { gerarResumo, montarSnapshot, type SnapshotRelatorio } from '@/lib/inteligencia/relatorio-mensal';

// client_monthly_reports e approval_requests ainda não estão nos tipos gerados; mesmo contorno de useApprovals.
const db = supabase as any;

export interface RelatorioMensal {
  id: string;
  client_id: string;
  period: string; // AAAA-MM-01
  status: 'draft' | 'published';
  snapshot: SnapshotRelatorio;
  summary: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const COLUNAS = 'id, client_id, period, status, snapshot, summary, created_at, updated_at, published_at';

export function useRelatoriosDoCliente(clientId: string) {
  return useQuery({
    queryKey: ['relatorios-mensais', clientId],
    queryFn: async (): Promise<RelatorioMensal[]> => {
      const { data, error } = await db.from('client_monthly_reports').select(COLUNAS).eq('client_id', clientId).order('period', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function montarDoBanco(wsId: string, clientId: string, nomeCliente: string, periodo: string) {
  const [cardsR, aprovR] = await Promise.all([
    supabase.from('cards').select('id, title, status, due_date, completed_at').eq('workspace_id', wsId).eq('client_id', clientId).limit(1000),
    db.from('approval_requests').select('status, created_at, decided_at').eq('workspace_id', wsId).eq('client_id', clientId).limit(1000),
  ]);
  if (cardsR.error) throw cardsR.error;
  if (aprovR.error) throw aprovR.error;
  const snapshot = montarSnapshot(periodo, cardsR.data ?? [], aprovR.data ?? [], STATUS_ENCERRADOS, new Date());
  return { snapshot, summary: gerarResumo(snapshot, nomeCliente) };
}

/** Cria o rascunho do mês (ou refaz números e texto de um rascunho existente, descartando a edição). */
export function useGerarRelatorio(clientId: string, nomeCliente: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  return useMutation({
    mutationFn: async ({ periodo, existenteId }: { periodo: string; existenteId?: string }) => {
      if (!user || !currentWorkspace) throw new Error('Sessão inválida');
      const { snapshot, summary } = await montarDoBanco(currentWorkspace.id, clientId, nomeCliente, periodo);
      if (existenteId) {
        const { error } = await db.from('client_monthly_reports').update({ snapshot, summary }).eq('id', existenteId).eq('status', 'draft');
        if (error) throw error;
        return;
      }
      const { error } = await db.from('client_monthly_reports').insert({
        workspace_id: currentWorkspace.id,
        client_id: clientId,
        period: `${periodo}-01`,
        created_by: user.id,
        snapshot,
        summary,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relatorios-mensais', clientId] }),
    onError: (e: any) => toast.error(e?.code === '23505' ? 'Já existe um relatório deste mês.' : 'Não consegui gerar o relatório.'),
  });
}

export function useAtualizarRelatorio(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { id: string; summary?: string; status?: 'draft' | 'published' }) => {
      const { id, ...campos } = patch;
      const { error } = await db.from('client_monthly_reports').update(campos).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relatorios-mensais', clientId] }),
    onError: () => toast.error('Não consegui salvar.'),
  });
}

export function useApagarRascunho(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('client_monthly_reports').delete().eq('id', id).eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relatorios-mensais', clientId] }),
    onError: () => toast.error('Não consegui apagar.'),
  });
}
