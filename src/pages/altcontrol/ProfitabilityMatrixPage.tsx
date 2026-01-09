import React from 'react';
import { useAltControlContracts, useAltControlLevels } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export const ProfitabilityMatrixPage: React.FC = () => {
  const { data: contracts } = useAltControlContracts({ status: 'active' });
  const { data: levels } = useAltControlLevels();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de Rentabilidade</CardTitle>
        <CardDescription>Análise de dispersão: Nível x Custo Real</CardDescription>
      </CardHeader>
      <CardContent>
        {contracts && contracts.length > 0 ? (
          <div className="grid gap-4">
            {levels?.map(level => {
              const levelContracts = contracts.filter(c => c.level_id === level.id);
              return (
                <div key={level.id} className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">{level.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {levelContracts.length} cliente(s) • Meta margem: {level.target_margin_percent}%
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Sem dados para exibir</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
