import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Varias mudancas seguidas (criar demanda + vincular ao espaco + campos) viram UMA atualizacao da tela.
const AGRUPAR_MUDANCAS_MS = 300;
// A demanda nasce em duas etapas no navegador (cards e depois card_spaces). Se a tela busca no meio, a demanda ainda nao
// aparece no quadro; uma segunda busca logo depois garante que ela entre.
const REBUSCA_APOS_CRIACAO_MS = 1500;
// Rede de seguranca: se o canal de demandas cair, a tela volta a buscar sozinha enquanto estiver visivel.
const BUSCA_DE_SEGURANCA_MS = 45_000;

/**
 * Atualiza ao vivo as demandas (cards) de qualquer tela quando outra pessoa cria, move ou edita uma.
 *
 * Cada tabela tem o SEU canal. O Realtime derruba o canal inteiro, sem avisar, quando uma das tabelas assinadas nao esta na
 * publicacao do banco; antes, card_spaces e card_folders estavam no mesmo canal de cards e as demandas nunca chegavam.
 * Montar uma vez no layout do app (nao por tela), para nao abrir canais repetidos.
 */
export const useRealtimeCards = (_spaceId?: string) => {
  const queryClient = useQueryClient();
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const wsId = currentWorkspace?.id;
    if (!wsId) return;

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const depois = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    let agendada = false;
    const atualizar = () => {
      if (agendada) return;
      agendada = true;
      depois(() => {
        agendada = false;
        queryClient.invalidateQueries({ queryKey: ['cards'] });
        queryClient.invalidateQueries({ queryKey: ['card-history'] });
        queryClient.invalidateQueries({ queryKey: ['client-cards'] });
        queryClient.invalidateQueries({ queryKey: ['card_member_assignments'] });
      }, AGRUPAR_MUDANCAS_MS);
    };

    const saudaveis = new Set<string>();
    const canais: RealtimeChannel[] = [];
    const abrir = (nome: string, tabela: string, filtro: string | undefined, aoMudar: (payload: any) => void) => {
      const canal = supabase
        .channel(`${nome}-${wsId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) }, aoMudar)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') saudaveis.add(nome);
          else saudaveis.delete(nome);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`[realtime] canal ${nome} (${tabela}): ${status}`);
        });
      canais.push(canal);
    };

    abrir('cards-rt', 'cards', `workspace_id=eq.${wsId}`, payload => {
      atualizar();
      if (payload.eventType === 'INSERT') {
        const novo = payload.new as { title: string; created_by: string };
        depois(() => queryClient.invalidateQueries({ queryKey: ['cards'] }), REBUSCA_APOS_CRIACAO_MS);
        if (novo.created_by !== user?.id) {
          toast({ title: 'Nova demanda', description: novo.title, duration: 3000 });
        }
      }
      if (payload.eventType === 'UPDATE') {
        const atualizado = payload.new as { id: string };
        queryClient.invalidateQueries({ queryKey: ['card', atualizado.id] });
      }
    });

    // Vinculo da demanda com o espaco: e o que a faz aparecer no quadro. Exige a tabela na publicacao supabase_realtime.
    abrir('card-spaces-rt', 'card_spaces', undefined, payload => {
      atualizar();
      const cardId = (payload.new as any)?.card_id ?? (payload.old as any)?.card_id;
      if (cardId) queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    });

    // Responsaveis da demanda: a troca de responsavel aparece na hora. Exige card_members na publicacao supabase_realtime.
    abrir('card-members-rt', 'card_members', undefined, payload => {
      atualizar();
      const cardId = (payload.new as any)?.card_id ?? (payload.old as any)?.card_id;
      if (cardId) queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    });

    abrir('card-folders-rt', 'card_folders', undefined, payload => {
      atualizar();
      const cardId = (payload.new as any)?.card_id ?? (payload.old as any)?.card_id;
      if (cardId) queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    });

    const seguranca = setInterval(() => {
      if (document.visibilityState === 'visible' && !saudaveis.has('cards-rt')) {
        queryClient.invalidateQueries({ queryKey: ['cards'] });
      }
    }, BUSCA_DE_SEGURANCA_MS);

    return () => {
      clearInterval(seguranca);
      timers.forEach(clearTimeout);
      canais.forEach(c => supabase.removeChannel(c));
    };
  }, [currentWorkspace?.id, user?.id, queryClient, toast]);
};

export const useRealtimeNotifications = () => {
  const queryClient = useQueryClient();
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, queryClient]);
};