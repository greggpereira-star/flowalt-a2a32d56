// Sugestão de responsável (Onda 6). Regra explicável, sem IA: quem mais entregou cards neste space nos
// últimos 180 dias e ainda tem fôlego. Só entram membros ativos; quem já está no card ou passou do limite
// de carga fica de fora. Cada sugestão vem com a razão e os números.
import { LIMITE_CARGA } from '@/lib/inteligencia/risco';

// Mínimo de cards entregues no space para a pessoa contar como "experiente" nele.
export const MIN_ENTREGAS = 3;
export const MAX_SUGESTOES = 3;

export interface Candidato {
  user_id: string;
  nome: string;
}

export interface EntregaNoSpace {
  /** responsáveis (card_members) de um card concluído do space */
  members: string[];
}

export interface Sugestao {
  user_id: string;
  nome: string;
  entregas: number;
  abertos: number;
  motivo: string;
  /** true quando não há histórico no space e a sugestão veio só da menor carga */
  semHistorico: boolean;
}

export function sugerirResponsaveis(
  candidatos: Candidato[],
  entregasDoSpace: EntregaNoSpace[],
  abertosPorPessoa: Map<string, number>,
  jaNoCard: string[] = []
): Sugestao[] {
  const entregas = new Map<string, number>();
  entregasDoSpace.forEach(c => new Set(c.members).forEach(id => entregas.set(id, (entregas.get(id) ?? 0) + 1)));

  const disponiveis = candidatos
    .filter(c => !jaNoCard.includes(c.user_id))
    .map(c => ({ ...c, entregas: entregas.get(c.user_id) ?? 0, abertos: abertosPorPessoa.get(c.user_id) ?? 0 }))
    .filter(c => c.abertos <= LIMITE_CARGA);

  const experientes = disponiveis
    .filter(c => c.entregas >= MIN_ENTREGAS)
    // Experiência pesa, mas cada card aberto desconta: 60 entregas com 5 abertos < 40 entregas com 0 abertos.
    .sort((a, b) => b.entregas / (1 + b.abertos) - a.entregas / (1 + a.abertos) || a.nome.localeCompare(b.nome))
    .slice(0, MAX_SUGESTOES)
    .map(c => ({
      user_id: c.user_id,
      nome: c.nome,
      entregas: c.entregas,
      abertos: c.abertos,
      semHistorico: false,
      motivo: `${c.entregas} ${c.entregas === 1 ? 'card entregue' : 'cards entregues'} neste space em 180 dias · ${c.abertos} ${c.abertos === 1 ? 'aberto' : 'abertos'} agora`,
    }));
  if (experientes.length > 0) return experientes;

  // Sem ninguém com histórico no space: oferece a menor carga, dizendo claramente que não há histórico.
  return disponiveis
    .sort((a, b) => a.abertos - b.abertos || a.nome.localeCompare(b.nome))
    .slice(0, 1)
    .map(c => ({
      user_id: c.user_id,
      nome: c.nome,
      entregas: c.entregas,
      abertos: c.abertos,
      semHistorico: true,
      motivo: `sem histórico neste space; menor carga da equipe (${c.abertos} ${c.abertos === 1 ? 'aberto' : 'abertos'})`,
    }));
}
