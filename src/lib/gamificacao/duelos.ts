// Duelos 1x1 (gamificacao, Onda 3): regras puras, sem rede nem React, para poderem ser testadas.
// O banco decide tudo (desafiar_duelo, responder_duelo, get_duelos); aqui ficam os textos e as contas do placar.

export type CategoriaDeDuelo = 'entregas' | 'comentarios' | 'constancia';
export type StatusDeDuelo = 'pendente' | 'ativo' | 'encerrado';

export const CATEGORIAS_DE_DUELO: { chave: CategoriaDeDuelo; rotulo: string; descricao: string }[] = [
  { chave: 'entregas', rotulo: 'Mais entregas', descricao: 'Quem entrega mais cards no período' },
  { chave: 'comentarios', rotulo: 'Mais comentários', descricao: 'Quem comenta mais (15+ caracteres)' },
  { chave: 'constancia', rotulo: 'Mais dias ativos', descricao: 'Quem tem ação em mais dias úteis' },
];

/** Espelha o banco (7 dias a partir do aceite): so o texto da tela. */
export const DURACAO_DO_DUELO_EM_DIAS = 7;

export interface Duelo {
  id: string;
  desafiante_id: string;
  desafiante_nome: string | null;
  desafiante_avatar: string | null;
  desafiado_id: string;
  desafiado_nome: string | null;
  desafiado_avatar: string | null;
  categoria: CategoriaDeDuelo;
  status: StatusDeDuelo;
  criado_em: string;
  aceito_em: string | null;
  fim: string | null;
  valor_desafiante: number | null;
  valor_desafiado: number | null;
  vencedor_id: string | null;
  sou_participante: boolean;
  posso_responder: boolean;
  posso_cancelar: boolean;
}

export function rotuloDaCategoriaDeDuelo(chave: string): string {
  return CATEGORIAS_DE_DUELO.find(c => c.chave === chave)?.rotulo ?? 'Duelo';
}

export interface Placar {
  a: number;
  b: number;
  lider: 'desafiante' | 'desafiado' | 'empate';
  /** Parte do desafiante na barra, de 0 a 100 (50 quando ninguem pontuou). */
  pctA: number;
}

export function placarDoDuelo(d: Pick<Duelo, 'valor_desafiante' | 'valor_desafiado'>): Placar {
  const a = d.valor_desafiante ?? 0;
  const b = d.valor_desafiado ?? 0;
  return { a, b, lider: a > b ? 'desafiante' : b > a ? 'desafiado' : 'empate', pctA: a + b === 0 ? 50 : Math.round((a / (a + b)) * 100) };
}

const diaSP = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Quanto falta para o duelo acabar, em palavras, pelo dia do calendario de Sao Paulo (hoje, amanha, em N dias). */
export function tempoRestanteDoDuelo(fim: string | null, agora: Date = new Date()): string {
  if (!fim) return '';
  const termino = new Date(fim);
  if (termino.getTime() <= agora.getTime()) return 'terminando';
  const dias = Math.round((Date.parse(diaSP(termino)) - Date.parse(diaSP(agora))) / 86_400_000);
  if (dias <= 0) return 'termina hoje';
  return dias === 1 ? 'termina amanhã' : `termina em ${dias} dias`;
}

/** Como o duelo terminou para quem esta olhando. */
export function resultadoParaMim(d: Pick<Duelo, 'vencedor_id' | 'sou_participante'>, meuId?: string): 'venci' | 'perdi' | 'empate' | 'terceiro' {
  if (!d.sou_participante) return 'terceiro';
  if (d.vencedor_id == null) return 'empate';
  return d.vencedor_id === meuId ? 'venci' : 'perdi';
}

const ERROS: Record<string, string> = {
  si_mesmo: 'Escolha um colega, não você.',
  categoria_invalida: 'Escolha uma das categorias.',
  colega_invalido: 'Esse colega não está mais na equipe.',
  voce_ocupado: 'Você já está em um duelo ou com um convite pendente. Termine ou cancele antes de chamar outro.',
  colega_ocupado: 'Esse colega já está em um duelo. Chame outra pessoa.',
  nao_esta_pendente: 'Esse convite já foi respondido.',
};

/** Traduz o erro do banco ("duelo:colega_ocupado") para uma frase; outro erro vira uma mensagem generica. */
export function mensagemDeErroDeDuelo(erro: unknown): string {
  const texto = erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : String(erro ?? '');
  const achado = /duelo:([a-z_]+)/.exec(texto);
  return (achado && ERROS[achado[1]]) || 'Não foi possível concluir. Tente de novo.';
}
