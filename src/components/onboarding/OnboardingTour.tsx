import React, { useEffect, useRef, useState } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboarding, ONBOARDING_STEPS, OnboardingStep } from '@/hooks/useOnboarding';
import { useBadges } from '@/hooks/useBadges';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, ArrowRight, X, Award } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BadgeToast } from './BadgeToast';

const tourSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: '🧭 Navegação Principal',
      description: 'Use a barra lateral para navegar entre as seções do sistema: Dashboard, Tempo, Agenda e mais.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="workspace-selector"]',
    popover: {
      title: '🏢 Seletor de Workspace',
      description: 'Aqui você pode alternar entre diferentes workspaces ou criar um novo.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="spaces-menu"]',
    popover: {
      title: '📁 Espaços de Trabalho',
      description: 'Os espaços organizam seus projetos por tipo: Design, Audiovisual, Social Media, etc.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: '📊 Métricas Rápidas',
      description: 'Visualize o status geral do seu trabalho: cards ativos, em progresso, atrasados e horas trabalhadas.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="management-menu"]',
    popover: {
      title: '⚙️ Gestão',
      description: 'Acesse ferramentas de coordenação, financeiro, painel dos sócios e configurações de API.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="user-menu"]',
    popover: {
      title: '👤 Seu Perfil',
      description: 'Acesse suas configurações pessoais ou saia do sistema por aqui.',
      side: 'top',
      align: 'end',
    },
  },
];

export const OnboardingTour: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const {
    onboarding,
    isLoading,
    shouldShowOnboarding,
    isOnboardingComplete,
    initOnboarding,
    completeStep,
    skipOnboarding,
  } = useOnboarding();
  const { earnBadge, hasBadge, isLoading: badgesLoading } = useBadges();

  const [showWelcome, setShowWelcome] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const firstLoginAttempted = useRef(false);

  // Check if we should show the welcome modal
  useEffect(() => {
    if (!isLoading && shouldShowOnboarding && currentWorkspace) {
      setShowWelcome(true);
    }
  }, [isLoading, shouldShowOnboarding, currentWorkspace]);

  // Award first login badge (once per session/workspace)
  useEffect(() => {
    if (!currentWorkspace?.id || badgesLoading) return;
    if (firstLoginAttempted.current) return;
    if (hasBadge('first_login')) {
      firstLoginAttempted.current = true;
      return;
    }
    firstLoginAttempted.current = true;
    earnBadge.mutate('first_login', {
      onSuccess: (data) => {
        if (data) setNewBadge('first_login');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id, badgesLoading]);

  // Start the tour
  const startTour = async () => {
    setShowWelcome(false);
    
    // Initialize onboarding record
    await initOnboarding.mutateAsync();
    
    // Navigate to dashboard first
    if (location.pathname !== '/') {
      navigate('/');
      // Wait for navigation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTourStarted(true);

    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Concluir!',
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'onboarding-popover',
      steps: tourSteps,
      onDestroyStarted: async () => {
        driverObj.destroy();
        setTourStarted(false);
        completeStep.mutate('complete' as OnboardingStep);
        
        // Award onboarding complete badge
        if (!hasBadge('onboarding_complete')) {
          earnBadge.mutate('onboarding_complete', {
            onSuccess: (data) => {
              if (data) setNewBadge('onboarding_complete');
            },
          });
        }
      },
    });

    driverObj.drive();
  };

  const handleSkip = async () => {
    setShowWelcome(false);
    await skipOnboarding.mutateAsync();
  };

  // Calculate progress for the welcome modal
  const progressSteps = [
    { label: 'Navegação e estrutura', done: false },
    { label: 'Espaços de trabalho', done: false },
    { label: 'Gestão e tempo', done: false },
  ];

  return (
    <>
      {/* Badge Toast */}
      {newBadge && (
        <BadgeToast badgeType={newBadge} onClose={() => setNewBadge(null)} />
      )}

      {/* Welcome Dialog */}
      {!isLoading && !isOnboardingComplete && !tourStarted && (
        <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-2xl">Bem-vindo ao Flowalt! 🎉</DialogTitle>
              <DialogDescription className="text-base">
                Vamos fazer um tour rápido para você conhecer as principais funcionalidades do sistema.
              </DialogDescription>
            </DialogHeader>

            {/* Gamification preview */}
            <div className="my-4 p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <span className="font-medium text-sm">Conquiste badges!</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete o tour e ganhe seu primeiro badge. Explore o sistema para desbloquear mais conquistas!
              </p>
              <Progress value={0} className="h-1.5 mt-3" />
              <p className="text-xs text-muted-foreground mt-1">0 de 10 badges conquistados</p>
            </div>

            <div className="space-y-3">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    index === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' :
                    index === 1 ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' :
                    'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-sm">{step.label}</span>
                </div>
              ))}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
              <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto">
                <X className="mr-2 h-4 w-4" />
                Pular tour
              </Button>
              <Button onClick={startTour} className="w-full sm:w-auto">
                Iniciar tour
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
