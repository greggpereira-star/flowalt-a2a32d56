import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Building2, FileCheck2, FolderPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AltControlProposal } from '@/hooks/useAltControl';

interface ConvertToContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: AltControlProposal;
  onConfirm: (data: { startDate: string; createSpace: boolean; createClientCard: boolean }) => Promise<void>;
  isLoading?: boolean;
}

export const ConvertToContractModal: React.FC<ConvertToContractModalProps> = ({
  open,
  onOpenChange,
  proposal,
  onConfirm,
  isLoading,
}) => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [createSpace, setCreateSpace] = useState(true);
  const [createClientCard, setCreateClientCard] = useState(!proposal.client_id);

  const handleConfirm = async () => {
    await onConfirm({ startDate, createSpace, createClientCard });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            Converter em Contrato
          </DialogTitle>
          <DialogDescription>
            Transforme esta proposta em um contrato ativo e integre ao fluxo operacional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Proposal Summary */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{proposal.client_name}</span>
                <Badge variant="outline">Proposta #{proposal.proposal_number}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Horas/mês:</span>
                  <span className="ml-2 font-medium">{proposal.total_hours}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(proposal.final_price || proposal.suggested_max_price)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Nível:</span>
                  <span className="ml-2 font-medium">{proposal.calculated_level?.name || 'Não definido'}</span>
                </div>
              </div>
              {proposal.items && proposal.items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground mb-1 block">Serviços inclusos:</span>
                    <div className="flex flex-wrap gap-1">
                      {proposal.items.map((item) => (
                        <Badge key={item.id} variant="secondary" className="text-xs">
                          {item.service?.name || 'Serviço'} ({item.hours_per_month}h)
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Início do Contrato
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <Separator />

          {/* Integration Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Integrações Automáticas</p>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="create-space"
                checked={createSpace}
                onCheckedChange={(checked) => setCreateSpace(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="create-space" className="flex items-center gap-2 cursor-pointer">
                  <FolderPlus className="h-4 w-4 text-blue-500" />
                  Criar Espaço para o Cliente
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Cria um espaço dedicado com pastas por serviço para organização operacional
                </p>
              </div>
            </div>

            {!proposal.client_id && (
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="create-client"
                  checked={createClientCard}
                  onCheckedChange={(checked) => setCreateClientCard(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="create-client" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4 text-green-500" />
                    Criar Card de Cliente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cadastra o cliente na base para gestão do relacionamento
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Convertendo...
              </>
            ) : (
              'Confirmar Conversão'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
