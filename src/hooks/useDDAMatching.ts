import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface TransactionMatch {
  transaction_id: string;
  description: string;
  amount: number;
  date: string;
  match_score: number;
  match_reasons: string[];
}

export interface DDAMatchResult {
  boleto_id: string;
  matches: TransactionMatch[];
}

// Fetch potential matches for a boleto
export function useDDAMatchSearch(boletoId: string | null, amount: number, dueDate: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dda-matches', boletoId, amount, dueDate],
    queryFn: async (): Promise<TransactionMatch[]> => {
      if (!currentWorkspace?.id || !boletoId) return [];

      // Search for transactions that could match the boleto
      const dueDateObj = new Date(dueDate);
      const startDate = new Date(dueDateObj);
      startDate.setDate(startDate.getDate() - 10);
      const endDate = new Date(dueDateObj);
      endDate.setDate(endDate.getDate() + 10);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, description, amount, due_date, paid_date')
        .eq('workspace_id', currentWorkspace.id)
        .eq('type', 'expense')
        .or(`due_date.gte.${startDate.toISOString().split('T')[0]},paid_date.gte.${startDate.toISOString().split('T')[0]}`)
        .order('due_date', { ascending: false });

      if (error) {
        console.error('Match search error:', error);
        return [];
      }

      // Score and filter matches
      const matches = (transactions || [])
        .map((t) => {
          const transactionDate = t.paid_date || t.due_date;
          const amountDiff = Math.abs(Math.abs(t.amount) - amount);
          const amountPercent = (amountDiff / amount) * 100;
          const dateDiff = transactionDate ? Math.abs(
            new Date(transactionDate).getTime() - dueDateObj.getTime()
          ) / (1000 * 60 * 60 * 24) : 999;

          // Calculate score (0-100)
          let score = 0;
          if (amountPercent <= 1) score += 50;
          else if (amountPercent <= 5) score += 30;
          else if (amountPercent <= 10) score += 10;

          if (dateDiff <= 1) score += 50;
          else if (dateDiff <= 3) score += 30;
          else if (dateDiff <= 7) score += 15;

          return {
            transaction_id: t.id,
            description: t.description || 'Transação',
            amount: Math.abs(t.amount),
            date: transactionDate || t.due_date,
            match_score: score,
            match_reasons: getMatchReasons(t.amount, amount, transactionDate || t.due_date, dueDate),
          };
        })
        .filter((m) => m.match_score >= 30)
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 10);

      return matches;
    },
    enabled: !!currentWorkspace?.id && !!boletoId,
  });
}

// Auto-reconcile boletos with transactions
export function useAutoReconcileDDA() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Get all pending boletos without linked transactions
      const { data: boletos, error: boletosError } = await supabase
        .from('dda_boletos')
        .select('id, valor_original, data_vencimento, cedente_nome')
        .eq('workspace_id', currentWorkspace.id)
        .is('transaction_id', null)
        .is('deleted_at', null)
        .in('status', ['pending', 'scheduled']);

      if (boletosError) throw boletosError;

      let matchedCount = 0;

      // For each boleto, try to find a matching transaction
      for (const boleto of boletos || []) {
        const dueDateObj = new Date(boleto.data_vencimento);
        const startDate = new Date(dueDateObj);
        startDate.setDate(startDate.getDate() - 5);
        const endDate = new Date(dueDateObj);
        endDate.setDate(endDate.getDate() + 5);

        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, amount, due_date, paid_date')
          .eq('workspace_id', currentWorkspace.id)
          .eq('type', 'expense')
          .eq('status', 'paid');

        // Find high-confidence match
        const match = (transactions || []).find((t) => {
          const transactionDate = t.paid_date || t.due_date;
          const amountDiff = Math.abs(Math.abs(t.amount) - boleto.valor_original);
          const amountPercent = (amountDiff / boleto.valor_original) * 100;
          const dateDiff = transactionDate ? Math.abs(
            new Date(transactionDate).getTime() - dueDateObj.getTime()
          ) / (1000 * 60 * 60 * 24) : 999;

          return amountPercent <= 2 && dateDiff <= 5;
        });

        if (match) {
          await supabase
            .from('dda_boletos')
            .update({
              transaction_id: match.id,
              status: 'paid',
              workflow_status: 'paid_reconciled',
              data_pagamento: match.paid_date || match.due_date,
            })
            .eq('id', boleto.id);

          matchedCount++;
        }
      }

      return { matchedCount, totalBoletos: boletos?.length || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      
      if (data.matchedCount > 0) {
        toast.success(`${data.matchedCount} boletos conciliados automaticamente`);
      } else {
        toast.info('Nenhum boleto foi conciliado automaticamente');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro na conciliação automática');
    },
  });
}

// Link boleto to transaction with workflow update
export function useLinkBoletoWithReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      boletoId,
      transactionId,
      paymentDate,
    }: {
      boletoId: string;
      transactionId: string;
      paymentDate?: string;
    }) => {
      const { error } = await supabase
        .from('dda_boletos')
        .update({
          transaction_id: transactionId,
          linked_ap_id: transactionId, // Also link as AP
          status: 'paid',
          workflow_status: 'paid_reconciled',
          data_pagamento: paymentDate || new Date().toISOString().split('T')[0],
        })
        .eq('id', boletoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dda-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['dda-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Boleto conciliado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao conciliar boleto');
    },
  });
}

// Helper function to determine match reasons
function getMatchReasons(
  transactionAmount: number,
  boletoAmount: number,
  transactionDate: string,
  boletoDate: string
): string[] {
  const reasons: string[] = [];
  
  const amountDiff = Math.abs(Math.abs(transactionAmount) - boletoAmount);
  const amountPercent = (amountDiff / boletoAmount) * 100;
  
  if (amountPercent <= 1) {
    reasons.push('Valor exato');
  } else if (amountPercent <= 5) {
    reasons.push('Valor aproximado');
  }
  
  const dateDiff = Math.abs(
    new Date(transactionDate).getTime() - new Date(boletoDate).getTime()
  ) / (1000 * 60 * 60 * 24);
  
  if (dateDiff <= 1) {
    reasons.push('Data próxima ao vencimento');
  } else if (dateDiff <= 5) {
    reasons.push('Data similar');
  }
  
  return reasons;
}
