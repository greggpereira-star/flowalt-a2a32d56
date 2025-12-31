import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";

export interface TaxSettings {
  id: string;
  workspace_id: string;
  tax_regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  
  // Simples Nacional
  simples_anexo: 'anexo_iii' | 'anexo_iv' | 'anexo_v';
  simples_faixa: number;
  simples_aliquota_efetiva: number;
  
  // Lucro Presumido
  lp_presuncao_servicos: number;
  lp_irpj_aliquota: number;
  lp_irpj_adicional: number;
  lp_csll_aliquota: number;
  lp_pis_aliquota: number;
  lp_cofins_aliquota: number;
  
  // Lucro Real
  lr_irpj_aliquota: number;
  lr_irpj_adicional: number;
  lr_csll_aliquota: number;
  lr_pis_aliquota: number;
  lr_cofins_aliquota: number;
  
  // ISS
  iss_aliquota: number;
  iss_retido_na_fonte: boolean;
  
  // Retenções
  retencao_irrf_aliquota: number;
  retencao_pis_aliquota: number;
  retencao_cofins_aliquota: number;
  retencao_csll_aliquota: number;
  retencao_inss_aliquota: number;
  
  effective_from: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxCalculation {
  regime: string;
  gross_revenue: number;
  das: number;
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  total_taxes: number;
  net_revenue: number;
  effective_rate: number;
}

const defaultSettings: Partial<TaxSettings> = {
  tax_regime: 'simples_nacional',
  simples_anexo: 'anexo_iii',
  simples_faixa: 1,
  simples_aliquota_efetiva: 6.00,
  lp_presuncao_servicos: 32.00,
  lp_irpj_aliquota: 15.00,
  lp_irpj_adicional: 10.00,
  lp_csll_aliquota: 9.00,
  lp_pis_aliquota: 0.65,
  lp_cofins_aliquota: 3.00,
  lr_irpj_aliquota: 15.00,
  lr_irpj_adicional: 10.00,
  lr_csll_aliquota: 9.00,
  lr_pis_aliquota: 1.65,
  lr_cofins_aliquota: 7.60,
  iss_aliquota: 5.00,
  iss_retido_na_fonte: false,
  retencao_irrf_aliquota: 1.50,
  retencao_pis_aliquota: 0.65,
  retencao_cofins_aliquota: 3.00,
  retencao_csll_aliquota: 1.00,
  retencao_inss_aliquota: 11.00,
};

export function useTaxSettings() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["tax-settings", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      
      const { data, error } = await supabase
        .from("tax_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .lte("effective_from", new Date().toISOString().split('T')[0])
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as TaxSettings | null;
    },
    enabled: !!workspaceId,
  });
}

export function useTaxSettingsHistory() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["tax-settings-history", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from("tax_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("effective_from", { ascending: false });

      if (error) throw error;
      return data as TaxSettings[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateTaxSettings() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (settings: Partial<TaxSettings>) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      const { data, error } = await supabase
        .from("tax_settings")
        .insert({
          ...defaultSettings,
          ...settings,
          workspace_id: currentWorkspace.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tax-settings-history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["tax-calculation"] });
      toast({ title: "Configuração fiscal salva com sucesso" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao salvar configuração fiscal", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateTaxSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...settings }: Partial<TaxSettings> & { id: string }) => {
      const { data, error } = await supabase
        .from("tax_settings")
        .update(settings)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tax-settings-history"] });
      queryClient.invalidateQueries({ queryKey: ["financial-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["tax-calculation"] });
      toast({ title: "Configuração fiscal atualizada" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao atualizar configuração", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}

export function useCalculateTaxes(grossRevenue: number, referenceDate?: Date) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["tax-calculation", workspaceId, grossRevenue, referenceDate?.toISOString()],
    queryFn: async () => {
      if (!workspaceId || grossRevenue <= 0) return null;

      const { data, error } = await supabase.rpc("calculate_taxes", {
        p_workspace_id: workspaceId,
        p_gross_revenue: grossRevenue,
        p_reference_date: referenceDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      });

      if (error) throw error;
      return data as unknown as TaxCalculation;
    },
    enabled: !!workspaceId && grossRevenue > 0,
  });
}

// Hook para calcular impostos localmente (sem chamada ao banco)
export function useLocalTaxCalculation() {
  const { data: settings } = useTaxSettings();

  const calculateTaxes = (grossRevenue: number): TaxCalculation => {
    if (!settings || grossRevenue <= 0) {
      return {
        regime: 'simples_nacional',
        gross_revenue: grossRevenue,
        das: grossRevenue * 0.06,
        irpj: 0,
        csll: 0,
        pis: 0,
        cofins: 0,
        iss: 0,
        total_taxes: grossRevenue * 0.06,
        net_revenue: grossRevenue * 0.94,
        effective_rate: 6,
      };
    }

    let das = 0, irpj = 0, csll = 0, pis = 0, cofins = 0, iss = 0;

    switch (settings.tax_regime) {
      case 'simples_nacional':
        das = grossRevenue * (settings.simples_aliquota_efetiva / 100);
        break;

      case 'lucro_presumido': {
        const baseCalculo = grossRevenue * (settings.lp_presuncao_servicos / 100);
        irpj = baseCalculo * (settings.lp_irpj_aliquota / 100);
        if (baseCalculo > 20000) {
          irpj += (baseCalculo - 20000) * (settings.lp_irpj_adicional / 100);
        }
        csll = baseCalculo * (settings.lp_csll_aliquota / 100);
        pis = grossRevenue * (settings.lp_pis_aliquota / 100);
        cofins = grossRevenue * (settings.lp_cofins_aliquota / 100);
        iss = grossRevenue * (settings.iss_aliquota / 100);
        break;
      }

      case 'lucro_real':
        irpj = grossRevenue * (settings.lr_irpj_aliquota / 100);
        csll = grossRevenue * (settings.lr_csll_aliquota / 100);
        pis = grossRevenue * (settings.lr_pis_aliquota / 100);
        cofins = grossRevenue * (settings.lr_cofins_aliquota / 100);
        iss = grossRevenue * (settings.iss_aliquota / 100);
        break;
    }

    const totalTaxes = das + irpj + csll + pis + cofins + iss;

    return {
      regime: settings.tax_regime,
      gross_revenue: grossRevenue,
      das,
      irpj,
      csll,
      pis,
      cofins,
      iss,
      total_taxes: totalTaxes,
      net_revenue: grossRevenue - totalTaxes,
      effective_rate: grossRevenue > 0 ? (totalTaxes / grossRevenue) * 100 : 0,
    };
  };

  const calculateRetentions = (grossValue: number) => {
    if (!settings) {
      return { irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, total: 0, netValue: grossValue };
    }

    const irrf = grossValue * (settings.retencao_irrf_aliquota / 100);
    const pis = grossValue * (settings.retencao_pis_aliquota / 100);
    const cofins = grossValue * (settings.retencao_cofins_aliquota / 100);
    const csll = grossValue * (settings.retencao_csll_aliquota / 100);
    const inss = grossValue * (settings.retencao_inss_aliquota / 100);
    const total = irrf + pis + cofins + csll + inss;

    return { irrf, pis, cofins, csll, inss, total, netValue: grossValue - total };
  };

  return { calculateTaxes, calculateRetentions, settings };
}
