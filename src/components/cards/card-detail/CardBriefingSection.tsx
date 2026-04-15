import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  User,
  Target,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefingData {
  context?: string;
  target_audience?: string;
  deliverables?: string;
  references?: string;
  deadline_notes?: string;
  special_instructions?: string;
}

interface CardBriefingSectionProps {
  isCompleted: boolean;
  briefingData: BriefingData;
  onOpenBriefing: () => void;
}

export const CardBriefingSection: React.FC<CardBriefingSectionProps> = ({
  isCompleted,
  briefingData,
  onOpenBriefing,
}) => {
  const filledFields = Object.values(briefingData).filter(v => v && v.trim()).length;
  const totalFields = 6;

  return (
    <button
      onClick={onOpenBriefing}
      className={cn(
        "w-full rounded-lg border p-4 transition-all hover:shadow-sm text-left group",
        isCompleted 
          ? "border-success/30 bg-success/5 hover:border-success/50" 
          : "border-warning/30 bg-warning/5 hover:border-warning/50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "p-2 rounded-lg flex-shrink-0",
          isCompleted ? "bg-success/10" : "bg-warning/10"
        )}>
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "text-sm font-medium",
              isCompleted ? "text-success" : "text-warning"
            )}>
              {isCompleted ? "Briefing Completo" : "Preencher Briefing"}
            </h4>
            {isCompleted && (
              <Badge 
                variant="secondary" 
                className="h-5 text-[10px] bg-success/10 text-success border-0"
              >
                Validado
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5">
            {isCompleted 
              ? "Clique para visualizar ou editar" 
              : `${filledFields}/${totalFields} campos preenchidos`
            }
          </p>

          {/* Mini progress bar */}
          {!isCompleted && (
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: totalFields }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < filledFields ? "bg-warning" : "bg-muted-foreground/15"
                  )}
                />
              ))}
            </div>
          )}

          {/* Quick info badges */}
          {(briefingData.context || briefingData.target_audience || briefingData.deliverables) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {briefingData.context && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 border-border/50">
                  <FileText className="h-2.5 w-2.5" />
                  Contexto
                </Badge>
              )}
              {briefingData.target_audience && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 border-border/50">
                  <User className="h-2.5 w-2.5" />
                  Público
                </Badge>
              )}
              {briefingData.deliverables && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 border-border/50">
                  <Target className="h-2.5 w-2.5" />
                  Entregáveis
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1" />
      </div>
    </button>
  );
};
