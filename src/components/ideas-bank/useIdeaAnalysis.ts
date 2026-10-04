import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  return useQuery({
    queryKey: ['idea-reference', inicial?.id],
    enabled: !!inicial?.id,
    initialData: inicial ?? undefined,
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => ((q.state.data as IdeaReference | undefined)?.transcript_status === 'processando' ? 4000 : false),
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

  return { salvarTranscricao, transcrever, analisar, gerarRoteiros, roteiros, apagarRoteiro };
}
