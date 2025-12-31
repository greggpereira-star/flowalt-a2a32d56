import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  ListChecks, 
  Link2, 
  Shield,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GateValidationResult, TransitionValidationResult } from '@/hooks/useWorkflow';
import { getStageDisplayName } from '@/hooks/useWorkflow';

interface TransitionBlockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStage: string;
  toStage: string;
  validation: TransitionValidationResult | null;
  onForceTransition?: (reason: string) => void;
  onFixGate?: (gate: string) => void;
  canForce?: boolean;
}

const gateIcons: Record<string, React.ReactNode> = {
  briefing_completed: <FileText className="h-4 w-4" />,
  checklist_progress: <ListChecks className="h-4 w-4" />,
  no_dependencies: <Link2 className="h-4 w-4" />,
  role_permission: <Shield className="h-4 w-4" />,
  transition_allowed: <ArrowRight className="h-4 w-4" />,
};

const gateLabels: Record<string, string> = {
  briefing_completed: 'Briefing',
  checklist_progress: 'Checklist',
  no_dependencies: 'Dependências',
  role_permission: 'Permissão',
  transition_allowed: 'Transição',
};

export const TransitionBlockedModal: React.FC<TransitionBlockedModalProps> = ({
  open,
  onOpenChange,
  fromStage,
  toStage,
  validation,
  onForceTransition,
  onFixGate,
  canForce = false,
}) => {
  const [reason, setReason] = React.useState('');
  const [showForceForm, setShowForceForm] = React.useState(false);

  const handleForce = () => {
    if (reason.trim() && onForceTransition) {
      onForceTransition(reason);
      setReason('');
      setShowForceForm(false);
      onOpenChange(false);
    }
  };

  if (!validation) return null;

  const { failedGates, gates, requiresReason, isBackward } = validation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Transição Bloqueada
          </DialogTitle>
          <DialogDescription>
            Não foi possível mover de <strong>{getStageDisplayName(fromStage)}</strong> para <strong>{getStageDisplayName(toStage)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Failed Gates */}
          {failedGates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Para avançar, você precisa:
              </p>
              <div className="space-y-2">
                {failedGates.map((gate, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      'bg-destructive/5 border-destructive/20'
                    )}
                  >
                    <div className="p-1.5 rounded-full bg-destructive/10">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {gateIcons[gate.gate]}
                        <span className="text-sm font-medium">
                          {gateLabels[gate.gate] || gate.gate}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {gate.message}
                      </p>
                    </div>
                    {onFixGate && (gate.gate === 'briefing_completed' || gate.gate === 'checklist_progress') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onFixGate(gate.gate);
                          onOpenChange(false);
                        }}
                      >
                        Resolver
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed Gates (collapsed) */}
          {gates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Requisitos atendidos:
              </p>
              <div className="flex flex-wrap gap-2">
                {gates.map((gate, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="bg-green-500/10 text-green-600 border-green-500/20"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {gateLabels[gate.gate] || gate.gate}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Backward transition warning */}
          {isBackward && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Esta é uma transição de retrocesso. 
                {requiresReason && ' É necessário informar o motivo.'}
              </p>
            </div>
          )}

          {/* Force transition form */}
          {showForceForm && canForce && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
              <Label htmlFor="reason">Motivo da transição forçada *</Label>
              <Textarea
                id="reason"
                placeholder="Explique por que esta transição está sendo forçada..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Esta ação será registrada no histórico do card.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          
          {canForce && !showForceForm && (
            <Button 
              variant="secondary" 
              onClick={() => setShowForceForm(true)}
            >
              Forçar Transição
            </Button>
          )}
          
          {showForceForm && canForce && (
            <Button 
              variant="destructive"
              disabled={!reason.trim()}
              onClick={handleForce}
            >
              Confirmar Transição Forçada
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
