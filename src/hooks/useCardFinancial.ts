import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// Hook to get financial data linked to a card
export function useCardFinancialData(cardId: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["card-financial", cardId],
    queryFn: async () => {
      if (!cardId || !currentWorkspace?.id) return null;

      // Get transactions linked to this card
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*, category:financial_categories(*)")
        .eq("workspace_id", currentWorkspace.id)
        .eq("card_id", cardId);

      // Get invoices linked to this card
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("card_id", cardId);

      // Get time entries for cost calculation
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("*")
        .eq("card_id", cardId);

      // Get profiles with hourly_rate for labor cost calculation
      const userIds = [...new Set(timeEntries?.map(e => e.user_id) || [])];
      let profileRates: Record<string, number> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, hourly_rate")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          profileRates[p.id] = p.hourly_rate || 50; // Fallback to 50 if not set
        });
      }

      const totalIncome = transactions
        ?.filter(t => t.type === "income" && t.status === "paid")
        .reduce((acc, t) => acc + Number(t.amount), 0) || 0;

      const totalExpenses = transactions
        ?.filter(t => t.type === "expense" && t.status === "paid")
        .reduce((acc, t) => acc + Number(t.amount), 0) || 0;

      const totalHours = timeEntries?.reduce((acc, e) => acc + (e.duration_seconds / 3600), 0) || 0;

      // Calculate labor cost using actual hourly rates from profiles
      const laborCost = timeEntries?.reduce((acc, e) => {
        const rate = profileRates[e.user_id] || 50;
        return acc + (e.duration_seconds / 3600) * rate;
      }, 0) || 0;

      const invoiceTotal = invoices?.reduce((acc, inv) => acc + Number(inv.gross_amount), 0) || 0;

      const profit = totalIncome - totalExpenses - laborCost;
      const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

      return {
        transactions: transactions || [],
        invoices: invoices || [],
        timeEntries: timeEntries || [],
        summary: {
          totalIncome,
          totalExpenses,
          totalHours,
          laborCost,
          invoiceTotal,
          profit,
          profitMargin,
        },
      };
    },
    enabled: !!cardId && !!currentWorkspace?.id,
  });
}

// Hook to get project profitability overview
export function useProjectProfitability() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["project-profitability", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get all cards with client info
      const { data: cards } = await supabase
        .from("cards")
        .select("id, title, client_id, status, clients(*)")
        .eq("workspace_id", currentWorkspace.id)
        .not("status", "eq", "archived");

      if (!cards) return [];

      // Get all transactions
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .not("card_id", "is", null);

      // Get all time entries
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("*")
        .eq("workspace_id", currentWorkspace.id);

      // Get all profiles with hourly rates
      const userIds = [...new Set(timeEntries?.map(e => e.user_id) || [])];
      let profileRates: Record<string, number> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, hourly_rate")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          profileRates[p.id] = p.hourly_rate || 50;
        });
      }

      // Calculate profitability per card
      const profitabilityData = cards.map(card => {
        const cardTransactions = transactions?.filter(t => t.card_id === card.id) || [];
        const cardTimeEntries = timeEntries?.filter(e => e.card_id === card.id) || [];

        const income = cardTransactions
          .filter(t => t.type === "income" && t.status === "paid")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const expenses = cardTransactions
          .filter(t => t.type === "expense" && t.status === "paid")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const hours = cardTimeEntries.reduce((acc, e) => acc + (e.duration_seconds / 3600), 0);

        const laborCost = cardTimeEntries.reduce((acc, e) => {
          const rate = profileRates[e.user_id] || 50;
          return acc + (e.duration_seconds / 3600) * rate;
        }, 0);

        const profit = income - expenses - laborCost;
        const profitMargin = income > 0 ? (profit / income) * 100 : 0;

        return {
          id: card.id,
          title: card.title,
          clientName: (card.clients as any)?.name || "Sem cliente",
          status: card.status,
          income,
          expenses,
          laborCost,
          hours,
          profit,
          profitMargin,
        };
      });

      // Sort by income (highest first)
      return profitabilityData.sort((a, b) => b.income - a.income);
    },
    enabled: !!currentWorkspace?.id,
  });
}

// Hook to get client profitability
export function useClientProfitability() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["client-profitability", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      const { data: transactions } = await supabase
        .from("transactions")
        .select("*, cards(client_id)")
        .eq("workspace_id", currentWorkspace.id);

      const { data: cards } = await supabase
        .from("cards")
        .select("id, client_id")
        .eq("workspace_id", currentWorkspace.id);

      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("*")
        .eq("workspace_id", currentWorkspace.id);

      if (!clients) return [];

      // Get all profiles with hourly rates
      const userIds = [...new Set(timeEntries?.map(e => e.user_id) || [])];
      let profileRates: Record<string, number> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, hourly_rate")
          .in("id", userIds);
        
        profiles?.forEach(p => {
          profileRates[p.id] = p.hourly_rate || 50;
        });
      }

      return clients.map(client => {
        const clientCards = cards?.filter(c => c.client_id === client.id) || [];
        const clientCardIds = clientCards.map(c => c.id);

        const clientTransactions = transactions?.filter(t => 
          clientCardIds.includes(t.card_id || "")
        ) || [];

        const clientTimeEntries = timeEntries?.filter(e => 
          clientCardIds.includes(e.card_id)
        ) || [];

        const income = clientTransactions
          .filter(t => t.type === "income" && t.status === "paid")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const expenses = clientTransactions
          .filter(t => t.type === "expense" && t.status === "paid")
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const hours = clientTimeEntries.reduce((acc, e) => acc + (e.duration_seconds / 3600), 0);

        const laborCost = clientTimeEntries.reduce((acc, e) => {
          const rate = profileRates[e.user_id] || 50;
          return acc + (e.duration_seconds / 3600) * rate;
        }, 0);

        const profit = income - expenses - laborCost;
        const profitMargin = income > 0 ? (profit / income) * 100 : 0;

        return {
          id: client.id,
          name: client.name,
          color: client.color,
          projectCount: clientCards.length,
          income,
          expenses,
          laborCost,
          hours,
          profit,
          profitMargin,
        };
      }).sort((a, b) => b.income - a.income);
    },
    enabled: !!currentWorkspace?.id,
  });
}
