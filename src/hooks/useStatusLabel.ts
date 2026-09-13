import { useCallback } from 'react';
import { useStatusLabels } from '@/hooks/useStatusLabels';
import { CARD_STATUS_LABELS } from '@/lib/cards/cardStatusLabels';
import type { CardStatus } from '@/lib/supabase';

/**
 * Resolve o rótulo de um status pelo nome que o workspace usa.
 *
 * Existe separado de `useStatusLabels` porque a maioria das telas só precisa
 * ler um nome; quem chama isto não deve ter de saber que há uma mutação de
 * renomear do outro lado.
 *
 * Prefira este hook a `getCardStatusLabel` dentro de componentes: a função
 * solta lê uma variável de módulo e não avisa o React quando o time renomeia
 * uma etapa, então a tela só mostraria o nome novo na próxima montagem. Aqui a
 * consulta é a mesma (cache compartilhado do React Query, sem requisição
 * extra) e o componente redesenha sozinho.
 */
export function useStatusLabel(): (status: string) => string {
  const { labels } = useStatusLabels();

  return useCallback(
    (status: string) =>
      labels[status as CardStatus] ?? CARD_STATUS_LABELS[status as CardStatus] ?? status,
    [labels],
  );
}
