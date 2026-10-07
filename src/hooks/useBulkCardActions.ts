import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useCreateCard, useDeleteCard, useMirrorCardToSpace, useUpdateCard, type Card } from '@/hooks/useCards';
import { resumoDoLote, statusDaCopia, type AcaoEmLote } from '@/lib/cards/bulk';
import type { CardStatus } from '@/lib/supabase';

export interface Destino {
  spaceId: string;
  modo: 'copy' | 'mirror';
}

interface Resultado {
  ok: number;
  falhas: number;
}

/** Roda a ação card a card, em pequenos grupos, sem que a falha de um derrube os outros. */
async function emGrupos<T>(itens: T[], acao: (item: T) => Promise<unknown>, tamanho = 4): Promise<Resultado & { falhou: T[] }> {
  let ok = 0;
  const falhou: T[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    const fatia = itens.slice(i, i + tamanho);
    const r = await Promise.allSettled(fatia.map(acao));
    r.forEach((x, j) => (x.status === 'fulfilled' ? ok++ : falhou.push(fatia[j])));
  }
  return { ok, falhas: falhou.length, falhou };
}

export function useBulkCardActions(spaceId?: string) {
  const criar = useCreateCard(spaceId);
  const espelhar = useMirrorCardToSpace(spaceId);
  const apagar = useDeleteCard();
  const atualizar = useUpdateCard();
  const [ocupado, setOcupado] = useState(false);

  const avisar = (acao: AcaoEmLote, r: Resultado, ignorados = 0, desfazer?: () => void) => {
    const texto = resumoDoLote(acao, { ok: r.ok, falhas: r.falhas, ignorados });
    const opcoes = desfazer && r.ok > 0 ? { action: { label: 'Desfazer', onClick: desfazer }, duration: 10000 } : undefined;
    if (r.ok === 0) toast.error(texto);
    else if (r.falhas > 0 || ignorados > 0) toast.warning(texto, opcoes);
    else toast.success(texto, opcoes);
  };

  const duplicar = useCallback(
    async (cards: Card[], destino?: Destino, folderId?: string) => {
      setOcupado(true);
      try {
        const acao: AcaoEmLote = !destino ? 'duplicar' : destino.modo === 'mirror' ? 'espelhar' : 'copiar';
        const r = await emGrupos(cards, card => {
          if (destino?.modo === 'mirror') return espelhar.mutateAsync({ cardId: card.id, targetSpaceId: destino.spaceId });
          return criar.mutateAsync({
            title: `${card.title} (cópia)`,
            space_id: destino?.spaceId || card.space_id,
            description: card.description || undefined,
            status: statusDaCopia(card.status) as CardStatus,
            urgency: card.urgency,
            due_date: card.due_date || undefined,
            client_id: card.client_id || undefined,
            duplicate_to_space_id: destino?.spaceId,
            duplication_mode: destino ? 'copy' : undefined,
            folder_id: destino ? undefined : folderId,
          });
        });
        avisar(acao, r);
        return r;
      } finally {
        setOcupado(false);
      }
    },
    [criar, espelhar]
  );

  const arquivar = useCallback(
    async (cards: Card[], ignorados = 0) => {
      setOcupado(true);
      try {
        const r = await emGrupos(cards, card => apagar.mutateAsync(card.id));
        const arquivados = cards.filter(c => !r.falhou.includes(c));
        const desfazer = () => {
          // Desfazer devolve cada card à coluna onde estava.
          emGrupos(arquivados, c => atualizar.mutateAsync({ id: c.id, status: c.status })).then(d =>
            d.falhas > 0 ? toast.error(`${d.falhas} não voltaram ao quadro`) : toast.success('Cards restaurados')
          );
        };
        avisar('arquivar', r, ignorados, desfazer);
        return r;
      } finally {
        setOcupado(false);
      }
    },
    [apagar, atualizar]
  );

  return { duplicar, arquivar, ocupado };
}
