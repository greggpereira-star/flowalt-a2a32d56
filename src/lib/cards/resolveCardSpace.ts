import { supabase } from '@/integrations/supabase/client';

/**
 * Descobre em qual espaço abrir um card.
 *
 * Por que isto existe: `cards.space_id` é um campo legado, da época em que um
 * card pertencia a um único quadro. Hoje o vínculo real está em `card_spaces`
 * (um card nasce em um espaço e é compartilhado com outros), e `cards.space_id`
 * continua congelado no espaço de ORIGEM.
 *
 * Navegar por esse campo levava a pessoa ao quadro onde o card foi criado, e
 * não ao quadro do time que a marcou — o card não aparecia na tela e parecia
 * ter sido perdido.
 *
 * O Kanban já contornava isso por conta própria, com o campo virtual
 * `display_space_id` em useCards. Esta função existe para que todo ponto de
 * navegação use a mesma regra, em vez de cada tela reimplementar a sua — foi
 * justamente a falta disso que deixou dois centros de alerta com o mesmo
 * defeito, um deles sem ninguém perceber que era código morto.
 *
 * @param cardId    card a ser aberto
 * @param hintSpaceId espaço sugerido pelo contexto (ex.: metadata da
 *                    notificação). É usado apenas se ainda for um vínculo
 *                    válido — nunca seguido às cegas.
 * @returns o id do espaço, ou null quando não há destino confiável (nesse caso
 *          o chamador deve cair para /tasks, que encontra o card em qualquer
 *          quadro).
 */
export interface ResolvedCardTarget {
  spaceId: string | null;
  /** Card já arquivado: o destino existe, mas não é mais trabalho ativo. */
  isArchived: boolean;
  title: string | null;
}

/**
 * Versão que também informa se o card está arquivado.
 *
 * Metade das notificações do workspace aponta para cards que foram arquivados
 * DEPOIS de a notificação ser criada — o link está certo, o card é que saiu de
 * circulação. Abrir isso em silêncio faz a pessoa achar que o sistema mandou
 * para o lugar errado. Quem chama deve avisar.
 */
export async function resolveCardTarget(
  cardId: string,
  hintSpaceId?: string | null,
): Promise<ResolvedCardTarget> {
  const spaceId = await resolveCardSpaceId(cardId, hintSpaceId);

  const { data } = await supabase
    .from('cards')
    .select('status, title')
    .eq('id', cardId)
    .maybeSingle();

  return {
    spaceId,
    isArchived: data?.status === 'archived',
    title: (data?.title as string | undefined) ?? null,
  };
}

export async function resolveCardSpaceId(
  cardId: string,
  hintSpaceId?: string | null,
): Promise<string | null> {
  if (!cardId) return null;

  try {
    const [spacesResult, cardResult] = await Promise.all([
      supabase
        .from('card_spaces')
        .select('space_id, created_at')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false }),
      supabase.from('cards').select('space_id').eq('id', cardId).maybeSingle(),
    ]);

    const validSpaceIds = (spacesResult.data ?? [])
      .map((row) => row.space_id)
      .filter(Boolean) as string[];

    // 1. A dica do contexto vale, desde que o card realmente esteja lá.
    if (hintSpaceId && validSpaceIds.includes(hintSpaceId)) {
      return hintSpaceId;
    }

    // 2. Vínculo mais recente: representa para onde o card foi encaminhado.
    if (validSpaceIds.length > 0) {
      return validSpaceIds[0];
    }

    // 3. Sem vínculo nenhum, o campo de origem é a única pista.
    return (cardResult.data?.space_id as string | undefined) ?? null;
  } catch (error) {
    console.error('Erro ao resolver o espaço do card:', error);
    return null;
  }
}
