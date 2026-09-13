import {
  Clapperboard,
  Flag,
  CalendarClock,
  Users,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

/** Espelha o enum `event_type` do banco. */
export type EventType = 'meeting' | 'recording' | 'milestone' | 'deadline' | 'other';

export interface EventTypeStyle {
  label: string;
  icon: LucideIcon;
  /** Barra lateral e ponto — o sinal de cor mais forte. */
  accent: string;
  /** Fundo suave do selo. */
  chip: string;
  /** Fundo bem leve do card, quando destacado. */
  surface: string;
  /**
   * Card inteiro pintado: fundo, texto e borda.
   *
   * Na grade do mês o card fica sobre a célula do dia, que já tem fundo próprio
   * quando o dia está ativo. Por isso o tom aqui é sólido (100/200) e não
   * translúcido: sobre o azul da célula um /40 sumiria.
   */
  tile: string;
}

/**
 * Cor e ícone são derivados do TIPO do evento, nunca escolhidos por evento.
 *
 * A coluna `events.color` existe e está nula em todos os 84 eventos — ninguém
 * nunca escolheu cor à mão. Isso é bom: se cada pessoa pudesse pintar o próprio
 * compromisso, a cor deixaria de significar algo e viraria enfeite. Aqui ela é
 * consequência do que o evento É, então bate o olho e se reconhece.
 *
 * ── Por que estes quatro matizes ─────────────────────────────────────────────
 *
 * Os quatro tipos cromáticos ficam espaçados no círculo de cor de propósito:
 *
 *     Reunião   azul     ~220°
 *     Gravação  fúcsia   ~292°   (72° do azul)
 *     Prazo     âmbar    ~40°    (108° do fúcsia)
 *     Marco     verde    ~150°   (110° do âmbar, 70° do azul)
 *
 * A primeira versão usava violeta para Gravação, a 50° do azul de Reunião. Num
 * card de 10px de altura os dois viravam a mesma cor lavada — e justamente
 * esses dois são os tipos dominantes da agenda (Reunião e Gravação somam a
 * maioria dos eventos), então eles aparecem lado a lado o tempo todo. Fúcsia
 * abre essa distância para 72°, que é o máximo possível com quatro matizes.
 *
 * Fúcsia (~292°) fica a ~38° do rosa usado em aniversário. É a menor folga da
 * paleta e foi uma escolha consciente: aniversário é raro, carrega ícone de
 * bolo e usa fundo bem mais lavado (/10), enquanto o par Reunião × Gravação
 * disputa espaço na mesma célula todo dia. Onde havia conflito inevitável,
 * preferi gastá-lo no caso raro.
 *
 * Âmbar continua em Prazo por significado, não só por distância: amarelo lê
 * como atenção sem gritar "erro", que é exatamente o tom de um prazo. Vermelho
 * teria dado uma separação um pouco melhor, mas ficaria a 30° do rosa de
 * aniversário e faria todo prazo parecer uma falha.
 *
 * "Outro" fica cinza de propósito: é a categoria sem identidade, e dar um
 * matiz a ela roubaria distinção dos quatro que significam alguma coisa.
 *
 * O ícone não é decoração: cor sozinha não pode ser o único indicador de
 * categoria — quem não distingue matiz precisa do símbolo para ler a agenda, e
 * mesmo quem distingue lê mais rápido o símbolo num bloco pequeno.
 */
export const EVENT_TYPE_STYLES: Record<EventType, EventTypeStyle> = {
  meeting: {
    label: 'Reunião',
    icon: Users,
    accent: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700',
    surface: 'bg-blue-50/40',
    tile: 'bg-blue-100 text-blue-950 border-blue-300 hover:bg-blue-200/80 dark:bg-blue-950/70 dark:text-blue-50 dark:border-blue-800',
  },
  recording: {
    label: 'Gravação',
    icon: Clapperboard,
    accent: 'bg-fuchsia-500',
    chip: 'bg-fuchsia-50 text-fuchsia-700',
    surface: 'bg-fuchsia-50/40',
    tile: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 hover:bg-fuchsia-200/80 dark:bg-fuchsia-950/70 dark:text-fuchsia-50 dark:border-fuchsia-800',
  },
  deadline: {
    label: 'Prazo',
    icon: CalendarClock,
    accent: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700',
    surface: 'bg-amber-50/40',
    tile: 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200/80 dark:bg-amber-950/70 dark:text-amber-50 dark:border-amber-800',
  },
  milestone: {
    label: 'Marco',
    icon: Flag,
    accent: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700',
    surface: 'bg-emerald-50/40',
    tile: 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-50 dark:border-emerald-800',
  },
  other: {
    label: 'Outro',
    icon: CircleDot,
    accent: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600',
    surface: 'bg-slate-50',
    tile: 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200/80 dark:bg-slate-800/70 dark:text-slate-50 dark:border-slate-600',
  },
};

export function getEventTypeStyle(type: string | null | undefined): EventTypeStyle {
  if (type && type in EVENT_TYPE_STYLES) {
    return EVENT_TYPE_STYLES[type as EventType];
  }
  return EVENT_TYPE_STYLES.other;
}

/** Ordem da legenda: os dois tipos mais usados primeiro (40 e 35 eventos). */
export const EVENT_TYPE_ORDER: EventType[] = [
  'meeting',
  'recording',
  'deadline',
  'milestone',
  'other',
];
