import React from 'react';
import { useWorkspacePlan, useHasEntitlement } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Lock, Crown, Key, Webhook, Code, BarChart3, 
  ArrowRight, Sparkles, Check, Building2
} from 'lucide-react';

const benefits = [
  { icon: Key, text: 'Crie API Keys para integrar com sistemas externos' },
  { icon: Webhook, text: 'Configure Webhooks para automações em tempo real' },
  { icon: Code, text: 'Acesse documentação completa da API' },
  { icon: BarChart3, text: 'Monitore métricas e logs de uso' },
];

export const IntegrationsPaywall: React.FC = () => {
  const navigate = useNavigate();
  const { currentRole } = useWorkspace();
  const { data: plan } = useWorkspacePlan();
  
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const currentTier = plan?.plan_tier || 'free';

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-lg w-full border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            API & Integrações
          </CardTitle>
          <CardDescription className="text-base">
            Disponível a partir do plano Pro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            Conecte o EDA a outras ferramentas e automatize seus processos com nossa API robusta e webhooks em tempo real.
          </p>

          <div className="space-y-3">
            {benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <benefit.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm">{benefit.text}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 space-y-3">
            {isAdmin ? (
              <>
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => navigate('/settings?tab=billing')}
                >
                  <Crown className="h-5 w-5" />
                  Fazer upgrade para Pro
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => navigate('/settings?tab=billing')}
                >
                  <Building2 className="h-4 w-4" />
                  Falar com vendas (Enterprise)
                </Button>
              </>
            ) : (
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Peça ao administrador do workspace para fazer upgrade do plano.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Seu plano atual: <span className="font-medium capitalize">{currentTier}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsPaywall;
