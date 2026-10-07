import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { intervaloDeIds } from '@/lib/cards/bulk';

export interface SelecaoDeCards {
  ids: ReadonlySet<string>;
  total: number;
  /** Há pelo menos um card marcado: cliques nos cards passam a marcar em vez de abrir. */
  ativa: boolean;
  tem: (id: string) => boolean;
  /** `intervalo`: ids na ordem em que aparecem na tela; com ele, o clique marca tudo entre a âncora e este card. */
  alternar: (id: string, opcoes?: { intervalo?: string[] }) => void;
  marcar: (ids: string[]) => void;
  desmarcar: (ids: string[]) => void;
  limpar: () => void;
}

const Contexto = createContext<SelecaoDeCards | null>(null);

/**
 * Estado da seleção múltipla. `visiveis` são os ids que a tela mostra agora: quem some
 * (filtro, arquivado, troca de espaço) sai da seleção, para a barra nunca agir em card invisível.
 */
export function useCardSelection(visiveis: string[]): SelecaoDeCards {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const ancora = useRef<string | null>(null);

  useEffect(() => {
    setIds(prev => {
      if (prev.size === 0) return prev;
      const vis = new Set(visiveis);
      const proximo = new Set([...prev].filter(id => vis.has(id)));
      return proximo.size === prev.size ? prev : proximo;
    });
  }, [visiveis]);

  const alternar = useCallback((id: string, opcoes?: { intervalo?: string[] }) => {
    setIds(prev => {
      const proximo = new Set(prev);
      const de = ancora.current;
      if (opcoes?.intervalo && de && de !== id && opcoes.intervalo.includes(de)) {
        // Shift+clique marca o trecho inteiro; nunca desmarca, para não surpreender.
        intervaloDeIds(opcoes.intervalo, de, id).forEach(i => proximo.add(i));
      } else if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
    ancora.current = id;
  }, []);

  const marcar = useCallback((lista: string[]) => setIds(prev => new Set([...prev, ...lista])), []);
  const desmarcar = useCallback((lista: string[]) => {
    setIds(prev => {
      const proximo = new Set(prev);
      lista.forEach(i => proximo.delete(i));
      return proximo;
    });
  }, []);
  const limpar = useCallback(() => {
    ancora.current = null;
    setIds(new Set());
  }, []);

  return useMemo(
    () => ({ ids, total: ids.size, ativa: ids.size > 0, tem: (id: string) => ids.has(id), alternar, marcar, desmarcar, limpar }),
    [ids, alternar, marcar, desmarcar, limpar]
  );
}

export const ProvedorDeSelecao: React.FC<{ valor: SelecaoDeCards; children: React.ReactNode }> = ({ valor, children }) => (
  <Contexto.Provider value={valor}>{children}</Contexto.Provider>
);

/** Fora de um provedor (ex.: o mesmo Kanban em outra tela) devolve null e o card age como sempre. */
export const useSelecaoDeCards = () => useContext(Contexto);
