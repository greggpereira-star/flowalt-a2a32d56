import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { LEVEL_CONFIGS } from '@/hooks/useUserLevel';

export type Periodo = 7 | 30 | 365;

export interface Jogador {
  user_id: string;
  name: string;
  avatar_url: string | null;
  cargo: string;
  participa: boolean;
  posicao: number | null; // só quem participa do ranking
  variacao: number | null; // posições ganhas (+) ou perdidas (-) desde o último dia gravado
  score: number;
  pts_entrega: number;
  pts_constancia: number;
  pts_colaboracao: number;
  pts_horas: number;
  entregas: number;
  dias_ativos: number;
  comentarios: number;
  movimentacoes: number;
  horas: number;
  xp: number;
  nivel: number;
  nivel_nome: string;
  nivel_icone: string;
  nivel_progresso: number; // 0-100 até o próximo nível
  xp_proximo: number;
  medalhas: number;
  streak_atual: number;
  melhor_streak: number;
  ativo_hoje: boolean;
  ultima_atividade: string | null;
}

export interface Pesos {
  entrega: number;
  constancia: number;
  colaboracao: number;
  horas: number;
}

const PESOS_PADRAO: Pesos = { entrega: 50, constancia: 20, colaboracao: 20, horas: 10 };

/** Atividade por pessoa, calculada no banco (get_people_activity), para uma janela em dias. */
function useAtividade(dias: number) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['gam-activity', currentWorkspace?.id, dias],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_people_activity', {
        p_workspace_id: currentWorkspace!.id,
        p_days: dias,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60_000,
  });
}

export function useGamificationData(periodo: Periodo) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const atividade = useAtividade(periodo);
  // Desafios da semana usam sempre os últimos 7 dias, independente do período do ranking.
  const semana = useAtividade(7);

  const membros = useQuery({
    queryKey: ['gam-members', wsId],
    queryFn: async () => {
      const { data: ms } = await supabase
        .from('workspace_members')
        .select('user_id, function_title')
        .eq('workspace_id', wsId!)
        .eq('is_active', true);
      const ids = (ms ?? []).map(m => m.user_id);
      if (ids.length === 0) return [];
      const [{ data: perfis }, { data: papeis }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids),
        supabase.from('user_roles').select('user_id, role').eq('workspace_id', wsId!),
      ]);
      return (ms ?? []).map(m => {
        const p = perfis?.find(x => x.id === m.user_id);
        const papel = papeis?.find(r => r.user_id === m.user_id)?.role;
        return {
          user_id: m.user_id,
          name: p?.full_name?.trim() || p?.email || 'Membro',
          avatar_url: p?.avatar_url ?? null,
          cargo: m.function_title || (papel === 'owner' ? 'Proprietário' : papel === 'admin' ? 'Administrador' : 'Membro'),
        };
      });
    },
    enabled: !!wsId,
    staleTime: 5 * 60_000,
  });

  const streaks = useQuery({
    queryKey: ['gam-streaks', wsId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_people_streaks', { p_workspace_id: wsId });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  // Posição no último dia gravado, para mostrar quem subiu e quem caiu.
  const historico = useQuery({
    queryKey: ['gam-history', wsId],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 10);
      const { data } = await supabase
        .from('ranking_history')
        .select('user_id, rank, recorded_at')
        .eq('workspace_id', wsId!)
        .gte('recorded_at', desde.toISOString().split('T')[0])
        .order('recorded_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 5 * 60_000,
  });

  const jogadores = useMemo<Jogador[]>(() => {
    if (!membros.data || !atividade.data) return [];

    const hoje = new Date().toISOString().split('T')[0];
    const diaAnterior = (historico.data ?? []).map(h => h.recorded_at).find(d => d < hoje);
    const posAnterior = new Map<string, number>(
      (historico.data ?? []).filter(h => h.recorded_at === diaAnterior).map(h => [h.user_id, h.rank as number])
    );

    const base = membros.data.map(m => {
      const a = atividade.data!.find(x => x.user_id === m.user_id);
      const s = streaks.data?.find(x => x.user_id === m.user_id);
      const nivel = a?.nivel ?? 1;
      const cfg = LEVEL_CONFIGS.find(c => c.level === nivel) ?? LEVEL_CONFIGS[0];
      const xp = a?.xp ?? 0;
      const faixa = (a?.proximo_nivel_xp ?? cfg.maxScore + 1) - cfg.minScore;
      return {
        user_id: m.user_id,
        name: m.name,
        avatar_url: m.avatar_url,
        cargo: m.cargo,
        participa: a?.participa ?? true,
        posicao: null as number | null,
        variacao: null as number | null,
        score: Number(a?.score ?? 0),
        pts_entrega: Number(a?.pts_entrega ?? 0),
        pts_constancia: Number(a?.pts_constancia ?? 0),
        pts_colaboracao: Number(a?.pts_colaboracao ?? 0),
        pts_horas: Number(a?.pts_horas ?? 0),
        entregas: a?.entregas ?? 0,
        dias_ativos: a?.dias_ativos ?? 0,
        comentarios: a?.comentarios ?? 0,
        movimentacoes: a?.movimentacoes ?? 0,
        horas: Number(a?.horas ?? 0),
        xp,
        nivel,
        nivel_nome: a?.nivel_nome || cfg.name,
        nivel_icone: cfg.icon,
        nivel_progresso: faixa > 0 ? Math.min(100, Math.max(0, ((xp - cfg.minScore) / faixa) * 100)) : 0,
        xp_proximo: a?.proximo_nivel_xp ?? cfg.maxScore + 1,
        medalhas: a?.medalhas ?? 0,
        streak_atual: s?.streak_atual ?? 0,
        melhor_streak: s?.melhor_streak ?? 0,
        ativo_hoje: !!s?.ativo_hoje,
        ultima_atividade: a?.ultima_atividade ?? null,
      } as Jogador;
    });

    const ordenados = base
      .filter(j => j.participa)
      .sort((a, b) => b.score - a.score || b.entregas - a.entregas || b.xp - a.xp);
    ordenados.forEach((j, i) => {
      j.posicao = i + 1;
      const antes = posAnterior.get(j.user_id);
      // Só compara no ranking de 30 dias, que é o que o histórico diário guarda.
      j.variacao = periodo === 30 && antes != null ? antes - (i + 1) : null;
    });

    return [...ordenados, ...base.filter(j => !j.participa).sort((a, b) => b.xp - a.xp)];
  }, [membros.data, atividade.data, streaks.data, historico.data, periodo]);

  const pesos: Pesos = useMemo(() => {
    const a = atividade.data?.[0];
    return a
      ? { entrega: a.peso_entrega, constancia: a.peso_constancia, colaboracao: a.peso_colaboracao, horas: a.peso_horas }
      : PESOS_PADRAO;
  }, [atividade.data]);

  const meusUltimos7 = useMemo(
    () => semana.data?.find(x => x.user_id === user?.id) ?? null,
    [semana.data, user?.id]
  );

  return {
    jogadores,
    eu: jogadores.find(j => j.user_id === user?.id) ?? null,
    pesos,
    meusUltimos7,
    carregando: membros.isLoading || atividade.isLoading,
    erro: membros.error || atividade.error,
  };
}

/** Medalhas de todo o workspace: raridade de cada uma e mural das mais recentes. */
export function useMedalhasDoTime() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['gam-team-badges', currentWorkspace?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('user_id, badge_type, earned_at')
        .eq('workspace_id', currentWorkspace!.id)
        .order('earned_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
}
