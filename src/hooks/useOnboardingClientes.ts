import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { EtapaOnb, TarefaOnb } from '@/lib/onboarding/esteira';

// As tabelas do onboarding ainda nao estao em integrations/supabase/types.ts; cliente sem tipos e formas declaradas aqui.
const db = supabase as any;

export interface EtapaDoModelo extends EtapaOnb {
  id: string;
  playbook: string | null;
}

export interface Modelo {
  id: string;
  name: string;
  description: string | null;
  etapas: EtapaDoModelo[];
}

export interface ClienteResumo {
  id: string;
  name: string;
  logo_url: string | null;
  color: string | null;
}

export interface Onboarding {
  id: string;
  client_id: string;
  template_id: string | null;
  start_date: string;
  status: 'active' | 'done' | 'canceled';
  completed_at: string | null;
  cliente: ClienteResumo | null;
  tarefas: TarefaDoCliente[];
}

export interface TarefaDoCliente extends TarefaOnb {
  onboarding_id: string;
  description: string | null;
  notes: string | null;
  completed_by: string | null;
}

/** Modelo padrao (criado na primeira vez) com as etapas em ordem. */
export function useModeloDeOnboarding() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['onb-modelo', wsId],
    enabled: !!wsId,
    staleTime: 60_000,
    queryFn: async (): Promise<Modelo> => {
      const { data: id, error } = await db.rpc('onboarding_ensure_default_template', { _workspace: wsId });
      if (error) throw error;
      const [{ data: modelo, error: e1 }, { data: etapas, error: e2 }] = await Promise.all([
        db.from('onboarding_templates').select('id, name, description').eq('id', id).single(),
        db.from('onboarding_template_stages').select('id, key, name, sort_order, playbook').eq('template_id', id).order('sort_order'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { ...(modelo as any), etapas: (etapas ?? []) as EtapaDoModelo[] };
    },
  });
}

async function carregarTarefas(ids: string[]): Promise<TarefaDoCliente[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from('client_onboarding_tasks')
    .select('id, onboarding_id, stage_key, title, description, due_date, assignee_id, completed_at, completed_by, sort_order, notes')
    .in('onboarding_id', ids)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as TarefaDoCliente[];
}

/** Todos os onboardings do workspace (em andamento e concluidos) com cliente e tarefas, para o quadro compilado. */
export function useOnboardings() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['onb-lista', wsId],
    enabled: !!wsId,
    staleTime: 20_000,
    queryFn: async (): Promise<Onboarding[]> => {
      const { data, error } = await db
        .from('client_onboardings')
        .select('id, client_id, template_id, start_date, status, completed_at, client_cards(id, name, logo_url, color)')
        .eq('workspace_id', wsId)
        .neq('status', 'canceled')
        .order('start_date', { ascending: false });
      if (error) throw error;
      const lista = (data ?? []) as any[];
      const tarefas = await carregarTarefas(lista.map(o => o.id));
      return lista.map(o => ({
        id: o.id,
        client_id: o.client_id,
        template_id: o.template_id,
        start_date: o.start_date,
        status: o.status,
        completed_at: o.completed_at,
        cliente: o.client_cards ?? null,
        tarefas: tarefas.filter(t => t.onboarding_id === o.id),
      }));
    },
  });
}

/** Um onboarding com cliente e tarefas. */
export function useOnboarding(id: string | undefined) {
  const { data: lista, isLoading, error } = useOnboardings();
  const onboarding = useMemo(() => (lista ?? []).find(o => o.id === id) ?? null, [lista, id]);
  return { onboarding, carregando: isLoading, erro: error };
}

/** Clientes ativos que ainda nao tem onboarding em andamento. */
export function useClientesParaOnboarding() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const { data: lista } = useOnboardings();
  return useQuery({
    queryKey: ['onb-clientes-livres', wsId, (lista ?? []).filter(o => o.status === 'active').map(o => o.client_id).sort().join(',')],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await db.from('client_cards').select('id, name, logo_url, color, start_date').eq('workspace_id', wsId).eq('status', 'active').order('name');
      if (error) throw error;
      const ocupados = new Set((lista ?? []).filter(o => o.status === 'active').map(o => o.client_id));
      return ((data ?? []) as (ClienteResumo & { start_date: string | null })[]).filter(c => !ocupados.has(c.id));
    },
  });
}

const invalidar = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['onb-lista'] });
  qc.invalidateQueries({ queryKey: ['onb-clientes-livres'] });
};

export function useIniciarOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, templateId, inicio }: { clientId: string; templateId: string; inicio: string }) => {
      const { data, error } = await db.rpc('iniciar_onboarding', { _client: clientId, _template: templateId, _start: inicio });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidar(qc),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível iniciar o onboarding.'),
  });
}

export function useAtualizarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<TarefaDoCliente, 'completed_at' | 'assignee_id' | 'due_date' | 'notes' | 'title'>> }) => {
      const { data, error } = await db.from('client_onboarding_tasks').update(patch).eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Você não tem permissão para alterar esta tarefa.');
    },
    onSuccess: () => invalidar(qc),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar.'),
  });
}

export function useAdicionarTarefa() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ onboardingId, stageKey, title, dueDate, sortOrder }: { onboardingId: string; stageKey: string; title: string; dueDate: string | null; sortOrder: number }) => {
      const { error } = await db.from('client_onboarding_tasks').insert({
        onboarding_id: onboardingId, workspace_id: currentWorkspace?.id, stage_key: stageKey, title: title.trim(), due_date: dueDate, sort_order: sortOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível adicionar a tarefa.'),
  });
}

export function useSalvarPlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, playbook }: { stageId: string; playbook: string }) => {
      const { data, error } = await db.from('onboarding_template_stages').update({ playbook }).eq('id', stageId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Só admin edita o playbook.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onb-modelo'] });
      toast.success('Playbook salvo.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar o playbook.'),
  });
}

export function useEncerrarOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'done' | 'canceled' }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      const { data, error } = await db.from('client_onboardings').update({ status }).eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Não foi possível atualizar o onboarding.');
    },
    onSuccess: (_r, v) => {
      invalidar(qc);
      toast.success(v.status === 'done' ? 'Onboarding concluído.' : 'Onboarding cancelado.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível concluir.'),
  });
}
