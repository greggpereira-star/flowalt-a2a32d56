import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Loader2,
  Lightbulb,
  CheckSquare,
  FileText,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useCardAI } from '@/hooks/useCardAI';
import { useCard } from '@/hooks/useCards';
import { useChecklists, useCreateChecklist } from '@/hooks/useChecklists';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CardAIAssistantProps {
  cardId: string;
  isBlocked?: boolean;
}

interface Suggestion {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

const PRIORITY_STYLES = {
  high: 'bg-red-500/10 text-red-600 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const PRIORITY_LABELS = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const CardAIAssistant: React.FC<CardAIAssistantProps> = ({
  cardId,
  isBlocked = false,
}) => {
  const { data: card } = useCard(cardId);
  const { data: checklists } = useChecklists(cardId);
  const createChecklist = useCreateChecklist();
  const { isLoading, getSuggestions, generateChecklist } = useCardAI();
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'checklist'>('suggestions');
  const [generatedChecklist, setGeneratedChecklist] = useState<{ title: string; order: number }[]>([]);

  const checklistProgress = checklists
    ? {
        completed: checklists.filter((c) => c.is_completed).length,
        total: checklists.length,
      }
    : undefined;

  const handleGetSuggestions = async () => {
    if (!card) return;
    const result = await getSuggestions(card, checklistProgress, isBlocked);
    if (result) {
      setSuggestions(result);
    }
  };

  const handleGenerateChecklist = async () => {
    if (!card) return;
    const result = await generateChecklist(card);
    if (result) {
      setGeneratedChecklist(result);
    }
  };

  const handleApplyChecklist = async () => {
    if (!card || generatedChecklist.length === 0) return;
    
    try {
      for (const item of generatedChecklist) {
        await createChecklist.mutateAsync({
          card_id: card.id,
          title: item.title,
        });
      }
      toast.success(`${generatedChecklist.length} itens adicionados ao checklist`);
      setGeneratedChecklist([]);
    } catch {
      toast.error('Erro ao aplicar checklist');
    }
  };

  if (!card) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'suggestions' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setActiveTab('suggestions')}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Sugestões
          </Button>
          <Button
            variant={activeTab === 'checklist' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setActiveTab('checklist')}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Checklist
          </Button>
        </div>

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleGetSuggestions}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar Sugestões de Ações
            </Button>

            {suggestions.length > 0 && (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-background border space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">
                          {suggestion.action}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', PRIORITY_STYLES[suggestion.priority])}
                        >
                          {PRIORITY_LABELS[suggestion.priority]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {suggestions.length === 0 && !isLoading && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Clique para obter sugestões inteligentes</p>
                <p className="text-xs mt-1">baseadas no contexto do card</p>
              </div>
            )}
          </div>
        )}

        {/* Checklist Tab */}
        {activeTab === 'checklist' && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleGenerateChecklist}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar Checklist com IA
            </Button>

            {generatedChecklist.length > 0 && (
              <>
                <ScrollArea className="h-[160px]">
                  <div className="space-y-1.5 pr-4">
                    {generatedChecklist.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded bg-background border text-sm"
                      >
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleApplyChecklist}
                  disabled={createChecklist.isPending}
                >
                  {createChecklist.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Aplicar Checklist ao Card
                </Button>
              </>
            )}

            {generatedChecklist.length === 0 && !isLoading && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Gere um checklist automaticamente</p>
                <p className="text-xs mt-1">baseado no título e descrição</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
