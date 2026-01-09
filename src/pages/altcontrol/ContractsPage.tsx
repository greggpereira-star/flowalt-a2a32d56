import React from 'react';
import { useAltControlContracts } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

export const ContractsPage: React.FC = () => {
  const { data: contracts, isLoading } = useAltControlContracts({ status: 'active' });

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoading) {
    return <Card><CardContent className="py-12 text-center">Carregando...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Ativos</CardTitle>
        <CardDescription>Velocímetro de horas por cliente</CardDescription>
      </CardHeader>
      <CardContent>
        {contracts && contracts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contracts.map(contract => {
              const realizedHours = contract.monthly_hours?.[0]?.realized_hours || 0;
              const progress = (realizedHours / contract.contracted_hours) * 100;
              const status = progress > 100 ? 'destructive' : progress > 85 ? 'warning' : 'success';
              
              return (
                <Card key={contract.id} className="relative overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">{contract.client_name}</p>
                        <p className="text-sm text-muted-foreground">{contract.level?.name}</p>
                      </div>
                      <Badge variant={status === 'success' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}>
                        {formatCurrency(contract.monthly_value)}/mês
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Horas</span>
                        <span>{realizedHours}h / {contract.contracted_hours}h</span>
                      </div>
                      <Progress value={Math.min(progress, 100)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum cliente ativo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
