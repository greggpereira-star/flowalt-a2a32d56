import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { IconPicker } from './IconPicker';
import { Folder, Smartphone, ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpaceType = 'custom' | 'social_media';

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; icon: string; color: string; type: SpaceType }) => Promise<void>;
  isLoading?: boolean;
}

interface SpaceTypeConfig {
  icon: typeof Folder;
  defaultIcon: string;
  defaultColor: string;
  title: string;
  description: string;
  placeholder: string;
  badge?: string;
}

const SPACE_TYPE_CONFIG: Record<SpaceType, SpaceTypeConfig> = {
  custom: {
    icon: Folder,
    defaultIcon: 'folder',
    defaultColor: '#6366f1',
    title: 'Espaço Comum',
    description: 'Estrutura livre. Ideal para projetos gerais, administrativo ou áreas customizadas.',
    placeholder: 'Ex: Administrativo, Marketing...',
  },
  social_media: {
    icon: Smartphone,
    defaultIcon: 'smartphone',
    defaultColor: '#0ea5e9',
    title: 'Espaço Social Media',
    description: 'Estrutura por colaborador com templates prontos. Ideal para gestão de conteúdo e calendário editorial.',
    placeholder: 'Ex: Social Media, Conteúdo...',
    badge: 'Recomendado para Social',
  },
};

const COLORS = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export function CreateSpaceDialog({ open, onOpenChange, onSubmit, isLoading }: CreateSpaceDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<SpaceType>('custom');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState('#6366f1');

  const handleTypeChange = (type: SpaceType) => {
    setSelectedType(type);
    setIcon(SPACE_TYPE_CONFIG[type].defaultIcon);
    setColor(SPACE_TYPE_CONFIG[type].defaultColor);
  };

  const handleNext = () => {
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), icon, color, type: selectedType });
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setSelectedType('custom');
    setName('');
    setIcon(SPACE_TYPE_CONFIG.custom.defaultIcon);
    setColor(SPACE_TYPE_CONFIG.custom.defaultColor);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Espaço</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Escolha o tipo de espaço. Isso define a estrutura inicial e recursos disponíveis.'
              : 'Configure os detalhes do seu novo espaço.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <RadioGroup
              value={selectedType}
              onValueChange={(value) => handleTypeChange(value as SpaceType)}
              className="grid gap-4"
            >
              {(Object.entries(SPACE_TYPE_CONFIG) as [SpaceType, SpaceTypeConfig][]).map(
                ([type, config]) => {
                  const Icon = config.icon;
                  const isSelected = selectedType === type;

                  return (
                    <label
                      key={type}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <RadioGroupItem value={type} className="mt-1" />
                      <div
                        className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${config.defaultColor}20` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: config.defaultColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{config.title}</span>
                          {config.badge && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                              <Sparkles className="w-3 h-3" />
                              {config.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                      </div>
                    </label>
                  );
                }
              )}
            </RadioGroup>

            <div className="flex justify-end pt-4">
              <Button onClick={handleNext}>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="space-name">Nome do Espaço</Label>
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={SPACE_TYPE_CONFIG[selectedType].placeholder}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Espaço'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
