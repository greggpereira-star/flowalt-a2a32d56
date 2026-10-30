// Kudos (gamificacao, Onda 3): regras puras, sem rede nem React, para poderem ser testadas.
// O banco e quem decide (dar_kudos); aqui ficam os limites para a tela avisar antes e a traducao dos erros.

export type CategoriaDeKudos = 'ajuda' | 'qualidade' | 'prazo' | 'ideia' | 'equipe';

export const CATEGORIAS_DE_KUDOS: { chave: CategoriaDeKudos; rotulo: string }[] = [
  { chave: 'ajuda', rotulo: 'Ajudou' },
  { chave: 'qualidade', rotulo: 'Qualidade' },
  { chave: 'prazo', rotulo: 'Salvou o prazo' },
  { chave: 'ideia', rotulo: 'Boa ideia' },
  { chave: 'equipe', rotulo: 'Espírito de equipe' },
];

/** Espelham o banco: se mudar la, mude aqui (so a validacao antecipada da tela). */
export const KUDOS_POR_SEMANA = 3;
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 280;

export interface Kudos {
  id: string;
  de_user_id: string;
  de_nome: string | null;
  de_avatar: string | null;
  para_user_id: string;
  para_nome: string | null;
  para_avatar: string | null;
  categoria: CategoriaDeKudos;
  motivo: string;
  criado_em: string;
  posso_remover: boolean;
}

export function rotuloDaCategoria(chave: string): string {
  return CATEGORIAS_DE_KUDOS.find(c => c.chave === chave)?.rotulo ?? 'Kudos';
}

/** Mensagem para o campo do motivo, ou null se estiver valido. */
export function validarMotivo(texto: string): string | null {
  const n = texto.trim().length;
  if (n < MOTIVO_MIN) return `Conte o motivo com pelo menos ${MOTIVO_MIN} caracteres.`;
  if (n > MOTIVO_MAX) return `O motivo passou de ${MOTIVO_MAX} caracteres.`;
  return null;
}

export function rotuloDeRestantes(restantes: number): string {
  if (restantes <= 0) return 'Suas palmas desta semana acabaram. Voltam na segunda.';
  return restantes === 1 ? 'Você tem 1 palma esta semana.' : `Você tem ${restantes} palmas esta semana.`;
}

const ERROS: Record<string, string> = {
  si_mesmo: 'Kudos é para um colega, não para você.',
  colega_invalido: 'Esse colega não está mais na equipe.',
  categoria_invalida: 'Escolha uma das categorias.',
  motivo_curto: `Conte o motivo com pelo menos ${MOTIVO_MIN} caracteres.`,
  motivo_longo: `O motivo passou de ${MOTIVO_MAX} caracteres.`,
  limite_semanal: 'Suas palmas desta semana acabaram. Voltam na segunda.',
  colega_repetido: 'Você já deu kudos a esse colega esta semana. Reconheça outra pessoa.',
};

/** Traduz o erro do banco ("kudos:limite_semanal") para uma frase; qualquer outro erro vira uma mensagem generica. */
export function mensagemDeErroDeKudos(erro: unknown): string {
  const texto = erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : String(erro ?? '');
  const achado = /kudos:([a-z_]+)/.exec(texto);
  return (achado && ERROS[achado[1]]) || 'Não foi possível enviar o kudos. Tente de novo.';
}
