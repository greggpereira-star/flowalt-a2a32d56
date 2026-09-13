import type { ClientFinancialState } from './useClientCards';

// Calculate financial state based on margins and profitability
function calculateFinancialState(
  profitMargin: number,
  expectedMargin: number | null,
  hoursEfficiency: number
): ClientFinancialState {
  const targetMargin = expectedMargin || 30; // Default 30% margin
  
  if (profitMargin >= targetMargin) {
    return 'healthy';
  } else if (profitMargin >= targetMargin * 0.7) {
    return 'attention';
  } else if (profitMargin >= 0) {
    return 'critical';
  }
  return 'loss';
}

// Calculate health score (0-100)
function calculateHealthScore(
  taskCompletionRate: number,
  hoursEfficiency: number,
  profitMargin: number,
  expectedMargin: number | null
): number {
  const targetMargin = expectedMargin || 30;
  
  // Weights for each component
  const taskWeight = 0.25;
  const hoursWeight = 0.25;
  const marginWeight = 0.50;
  
  // Task completion score (0-100)
  const taskScore = Math.min(taskCompletionRate, 100);
  
  // Hours efficiency score (100 = on budget, less is better but cap at 50)
  const hoursScore = hoursEfficiency <= 100 
    ? 100 - Math.abs(100 - hoursEfficiency) * 0.5
    : Math.max(0, 100 - (hoursEfficiency - 100));
  
  // Margin score (based on target margin)
  let marginScore = 0;
  if (profitMargin >= targetMargin) {
    marginScore = 100;
  } else if (profitMargin >= 0) {
    marginScore = (profitMargin / targetMargin) * 100;
  } else {
    marginScore = Math.max(0, 50 + profitMargin); // Negative margins drop score fast
  }
  
  const finalScore = (taskScore * taskWeight) + (hoursScore * hoursWeight) + (marginScore * marginWeight);
  
  return Math.round(Math.min(100, Math.max(0, finalScore)));
}

export interface ComputeClientMetricsInput {
  cards: Array<{ status: string; due_date?: string | null; estimated_hours?: number | null }>;
  timeEntries: Array<{ user_id: string; duration_seconds: number }>;
  transactions: Array<{ type: string; status: string; amount: number | string }>;
  profileRates: Record<string, number>;
  contractValue: number | null;
  expectedMargin: number | null;
}

/**
 * Núcleo de cálculo do relatório do cliente, isolado do acesso a dados.
 *
 * Está separado para que qualquer recálculo fora da tela — backfill de
 * health_score, job, script — use exatamente esta fórmula em vez de uma
 * reescrita equivalente em SQL. É o mesmo motivo pelo qual health_score
 * divergia: quem grava e quem calcula precisam ser o mesmo código.
 */
export const computeClientMetrics = (input: ComputeClientMetricsInput) => {
  const { cards, timeEntries, transactions, profileRates, contractValue, expectedMargin } = input;

  const now = new Date();
  const totalTasks = cards.length;
  const completedTasks = cards.filter(c => c.status === 'delivered').length;
  const inProgressTasks = cards.filter(c => c.status === 'todo' || c.status === 'review').length;
  const overduesTasks = cards.filter(c =>
    c.due_date && new Date(c.due_date) < now && c.status !== 'delivered' && c.status !== 'approved' && c.status !== 'archived'
  ).length;
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalHours = timeEntries.reduce((acc, e) => acc + (e.duration_seconds / 3600), 0);
  const estimatedHours = cards.reduce((acc, c) => acc + (c.estimated_hours || 0), 0);
  const hoursEfficiency = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 100;

  const totalRevenue = transactions
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const laborCost = timeEntries.reduce((acc, e) => {
    const rate = profileRates[e.user_id] || 50;
    return acc + (e.duration_seconds / 3600) * rate;
  }, 0);

  const profit = totalRevenue - totalExpenses - laborCost;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const consumedValue = totalExpenses + laborCost;
  const remainingValue = contractValue ? contractValue - consumedValue : null;

  const financialState = calculateFinancialState(profitMargin, expectedMargin, hoursEfficiency);
  const healthScore = calculateHealthScore(taskCompletionRate, hoursEfficiency, profitMargin, expectedMargin);

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    overduesTasks,
    taskCompletionRate,
    totalHours,
    estimatedHours,
    hoursEfficiency,
    totalRevenue,
    totalExpenses,
    laborCost,
    profit,
    profitMargin,
    contractValue,
    consumedValue,
    remainingValue,
    financialState,
    healthScore,
  };
};
