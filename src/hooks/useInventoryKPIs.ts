import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { differenceInDays } from 'date-fns';

export interface InventoryExecKPIs {
  // Assets
  totalAssetValue: number;
  totalBookValue: number;
  monthlyDepreciation: number;
  assetsCount: number;
  
  // Warranties
  warrantiesExpiringSoon: number;
  warrantiesExpired: number;
  warrantyRisk: 'low' | 'medium' | 'high';
  
  // Subscriptions
  monthlySubscriptionCost: number;
  yearlySubscriptionCost: number;
  underutilizedLicenses: number;
  potentialSavings: number;
  subscriptionsExpiringSoon: number;
  
  // Stock
  lowStockItems: number;
  outOfStockItems: number;
  
  // Maintenance
  pendingMaintenance: number;
  maintenanceCostMTD: number;
  
  // Operations
  itemsCheckedOut: number;
  overdueReturns: number;
}

export function useInventoryExecKPIs() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['inventory-exec-kpis', currentWorkspace?.id],
    queryFn: async (): Promise<InventoryExecKPIs> => {
      if (!currentWorkspace?.id) {
        return getEmptyKPIs();
      }

      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Fetch all data in parallel
      const [
        itemsRes,
        unitsRes,
        depreciationRes,
        subscriptionsRes,
        maintenanceRes,
        cardKitsRes,
      ] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('inventory_units')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('depreciation_schedules')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('month_ref', { ascending: false }),
        supabase
          .from('subscription_licenses')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('maintenance_records')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .gte('service_date', startOfMonth.toISOString().split('T')[0]),
        supabase
          .from('card_kits')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .eq('status', 'checked_out'),
      ]);

      const items = itemsRes.data || [];
      const units = unitsRes.data || [];
      const depreciation = depreciationRes.data || [];
      const subscriptions = subscriptionsRes.data || [];
      const maintenance = maintenanceRes.data || [];
      const checkedOutKits = cardKitsRes.data || [];

      // Calculate asset values
      const assets = items.filter(i => i.category === 'asset');
      const totalAssetValue = assets.reduce((acc, a) => acc + (a.purchase_value || 0), 0);
      
      // Get latest depreciation per item
      const latestDepreciation = new Map<string, typeof depreciation[0]>();
      depreciation.forEach(d => {
        if (!latestDepreciation.has(d.item_id)) {
          latestDepreciation.set(d.item_id, d);
        }
      });
      
      let totalBookValue = 0;
      let monthlyDepreciation = 0;
      latestDepreciation.forEach(d => {
        totalBookValue += d.book_value;
        monthlyDepreciation += d.depreciation_amount;
      });

      // Warranties
      const warrantiesExpiringSoon = units.filter(u => {
        if (!u.warranty_end_date) return false;
        const endDate = new Date(u.warranty_end_date);
        return endDate >= today && endDate <= thirtyDaysFromNow;
      }).length;

      const warrantiesExpired = units.filter(u => {
        if (!u.warranty_end_date) return false;
        return new Date(u.warranty_end_date) < today;
      }).length;

      const warrantyRisk: 'low' | 'medium' | 'high' = 
        warrantiesExpiringSoon > 5 || warrantiesExpired > 3 ? 'high' :
        warrantiesExpiringSoon > 2 || warrantiesExpired > 0 ? 'medium' : 'low';

      // Subscriptions
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      
      let monthlySubscriptionCost = 0;
      let yearlySubscriptionCost = 0;
      activeSubscriptions.forEach(s => {
        if (s.billing_cycle === 'monthly') {
          monthlySubscriptionCost += s.cost_per_cycle;
          yearlySubscriptionCost += s.cost_per_cycle * 12;
        } else if (s.billing_cycle === 'yearly') {
          monthlySubscriptionCost += s.cost_per_cycle / 12;
          yearlySubscriptionCost += s.cost_per_cycle;
        }
      });

      const underutilizedLicenses = activeSubscriptions.filter(s => {
        if (!s.seats_total) return false;
        const utilization = (s.seats_used || 0) / s.seats_total;
        return utilization < 0.5;
      }).length;

      // Calculate potential savings from underutilized licenses
      const potentialSavings = activeSubscriptions
        .filter(s => s.seats_total && (s.seats_used || 0) / s.seats_total < 0.5)
        .reduce((acc, s) => acc + (s.cost_per_cycle * 0.3), 0); // Estimate 30% savings

      const subscriptionsExpiringSoon = subscriptions.filter(s => {
        if (s.status !== 'active') return false;
        const renewalDate = new Date(s.renewal_date);
        return renewalDate >= today && renewalDate <= thirtyDaysFromNow;
      }).length;

      // Stock
      const consumables = items.filter(i => i.category === 'consumable');
      const lowStockItems = consumables.filter(i => 
        i.min_stock && i.current_stock < i.min_stock && i.current_stock > 0
      ).length;
      const outOfStockItems = consumables.filter(i => 
        i.min_stock && i.current_stock === 0
      ).length;

      // Maintenance
      const pendingMaintenance = maintenance.filter(m => !m.is_resolved).length;
      const maintenanceCostMTD = maintenance.reduce((acc, m) => acc + (m.cost || 0), 0);

      // Operations
      const itemsCheckedOut = checkedOutKits.length;
      const overdueReturns = checkedOutKits.filter(k => {
        if (!k.expected_return_date) return false;
        return new Date(k.expected_return_date) < today;
      }).length;

      return {
        totalAssetValue,
        totalBookValue,
        monthlyDepreciation,
        assetsCount: assets.length,
        warrantiesExpiringSoon,
        warrantiesExpired,
        warrantyRisk,
        monthlySubscriptionCost,
        yearlySubscriptionCost,
        underutilizedLicenses,
        potentialSavings,
        subscriptionsExpiringSoon,
        lowStockItems,
        outOfStockItems,
        pendingMaintenance,
        maintenanceCostMTD,
        itemsCheckedOut,
        overdueReturns,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function getEmptyKPIs(): InventoryExecKPIs {
  return {
    totalAssetValue: 0,
    totalBookValue: 0,
    monthlyDepreciation: 0,
    assetsCount: 0,
    warrantiesExpiringSoon: 0,
    warrantiesExpired: 0,
    warrantyRisk: 'low',
    monthlySubscriptionCost: 0,
    yearlySubscriptionCost: 0,
    underutilizedLicenses: 0,
    potentialSavings: 0,
    subscriptionsExpiringSoon: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    pendingMaintenance: 0,
    maintenanceCostMTD: 0,
    itemsCheckedOut: 0,
    overdueReturns: 0,
  };
}
