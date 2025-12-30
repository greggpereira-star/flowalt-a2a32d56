import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOnboarding, ONBOARDING_STEPS } from '@/hooks/useOnboarding';
import { useBadges } from '@/hooks/useBadges';
import { RotateCcw, Award, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

export function OnboardingSettings() {
  const { onboarding, resetOnboarding, isOnboardingComplete, stepsCompleted } = useOnboarding();
  const { progress, earnedBadges } = useBadges();

  const handleResetOnboarding = async () => {
    try {
      await resetOnboarding.mutateAsync();
      toast.success('Tour de onboarding reiniciado! Recarregue a página para iniciar.');
    } catch (error) {
      toast.error('Erro ao reiniciar o tour');
    }
  };

  const stepLabels: Record<string, string> = {
    welcome: 'Boas-vindas',
    workspace: 'Workspace',
    sidebar: 'Menu lateral',
    spaces: 'Spaces',
    'create-card': 'Criar card',
    'time-tracking': 'Registro de tempo',
    complete: 'Conclusão',
  };

  const onboardingProgress = Math.round((stepsCompleted.length / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Tour de Onboarding
          </CardTitle>
          <CardDescription>
            Reveja o tour guiado para conhecer todas as funcionalidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do tour</span>
              <span className="text-sm text-muted-foreground">
                {stepsCompleted.length}/{ONBOARDING_STEPS.length} etapas
              </span>
            </div>
            <Progress value={onboardingProgress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ONBOARDING_STEPS.map((step) => (
              <div
                key={step}
                className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50"
              >
                {stepsCompleted.includes(step) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={stepsCompleted.includes(step) ? '' : 'text-muted-foreground'}>
                  {stepLabels[step] || step}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button 
              variant="outline" 
              onClick={handleResetOnboarding}
              disabled={resetOnboarding.isPending}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {resetOnboarding.isPending ? 'Reiniciando...' : 'Reiniciar Tour'}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Recarregue a página após reiniciar para ver o tour novamente
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Conquistas
          </CardTitle>
          <CardDescription>
            Seus badges e progresso na plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Badges conquistados</span>
              <span className="text-sm text-muted-foreground">
                {progress.earned}/{progress.total} ({progress.percentage}%)
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>

          {earnedBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((badge) => (
                <Badge
                  key={badge.type}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1.5 px-3"
                >
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum badge conquistado ainda. Continue explorando!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
