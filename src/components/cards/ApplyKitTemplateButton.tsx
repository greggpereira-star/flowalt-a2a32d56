import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileStack, Zap } from 'lucide-react';
import { useKitTemplates, useApplyKitTemplate } from '@/hooks/useKitTemplates';

interface ApplyKitTemplateButtonProps {
  cardId: string;
  spaceType?: string;
}

export function ApplyKitTemplateButton({ cardId, spaceType }: ApplyKitTemplateButtonProps) {
  const { data: templates = [] } = useKitTemplates(spaceType);
  const applyTemplate = useApplyKitTemplate();
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Also fetch all templates if spaceType filter returns empty
  const { data: allTemplates = [] } = useKitTemplates();
  const availableTemplates = templates.length > 0 ? templates : allTemplates;

  const handleApply = async () => {
    if (!selectedTemplateId) return;
    
    try {
      await applyTemplate.mutateAsync({ templateId: selectedTemplateId, cardId });
      setOpen(false);
      setSelectedTemplateId('');
    } catch {
      // Error handled by mutation
    }
  };

  if (availableTemplates.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="h-4 w-4" />
          Aplicar Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            Aplicar Template de Kit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar template..." />
            </SelectTrigger>
            <SelectContent>
              {availableTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center gap-2">
                    <span>{template.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {template.items?.length || 0} itens
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTemplateId && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Itens do template:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {availableTemplates
                  .find(t => t.id === selectedTemplateId)
                  ?.items?.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span>•</span>
                      <span>{item.item?.name}</span>
                      <span className="text-muted-foreground/70">x{item.quantity}</span>
                      {item.is_required && (
                        <Badge variant="secondary" className="text-[10px] px-1">
                          Obrigatório
                        </Badge>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <Button
            onClick={handleApply}
            className="w-full"
            disabled={!selectedTemplateId || applyTemplate.isPending}
          >
            Aplicar ao Kit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
