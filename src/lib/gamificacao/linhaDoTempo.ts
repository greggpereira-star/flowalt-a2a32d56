// Linha do tempo do time (gamificacao, Onda 3): regras puras, sem rede nem React, para poderem ser testadas.
// O banco decide o que entra no feed (get_linha_do_tempo); aqui ficam so os textos de cada tipo de evento.
import { NOMES_DOS_NIVEIS, TRILHAS } from '@/lib/gamificacao/conquistas';
import { rotuloDaCategoria } from '@/lib/gamificacao/kudos';

export type TipoDeEvento = 'entrega' | 'missao' | 'conquista' | 'kudos';

export interface EventoDaLinha {
  tipo: TipoDeEvento;
  quando: string;
  titulo: string | null;
  nomes: string[];
  alvo: string | null;
  detalhe: string | null;
  pontos: number | null;
}

export interface TextoDoEvento {
  /** Quem fez, ja juntado ("Ana e Rhunner"). */
  quem: string;
  /** O verbo, concordando no plural quando for mais de uma pessoa. */
  acao: string;
  /** O que foi feito, com o titulo entre aspas quando houver. */
  complemento: string;
  /** Selo curto ao lado do texto, ou null. */
  selo: string | null;
}

/** "Ana" / "Ana e Rhunner" / "Ana, Rhunner e Lucas". */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? 'Alguém';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

const entre = (titulo: string | null) => (titulo ? `“${titulo}”` : 'um card');

/**
 * Texto de cada evento. So elogia: entrega atrasada aparece igual a qualquer outra (sem selo de atraso);
 * "no prazo" ganha um selo. A cobranca de prazo e do ranking, nao do mural.
 */
export function descreverEvento(e: EventoDaLinha): TextoDoEvento {
  const varios = e.nomes.length > 1;
  const quem = juntarNomes(e.nomes);
  switch (e.tipo) {
    case 'entrega':
      return { quem, acao: varios ? 'entregaram' : 'entregou', complemento: entre(e.titulo), selo: e.detalhe === 'no_prazo' ? 'no prazo' : null };
    case 'missao':
      return {
        quem,
        acao: e.detalhe === 'atraso' ? (varios ? 'resolveram o atraso de' : 'resolveu o atraso de') : varios ? 'destravaram' : 'destravou',
        complemento: entre(e.titulo),
        selo: e.pontos != null ? `+${e.pontos} pts` : null,
      };
    case 'conquista': {
      const trilha = TRILHAS.find(t => t.chave === e.detalhe)?.nome ?? 'uma trilha';
      const nivel = e.pontos != null && e.pontos >= 1 && e.pontos <= 3 ? NOMES_DOS_NIVEIS[e.pontos - 1] : 'um novo nível';
      return { quem, acao: 'chegou ao', complemento: `${nivel} em ${trilha}`, selo: null };
    }
    case 'kudos':
      return { quem, acao: 'deu kudos a', complemento: e.alvo ?? 'um colega', selo: e.detalhe ? rotuloDaCategoria(e.detalhe) : null };
  }
}
