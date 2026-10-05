import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useClientCards } from '@/hooks/useClientCards';
import { useClientsHealth } from '@/hooks/useClientsHealth';
import { buscarCards } from '@/hooks/home/useInicioDados';
import { janelaDoPeriodo, resumoDaJanela } from '@/lib/analytics/metrics';
import { gerarDecisoes } from '@/lib/dashboard/executiva-metrics';
import { contarAbertosEAtrasados } from '@/lib/metrics/definicoes';
import {
  caixaPrevisto,
  receitaPorCliente,
  chaveDoMes,
  resumoDoMes,
  serieMensal,
  type Transacao,
} from '@/lib/metrics/financeiro';

const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export interface SaudeDaCarteira {
  contagem: { healthy: number; attention: number; critical: number; loss: number };
  piores: { id: string; nome: string; score: number; estado: string }[];
  total: number;
}

/**
 * Dados da visão executiva do sócio. Os cálculos moram em lib/metrics/financeiro e lib/dashboard/executiva-metrics
 * (puros e testados); aqui só se busca e se junta: transações, clientes, saúde, cards e aprovações pendentes.
 */
export function useDashboardExecutiva(mes: Date) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const { data: clientes } = useClientCards();
  const { data: saude } = useClientsHealth();

  const inicioJanela = new Date(mes.getFullYear(), mes.getMonth() - 5, 1);
  const hoje = new Date();
  const fimJanela = new Date(Math.max(new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getTime(), hoje.getTime() + 91 * 86_400_000));

  const trsQ = useQuery({
    queryKey: ['exec-transacoes', wsId, dia(inicioJanela), dia(fimJanela)],
    enabled: !!wsId,
    staleTime: 60_000,
    queryFn: async () => {
      const linhas: Transacao[] = [];
      const PAGINA = 1000;
      for (let inicio = 0; ; inicio += PAGINA) {
        const { data, error } = await supabase
          .from('transactions')
          .select('type, status, amount, due_date, client_id')
          .eq('workspace_id', wsId!)
          .gte('due_date', dia(inicioJanela))
          .lte('due_date', dia(fimJanela))
          .order('due_date', { ascending: true })
          .range(inicio, inicio + PAGINA - 1);
        if (error) throw error;
        (data ?? []).forEach(l =>
          linhas.push({
            type: l.type as Transacao['type'],
            status: l.status as string,
            amount: Number(l.amount),
            due_date: l.due_date as string,
            client_id: l.client_id,
          })
        );
        if (!data || data.length < PAGINA) break;
      }
      return linhas;
    },
  });

  const cardsQ = useQuery({
    queryKey: ['exec-cards', wsId],
    queryFn: () => buscarCards(wsId!),
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const aprovacoesQ = useQuery({
    queryKey: ['exec-aprovacoes', wsId, user?.id],
    enabled: !!wsId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('altcontrol_approval_requests')
        .select('id, altcontrol_proposals!inner(workspace_id)')
        .eq('status', 'pending')
        .eq('approver_id', user!.id)
        .eq('altcontrol_proposals.workspace_id', wsId!);
      if (error) throw error;
      return data?.length ?? 0;
    },
  });

  const resultado = useMemo(() => {
    if (!trsQ.data || !cardsQ.data) return null;
    const agora = new Date();
    const trs = trsQ.data;
    const anterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);

    const doMes = resumoDoMes(trs, mes.getFullYear(), mes.getMonth());
    const mesAnterior = resumoDoMes(trs, anterior.getFullYear(), anterior.getMonth());
    const serie = serieMensal(trs, mes, 6);
    const caixa = caixaPrevisto(trs, dia(agora), 90);

    // Carteira: receita já recebida nos últimos 6 meses até hoje (independe do mês navegado)
    const desde = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
    const carteira = receitaPorCliente(trs, dia(desde), dia(agora));

    const nomes = new Map((clientes ?? []).map(c => [c.id, c.name] as [string, string]));
    const ativos = (clientes ?? []).filter(c => c.status === 'active');
    const saudeCarteira: SaudeDaCarteira = {
      contagem: { healthy: 0, attention: 0, critical: 0, loss: 0 },
      piores: [],
      total: ativos.length,
    };
    const pontuados = ativos.map(c => {
      const h = saude?.get(c.id);
      return { id: c.id, nome: c.name, score: h?.healthScore ?? 0, estado: (h?.financialState ?? 'critical') as string };
    });
    pontuados.forEach(c => {
      if (c.estado in saudeCarteira.contagem) saudeCarteira.contagem[c.estado as keyof typeof saudeCarteira.contagem] += 1;
    });
    saudeCarteira.piores = [...pontuados].sort((a, b) => a.score - b.score).slice(0, 4);

    const { atual, anterior: janelaAnterior } = janelaDoPeriodo('30d', agora);
    const operacao = {
      atual: resumoDaJanela(cardsQ.data, atual),
      anterior: resumoDaJanela(cardsQ.data, janelaAnterior),
      ...contarAbertosEAtrasados(cardsQ.data, agora),
    };

    const criticos = pontuados.filter(c => c.estado === 'critical' || c.estado === 'loss').map(c => ({ nome: c.nome }));
    const decisoes = gerarDecisoes({
      mes: doMes,
      // "fecharam no vermelho" só vale para meses que já fecharam: o mês em andamento é previsão
      serie: serie.filter(m => m.chave < chaveDoMes(agora.getFullYear(), agora.getMonth())),
      caixa,
      carteira,
      nomeDoMaiorCliente: carteira.itens[0] ? nomes.get(carteira.itens[0].clientId) : undefined,
      clientesCriticos: criticos,
      aprovacoesPendentes: aprovacoesQ.data ?? 0,
      cardsAtrasados: operacao.atrasados,
    });

    return { doMes, mesAnterior, serie, caixa, carteira, nomes, saudeCarteira, operacao, decisoes };
  }, [trsQ.data, cardsQ.data, clientes, saude, aprovacoesQ.data, mes]);

  return {
    resultado,
    carregando: trsQ.isLoading || cardsQ.isLoading,
    erro: trsQ.error ?? cardsQ.error ?? null,
  };
}
