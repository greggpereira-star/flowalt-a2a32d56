import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { IdeaReference } from '@/hooks/useIdeaReferences';

export interface AnaliseCriativo {
  resumo: string;
  gancho: { trecho: string; tipo: string; por_que_funciona: string };
  estrutura: { etapa: string; trecho: string; funcao: string }[];
  gatilhos: { nome: string; evidencia: string }[];
  tom_e_ritmo: { tom: string; ritmo: string; linguagem: string };
  por_que_funciona: string[];
  o_que_replicar: string[];
  o_que_evitar: string[];
  limitacoes: string;
  /** Presente quando o vídeo foi medido e os quadros foram vistos pelo agente. */
  edicao?: {
    ritmo: string;
    estrutura_visual: { tempo: string; plano: string; o_que_aparece: string }[];
    texto_na_tela: { estilo: string; exemplos: string[]; quando_aparece: string };
    enquadramento: string;
    gancho_visual: string;
    audio_e_trilha: string;
    o_que_replicar: string[];
    limitacoes: string;
  };
}

export interface RoteiroGerado {
  titulo: string;
  abordagem: string;
  gancho: string;
  cenas: { tempo: string; fala: string; visual: string }[];
  cta: string;
  legenda: string;
  hashtags: string[];
  por_que_funciona_para_o_cliente: string;
  direcao_de_edicao?: { ritmo: string; texto_na_tela: string; planos: string; audio: string; observacoes?: string };
}

export interface RoteiroSalvo {
  id: string;
  reference_id: string;
  client_id: string | null;
  title: string;
  content: RoteiroGerado;
  options: { quantidade?: number; duracao_segundos?: number; objetivo?: string | null; formato?: string | null } | null;
  created_by: string | null;
  created_at: string;
}

export interface PedidoIA {
  id: string;
  reference_id: string;
  kind: 'analise' | 'roteiros';
  client_id: string | null;
  options: Partial<OpcoesRoteiro> | null;
  status: 'pendente' | 'processando' | 'pronto' | 'erro';
  error: string | null;
  result: { lacunas_do_briefing?: string[] } | null;
  requested_by: string;
  created_at: string;
  finished_at: string | null;
}

export const pedidoAberto = (p: PedidoIA) => p.status === 'pendente' || p.status === 'processando';

export interface OpcoesRoteiro {
  quantidade: number;
  duracao_segundos: number;
  objetivo: string;
  formato: string;
  instrucoes: string;
}

/** Mensagem legível de um erro de função do servidor (o corpo da resposta traz o motivo). */
async function mensagemDoErro(error: any): Promise<string> {
  try {
    const corpo = await error?.context?.json?.();
    if (corpo?.error) return corpo.error as string;
  } catch {
    /* corpo ilegível */
  }
  return error?.message || 'Erro inesperado';
}

/** A referência, atualizada sozinha enquanto a transcrição roda em segundo plano. */
export function useReferenciaAoVivo(inicial: IdeaReference | null) {
  const qcAoVivo = useQueryClient();
  return useQuery({
    queryKey: ['idea-reference', inicial?.id],
    enabled: !!inicial?.id,
    initialData: inicial ?? undefined,
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => {
      const d = q.state.data as IdeaReference | undefined;
      if (d?.transcript_status === 'processando' || d?.edit_metrics_status === 'processando') return 4000;
      // Enquanto há pedido ao agente em aberto, a referência é reconsultada para mostrar o resultado quando chegar.
      const pedidos = qcAoVivo.getQueryData<PedidoIA[]>(['idea-requests', inicial?.id]);
      return pedidos?.some(pedidoAberto) ? 8000 : false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('idea_references').select('*').eq('id', inicial!.id).single();
      if (error) throw error;
      return data as IdeaReference;
    },
  });
}

export function useIdeaAnalysis(referenceId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['idea-reference', referenceId] });
    qc.invalidateQueries({ queryKey: ['idea-references'] });
    qc.invalidateQueries({ queryKey: ['idea-feed'] });
    qc.invalidateQueries({ queryKey: ['idea-feed-totais'] });
  };

  const salvarTranscricao = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await (supabase as any)
        .from('idea_references')
        .update({
          transcript: texto.trim() || null,
          transcript_status: texto.trim() ? 'pronta' : null,
          transcript_source: texto.trim() ? 'manual' : null,
          transcript_error: null,
        })
        .eq('id', referenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      recarregar();
      toast({ title: 'Transcrição salva' });
    },
    onError: (e: any) => toast({ title: 'Não foi possível salvar', description: e.message, variant: 'destructive' }),
  });

  const transcrever = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('idea-transcribe', { body: { reference_id: referenceId } });
      if (error) throw new Error(await mensagemDoErro(error));
    },
    onSuccess: recarregar,
    onError: (e: any) => toast({ title: 'Não foi possível transcrever', description: e.message, variant: 'destructive' }),
  });

  const medirEdicao = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('idea-measure', { body: { reference_id: referenceId } });
      if (error) throw new Error(await mensagemDoErro(error));
    },
    onSuccess: recarregar,
    onError: (e: any) => toast({ title: 'Não foi possível medir a edição', description: e.message, variant: 'destructive' }),
  });

  const analisar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('idea-analyze', { body: { mode: 'analyze', reference_id: referenceId } });
      if (error) throw new Error(await mensagemDoErro(error));
      return (data as any).analysis as AnaliseCriativo;
    },
    onSuccess: recarregar,
    onError: (e: any) => toast({ title: 'Não foi possível analisar', description: e.message, variant: 'destructive' }),
  });

  const gerarRoteiros = useMutation({
    mutationFn: async ({ clientId, opcoes }: { clientId: string; opcoes: OpcoesRoteiro }) => {
      const { data, error } = await supabase.functions.invoke('idea-analyze', {
        body: { mode: 'scripts', reference_id: referenceId, client_id: clientId, options: opcoes },
      });
      if (error) throw new Error(await mensagemDoErro(error));
      return data as { scripts: RoteiroSalvo[]; lacunas_do_briefing: string[] };
    },
    onSuccess: () => {
      recarregar();
      qc.invalidateQueries({ queryKey: ['idea-scripts', referenceId] });
    },
    onError: (e: any) => toast({ title: 'Não foi possível gerar os roteiros', description: e.message, variant: 'destructive' }),
  });

  const roteiros = useQuery({
    queryKey: ['idea-scripts', referenceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_scripts')
        .select('*')
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RoteiroSalvo[];
    },
  });

  const apagarRoteiro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('idea_scripts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-scripts', referenceId] }),
    onError: (e: any) => toast({ title: 'Não foi possível excluir', description: e.message, variant: 'destructive' }),
  });

  // ---------- Fila do agente de copy (plano B: sem API paga) ----------
  const pedidos = useQuery({
    queryKey: ['idea-requests', referenceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_requests')
        .select('*')
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as PedidoIA[];
    },
    refetchInterval: (q) => ((q.state.data as PedidoIA[] | undefined)?.some(pedidoAberto) ? 8000 : false),
    refetchIntervalInBackground: true,
  });

  // Quando um pedido termina, atualiza análise e roteiros na tela.
  const concluidos = (pedidos.data ?? []).filter(p => p.status === 'pronto').map(p => p.id).join(',');
  useEffect(() => {
    if (!concluidos) return;
    qc.invalidateQueries({ queryKey: ['idea-reference', referenceId] });
    qc.invalidateQueries({ queryKey: ['idea-scripts', referenceId] });
    qc.invalidateQueries({ queryKey: ['idea-feed'] });
    qc.invalidateQueries({ queryKey: ['idea-feed-totais'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concluidos]);

  const criarPedido = useMutation({
    mutationFn: async (p: { kind: 'analise' | 'roteiros'; clientId?: string; opcoes?: OpcoesRoteiro }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Sessão ausente');
      const { error } = await (supabase as any).from('idea_requests').insert({
        workspace_id: currentWorkspace.id,
        reference_id: referenceId,
        kind: p.kind,
        client_id: p.clientId ?? null,
        options: p.opcoes ?? null,
        requested_by: user.id,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Já existe um pedido igual na fila.');
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-requests', referenceId] });
      toast({ title: 'Pedido enviado ao agente de copy', description: 'O resultado aparece aqui quando ele processar a fila.' });
    },
    onError: (e: any) => toast({ title: 'Não foi possível pedir', description: e.message, variant: 'destructive' }),
  });

  const cancelarPedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('idea_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-requests', referenceId] }),
    onError: (e: any) => toast({ title: 'Não foi possível cancelar', description: e.message, variant: 'destructive' }),
  });

  return { salvarTranscricao, transcrever, medirEdicao, analisar, gerarRoteiros, roteiros, apagarRoteiro, pedidos, criarPedido, cancelarPedido };
}
