// Leitura do dia (Inicio): transforma os numeros que a tela ja carrega em ate 4 recomendacoes, da mais grave para a mais leve.
// Funcao pura e sem modelo de linguagem: cada frase sai de uma regra com limite explicito, para ser testavel e auditavel.

export type SeveridadeDaLeitura = 'critico' | 'atencao' | 'info' | 'positivo';

export interface EntradaDaLeitura {
  atrasados: number;
  foraDoSla: number;
  /** Atrasado mais antigo, para o primeiro passo concreto. */
  maisAntigoAtrasado: { id: string; titulo: string; dias: number } | null;
  /** Entregas no prazo nos ultimos 30 dias e quantas tinham prazo. */
  noPrazo: number;
  comPrazo: number;
  noPrazoPct: number | null;
  noPrazoAnteriorPct: number | null;
  entregas30: number;
  entregas30Anterior: number;
  /** Pessoas com mais cards abertos que o limite (so para quem enxerga a equipe). */
  cargaAcimaDoLimite: { nome: string; abertos: number }[];
  limiteDeCarga: number;
  /** Cards sem alteracao ha 14 dias ou mais. */
  parados14d: number;
  /** Aprovacoes enviadas ao cliente que ainda nao foram abertas. */
  aprovacoesNaoVistas: number;
}

export interface Leitura {
  chave: string;
  severidade: SeveridadeDaLeitura;
  texto: string;
  /** Passo seguinte: abrir um card ou ir para uma tela. */
  acao?: { rotulo: string; cardId?: string; to?: string };
}

/** Limites das regras, juntos para ficarem faceis de revisar. */
export const REGRAS_DA_LEITURA = {
  amostraMinimaDePrazo: 10,
  noPrazoBaixoAbaixoDe: 50,
  melhoraRelevanteEmPp: 5,
  paradosMinimos: 3,
  crescimentoRelevante: 1.2,
} as const;

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const ORDEM: Record<SeveridadeDaLeitura, number> = { critico: 0, atencao: 1, info: 2, positivo: 3 };

export function gerarLeituraDoDia(e: EntradaDaLeitura): Leitura[] {
  const r: Leitura[] = [];

  if (e.atrasados > 0) {
    const cabeca = `${e.atrasados} ${plural(e.atrasados, 'card está atrasado', 'cards estão atrasados')}.`;
    r.push({
      chave: 'atrasados',
      severidade: 'critico',
      texto: e.maisAntigoAtrasado ? `${cabeca} Comece pelo mais antigo: “${e.maisAntigoAtrasado.titulo}” (${e.maisAntigoAtrasado.dias} ${plural(e.maisAntigoAtrasado.dias, 'dia', 'dias')}).` : cabeca,
      acao: e.maisAntigoAtrasado ? { rotulo: 'Abrir', cardId: e.maisAntigoAtrasado.id } : undefined,
    });
  }

  if (e.noPrazoPct != null && e.comPrazo >= REGRAS_DA_LEITURA.amostraMinimaDePrazo) {
    const antes = e.noPrazoAnteriorPct != null ? ` No período anterior eram ${e.noPrazoAnteriorPct}%.` : '';
    if (e.noPrazoPct < REGRAS_DA_LEITURA.noPrazoBaixoAbaixoDe) {
      r.push({ chave: 'no-prazo', severidade: 'atencao', texto: `Só ${e.noPrazoPct}% das entregas saíram no prazo (${e.noPrazo} de ${e.comPrazo}).${antes}` });
    } else if (e.noPrazoAnteriorPct != null && e.noPrazoPct - e.noPrazoAnteriorPct >= REGRAS_DA_LEITURA.melhoraRelevanteEmPp) {
      r.push({ chave: 'no-prazo', severidade: 'positivo', texto: `Entregas no prazo subiram para ${e.noPrazoPct}% (${e.noPrazo} de ${e.comPrazo}).${antes}` });
    }
  }

  if (e.cargaAcimaDoLimite.length > 0) {
    const lista = e.cargaAcimaDoLimite.slice(0, 3).map(p => `${p.nome} (${p.abertos})`).join(', ');
    const resto = e.cargaAcimaDoLimite.length > 3 ? ` e mais ${e.cargaAcimaDoLimite.length - 3}` : '';
    r.push({
      chave: 'carga',
      severidade: 'atencao',
      texto: `${lista}${resto} ${plural(e.cargaAcimaDoLimite.length, 'está', 'estão')} acima do limite de ${e.limiteDeCarga} cards abertos. Redistribuir pode destravar prazos.`,
      acao: { rotulo: 'Ver carga', to: '/coordination' },
    });
  }

  if (e.foraDoSla > 0) {
    r.push({ chave: 'sla', severidade: 'atencao', texto: `${e.foraDoSla} ${plural(e.foraDoSla, 'card passou', 'cards passaram')} do tempo combinado na etapa.` });
  }

  if (e.aprovacoesNaoVistas > 0) {
    r.push({ chave: 'aprovacoes', severidade: 'info', texto: `${e.aprovacoesNaoVistas} ${plural(e.aprovacoesNaoVistas, 'aprovação enviada ao cliente ainda não foi vista', 'aprovações enviadas ao cliente ainda não foram vistas')}. Vale cobrar.` });
  }

  if (e.parados14d >= REGRAS_DA_LEITURA.paradosMinimos) {
    r.push({ chave: 'parados', severidade: 'info', texto: `${e.parados14d} cards estão sem alteração há 14 dias ou mais. Priorize ou arquive para limpar a fila.` });
  }

  if (e.entregas30Anterior > 0 && e.entregas30 >= e.entregas30Anterior * REGRAS_DA_LEITURA.crescimentoRelevante) {
    const pct = Math.round((e.entregas30 / e.entregas30Anterior - 1) * 100);
    r.push({ chave: 'volume', severidade: 'positivo', texto: `Bom ritmo: ${e.entregas30} entregas em 30 dias, ${pct}% a mais que no período anterior.` });
  }

  if (r.length === 0) {
    r.push({ chave: 'ok', severidade: 'positivo', texto: 'Tudo em ordem: nenhum atraso, nada fora do tempo combinado e a carga está dentro do limite.' });
  }

  return r.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]).slice(0, 4);
}
