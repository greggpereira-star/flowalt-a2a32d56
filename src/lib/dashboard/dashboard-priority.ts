import type {
  DashboardAgendaEvent,
  DashboardDelivery,
  OperationalAlert,
  OverdueCard,
} from '@/lib/dashboard/dashboard-types';

/** Máximo de alertas exibidos. Acima disso vira ruído e ninguém lê nenhum. */
const LIMITE_ALERTAS = 3;

/** Um card conta como "crítico" depois de tantos dias vencido. */
const DIAS_PARA_CRITICO = 3;

/** Uma entrega é "iminente" dentro desta janela. */
const HORAS_ENTREGA_IMINENTE = 2;

/** Uma reunião é "já já" dentro desta janela. */
const MINUTOS_REUNIAO_PROXIMA = 30;

/** Aprovação parada mais que isto vira pendência. */
const HORAS_APROVACAO_PARADA = 24;

interface EntradaPrioridade {
  overdueCards: OverdueCard[];
  upcomingDeliveries: DashboardDelivery[];
  nextEvent?: DashboardAgendaEvent;
  pendingApprovals: number;
  approvalOldestHours?: number;
  agora: Date;
}

/**
 * A frase única que o topo do Dashboard mostra.
 *
 * Existe uma escolha de produto aqui: mostrar UMA coisa, não uma lista. Quem
 * abre o Dashboard de manhã precisa saber onde colocar a próxima hora, e cinco
 * avisos empatados não respondem isso. A ordem abaixo é a ordem em que um
 * coordenador realmente age — o que já falhou vem antes do que está prestes a
 * falhar, que vem antes do que só precisa de acompanhamento.
 *
 * Quando não há nada crítico, a mensagem afirma isso. "Nenhuma pendência" é
 * informação, não ausência de informação: evita a leitura de que o painel
 * quebrou ou não carregou.
 */
export type TemaPrioridade = 'atrasos' | 'entregas' | 'reuniao' | 'aprovacoes' | null;

/** Tema da prioridade escolhida, para os alertas não repetirem o assunto. */
export function temaDaPrioridade(alerta: OperationalAlert): TemaPrioridade {
  if (alerta.id.includes('criticos') || alerta.id.includes('atrasados')) return 'atrasos';
  if (alerta.id.includes('entrega')) return 'entregas';
  if (alerta.id.includes('reuniao')) return 'reuniao';
  if (alerta.id.includes('aprovacao')) return 'aprovacoes';
  return null;
}

export function selecionarPrioridadeDoDia(entrada: EntradaPrioridade): OperationalAlert {
  const { overdueCards, upcomingDeliveries, nextEvent, pendingApprovals, agora } = entrada;

  const criticos = overdueCards.filter(c => c.overdueDays >= DIAS_PARA_CRITICO);
  if (criticos.length > 0) {
    const pior = criticos[0];
    return {
      id: 'prioridade-criticos',
      severity: 'critical',
      title: 'Priorize o que importa',
      description:
        criticos.length === 1
          ? `"${pior.title}" está atrasado há ${pior.overdueDays} dias.`
          : `${criticos.length} cards atrasados há mais de ${DIAS_PARA_CRITICO} dias precisam de sua atenção.`,
      count: criticos.length,
      route: '/tasks?filter=overdue',
      actionLabel: 'Ver atrasados',
    };
  }

  const iminentes = upcomingDeliveries.filter(d => {
    const diff = (new Date(d.dueDate).getTime() - agora.getTime()) / 36e5;
    return diff >= 0 && diff <= HORAS_ENTREGA_IMINENTE;
  });
  if (iminentes.length > 0) {
    return {
      id: 'prioridade-entrega-iminente',
      severity: 'warning',
      title: 'Entrega chegando',
      description:
        iminentes.length === 1
          ? `"${iminentes[0].title}" vence nas próximas ${HORAS_ENTREGA_IMINENTE} horas.`
          : `${iminentes.length} entregas vencem nas próximas ${HORAS_ENTREGA_IMINENTE} horas.`,
      count: iminentes.length,
      route: '/tasks?filter=due-soon',
      actionLabel: 'Ver entregas',
    };
  }

  if (nextEvent) {
    const minutos = (new Date(nextEvent.startTime).getTime() - agora.getTime()) / 6e4;
    if (minutos >= 0 && minutos <= MINUTOS_REUNIAO_PROXIMA) {
      return {
        id: 'prioridade-reuniao',
        severity: 'info',
        title: 'Compromisso começando',
        description: `${nextEvent.title} começa em ${Math.round(minutos)} min.`,
        route: '/calendar',
        actionLabel: 'Ver agenda',
      };
    }
  }

  if (pendingApprovals > 0 && (entrada.approvalOldestHours ?? 0) >= HORAS_APROVACAO_PARADA) {
    return {
      id: 'prioridade-aprovacao',
      severity: 'warning',
      title: 'Aprovação parada',
      description: `${pendingApprovals} ${pendingApprovals === 1 ? 'item aguarda' : 'itens aguardam'} sua revisão há mais de 24h.`,
      count: pendingApprovals,
      route: '/approvals',
      actionLabel: 'Revisar',
    };
  }

  if (overdueCards.length > 0) {
    return {
      id: 'prioridade-atrasados',
      severity: 'warning',
      title: 'Priorize o que importa',
      description: `${overdueCards.length} ${overdueCards.length === 1 ? 'card atrasado precisa' : 'cards atrasados precisam'} de sua atenção.`,
      count: overdueCards.length,
      route: '/tasks?filter=overdue',
      actionLabel: 'Ver atrasados',
    };
  }

  return {
    id: 'prioridade-ok',
    severity: 'success',
    title: 'Tudo sob controle',
    description: 'Nenhuma demanda crítica atrasada neste momento.',
  };
}

interface EntradaAlertas {
  /**
   * Tema que a prioridade do dia já ocupou.
   *
   * Sem isto, atraso virava a prioridade E o primeiro alerta E o rodapé do
   * KPI — três frases sobre o mesmo fato na mesma tela. Repetir não aumenta a
   * urgência; só empurra para baixo aquilo que ainda não foi dito.
   */
  temaJaCoberto?: 'atrasos' | 'entregas' | 'reuniao' | 'aprovacoes' | null;
  overdueCards: OverdueCard[];
  dueTodayCount: number;
  pendingApprovals: number;
  bottleneckTopSpace?: { spaceName: string; overdueCards: number; overdueRate: number };
  agora: Date;
}

/**
 * Alertas do painel, no máximo três.
 *
 * O corte em três é deliberado: uma lista que cresce sem limite deixa de ser
 * alerta e vira relatório, e a pessoa passa a ignorar o bloco inteiro. Os
 * candidatos são ordenados por severidade e os excedentes ficam para a tela de
 * alertas, alcançável pelo "Ver todos".
 */
export function gerarAlertasOperacionais(entrada: EntradaAlertas): OperationalAlert[] {
  const { overdueCards, dueTodayCount, pendingApprovals, bottleneckTopSpace, temaJaCoberto } = entrada;
  const candidatos: OperationalAlert[] = [];

  if (dueTodayCount > 0) {
    candidatos.push({
      id: 'alerta-vence-hoje',
      severity: 'warning',
      title: `${dueTodayCount} ${dueTodayCount === 1 ? 'card vence' : 'cards vencem'} hoje`,
      description: 'Requerem sua atenção',
      count: dueTodayCount,
      route: '/tasks?filter=due-today',
    });
  }

  const criticos = overdueCards.filter(c => c.overdueDays >= DIAS_PARA_CRITICO);
  if (criticos.length > 0 && temaJaCoberto !== 'atrasos') {
    candidatos.push({
      id: 'alerta-criticos',
      severity: 'critical',
      title: `${criticos.length} ${criticos.length === 1 ? 'card crítico' : 'cards críticos'}`,
      description: `Atrasados há mais de ${DIAS_PARA_CRITICO} dias`,
      count: criticos.length,
      route: '/tasks?filter=overdue',
    });
  }

  if (pendingApprovals > 0 && temaJaCoberto !== 'aprovacoes') {
    candidatos.push({
      id: 'alerta-aprovacoes',
      severity: 'info',
      title: `${pendingApprovals} ${pendingApprovals === 1 ? 'aprovação pendente' : 'aprovações pendentes'}`,
      description: 'Aguardando sua revisão',
      count: pendingApprovals,
      route: '/approvals',
    });
  }

  // Só vira alerta quando a concentração é desproporcional; um espaço grande
  // naturalmente acumula mais atrasos e apontá-lo seria punir volume.
  if (bottleneckTopSpace && bottleneckTopSpace.overdueRate >= 0.25 && bottleneckTopSpace.overdueCards >= 3) {
    candidatos.push({
      id: 'alerta-gargalo',
      severity: 'warning',
      title: `${bottleneckTopSpace.spaceName} concentra atrasos`,
      description: `${Math.round(bottleneckTopSpace.overdueRate * 100)}% dos cards abertos estão atrasados`,
      count: bottleneckTopSpace.overdueCards,
      route: '/coordination',
    });
  }

  if (candidatos.length === 0) {
    return [
      {
        id: 'alerta-ok',
        severity: 'success',
        title: 'Nada além do já sinalizado',
        description: 'Nenhum outro ponto exige ação agora.',
      },
    ];
  }

  const peso: Record<OperationalAlert['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return candidatos.sort((a, b) => peso[a.severity] - peso[b.severity]).slice(0, LIMITE_ALERTAS);
}

/**
 * Peso de um card atrasado na fila de atenção.
 *
 * Ordenar só por data trata igual um card de 2 dias de um cliente em risco e um
 * de 2 dias sem urgência. Aqui o tempo de atraso continua sendo o fator
 * dominante, mas urgência e bloqueio conseguem trazer um card recente para
 * cima — que é como uma coordenação decide na prática.
 */
export function calcularScoreAtraso(card: {
  overdueDays: number;
  urgency?: string | null;
  isBlocked?: boolean;
  clientAtRisk?: boolean;
}): number {
  const pesoUrgencia: Record<string, number> = {
    critical: 40,
    high: 25,
    medium: 10,
    low: 0,
  };

  return (
    card.overdueDays * 10 +
    (pesoUrgencia[card.urgency ?? 'low'] ?? 0) +
    (card.clientAtRisk ? 20 : 0) +
    (card.isBlocked ? 15 : 0)
  );
}
