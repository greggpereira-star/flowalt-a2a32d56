import React, { useEffect, useState } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboarding, ONBOARDING_STEPS, OnboardingStep } from '@/hooks/useOnboarding';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, ArrowRight, X } from 'lucide-react';

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

  const [showWelcome, setShowWelcome] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);

  // Check if we should show the welcome modal
  useEffect(() => {
    if (!isLoading && shouldShowOnboarding && currentWorkspace) {
      setShowWelcome(true);
    }
  }, [isLoading, shouldShowOnboarding, currentWorkspace]);

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
      onDestroyStarted: () => {
        driverObj.destroy();
        setTourStarted(false);
        completeStep.mutate('complete' as OnboardingStep);
      },
    });

    driverObj.drive();
  };

  const handleSkip = async () => {
    setShowWelcome(false);
    await skipOnboarding.mutateAsync();
  };

  // Don't render anything if loading or onboarding is complete
  if (isLoading || isOnboardingComplete || tourStarted) {
    return null;
  }

  return (
    <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Bem-vindo ao Flowalt! 🎉</DialogTitle>
          <DialogDescription className="text-base">
            Vamos fazer um tour rápido para você conhecer as principais funcionalidades do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              1
            </div>
            <span className="text-sm">Navegação e estrutura do sistema</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
              2
            </div>
            <span className="text-sm">Espaços de trabalho e cards</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
              3
            </div>
            <span className="text-sm">Controle de tempo e gestão</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
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
  );
};
