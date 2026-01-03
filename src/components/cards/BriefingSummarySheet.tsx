import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextViewer, isRichTextEmpty, extractPlainText } from '@/components/ui/rich-text-viewer';
import type { BriefingData } from './BriefingForm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BriefingSummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BriefingData;
  isCompleted: boolean;
  cardTitle?: string;
}

const FIELDS = [
  {
    key: 'context' as keyof BriefingData,
    label: 'Contexto do Projeto',
    icon: FileText,
    required: true,
    description: 'Objetivo principal e informações relevantes',
  },
  {
    key: 'target_audience' as keyof BriefingData,
    label: 'Público-Alvo',
    icon: Users,
    required: false,
    description: 'Quem é o público-alvo',
  },
  {
    key: 'deliverables' as keyof BriefingData,
    label: 'Entregáveis',
    icon: Package,
    required: true,
    description: 'O que precisa ser entregue',
  },
  {
    key: 'references' as keyof BriefingData,
    label: 'Referências',
    icon: Link2,
    required: false,
    description: 'Inspirações e exemplos',
  },
  {
    key: 'deadline_notes' as keyof BriefingData,
    label: 'Observações de Prazo',
    icon: Clock,
    required: false,
    description: 'Urgências e datas importantes',
  },
  {
    key: 'special_instructions' as keyof BriefingData,
    label: 'Instruções Especiais',
    icon: Lightbulb,
    required: false,
    description: 'Restrições e regras especiais',
  },
];

export const BriefingSummarySheet: React.FC<BriefingSummarySheetProps> = ({
  open,
  onOpenChange,
  data,
  isCompleted,
  cardTitle,
}) => {
  const filledFields = FIELDS.filter(f => !isRichTextEmpty(data[f.key]));
  const totalFields = FIELDS.length;
  const requiredFields = FIELDS.filter(f => f.required);
  const requiredFilled = requiredFields.filter(f => !isRichTextEmpty(data[f.key]));

  const handleCopyAll = () => {
    const text = FIELDS
      .filter(f => !isRichTextEmpty(data[f.key]))
      .map(f => `${f.label}:\n${extractPlainText(data[f.key])}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast.success('Briefing copiado para a área de transferência');
  };

  const handleExportMarkdown = () => {
    const markdown = [
      `# Briefing${cardTitle ? `: ${cardTitle}` : ''}`,
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
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-semibold">
                    Resumo do Briefing
                  </SheetTitle>
                  {cardTitle && (
                    <SheetDescription className="text-sm truncate">
                      {cardTitle}
                    </SheetDescription>
                  )}
                </div>
              </div>
            </div>
            <Badge 
              className={cn(
                'gap-1.5 flex-shrink-0',
                isCompleted 
                  ? 'bg-success/20 text-success border-success/30' 
                  : 'bg-warning/20 text-warning border-warning/30'
              )}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completo
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5" />
                  Pendente
                </>
              )}
            </Badge>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">
                {filledFields.length}/{totalFields} campos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                requiredFilled.length === requiredFields.length 
                  ? "bg-success" 
                  : "bg-warning"
              )} />
              <span className="text-muted-foreground">
                {requiredFilled.length}/{requiredFields.length} obrigatórios
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {FIELDS.map((field) => {
              const Icon = field.icon;
              const isEmpty = isRichTextEmpty(data[field.key]);
              
              return (
                <div 
                  key={field.key} 
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    isEmpty 
                      ? 'bg-muted/30 border-dashed border-muted-foreground/30' 
                      : 'bg-card border-border'
                  )}
                >
                  {/* Field Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isEmpty ? 'bg-muted' : 'bg-primary/10'
                    )}>
                      <Icon className={cn(
                        'h-4 w-4',
                        isEmpty ? 'text-muted-foreground' : 'text-primary'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          'font-medium',
                          isEmpty && 'text-muted-foreground'
                        )}>
                          {field.label}
                        </h3>
                        {field.required && (
                          <span className="text-xs text-destructive">*</span>
                        )}
                        {!isEmpty && (
                          <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {field.description}
                      </p>
                    </div>
                  </div>

                  {/* Field Content */}
                  {isEmpty ? (
                    <p className="text-sm text-muted-foreground italic pl-11">
                      Não preenchido
                    </p>
                  ) : (
                    <div className="pl-11">
                      <RichTextViewer 
                        content={data[field.key]} 
                        className="text-sm prose-p:my-1"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-2"
            disabled={filledFields.length === 0}
          >
            <Copy className="h-4 w-4" />
            Copiar Tudo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMarkdown}
            className="gap-2"
            disabled={filledFields.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar .md
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
