export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;
  collapsed?: boolean;
  icon?: string;
}

export interface BranchPalette {
  bg: string;
  line: string;
  text: string;
}

export const BRANCH_PALETTES: BranchPalette[] = [
  { bg: '#f59e0b', line: '#f59e0b', text: '#92400e' }, // amber / Audience
  { bg: '#3b82f6', line: '#3b82f6', text: '#1e40af' }, // blue / Messaging
  { bg: '#8b5cf6', line: '#8b5cf6', text: '#5b21b6' }, // purple / Timeline
  { bg: '#ec4899', line: '#ec4899', text: '#9d174d' }, // pink / Budget
  { bg: '#f97316', line: '#f97316', text: '#c2410c' }, // orange / Channels
  { bg: '#06b6d4', line: '#06b6d4', text: '#0e7490' }, // teal / KPIs
  { bg: '#22c55e', line: '#22c55e', text: '#15803d' }, // green
  { bg: '#ef4444', line: '#ef4444', text: '#b91c1c' }, // red
];

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const DEFAULT_ROOT_NODE: MindMapNode = {
  id: 'root',
  text: 'Ideia Central',
  x: 0,
  y: 0,
  parentId: null,
  color: '#1e293b',
};
