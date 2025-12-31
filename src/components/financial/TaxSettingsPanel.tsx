import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Building2, 
  Calculator, 
  Calendar, 
  Check, 
  ChevronDown, 
  History, 
  Info, 
  Percent, 
  Save,
  Settings2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useTaxSettings, 
  useTaxSettingsHistory, 
  useCreateTaxSettings, 
  useUpdateTaxSettings,
  TaxSettings 
} from "@/hooks/useTaxSettings";

const regimeLabels: Record<string, { label: string; description: string; color: string }> = {
  simples_nacional: {
    label: "Simples Nacional",
    description: "Regime unificado de arrecadação para ME e EPP",
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
  lucro_presumido: {
    label: "Lucro Presumido",
    description: "Tributação com base em percentual de presunção",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  lucro_real: {
    label: "Lucro Real",
    description: "Tributação sobre o lucro contábil ajustado",
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
  },
};

const anexoLabels: Record<string, string> = {
  anexo_iii: "Anexo III - Serviços (locação, academias, etc.)",
  anexo_iv: "Anexo IV - Serviços (limpeza, vigilância, etc.)",
  anexo_v: "Anexo V - Serviços intelectuais (TI, marketing, etc.)",
};

const faixaSimples: Record<number, { limite: string; aliquota: string }> = {
  1: { limite: "Até R$ 180.000,00", aliquota: "6,00%" },
  2: { limite: "De R$ 180.000,01 a R$ 360.000,00", aliquota: "11,20%" },
  3: { limite: "De R$ 360.000,01 a R$ 720.000,00", aliquota: "13,50%" },
  4: { limite: "De R$ 720.000,01 a R$ 1.800.000,00", aliquota: "16,00%" },
  5: { limite: "De R$ 1.800.000,01 a R$ 3.600.000,00", aliquota: "21,00%" },
  6: { limite: "De R$ 3.600.000,01 a R$ 4.800.000,00", aliquota: "33,00%" },
};

export function TaxSettingsPanel() {
  const { data: currentSettings, isLoading } = useTaxSettings();
  const { data: history } = useTaxSettingsHistory();
  const createSettings = useCreateTaxSettings();
  const updateSettings = useUpdateTaxSettings();

  const [formData, setFormData] = useState<Partial<TaxSettings>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  // Merge current settings with form data
  const settings = { ...currentSettings, ...formData };
  const selectedRegime = settings.tax_regime || 'simples_nacional';

  const handleChange = (field: keyof TaxSettings, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (currentSettings?.id) {
      // Se mudou o regime ou a data, criar novo registro
      if (formData.tax_regime !== currentSettings.tax_regime || effectiveFrom !== currentSettings.effective_from) {
        await createSettings.mutateAsync({
          ...currentSettings,
          ...formData,
          effective_from: effectiveFrom,
        });
      } else {
        await updateSettings.mutateAsync({ id: currentSettings.id, ...formData });
      }
    } else {
      await createSettings.mutateAsync({
        ...formData,
        effective_from: effectiveFrom,
      });
    }
    setFormData({});
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Status Atual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Configuração Fiscal</CardTitle>
                <CardDescription>
                  Configure o regime tributário e alíquotas para cálculo automático
                </CardDescription>
              </div>
            </div>
            {currentSettings && (
              <Badge variant="outline" className={regimeLabels[currentSettings.tax_regime]?.color}>
                {regimeLabels[currentSettings.tax_regime]?.label}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Seleção de Regime */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Regime Tributário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(regimeLabels).map(([key, { label, description, color }]) => (
              <button
                key={key}
                onClick={() => handleChange('tax_regime', key as TaxSettings['tax_regime'])}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedRegime === key 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{label}</span>
                  {selectedRegime === key && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>

          {/* Data de Vigência */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label>Vigente a partir de:</Label>
            </div>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-auto"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Altere a data para programar mudanças futuras de regime</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Configurações por Regime */}
      <Tabs value={selectedRegime} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simples_nacional" disabled={selectedRegime !== 'simples_nacional'}>
            Simples Nacional
          </TabsTrigger>
          <TabsTrigger value="lucro_presumido" disabled={selectedRegime !== 'lucro_presumido'}>
            Lucro Presumido
          </TabsTrigger>
          <TabsTrigger value="lucro_real" disabled={selectedRegime !== 'lucro_real'}>
            Lucro Real
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simples_nacional">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuração do Simples Nacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Anexo</Label>
                  <Select
                    value={settings.simples_anexo || 'anexo_v'}
                    onValueChange={(v) => handleChange('simples_anexo', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(anexoLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Agências de marketing geralmente se enquadram no Anexo V
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Faixa de Faturamento (últimos 12 meses)</Label>
                  <Select
                    value={String(settings.simples_faixa || 1)}
                    onValueChange={(v) => handleChange('simples_faixa', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(faixaSimples).map(([key, { limite, aliquota }]) => (
                        <SelectItem key={key} value={key}>
                          {key}ª Faixa - {limite} ({aliquota})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Alíquota Efetiva
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>A alíquota efetiva é calculada com base na fórmula do Simples Nacional, considerando o faturamento dos últimos 12 meses.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="33"
                    value={settings.simples_aliquota_efetiva || 6}
                    onChange={(e) => handleChange('simples_aliquota_efetiva', parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lucro_presumido">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuração do Lucro Presumido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Percentual de Presunção (Serviços)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.lp_presuncao_servicos || 32}
                    onChange={(e) => handleChange('lp_presuncao_servicos', parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">(padrão: 32% para serviços)</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>IRPJ</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lp_irpj_aliquota || 15}
                      onChange={(e) => handleChange('lp_irpj_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>IRPJ Adicional</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lp_irpj_adicional || 10}
                      onChange={(e) => handleChange('lp_irpj_adicional', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Sobre lucro &gt; R$20k/mês</p>
                </div>

                <div className="space-y-2">
                  <Label>CSLL</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lp_csll_aliquota || 9}
                      onChange={(e) => handleChange('lp_csll_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PIS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lp_pis_aliquota || 0.65}
                      onChange={(e) => handleChange('lp_pis_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>COFINS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lp_cofins_aliquota || 3}
                      onChange={(e) => handleChange('lp_cofins_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lucro_real">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuração do Lucro Real</CardTitle>
              <CardDescription>
                No Lucro Real, os impostos são calculados sobre o lucro contábil ajustado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>IRPJ</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lr_irpj_aliquota || 15}
                      onChange={(e) => handleChange('lr_irpj_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>IRPJ Adicional</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lr_irpj_adicional || 10}
                      onChange={(e) => handleChange('lr_irpj_adicional', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CSLL</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lr_csll_aliquota || 9}
                      onChange={(e) => handleChange('lr_csll_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PIS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lr_pis_aliquota || 1.65}
                      onChange={(e) => handleChange('lr_pis_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>COFINS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.lr_cofins_aliquota || 7.6}
                      onChange={(e) => handleChange('lr_cofins_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ISS Municipal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ISS Municipal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label>Alíquota ISS</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="2"
                  max="5"
                  value={settings.iss_aliquota || 5}
                  onChange={(e) => handleChange('iss_aliquota', parseFloat(e.target.value))}
                  className="w-32"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">(varia de 2% a 5% conforme município)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="iss-retido">ISS retido na fonte</Label>
              <Switch
                id="iss-retido"
                checked={settings.iss_retido_na_fonte || false}
                onCheckedChange={(v) => handleChange('iss_retido_na_fonte', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retenções na Fonte */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Retenções na Fonte (quando tomador)</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardDescription>
                Alíquotas aplicadas quando você contrata serviços de terceiros
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>IRRF</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.retencao_irrf_aliquota || 1.5}
                      onChange={(e) => handleChange('retencao_irrf_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PIS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.retencao_pis_aliquota || 0.65}
                      onChange={(e) => handleChange('retencao_pis_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>COFINS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.retencao_cofins_aliquota || 3}
                      onChange={(e) => handleChange('retencao_cofins_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CSLL</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.retencao_csll_aliquota || 1}
                      onChange={(e) => handleChange('retencao_csll_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>INSS</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.retencao_inss_aliquota || 11}
                      onChange={(e) => handleChange('retencao_inss_aliquota', parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <Percent className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Histórico */}
      {history && history.length > 1 && (
        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico de Alterações
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2">
                  {history.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={regimeLabels[item.tax_regime]?.color}>
                          {regimeLabels[item.tax_regime]?.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Vigente a partir de {format(new Date(item.effective_from), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {index === 0 && (
                        <Badge variant="secondary">Atual</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Botão Salvar */}
      {Object.keys(formData).length > 0 && (
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={createSettings.isPending || updateSettings.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Configuração
          </Button>
        </div>
      )}
    </div>
  );
}
