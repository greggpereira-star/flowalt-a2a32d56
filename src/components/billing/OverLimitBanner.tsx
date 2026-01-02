import React, { useState } from 'react';
import { useWorkspacePlan, useWorkspaceUsage } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Settings, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface OverLimitItem {
  label: string;
  used: number;
  limit: number;
}

export const OverLimitBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const { data: plan } = useWorkspacePlan();
  const { data: usage } = useWorkspaceUsage();
  const { currentRole } = useWorkspace();
  const navigate = useNavigate();

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  if (dismissed || !plan || !usage) return null;

  // Check what's over limit
  const overLimitItems: OverLimitItem[] = [];

  if (usage.seats_used > plan.seats_limit) {
    overLimitItems.push({ label: 'Membros', used: usage.seats_used, limit: plan.seats_limit });
  }
  if (usage.spaces_used > plan.spaces_limit) {
    overLimitItems.push({ label: 'Espaços', used: usage.spaces_used, limit: plan.spaces_limit });
  }
  if (usage.api_keys_used > plan.api_keys_limit) {
    overLimitItems.push({ label: 'API Keys', used: usage.api_keys_used, limit: plan.api_keys_limit });
  }
  if (usage.webhooks_used > plan.webhooks_limit) {
    overLimitItems.push({ label: 'Webhooks', used: usage.webhooks_used, limit: plan.webhooks_limit });
  }

  if (overLimitItems.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-300">
              Seu workspace está acima do limite do plano atual.
            </span>
            <span className="text-amber-700 dark:text-amber-400 ml-2">
              {overLimitItems.map((item, i) => (
                <span key={item.label}>
                  {i > 0 && ', '}
                  {item.label} ({item.used}/{item.limit})
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Button 
                size="sm" 
                variant="outline"
                className="gap-1.5 bg-background"
                onClick={() => navigate('/settings?tab=billing')}
              >
                <Settings className="h-3.5 w-3.5" />
                Gerenciar uso
              </Button>
              <Button 
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/settings?tab=billing')}
              >
                <Crown className="h-3.5 w-3.5" />
                Fazer upgrade
              </Button>
            </>
          ) : (
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Solicite ao Admin para resolver.
            </span>
          )}
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OverLimitBanner;
