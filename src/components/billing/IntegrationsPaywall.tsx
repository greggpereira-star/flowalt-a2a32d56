import React, { useEffect } from 'react';
import { useWorkspacePlan } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBillingGovernanceEvents } from '@/hooks/useBillingGovernanceEvents';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Lock, Crown, Key, Webhook, Code, BarChart3, 
  ArrowRight, Check, Building2, Copy, Mail, Lightbulb
} from 'lucide-react';

const benefits = [
  { icon: Key, text: 'Crie API Keys para integrar com sistemas externos' },
  { icon: Webhook, text: 'Configure Webhooks para automações em tempo real' },
  { icon: Code, text: 'Acesse documentação completa da API' },
  { icon: BarChart3, text: 'Monitore métricas e logs de uso' },
];

const freeAlternatives = [
  'Exporte dados manualmente via relatórios',
  'Use automações internas do workspace',
  'Compartilhe links de cards com externos',
  'Utilize templates para padronizar processos',
];

export const IntegrationsPaywall: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const { data: plan } = useWorkspacePlan();
  const { logPaywallViewed, logUpgradeIntent, logRequestUpgradeSent } = useBillingGovernanceEvents();
  
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const currentTier = plan?.plan_tier || 'free';

  useEffect(() => {
    logPaywallViewed('integrations', currentTier);
  }, [currentTier]);

  const handleUpgrade = () => {
    logUpgradeIntent('pro', 'integrations_paywall');
    navigate('/settings?tab=billing');
  };

  const handleCopyMessage = () => {
    const message = `Olá! Preciso de acesso à API e Integrações no workspace. Poderia fazer upgrade do plano para Pro?`;
    navigator.clipboard.writeText(message);
    toast({
      title: 'Mensagem copiada',
      description: 'Cole no Slack/WhatsApp para enviar ao Admin.',
    });
  };

  const handleRequestAccess = () => {
    logRequestUpgradeSent();
    toast({
      title: 'Solicitação enviada',
      description: 'O administrador será notificado sobre seu interesse.',
    });
  };

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
          {/* What you get */}
          <div>
            <p className="text-sm font-medium mb-3">O que você ganha com integrações:</p>
            <div className="space-y-2.5">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <benefit.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Free alternatives */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium">Alternativas no plano Free:</p>
            </div>
            <ul className="space-y-1.5">
              {freeAlternatives.map((alt, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  {alt}
                </li>
              ))}
            </ul>
          </div>

          {/* 3 Paths */}
          <div className="space-y-3">
            {isAdmin ? (
              <>
                {/* Path 1: Upgrade to Pro */}
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleUpgrade}
                >
                  <Crown className="h-5 w-5" />
                  Fazer upgrade para Pro
                  <ArrowRight className="h-4 w-4" />
                </Button>
                
                {/* Path 2: Enterprise contact */}
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleUpgrade}
                >
                  <Building2 className="h-4 w-4" />
                  Falar com vendas (Enterprise)
                </Button>
              </>
            ) : (
              <>
                {/* Path 3: Request access (non-admin) */}
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    Você não tem permissão para gerenciar o plano.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5" 
                      onClick={handleCopyMessage}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar mensagem
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={handleRequestAccess}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Solicitar acesso
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t">
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
