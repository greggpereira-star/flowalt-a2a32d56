import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import {
  CheckCircle2,
  FileText,
  Users,
  Package,
  Link2,
  Clock,
  Lightbulb,
  AlertCircle,
  Eye,
  Circle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BriefingData } from './BriefingForm';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { BriefingSummarySheet } from './BriefingSummarySheet';
import { mergeBriefingDataPreservingFilled, normalizeBriefingData } from './briefingDataUtils';

interface ValidationResult {
  isValid: boolean;
  message: string;
  issues: string[];
  suggestions?: string[];
}

interface BriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BriefingData;
  onChange: (data: BriefingData, cardId?: string) => void;
  isCompleted: boolean;
  onMarkComplete: (cardId?: string, briefingDataOverride?: BriefingData) => void;
  disabled?: boolean;
  cardTitle?: string;
  cardId?: string;
}

const SECTIONS = [
  {
    id: 'context',
    title: 'Contexto',
    subtitle: 'O que é o projeto?',
    icon: FileText,
    field: 'context' as keyof BriefingData,
    placeholder: 'Descreva o contexto do projeto, objetivo principal e informações relevantes para quem vai executar...',
    required: true,
    minLength: 10,
    tip: 'Inclua objetivo, problema a resolver e histórico relevante.',
  },
  {
    id: 'audience',
    title: 'Público-Alvo',
    subtitle: 'Para quem é?',
    icon: Users,
    field: 'target_audience' as keyof BriefingData,
    placeholder: 'Quem é o público-alvo? Descreva idade, interesses, comportamento, dores...',
    required: false,
    tip: 'Quanto mais detalhado, melhor a execução.',
  },
  {
    id: 'deliverables',
    title: 'Entregáveis',
    subtitle: 'O que entregar?',
    icon: Package,
    field: 'deliverables' as keyof BriefingData,
    placeholder: 'Liste o que precisa ser entregue: formatos, dimensões, quantidade, especificações técnicas...',
    required: true,
    minLength: 10,
    tip: 'Ex.: "3 posts carrossel 1080x1350, 1 story animado".',
  },
  {
    id: 'references',
    title: 'Referências',
    subtitle: 'Inspirações',
    icon: Link2,
    field: 'references' as keyof BriefingData,
    placeholder: 'Links, imagens de inspiração, exemplos de estilo, tom de comunicação...',
    required: false,
    tip: 'Cole links ou descreva referências visuais.',
  },
  {
    id: 'deadline',
    title: 'Prazos',
    subtitle: 'Observações de tempo',
    icon: Clock,
    field: 'deadline_notes' as keyof BriefingData,
    placeholder: 'Urgências, feriados, eventos importantes, dependências de timing...',
    required: false,
    tip: 'Informe se há data crítica ou evento.',
  },
  {
    id: 'instructions',
    title: 'Instruções',
    subtitle: 'Regras especiais',
    icon: Lightbulb,
    field: 'special_instructions' as keyof BriefingData,
    placeholder: 'Restrições, cores proibidas, tom de voz, do & donts...',
    required: false,
    tip: 'O que NÃO pode acontecer neste projeto.',
  },
];

export const BriefingDialog: React.FC<BriefingDialogProps> = ({
  open,
  onOpenChange,
  data,
  onChange,
  isCompleted,
  onMarkComplete,
  disabled,
  cardTitle,
  cardId,
}) => {
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const [localData, setLocalData] = useState<BriefingData>(() => normalizeBriefingData(data));
  const hasUnsavedChanges = useRef(false);
  const localDataRef = useRef(localData);
  const cardIdRef = useRef(cardId);
  const onChangeRef = useRef(onChange);

  useEffect(() => { localDataRef.current = localData; }, [localData]);
  useEffect(() => { cardIdRef.current = cardId; }, [cardId]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const lastCardIdRef = useRef(cardId);
  useEffect(() => {
    if (cardId !== lastCardIdRef.current) {
      lastCardIdRef.current = cardId;
      hasUnsavedChanges.current = false;
      const nextData = normalizeBriefingData(data);
      localDataRef.current = nextData;
      setLocalData(nextData);
      return;
    }
    if (open && !hasUnsavedChanges.current) {
      setLocalData(prev => {
        const nextData = mergeBriefingDataPreservingFilled(prev, data);
        localDataRef.current = nextData;
        return nextData;
      });
    }
  }, [open, data, cardId]);

  // Debounced auto-save
  useEffect(() => {
    if (!open || !cardId) return;
    if (!hasUnsavedChanges.current) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      if (hasUnsavedChanges.current && cardIdRef.current) {
        onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
        hasUnsavedChanges.current = false;
        setSaveStatus('saved');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [localData, open, cardId]);

  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open && hasUnsavedChanges.current && cardIdRef.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    return () => {
      if (hasUnsavedChanges.current && cardIdRef.current) {
        onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
        hasUnsavedChanges.current = false;
      }
    };
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && cardIdRef.current && hasUnsavedChanges.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const persistLocalData = useCallback(() => {
    if (hasUnsavedChanges.current && cardIdRef.current) {
      onChangeRef.current(normalizeBriefingData(localDataRef.current), cardIdRef.current);
      hasUnsavedChanges.current = false;
      setSaveStatus('saved');
    }
  }, []);

  const updateField = useCallback((field: keyof BriefingData, value: string) => {
    setLocalData(prev => {
      const nextData = { ...prev, [field]: value };
      localDataRef.current = nextData;
      return nextData;
    });
    hasUnsavedChanges.current = true;
    setSaveStatus('saving');
    if (validationError) setValidationError(null);
  }, [validationError]);

  const getFieldValue = useCallback((field: keyof BriefingData): string => {
    return localData[field] || '';
  }, [localData]);

  const isSectionComplete = useCallback((idx: number): boolean => {
    const s = SECTIONS[idx];
    const v = extractPlainText(getFieldValue(s.field));
    if (s.required) return v.length >= (s.minLength || 1);
    return v.length > 0;
  }, [getFieldValue]);

  const missingRequiredSections = SECTIONS.filter((s) => {
    if (!s.required) return false;
    const v = extractPlainText(getFieldValue(s.field));
    return v.length < (s.minLength || 1);
  });
  const requiredComplete = missingRequiredSections.length === 0;

  const filledCount = SECTIONS.filter((_, idx) => isSectionComplete(idx)).length;
  const progressPercent = (filledCount / SECTIONS.length) * 100;

  // Scrollspy
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !open) return;
    const handler = () => {
      const top = root.scrollTop + 120;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (el && el.offsetTop <= top) current = s.id;
      }
      setActiveSection(current);
    };
    root.addEventListener('scroll', handler, { passive: true });
    return () => root.removeEventListener('scroll', handler);
  }, [open]);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    const root = scrollRef.current;
    if (el && root) {
      root.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    }
  };

  const handleComplete = useCallback(() => {
    if (!cardId) {
      toast.error('Card ainda não carregado. Abra o briefing novamente.');
      return;
    }
    if (!requiredComplete) {
      setValidationError({
        isValid: false,
        message: 'Preencha os campos obrigatórios',
        issues: ['Contexto e Entregáveis são obrigatórios'],
      });
      toast.error('Preencha os campos obrigatórios');
      const firstMissing = missingRequiredSections[0];
      if (firstMissing) scrollToSection(firstMissing.id);
      return;
    }
    onMarkComplete(cardId, normalizeBriefingData(localDataRef.current));
    hasUnsavedChanges.current = false;
    toast.success('Briefing completo!');
    onOpenChange(false);
  }, [requiredComplete, onMarkComplete, onOpenChange, cardId, missingRequiredSections]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl h-[92vh] max-h-[900px] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b bg-background">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-xl font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span>Briefing</span>
              </DialogTitle>
              {cardTitle && (
                <DialogDescription className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-snug break-words">
                  {cardTitle}
                </DialogDescription>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={cn(
                  'hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full transition-colors',
                  saveStatus === 'saving' && 'text-amber-600 bg-amber-500/10',
                  saveStatus === 'saved' && 'text-success bg-success/10',
                  saveStatus === 'idle' && 'text-muted-foreground bg-muted'
                )}
                aria-live="polite"
              >
                {saveStatus === 'saving' && <>● Salvando…</>}
                {saveStatus === 'saved' && <><CheckCircle2 className="h-3 w-3" /> Salvo</>}
                {saveStatus === 'idle' && <>Salvamento automático</>}
              </span>

              {isCompleted && (
                <Badge className="bg-success/20 text-success border-success/30 gap-1 text-[10px] sm:text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Completo</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span className="text-muted-foreground">Progresso do briefing</span>
              <span className="font-medium text-primary">{filledCount} de {SECTIONS.length} seções</span>
            </div>
            <Progress value={progressPercent} className="h-1 sm:h-1.5" />
          </div>
        </DialogHeader>

        {/* Validation */}
        {validationError && !validationError.isValid && (
          <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 flex gap-2 p-2 sm:p-3 rounded-lg border border-destructive/50 bg-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm min-w-0">
              <p className="font-medium text-destructive">Campos obrigatórios pendentes</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {missingRequiredSections.map(s => s.title).join(' • ')}
              </p>
            </div>
          </div>
        )}

        {/* Body: sidebar + scrollable single-page */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Sidebar nav (desktop) */}
          <aside className="hidden md:flex flex-col w-56 border-r bg-muted/20 p-3 gap-1 overflow-y-auto">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Seções
            </p>
            {SECTIONS.map((s, idx) => {
              const Icon = s.icon;
              const complete = isSectionComplete(idx);
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-all',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span className={cn(
                    'flex items-center justify-center h-6 w-6 rounded-md flex-shrink-0 transition-colors',
                    complete
                      ? 'bg-success/15 text-success'
                      : active
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 truncate">{s.title}</span>
                  {s.required && !complete && (
                    <span className="text-destructive text-xs">*</span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Mobile section chips */}
          <div className="md:hidden flex-shrink-0 absolute left-0 right-0 z-10" />

          <div className="flex-1 min-w-0 flex flex-col">
            {/* Mobile chips */}
            <div className="md:hidden flex-shrink-0 px-4 py-2 border-b bg-background overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {SECTIONS.map((s, idx) => {
                  const Icon = s.icon;
                  const complete = isSectionComplete(idx);
                  const active = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : complete
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {complete ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      {s.title}
                      {s.required && !complete && <span className="text-destructive">*</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable single-page content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
                {SECTIONS.map((s, idx) => {
                  const Icon = s.icon;
                  const complete = isSectionComplete(idx);
                  const value = getFieldValue(s.field);
                  const charCount = extractPlainText(value).length;
                  return (
                    <section
                      key={s.id}
                      ref={(el) => { sectionRefs.current[s.id] = el; }}
                      className="scroll-mt-4"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 transition-colors',
                          complete ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
                        )}>
                          {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-semibold">{s.title}</h3>
                            {s.required ? (
                              <span className="text-[10px] font-medium text-destructive uppercase tracking-wider">
                                Obrigatório
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Opcional
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">{s.subtitle}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <RichTextEditor
                          value={value}
                          onChange={(v) => updateField(s.field, v)}
                          placeholder={s.placeholder}
                          disabled={disabled}
                          minHeight="140px"
                          maxHeight="340px"
                        />
                        <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
                          <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                            <Lightbulb className="h-3 w-3 flex-shrink-0" />
                            <span>{s.tip}</span>
                          </p>
                          {s.minLength && (
                            <p className={cn(
                              'text-[10px] sm:text-xs flex-shrink-0',
                              charCount >= s.minLength ? 'text-success' : 'text-muted-foreground'
                            )}>
                              {charCount} / mín. {s.minLength}
                            </p>
                          )}
                        </div>
                      </div>

                      {idx < SECTIONS.length - 1 && (
                        <div className="mt-6 sm:mt-8 border-b border-border/50" />
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t bg-muted/30 flex items-center justify-between gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => { persistLocalData(); setShowSummary(true); }}
                  size="sm"
                  className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ver Resumo</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium ml-1">
                    {filledCount}/{SECTIONS.length}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Ver briefing completo</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={persistLocalData}
              disabled={saveStatus !== 'saving'}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Salvar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      onClick={handleComplete}
                      disabled={!requiredComplete || disabled || isCompleted}
                      size="sm"
                      className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">
                        {isCompleted ? 'Completo' : 'Concluir Briefing'}
                      </span>
                      <span className="sm:hidden">{isCompleted ? 'Completo' : 'Concluir'}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {!requiredComplete && !isCompleted && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Faltam campos obrigatórios:</p>
                    <ul className="text-xs list-disc pl-4">
                      {missingRequiredSections.map(s => <li key={s.id}>{s.title}</li>)}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <BriefingSummarySheet
          open={showSummary}
          onOpenChange={setShowSummary}
          data={localData}
          isCompleted={isCompleted}
          cardTitle={cardTitle}
          onEditStep={(idx) => {
            setShowSummary(false);
            const s = SECTIONS[idx];
            if (s) setTimeout(() => scrollToSection(s.id), 100);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
