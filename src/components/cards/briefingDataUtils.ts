import type { BriefingData } from './BriefingForm';

export const BRIEFING_FIELDS: Array<keyof BriefingData> = [
  'context',
  'target_audience',
  'deliverables',
  'references',
  'deadline_notes',
  'special_instructions',
];

export const createEmptyBriefingData = (): BriefingData => ({
  context: '',
  target_audience: '',
  deliverables: '',
  references: '',
  deadline_notes: '',
  special_instructions: '',
});

const extractTextFromTipTapNode = (node: any): string => {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'mention') return node.attrs?.label || node.attrs?.id || '';
  if (Array.isArray(node.content)) return node.content.map(extractTextFromTipTapNode).join('');
  return '';
};

export const isBriefingValueEmpty = (value: unknown): boolean => {
  if (typeof value !== 'string') return true;
  if (!value.trim() || value === '""') return true;

  try {
    const parsed = JSON.parse(value);
    return !extractTextFromTipTapNode(parsed).trim();
  } catch {
    return !value.trim();
  }
};

export const normalizeBriefingData = (input: unknown): BriefingData => {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Partial<Record<keyof BriefingData, unknown>>
    : {};

  return BRIEFING_FIELDS.reduce((acc, field) => {
    const value = source[field];
    acc[field] = typeof value === 'string' ? value : '';
    return acc;
  }, createEmptyBriefingData());
};

/**
 * Campos exigidos para um briefing contar como completo, e o mínimo de texto
 * puro em cada um. Espelha exatamente o que BriefingDialog já cobra para
 * habilitar o botão "Concluir Briefing" (SECTIONS com required: true).
 */
const REQUIRED_BRIEFING_FIELDS: Array<{ field: keyof BriefingData; minLength: number }> = [
  { field: 'context', minLength: 10 },
  { field: 'deliverables', minLength: 10 },
];

const briefingPlainTextLength = (value: unknown): number => {
  if (typeof value !== 'string' || !value.trim()) return 0;
  try {
    return extractTextFromTipTapNode(JSON.parse(value)).trim().length;
  } catch {
    // Nem todo valor é TipTap: parte da base guarda texto puro. Mesmo fallback
    // do extractPlainText usado pelo editor.
    return value.trim().length;
  }
};

/**
 * O briefing padrão tem conteúdo suficiente para liberar produção?
 *
 * Deriva do conteúdo em vez de olhar `briefing_completed`, porque a flag é
 * gravada por caminhos que nunca inspecionam o que foi escrito (useCards marca
 * true por tipo de card, CreateCardFromIdeaDialog idem). Medido na base: 24
 * cards `full` têm a flag ligada sem context/deliverables mínimos, e 7 têm o
 * conteúdo completo com a flag desligada.
 */
export const isBriefingContentComplete = (briefingData: unknown): boolean => {
  const data = normalizeBriefingData(briefingData);
  return REQUIRED_BRIEFING_FIELDS.every(
    ({ field, minLength }) => briefingPlainTextLength(data[field]) >= minLength
  );
};

/**
 * Cards de tráfego preenchem outro formulário (TrafficBriefingForm), que não
 * tem campo obrigatório declarado. Exigimos objetivo e plataforma, que são o
 * mínimo para alguém subir uma campanha.
 */
export const isTrafficBriefingContentComplete = (trafficBriefingData: unknown): boolean => {
  if (!trafficBriefingData || typeof trafficBriefingData !== 'object' || Array.isArray(trafficBriefingData)) {
    return false;
  }
  const data = trafficBriefingData as Record<string, unknown>;
  return ['objective', 'platform'].every(
    field => typeof data[field] === 'string' && (data[field] as string).trim().length > 0
  );
};

/**
 * Regra única do gate de briefing. Cards `quick` são dispensados por desenho do
 * produto — não é incoerência de dados, é o que useCards sempre fez.
 */
export const isBriefingSatisfied = (card: {
  card_type?: string | null;
  briefing_data?: unknown;
  traffic_briefing_data?: unknown;
}): boolean => {
  if (card.card_type === 'quick') return true;
  return (
    isBriefingContentComplete(card.briefing_data) ||
    isTrafficBriefingContentComplete(card.traffic_briefing_data)
  );
};
