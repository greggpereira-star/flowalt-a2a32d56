import React, { useState, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Users,
  Package,
  Link2,
  Clock,
  Lightbulb,
  CheckCircle2,
  Circle,
  Copy,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileDown,
  File,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextViewer, isRichTextEmpty, extractPlainText } from '@/components/ui/rich-text-viewer';
import type { BriefingData } from './BriefingForm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BriefingSummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BriefingData;
  isCompleted: boolean;
  cardTitle?: string;
  onEditStep?: (stepIndex: number) => void;
}

const FIELDS = [
  {
    key: 'context' as keyof BriefingData,
    label: 'Contexto do Projeto',
    icon: FileText,
    required: true,
    description: 'Objetivo principal e informações relevantes',
    stepIndex: 0,
  },
  {
    key: 'target_audience' as keyof BriefingData,
    label: 'Público-Alvo',
    icon: Users,
    required: false,
    description: 'Quem é o público-alvo',
    stepIndex: 1,
  },
  {
    key: 'deliverables' as keyof BriefingData,
    label: 'Entregáveis',
    icon: Package,
    required: true,
    description: 'O que precisa ser entregue',
    stepIndex: 2,
  },
  {
    key: 'references' as keyof BriefingData,
    label: 'Referências',
    icon: Link2,
    required: false,
    description: 'Inspirações e exemplos',
    stepIndex: 3,
  },
  {
    key: 'deadline_notes' as keyof BriefingData,
    label: 'Observações de Prazo',
    icon: Clock,
    required: false,
    description: 'Urgências e datas importantes',
    stepIndex: 4,
  },
  {
    key: 'special_instructions' as keyof BriefingData,
    label: 'Instruções Especiais',
    icon: Lightbulb,
    required: false,
    description: 'Restrições e regras especiais',
    stepIndex: 5,
  },
];

export const BriefingSummarySheet: React.FC<BriefingSummarySheetProps> = ({
  open,
  onOpenChange,
  data,
  isCompleted,
  cardTitle,
  onEditStep,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: true }), {})
  );
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filledFields = FIELDS.filter(f => !isRichTextEmpty(data[f.key]));
  const totalFields = FIELDS.length;
  const requiredFields = FIELDS.filter(f => f.required);
  const requiredFilled = requiredFields.filter(f => !isRichTextEmpty(data[f.key]));

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllSections = (expanded: boolean) => {
    setExpandedSections(FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: expanded }), {}));
  };

  const scrollToSection = (key: string) => {
    const ref = sectionRefs.current[key];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyAll = useCallback(() => {
    const text = FIELDS
      .filter(f => !isRichTextEmpty(data[f.key]))
      .map(f => `${f.label}:\n${extractPlainText(data[f.key])}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast.success('Briefing copiado para a área de transferência');
  }, [data]);

  const handleExportMarkdown = useCallback(() => {
    const markdown = [
      `# Briefing${cardTitle ? `: ${cardTitle}` : ''}`,
      '',
      `> Status: ${isCompleted ? '✅ Completo' : '⏳ Pendente'}`,
      `> Campos preenchidos: ${filledFields.length}/${totalFields}`,
      '',
      ...FIELDS
        .filter(f => !isRichTextEmpty(data[f.key]))
        .map(f => `## ${f.label}\n\n${extractPlainText(data[f.key])}`),
    ].join('\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `briefing${cardTitle ? `-${cardTitle.toLowerCase().replace(/\s+/g, '-')}` : ''}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Briefing exportado como Markdown');
  }, [data, cardTitle, isCompleted, filledFields.length, totalFields]);

  const handleEditSection = useCallback((stepIndex: number) => {
    onEditStep?.(stepIndex);
    onOpenChange(false);
  }, [onEditStep, onOpenChange]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = 25;

    // Helper to add new page if needed
    const checkNewPage = (heightNeeded: number) => {
      if (yPosition + heightNeeded > 270) {
        doc.addPage();
        yPosition = 25;
        return true;
      }
      return false;
    };

    // Header
    doc.setFillColor(99, 102, 241); // Primary color
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BRIEFING', margin, 20);
    
    if (cardTitle) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(cardTitle.substring(0, 60), margin, 30);
    }

    // Status badge
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const statusText = isCompleted ? 'COMPLETO' : 'PENDENTE';
    const statusWidth = doc.getTextWidth(statusText) + 10;
    doc.setFillColor(isCompleted ? 34 : 234, isCompleted ? 197 : 179, isCompleted ? 94 : 8);
    doc.roundedRect(pageWidth - margin - statusWidth, 15, statusWidth, 14, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, pageWidth - margin - statusWidth + 5, 24);

    yPosition = 55;

    // Summary stats
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Campos preenchidos: ${filledFields.length}/${totalFields}`, margin, yPosition);
    doc.text(`Obrigatórios: ${requiredFilled.length}/${requiredFields.length}`, margin + 80, yPosition);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin - 70, yPosition);
    
    yPosition += 15;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Sections
    FIELDS.forEach((field) => {
      const content = data[field.key];
      const isEmpty = isRichTextEmpty(content);
      const plainText = extractPlainText(content);

      checkNewPage(40);

      // Section header
      doc.setFillColor(isEmpty ? 245 : 239, isEmpty ? 245 : 246, isEmpty ? 245 : 255);
      doc.roundedRect(margin, yPosition - 5, contentWidth, 20, 3, 3, 'F');
      
      doc.setTextColor(isEmpty ? 150 : 99, isEmpty ? 150 : 102, isEmpty ? 150 : 241);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(field.label + (field.required ? ' *' : ''), margin + 5, yPosition + 7);
      
      if (!isEmpty) {
        doc.setTextColor(34, 197, 94);
        doc.setFontSize(8);
        doc.text('✓', pageWidth - margin - 10, yPosition + 7);
      }
      
      yPosition += 25;

      // Section content
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (isEmpty) {
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        doc.text('Não preenchido', margin + 5, yPosition);
        yPosition += 15;
      } else {
        // Split text into lines that fit the content width
        const lines = doc.splitTextToSize(plainText, contentWidth - 10);
        const lineHeight = 5;
        
        lines.forEach((line: string, idx: number) => {
          if (idx < 20) { // Limit lines per section
            checkNewPage(lineHeight + 5);
            doc.text(line, margin + 5, yPosition);
            yPosition += lineHeight;
          }
        });
        
        if (lines.length > 20) {
          doc.setTextColor(150, 150, 150);
          doc.text(`... (${lines.length - 20} linhas omitidas)`, margin + 5, yPosition);
          yPosition += lineHeight;
        }
        
        yPosition += 10;
      }
    });

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        'Flowalt - Briefing',
        margin,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    // Download
    const fileName = `briefing${cardTitle ? `-${cardTitle.toLowerCase().replace(/\s+/g, '-').substring(0, 30)}` : ''}.pdf`;
    doc.save(fileName);
    toast.success('Briefing exportado como PDF');
  }, [data, cardTitle, isCompleted, filledFields.length, totalFields, requiredFilled.length, requiredFields.length]);

  // Content component to reuse between Sheet and Dialog
  const SummaryContent = () => (
    <>
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold truncate">
                  Resumo do Briefing
                </h2>
                {cardTitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {cardTitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge 
              className={cn(
                'gap-1 sm:gap-1.5 text-[10px] sm:text-xs',
                isCompleted 
                  ? 'bg-success/20 text-success border-success/30' 
                  : 'bg-warning/20 text-warning border-warning/30'
              )}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Completo</span>
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Pendente</span>
                </>
              )}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFullscreen ? 'Minimizar' : 'Tela cheia'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Stats & Quick Navigation */}
        <div className="flex flex-col gap-3 mt-4">
          {/* Stats Row */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                {filledFields.length}/{totalFields} campos
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className={cn(
                "h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full",
                requiredFilled.length === requiredFields.length 
                  ? "bg-success" 
                  : "bg-warning"
              )} />
              <span className="text-muted-foreground">
                {requiredFilled.length}/{requiredFields.length} obrigatórios
              </span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">Ir para:</span>
            <div className="flex gap-1">
              {FIELDS.map((field) => {
                const isEmpty = isRichTextEmpty(data[field.key]);
                const Icon = field.icon;
                return (
                  <TooltipProvider key={field.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => scrollToSection(field.key)}
                          className={cn(
                            'p-1.5 rounded-md transition-colors flex-shrink-0',
                            isEmpty 
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80' 
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          )}
                        >
                          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {field.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            <div className="flex gap-1 ml-auto flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] sm:text-xs"
                onClick={() => toggleAllSections(true)}
              >
                Expandir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] sm:text-xs"
                onClick={() => toggleAllSections(false)}
              >
                Recolher
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {FIELDS.map((field) => {
            const Icon = field.icon;
            const isEmpty = isRichTextEmpty(data[field.key]);
            const isExpanded = expandedSections[field.key];
            
            return (
              <Card 
                key={field.key}
                ref={el => sectionRefs.current[field.key] = el}
                className={cn(
                  'transition-all duration-200 overflow-hidden',
                  isEmpty 
                    ? 'bg-muted/20 border-dashed border-muted-foreground/20' 
                    : 'hover:shadow-md hover:border-primary/20'
                )}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleSection(field.key)}>
                  <CollapsibleTrigger asChild>
                    <div className={cn(
                      'flex items-center gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer transition-colors',
                      'hover:bg-muted/50'
                    )}>
                      <div className={cn(
                        'p-1.5 sm:p-2 rounded-lg flex-shrink-0',
                        isEmpty ? 'bg-muted' : 'bg-primary/10'
                      )}>
                        <Icon className={cn(
                          'h-3.5 w-3.5 sm:h-4 sm:w-4',
                          isEmpty ? 'text-muted-foreground' : 'text-primary'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <h3 className={cn(
                            'text-sm sm:text-base font-medium truncate',
                            isEmpty && 'text-muted-foreground'
                          )}>
                            {field.label}
                          </h3>
                          {field.required && (
                            <span className="text-[10px] sm:text-xs text-destructive">*</span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {field.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {!isEmpty && (
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-3 sm:pb-4 px-3 sm:px-4">
                      {isEmpty ? (
                        <div className="flex items-center justify-between pl-9 sm:pl-12">
                          <p className="text-xs sm:text-sm text-muted-foreground italic">
                            Não preenchido
                          </p>
                          {onEditStep && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => handleEditSection(field.stepIndex)}
                            >
                              <Edit3 className="h-3 w-3" />
                              Preencher
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 sm:space-y-3">
                          <div className="pl-9 sm:pl-12 pr-1">
                            <RichTextViewer 
                              content={data[field.key]} 
                              className="text-xs sm:text-sm prose-p:my-1 prose-p:leading-relaxed"
                            />
                          </div>
                          {onEditStep && (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditSection(field.stepIndex)}
                              >
                                <Edit3 className="h-3 w-3" />
                                Editar
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-1.5 h-8 text-xs sm:text-sm"
            disabled={filledFields.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copiar Tudo</span>
            <span className="sm:hidden">Copiar</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMarkdown}
            className="gap-1.5 h-8 text-xs sm:text-sm"
            disabled={filledFields.length === 0}
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar .md</span>
            <span className="sm:hidden">.md</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            className="gap-1.5 h-8 text-xs sm:text-sm"
            disabled={filledFields.length === 0}
          >
            <File className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>
    </>
  );

  // Render fullscreen dialog or sheet based on state
  if (isFullscreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          <SummaryContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col"
      >
        <SummaryContent />
      </SheetContent>
    </Sheet>
  );
};
