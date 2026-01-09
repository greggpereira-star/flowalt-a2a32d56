import React from 'react';
import { useAltControlApprovers } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export const ApproversSettings: React.FC = () => {
  const { data: approvers, isLoading } = useAltControlApprovers();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pool de Aprovadores</CardTitle>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Carregando...</p>
        ) : approvers && approvers.length > 0 ? (
          <div className="space-y-2">
            {approvers.map(approver => (
              <div key={approver.id} className="p-4 border rounded-lg flex justify-between items-center">
                <p className="font-medium">Aprovador {approver.user_id.slice(0, 8)}</p>
                <Badge variant={approver.is_senior ? 'default' : 'secondary'}>
                  {approver.is_senior ? 'Sênior' : 'Regular'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum aprovador configurado</p>
        )}
      </CardContent>
    </Card>
  );
};
