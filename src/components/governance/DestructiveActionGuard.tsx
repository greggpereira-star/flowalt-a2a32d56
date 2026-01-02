import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useGovernanceEvents } from '@/hooks/useGovernanceEvents';
import { AlertTriangle, Archive, Trash2, Lock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DestructiveMode = 'archive' | 'delete';

interface DestructiveActionGuardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'card' | 'folder' | 'space' | 'checklist' | 'item';
  entityId: string;
  entityName: string;
  createdBy?: string | null;
  hasHistory?: boolean;
  dependentItems?: { type: string; count: number }[];
  onConfirm: (mode: DestructiveMode) => Promise<void>;
  forceMode?: DestructiveMode;
}

export const DestructiveActionGuard: React.FC<DestructiveActionGuardProps> = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  createdBy,
  hasHistory = false,
  dependentItems = [],
  onConfirm,
  forceMode,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isOwner, isAdmin, canDeleteCards } = usePermissions();
  const { user } = useAuth();
  const { trackAccessDenied } = useGovernanceEvents();

  const isCreator = createdBy === user?.id;
  const canDelete = isOwner || isAdmin || canDeleteCards || isCreator;
  const mode: DestructiveMode = forceMode || (hasHistory ? 'archive' : 'delete');
  const isIrreversible = mode === 'delete';

  const entityLabels: Record<string, string> = {
    card: 'card', folder: 'pasta', space: 'espaço', checklist: 'checklist', item: 'item',
  };

  const handleConfirm = async () => {
    if (isIrreversible && !confirmed) return;
    setIsLoading(true);
    try {
      await onConfirm(mode);
      onOpenChange(false);
    } catch (error) {
      console.error('Error in destructive action:', error);
    } finally {
      setIsLoading(false);
      setConfirmed(false);
    }
  };

  if (!canDelete) {
    const validEntityType = entityType === 'checklist' || entityType === 'item' ? 'card' : entityType;
    trackAccessDenied(validEntityType, entityId, 'delete', 'admin', undefined);
    
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <div className="flex flex-col items-center py-4">
            <div className="p-3 rounded-full bg-destructive/10 mb-4">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogHeader className="text-center">
              <AlertDialogTitle>Sem permissão</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Você não tem permissão para excluir este {entityLabels[entityType]}.
                <br />
                <span className="text-xs text-muted-foreground mt-2 block">
                  Apenas Admin, Owner, Coordenação ou o criador podem excluir.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full', mode === 'archive' ? 'bg-warning/10' : 'bg-destructive/10')}>
              {mode === 'archive' ? <Archive className="h-5 w-5 text-warning" /> : <Trash2 className="h-5 w-5 text-destructive" />}
            </div>
            <div>
              <AlertDialogTitle>{mode === 'archive' ? 'Arquivar' : 'Excluir'} {entityLabels[entityType]}?</AlertDialogTitle>
              {hasHistory && mode === 'archive' && (
                <Badge variant="outline" className="mt-1 text-xs"><Info className="h-3 w-3 mr-1" />Contém histórico</Badge>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription className="space-y-3">
          <p>
            {mode === 'archive' 
              ? <>O {entityLabels[entityType]} <strong>"{entityName}"</strong> será arquivado.</>
              : <>O {entityLabels[entityType]} <strong>"{entityName}"</strong> será excluído permanentemente.</>
            }
          </p>

          {dependentItems.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Itens vinculados:</p>
              <ul className="text-xs space-y-0.5">
                {dependentItems.map((dep, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground" />{dep.count} {dep.type}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isIrreversible && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-xs text-destructive">Esta ação é irreversível.</p>
                <div className="flex items-center gap-2">
                  <Checkbox id="confirm-delete" checked={confirmed} onCheckedChange={(c) => setConfirmed(!!c)} />
                  <label htmlFor="confirm-delete" className="text-xs font-medium cursor-pointer">Entendi</label>
                </div>
              </div>
            </div>
          )}
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || (isIrreversible && !confirmed)}
            className={cn(mode === 'archive' ? 'bg-warning text-warning-foreground hover:bg-warning/90' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {isLoading ? 'Processando...' : mode === 'archive' ? <><Archive className="h-4 w-4 mr-1" />Arquivar</> : <><Trash2 className="h-4 w-4 mr-1" />Excluir</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DestructiveActionGuard;
