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

export const mergeBriefingDataPreservingFilled = (
  previous: unknown,
  incoming: unknown,
): BriefingData => {
  const prev = normalizeBriefingData(previous);
  const next = normalizeBriefingData(incoming);

  return BRIEFING_FIELDS.reduce((acc, field) => {
    const incomingValue = next[field];
    const previousValue = prev[field];

    acc[field] = isBriefingValueEmpty(incomingValue) && !isBriefingValueEmpty(previousValue)
      ? previousValue
      : incomingValue;

    return acc;
  }, createEmptyBriefingData());
};