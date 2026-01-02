import React from 'react';
import { useWorkspacePlan, useWorkspaceUsage } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, FolderKanban, Key, Webhook, Database,
  ExternalLink, AlertTriangle, Settings, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManageUsageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UsageRowProps {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  manageLink?: string;
  manageLabel?: string;
}

const UsageRow: React.FC<UsageRowProps> = ({ 
  icon: Icon, 
  label, 
  used, 
  limit, 
  manageLink,
  manageLabel 
}) => {
  const navigate = useNavigate();
  const percentage = limit > 0 ? (used / limit) * 100 : 100;
  const isOverLimit = used > limit;
  const isNearLimit = percentage >= 80 && !isOverLimit;

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
      <div className={cn(
        "p-2 rounded-lg",
        isOverLimit ? 'bg-destructive/10' : isNearLimit ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'
      )}>
        <Icon className={cn(
          "h-4 w-4",
          isOverLimit ? 'text-destructive' : isNearLimit ? 'text-amber-600' : 'text-muted-foreground'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2">
            {isOverLimit && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Excedido
              </Badge>
            )}
            <span className={cn(
              "text-sm",
              isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}>
              {used} / {limit}
            </span>
          </div>
        </div>
        <Progress 
          value={Math.min(percentage, 100)} 
          className={cn(
            "h-1.5",
            isOverLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''
          )}
        />
      </div>

      {manageLink && (
        <Button 
          size="sm" 
          variant="ghost"
          className="gap-1.5 text-xs"
          onClick={() => navigate(manageLink)}
        >
          <Settings className="h-3.5 w-3.5" />
          {manageLabel || 'Gerenciar'}
        </Button>
      )}
    </div>
  );
};

export const ManageUsageModal: React.FC<ManageUsageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();
  const { currentRole } = useWorkspace();
  const { data: plan } = useWorkspacePlan();
  const { data: usage } = useWorkspaceUsage();

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  if (!plan || !usage) return null;

  const hasOverLimit = 
    usage.seats_used > plan.seats_limit ||
    usage.spaces_used > plan.spaces_limit ||
    usage.api_keys_used > plan.api_keys_limit ||
    usage.webhooks_used > plan.webhooks_limit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gerenciar Uso do Workspace
          </DialogTitle>
          <DialogDescription>
            {hasOverLimit 
              ? 'Seu workspace está acima dos limites. Reduza o uso ou faça upgrade.'
              : 'Visualize e gerencie o consumo de recursos do workspace.'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            <UsageRow
              icon={Users}
              label="Membros"
              used={usage.seats_used}
              limit={plan.seats_limit}
              manageLink="/settings?tab=members"
              manageLabel="Ver membros"
            />
            <UsageRow
              icon={FolderKanban}
              label="Espaços"
              used={usage.spaces_used}
              limit={plan.spaces_limit}
              manageLink="/settings?tab=spaces"
              manageLabel="Ver espaços"
            />
            <UsageRow
              icon={Key}
              label="API Keys"
              used={usage.api_keys_used}
              limit={plan.api_keys_limit}
              manageLink="/integrations?tab=api-keys"
              manageLabel="Ver keys"
            />
            <UsageRow
              icon={Webhook}
              label="Webhooks"
              used={usage.webhooks_used}
              limit={plan.webhooks_limit}
              manageLink="/integrations?tab=webhooks"
              manageLabel="Ver webhooks"
            />
            <UsageRow
              icon={Database}
              label="Armazenamento (MB)"
              used={usage.storage_mb_used}
              limit={plan.storage_mb_limit}
            />
          </div>
        </ScrollArea>

        <div className="flex flex-col gap-2 pt-4 border-t">
          {isAdmin ? (
            <>
              <Button 
                className="w-full gap-2"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/settings?tab=billing');
                }}
              >
                <Crown className="h-4 w-4" />
                Fazer upgrade
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </>
          ) : (
            <>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Você não tem permissão para alterar limites.
                  <br />
                  Peça para um Admin gerenciar o plano.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageUsageModal;
