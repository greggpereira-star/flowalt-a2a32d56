import React from 'react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { AlignLeft, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardDescriptionSectionProps {
  description: string;
  onChange: (description: string) => void;
  onSave: () => void;
  isDirty: boolean;
}

export const CardDescriptionSection: React.FC<CardDescriptionSectionProps> = ({
  description,
  onChange,
  onSave,
  isDirty,
}) => {

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlignLeft className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Descrição</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            Escrever com IA
          </Button>
          
          {isDirty && (
            <Button
              size="sm"
              onClick={onSave}
              className="h-7 gap-1.5 text-xs"
            >
              <Check className="h-3 w-3" />
              Salvar
            </Button>
          )}
        </div>
      </div>
      
      <div 
        className={cn(
          "rounded-lg border transition-all",
          "border-border/50 hover:border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20"
        )}
      >
        <RichTextEditor
          value={description}
          onChange={onChange}
          placeholder="Adicione uma descrição detalhada para este card..."
          minHeight="100px"
          maxHeight="250px"
        />
      </div>
    </div>
  );
};
