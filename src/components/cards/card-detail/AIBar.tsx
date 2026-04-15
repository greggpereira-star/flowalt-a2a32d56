import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIBarProps {
  onAction?: (action: 'summary' | 'similar' | 'question') => void;
}

export const AIBar: React.FC<AIBarProps> = ({ onAction }) => {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer group/ai transition-all"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)',
        border: '1px solid hsl(var(--primary) / 0.15)',
      }}
      onClick={() => onAction?.('question')}
    >
      <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse flex-shrink-0" />
      <p className="text-xs text-muted-foreground">
        Peça à IA para{' '}
        <button onClick={(e) => { e.stopPropagation(); onAction?.('summary'); }} className="text-primary font-medium hover:underline">
          criar um resumo
        </button>
        ,{' '}
        <button onClick={(e) => { e.stopPropagation(); onAction?.('similar'); }} className="text-primary font-medium hover:underline">
          encontrar tarefas semelhantes
        </button>
        {' '}ou{' '}
        <button onClick={(e) => { e.stopPropagation(); onAction?.('question'); }} className="text-primary font-medium hover:underline">
          faça uma pergunta sobre esta tarefa
        </button>
      </p>
    </div>
  );
};
