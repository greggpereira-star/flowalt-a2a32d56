import * as React from 'react';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';

/**
 * "Skin" do visual novo para as telas do grupo Gestão (opção beta pessoal).
 *
 * Em vez de editar cada tela, o grupo é embrulhado em <GestaoSkin>: quando a opção está ligada,
 * os componentes Card passam a usar o desenho novo (cantos mais arredondados, borda fina, título
 * em negrito) e o CSS `.gestao-novo` ajusta títulos de página e abas. Desligada, este componente
 * devolve os filhos sem nenhuma alteração.
 */
const SkinNovoContext = React.createContext(false);

export const useSkinNovo = () => React.useContext(SkinNovoContext);

function Skin({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  if (!ativo) return <>{children}</>;
  return (
    <SkinNovoContext.Provider value={true}>
      {/* display: contents mantém o layout exatamente como estava; só o CSS descendente passa a valer. */}
      <div className="gestao-novo contents">{children}</div>
    </SkinNovoContext.Provider>
  );
}

export function GestaoSkin({ children }: { children: React.ReactNode }) {
  const { gestao } = useNewUiBeta();
  return <Skin ativo={gestao}>{children}</Skin>;
}

export function TempoSkin({ children }: { children: React.ReactNode }) {
  const { tempo } = useNewUiBeta();
  return <Skin ativo={tempo}>{children}</Skin>;
}

export function IdeiasSkin({ children }: { children: React.ReactNode }) {
  const { ideias } = useNewUiBeta();
  return <Skin ativo={ideias}>{children}</Skin>;
}
