import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OnboardingStatus {
  id: string;
  user_id: string;
  completed: boolean;
  current_step: number;
  steps_completed: string[];
  created_at: string;
  updated_at: string;
}

export const ONBOARDING_STEPS = [
  'welcome',
  'workspace',
  'sidebar',
  'spaces',
  'create-card',
  'time-tracking',
  'complete',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

export function useOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ['onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as OnboardingStatus | null;
    },
    enabled: !!user?.id,
  });

  const initOnboarding = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('user_onboarding')
        .insert({
          user_id: user.id,
          completed: false,
          current_step: 0,
          steps_completed: [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as OnboardingStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', user?.id] });
    },
  });

  const completeStep = useMutation({
    mutationFn: async (step: OnboardingStep) => {
      if (!user?.id || !onboarding) throw new Error('No user or onboarding');

      const stepsCompleted = [...(onboarding.steps_completed || [])];
      if (!stepsCompleted.includes(step)) {
        stepsCompleted.push(step);
      }

      const stepIndex = ONBOARDING_STEPS.indexOf(step);
      const nextStep = Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1);
      const isComplete = step === 'complete' || stepsCompleted.length === ONBOARDING_STEPS.length;

      const { data, error } = await supabase
        .from('user_onboarding')
        .update({
          current_step: nextStep,
          steps_completed: stepsCompleted,
          completed: isComplete,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as OnboardingStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', user?.id] });
    },
  });

  const skipOnboarding = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: user.id,
          completed: true,
          current_step: ONBOARDING_STEPS.length - 1,
          steps_completed: ONBOARDING_STEPS as unknown as string[],
        })
        .select()
        .single();

      if (error) throw error;
      return data as OnboardingStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', user?.id] });
    },
  });

  const resetOnboarding = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('user_onboarding')
        .update({
          completed: false,
          current_step: 0,
          steps_completed: [],
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as OnboardingStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', user?.id] });
    },
  });

  return {
    onboarding,
    isLoading,
    shouldShowOnboarding: !isLoading && onboarding === null,
    isOnboardingComplete: onboarding?.completed ?? false,
    currentStep: onboarding?.current_step ?? 0,
    stepsCompleted: onboarding?.steps_completed ?? [],
    initOnboarding,
    completeStep,
    skipOnboarding,
    resetOnboarding,
  };
}
