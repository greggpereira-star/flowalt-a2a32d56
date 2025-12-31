import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Card } from './useCards';

interface AIActionSuggestion {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface AIChecklistItem {
  title: string;
  order: number;
}

interface AIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const useCardAI = () => {
  const [isLoading, setIsLoading] = useState(false);

  const getSuggestions = async (
    card: Card,
    checklistProgress?: { completed: number; total: number },
    isBlocked?: boolean
  ): Promise<AIActionSuggestion[] | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AIResponse<{ suggestions: AIActionSuggestion[] }>>(
        'card-ai-assistant',
        {
          body: {
            type: 'suggestions',
            cardContext: {
              title: card.title,
              description: card.description,
              status: card.status,
              urgency: card.urgency,
              dueDate: card.due_date,
              estimatedHours: card.estimated_hours,
              actualHours: card.actual_hours,
              briefingCompleted: card.briefing_completed,
              checklistProgress,
              isBlocked,
            },
          },
        }
      );

      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.data?.suggestions || null;
    } catch (err) {
      console.error('AI suggestions error:', err);
      toast.error('Erro ao obter sugestões da IA');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const generateChecklist = async (card: Card): Promise<AIChecklistItem[] | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AIResponse<{ items: AIChecklistItem[] }>>(
        'card-ai-assistant',
        {
          body: {
            type: 'checklist',
            cardContext: {
              title: card.title,
              description: card.description,
              status: card.status,
              urgency: card.urgency,
            },
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.data?.items || null;
    } catch (err) {
      console.error('AI checklist error:', err);
      toast.error('Erro ao gerar checklist com IA');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const improveDescription = async (card: Card): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AIResponse<{ content: string }>>(
        'card-ai-assistant',
        {
          body: {
            type: 'description',
            cardContext: {
              title: card.title,
              description: card.description,
              status: card.status,
              urgency: card.urgency,
            },
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.data?.content || null;
    } catch (err) {
      console.error('AI description error:', err);
      toast.error('Erro ao melhorar descrição com IA');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    getSuggestions,
    generateChecklist,
    improveDescription,
  };
};
