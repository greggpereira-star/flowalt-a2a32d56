import React from 'react';
import { useParams } from 'react-router-dom';
import { useAltControlContract } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const ContractDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: contract } = useAltControlContract(id || '');

  if (!contract) return <div>Carregando...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contract.client_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Horas contratadas: {contract.contracted_hours}h/mês</p>
        <p>Valor: R$ {contract.monthly_value}</p>
      </CardContent>
    </Card>
  );
};
