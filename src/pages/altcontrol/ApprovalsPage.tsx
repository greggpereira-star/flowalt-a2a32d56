import React from 'react';
import { usePendingApprovals } from '@/hooks/useAltControl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock } from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: approvals, isLoading } = usePendingApprovals();

  if (isLoading) {
    return <Card><CardContent className="py-12 text-center">Carregando...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de Aprovações</CardTitle>
        <CardDescription>Propostas aguardando sua análise</CardDescription>
      </CardHeader>
      <CardContent>
        {approvals && approvals.length > 0 ? (
          <div className="space-y-4">
            {approvals.map((approval: any) => (
              <div key={approval.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{approval.proposal?.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {approval.proposal?.total_hours}h/mês • {approval.proposal?.calculated_level?.name}
                  </p>
                </div>
                <Button onClick={() => navigate(`/altcontrol/approvals/${approval.proposal_id}`)}>
                  Analisar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma aprovação pendente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
