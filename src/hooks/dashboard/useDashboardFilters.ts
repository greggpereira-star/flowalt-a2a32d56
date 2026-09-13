import { useCallback, useMemo, useState } from 'react';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths, differenceInCalendarDays, format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardPeriod, DashboardPeriodId } from '@/lib/dashboard/dashboard-types';

/**
 * Período de análise do Dashboard.
 *
 * O ponto central: este hook devolve DUAS coisas separadas de propósito —
 * `period`, a janela que a pessoa escolheu, e `agora`, o instante real.
 *
 * Métricas de volume (quantos cards, quantas horas) usam `period`. Métricas de
 * pendência (atrasado, vence hoje, próxima reunião) usam `agora` e ignoram o
 * período. Sem essa separação, escolher "mês passado" faria a tela afirmar que
 * existem 8 cards atrasados — pendências de agora exibidas como se fossem
 * daquela época.
 *
 * A janela anterior tem sempre a mesma duração da atual, para o delta comparar
 * períodos equivalentes em vez de uma semana contra um mês.
 */
export function useDashboardFilters(inicial: DashboardPeriodId = 'esta_semana') {
  const [periodId, setPeriodId] = useState<DashboardPeriodId>(inicial);
  const [intervaloCustom, setIntervaloCustom] = useState<{ start: Date; end: Date } | null>(null);
  const [spaceId, setSpaceId] = useState<string | undefined>();

  const period = useMemo<DashboardPeriod>(
    () => montarPeriodo(periodId, intervaloCustom),
    [periodId, intervaloCustom],
  );

  const selecionarPeriodo = useCallback((id: DashboardPeriodId, custom?: { start: Date; end: Date }) => {
    setPeriodId(id);
    if (id === 'personalizado' && custom) setIntervaloCustom(custom);
  }, []);

  return {
    period,
    periodId,
    selecionarPeriodo,
    spaceId,
    setSpaceId,
    /**
     * Instante atual, estável dentro do render.
     *
     * Não é `new Date()` espalhado pelos componentes: dois cálculos no mesmo
     * ciclo poderiam cair em minutos diferentes e um card apareceria atrasado
     * num widget e no prazo em outro.
     */
    agora: useMemo(() => new Date(), [periodId]),
  };
}

function montarPeriodo(
  id: DashboardPeriodId,
  custom: { start: Date; end: Date } | null,
): DashboardPeriod {
  const hoje = new Date();
  const semana = { weekStartsOn: 0 as const, locale: ptBR };

  let start: Date;
  let end: Date;
  let label: string;

  switch (id) {
    case 'hoje':
      start = startOfDay(hoje); end = endOfDay(hoje);
      label = 'Hoje';
      break;
    case 'semana_passada': {
      const ref = subWeeks(hoje, 1);
      start = startOfWeek(ref, semana); end = endOfWeek(ref, semana);
      label = 'Semana passada';
      break;
    }
    case 'ultimos_7_dias':
      start = startOfDay(subDays(hoje, 6)); end = endOfDay(hoje);
      label = 'Últimos 7 dias';
      break;
    case 'este_mes':
      start = startOfMonth(hoje); end = endOfMonth(hoje);
      label = 'Este mês';
      break;
    case 'mes_passado': {
      const ref = subMonths(hoje, 1);
      start = startOfMonth(ref); end = endOfMonth(ref);
      label = 'Mês passado';
      break;
    }
    case 'personalizado':
      start = startOfDay(custom?.start ?? hoje);
      end = endOfDay(custom?.end ?? hoje);
      label = `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM', { locale: ptBR })}`;
      break;
    case 'esta_semana':
    default:
      start = startOfWeek(hoje, semana); end = endOfWeek(hoje, semana);
      label = rotularIntervalo(start, end);
      break;
  }

  // A janela anterior acompanha a duração da atual, senão o delta compararia
  // grandezas diferentes (uma semana contra um mês inteiro, por exemplo).
  const dias = differenceInCalendarDays(end, start) + 1;
  const previousEnd = endOfDay(subDays(start, 1));
  const previousStart = startOfDay(subDays(start, dias));

  return {
    id,
    label,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

/** "19 – 25 de maio", como na referência; encurta quando cruza meses. */
function rotularIntervalo(start: Date, end: Date): string {
  const mesmoMes = start.getMonth() === end.getMonth();
  return mesmoMes
    ? `${format(start, 'd', { locale: ptBR })} – ${format(end, "d 'de' MMMM", { locale: ptBR })}`
    : `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM", { locale: ptBR })}`;
}

export const OPCOES_PERIODO: { id: DashboardPeriodId; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'semana_passada', label: 'Semana passada' },
  { id: 'ultimos_7_dias', label: 'Últimos 7 dias' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
];
