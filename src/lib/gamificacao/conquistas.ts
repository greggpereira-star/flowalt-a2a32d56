// Trilhas de conquista com niveis (gamificacao, Onda 2): regras puras, sem rede nem React, para poderem ser testadas.
// O banco calcula o valor e o nivel de cada trilha e devolve os limites (get_conquistas_niveis); aqui ficam so os textos e as contas de progresso.

export type ChaveDaTrilha = 'entregador' | 'pontual' | 'voz' | 'constante' | 'dia_completo' | 'missoes' | 'campeao';

export const TRILHAS: { chave: ChaveDaTrilha; nome: string; descricao: string; unidade: string }[] = [
  { chave: 'entregador', nome: 'Entregador', descricao: 'Cards entregues como responsável', unidade: 'entregas' },
  { chave: 'pontual', nome: 'Pontual', descricao: 'Cards entregues dentro do prazo', unidade: 'no prazo' },
  { chave: 'voz', nome: 'Voz do time', descricao: 'Comentários nos cards', unidade: 'comentários' },
  { chave: 'constante', nome: 'Constante', descricao: 'Dias úteis com alguma ação', unidade: 'dias' },
  { chave: 'dia_completo', nome: 'Dia completo', descricao: 'Dias em que fez as 3 missões diárias', unidade: 'dias' },
  { chave: 'missoes', nome: 'Caçador de missões', descricao: 'Missões da semana em que pontuou', unidade: 'missões' },
  { chave: 'campeao', nome: 'Campeão', descricao: 'Temporadas mensais vencidas', unidade: 'títulos' },
];

export const NOMES_DOS_NIVEIS = ['Bronze', 'Prata', 'Ouro'] as const;

export interface LinhaDeConquista {
  user_id: string;
  trilha: ChaveDaTrilha;
  valor: number;
  nivel: number;
  limites: number[];
  conquistado_em: string | null;
}

export function nomeDoNivel(nivel: number): string {
  return nivel >= 1 && nivel <= 3 ? NOMES_DOS_NIVEIS[nivel - 1] : 'Sem nível';
}

export interface Progresso {
  nivel: number;
  /** Valor do proximo nivel, ou null no ouro. */
  proximoAlvo: number | null;
  /** Quanto falta para o proximo nivel (0 no ouro). */
  falta: number;
  /** Avanco dentro do degrau atual, de 0 a 100 (100 no ouro). */
  pct: number;
}

/** Nivel e avanco ate o proximo limite. `limites` sao os valores de bronze, prata e ouro. */
export function progressoDaTrilha(valor: number, limites: number[]): Progresso {
  const nivel = limites.filter(l => valor >= l).length;
  if (nivel >= limites.length) return { nivel, proximoAlvo: null, falta: 0, pct: 100 };
  const base = nivel > 0 ? limites[nivel - 1] : 0;
  const alvo = limites[nivel];
  return { nivel, proximoAlvo: alvo, falta: alvo - valor, pct: Math.max(0, Math.min(100, Math.round(((valor - base) / (alvo - base)) * 100))) };
}

/** Quantas trilhas do time estao no melhor nivel de bronze, prata e ouro (cada pessoa conta uma vez por trilha). */
export function resumoDoTime(linhas: LinhaDeConquista[]): { bronze: number; prata: number; ouro: number } {
  return {
    bronze: linhas.filter(l => l.nivel === 1).length,
    prata: linhas.filter(l => l.nivel === 2).length,
    ouro: linhas.filter(l => l.nivel === 3).length,
  };
}

/** Quem lidera uma trilha (maior valor; empate fica com quem aparece primeiro). Null se ninguem pontuou. */
export function liderDaTrilha(linhas: LinhaDeConquista[], trilha: ChaveDaTrilha): { user_id: string; valor: number } | null {
  const melhor = linhas.filter(l => l.trilha === trilha && l.valor > 0).sort((a, b) => b.valor - a.valor)[0];
  return melhor ? { user_id: melhor.user_id, valor: melhor.valor } : null;
}
