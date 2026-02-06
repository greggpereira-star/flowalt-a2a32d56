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
import { Separator } from '@/components/ui/separator';
import { IconPicker } from './IconPicker';
import { SpaceTemplatePreview } from './SpaceTemplatePreview';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Eye, AlertTriangle, Lock, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  SPACE_TEMPLATES, 
  type SpaceTemplateType, 
  type SpaceTemplate,
  templateHasStructure,
} from '@/lib/spaceTemplates';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUserSpaceTemplates, useDeleteUserTemplate, type UserSpaceTemplate } from '@/hooks/useSpaceTemplateActions';

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { 
    name: string; 
    icon: string; 
    color: string; 
    type: SpaceTemplateType;
    template: SpaceTemplate;
    userTemplate?: UserSpaceTemplate;
  }) => Promise<void>;
  isLoading?: boolean;
}

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

type WizardStep = 1 | 2 | 3;

export function CreateSpaceDialog({ open, onOpenChange, onSubmit, isLoading }: CreateSpaceDialogProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedType, setSelectedType] = useState<SpaceTemplateType>('blank');
  const [selectedUserTemplate, setSelectedUserTemplate] = useState<UserSpaceTemplate | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState('#6366f1');

  const { currentRole } = useWorkspace();
  const { within, explain } = useEntitlementRegistry();
  const canCreateSpace = within('spaces_limit');
  const explanation = explain('spaces_limit');
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  // User templates
  const { data: userTemplates = [] } = useUserSpaceTemplates();
  const deleteUserTemplate = useDeleteUserTemplate();

  const template = SPACE_TEMPLATES[selectedType];
  const hasStructure = templateHasStructure(selectedType);

  const handleTypeChange = (type: SpaceTemplateType) => {
    setSelectedType(type);
    setSelectedUserTemplate(null); // Clear user template selection
    const newTemplate = SPACE_TEMPLATES[type];
    setIcon(newTemplate.defaultIcon);
    setColor(newTemplate.defaultColor);
  };

  const handleUserTemplateSelect = (userTemplate: UserSpaceTemplate) => {
    setSelectedUserTemplate(userTemplate);
    setSelectedType('blank'); // Reset system template selection
    setIcon(userTemplate.icon);
    setColor(userTemplate.color);
    setName(userTemplate.name.replace('Template - ', ''));
  };

  const handleNext = () => {
    if (step === 1) {
      // If template has structure, show preview. Otherwise, skip to details.
      setStep(hasStructure ? 2 : 3);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(hasStructure ? 2 : 1);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit({ 
      name: name.trim(), 
      icon, 
      color, 
      type: selectedType,
      template,
      userTemplate: selectedUserTemplate || undefined,
    });
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setSelectedType('blank');
    setSelectedUserTemplate(null);
    setName('');
    setIcon(SPACE_TEMPLATES.blank.defaultIcon);
    setColor(SPACE_TEMPLATES.blank.defaultColor);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleDeleteUserTemplate = async (templateKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteUserTemplate.mutateAsync(templateKey);
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Escolha um Template';
      case 2:
        return 'Prévia do Template';
      case 3:
        return 'Configurar Espaço';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return 'Templates são opcionais e apenas sugerem uma estrutura inicial.';
      case 2:
        return 'Veja o que será criado com este template. Você pode personalizar depois.';
      case 3:
        return 'Configure os detalhes do seu novo espaço.';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{getStepTitle()}</DialogTitle>
            <div className="flex items-center gap-1 ml-auto">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    step >= s ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          </div>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {/* Step 1: Template Selection */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Limit warning */}
            {!canCreateSpace && explanation.reason_code !== 'OK' && (
              <div className="p-4 rounded-lg border border-warning bg-warning/10">
                <div className="flex items-center gap-2 text-warning-foreground">
                  {explanation.reason_code === 'DISABLED' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span className="font-medium">{explanation.message}</span>
                </div>
                {explanation.cta && isAdmin && (
                  <p className="text-sm text-muted-foreground mt-1">{explanation.cta}</p>
                )}
                {explanation.limit && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {explanation.current}/{explanation.limit} Espaços utilizados
                  </p>
                )}
              </div>
            )}

            {canCreateSpace && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {/* User Templates Section */}
                {userTemplates.length > 0 && (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Seus Templates
                      </h4>
                      <div className="grid gap-2">
                        {userTemplates.map((userTpl) => {
                          const isSelected = selectedUserTemplate?.key === userTpl.key;
                          return (
                            <div
                              key={userTpl.key}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all group',
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              )}
                              onClick={() => handleUserTemplateSelect(userTpl)}
                            >
                              <div
                                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${userTpl.color}20` }}
                              >
                                <Sparkles className="w-5 h-5" style={{ color: userTpl.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground">{userTpl.name}</span>
                                {userTpl.description && (
                                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                    {userTpl.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {userTpl.folders_config.length} pasta(s)
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={(e) => handleDeleteUserTemplate(userTpl.key, e)}
                                disabled={deleteUserTemplate.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* System Templates */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Templates do Sistema
                  </h4>
                  <RadioGroup
                    value={selectedUserTemplate ? '' : selectedType}
                    onValueChange={(value) => handleTypeChange(value as SpaceTemplateType)}
                    className="grid gap-2"
                  >
                    {Object.entries(SPACE_TEMPLATES).map(([type, config]) => {
                      const Icon = config.icon;
                      const isSelected = !selectedUserTemplate && selectedType === type;

                      return (
                        <label
                          key={type}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <RadioGroupItem value={type} className="mt-1" />
                          <div
                            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${config.defaultColor}20` }}
                          >
                            <Icon className="w-5 h-5" style={{ color: config.defaultColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{config.name}</span>
                              {config.badge && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                  <Sparkles className="w-3 h-3" />
                                  {config.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {config.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleNext} disabled={!canCreateSpace}>
                {hasStructure ? (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Preview
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Template Preview */}
        {step === 2 && (
          <div className="space-y-4">
            <SpaceTemplatePreview 
              template={template} 
              spaceName={name || undefined}
              spaceColor={color}
            />

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleNext}>
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Space Details */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="space-name">Nome do Espaço</Label>
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ex: ${template.name}`}
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

            {/* Template indicator */}
            {templateHasStructure(selectedType) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <template.icon className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">
                  Template: <span className="font-medium text-foreground">{template.name}</span>
                </span>
              </div>
            )}

            <div className="flex justify-between pt-2">
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
