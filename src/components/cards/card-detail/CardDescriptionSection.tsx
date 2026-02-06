import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FileText, Sparkles, Save } from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const hasDescription = description && description.trim().length > 0;

  if (!isEditing && !hasDescription) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setIsEditing(true)}
          className="w-full flex items-center gap-3 py-3 px-4 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30 transition-all text-left group"
        >
          <FileText className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            Adicionar descrição
          </span>
        </button>
        
        <button className="flex items-center gap-2 text-xs text-primary hover:underline">
          <Sparkles className="h-3 w-3" />
          <span>Escrever com IA</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <RichTextEditor
        value={description}
        onChange={onChange}
        placeholder="Adicione uma descrição detalhada..."
        minHeight="120px"
        maxHeight="300px"
      />
      
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-xs text-primary hover:underline">
          <Sparkles className="h-3 w-3" />
          <span>Escrever com IA</span>
        </button>
        
        {isDirty && (
          <Button
            size="sm"
            onClick={onSave}
            className="h-7 gap-1.5 text-xs"
          >
            <Save className="h-3 w-3" />
            Salvar
          </Button>
        )}
      </div>
    </div>
  );
};
