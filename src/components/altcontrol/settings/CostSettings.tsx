import React from 'react';
import { useAltControlCostParams, useUpsertCostParams } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export const CostSettings: React.FC = () => {
  const { data: costParams, isLoading } = useAltControlCostParams();
  const upsertCostParams = useUpsertCostParams();
  
  const [baseHourlyCost, setBaseHourlyCost] = React.useState(50);
  const [overheadPercent, setOverheadPercent] = React.useState(20);

  React.useEffect(() => {
    if (costParams) {
      setBaseHourlyCost(costParams.base_hourly_cost);
      setOverheadPercent(costParams.overhead_percent);
    }
  }, [costParams]);

  const handleSave = () => {
    upsertCostParams.mutate({
      base_hourly_cost: baseHourlyCost,
      overhead_percent: overheadPercent,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros de Custo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Custo Base por Hora (R$)</Label>
            <Input 
              type="number" 
              value={baseHourlyCost} 
              onChange={(e) => setBaseHourlyCost(Number(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label>Overhead (%)</Label>
            <Input 
              type="number" 
              value={overheadPercent} 
              onChange={(e) => setOverheadPercent(Number(e.target.value))} 
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={upsertCostParams.isPending}>
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </CardContent>
    </Card>
  );
};
