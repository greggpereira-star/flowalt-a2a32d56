import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Notice } from '@/hooks/useNoticesModule';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AlertTriangle, Info, PartyPopper, Calendar, Wrench, FileText, 
  CheckCircle2, Clock, Shield
} from 'lucide-react';

interface MandatoryNoticeModalProps {
  notice: Notice;
  onConfirm: () => void;
}

const categoryIcons: Record<Notice['category'], React.ReactNode> = {
  general: <Info className="h-6 w-6" />,
  urgent: <AlertTriangle className="h-6 w-6" />,
  celebration: <PartyPopper className="h-6 w-6" />,
  holiday: <Calendar className="h-6 w-6" />,
  birthday: <PartyPopper className="h-6 w-6" />,
  maintenance: <Wrench className="h-6 w-6" />,
  policy: <FileText className="h-6 w-6" />,
};

const categoryLabels: Record<Notice['category'], string> = {
  general: 'Comunicado Geral',
  urgent: 'Aviso Urgente',
  celebration: 'Celebração',
  holiday: 'Feriado',
  birthday: 'Aniversário',
  maintenance: 'Manutenção',
  policy: 'Política',
};

const priorityStyles: Record<Notice['priority'], { bg: string; border: string; icon: string }> = {
  low: { bg: 'bg-muted', border: 'border-muted', icon: 'text-muted-foreground' },
  normal: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-500' },
  high: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-500' },
  critical: { bg: 'bg-destructive/10', border: 'border-destructive/30', icon: 'text-destructive' },
};

export const MandatoryNoticeModal: React.FC<MandatoryNoticeModalProps> = ({ 
  notice, 
  onConfirm 
}) => {
  const [hasRead, setHasRead] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [canConfirm, setCanConfirm] = useState(false);

  // Timer to ensure user spends minimum time reading
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanConfirm(true);
    }
  }, [timeRemaining]);

  const handleConfirm = () => {
    if (hasRead && canConfirm) {
      onConfirm();
    }
  };

  const priorityStyle = priorityStyles[notice.priority];
  const isCritical = notice.priority === 'critical' || notice.priority === 'high';

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className={cn(
          "sm:max-w-2xl p-0 gap-0 overflow-hidden border-2",
          priorityStyle.border
        )}
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-4 flex items-center gap-4",
          priorityStyle.bg
        )}>
          <div className={cn(
            "p-3 rounded-full bg-background/80 backdrop-blur",
            priorityStyle.icon
          )}>
            {categoryIcons[notice.category]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-normal">
                {categoryLabels[notice.category]}
              </Badge>
              {isCritical && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {notice.priority === 'critical' ? 'Crítico' : 'Importante'}
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-semibold">{notice.title}</h2>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[50vh]">
          <div className="p-6">
            {notice.content ? (
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap leading-relaxed">{notice.content}</p>
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                Nenhum conteúdo adicional.
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t bg-muted/30 p-6 space-y-4">
          {/* Meta info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(notice.starts_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-amber-600">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">Confirmação obrigatória</span>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <div 
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
              hasRead 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-muted/50 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
            )}
            onClick={() => canConfirm && setHasRead(!hasRead)}
          >
            <Checkbox 
              id="confirm-read"
              checked={hasRead}
              onCheckedChange={(checked) => canConfirm && setHasRead(!!checked)}
              disabled={!canConfirm}
              className="mt-0.5"
            />
            <label 
              htmlFor="confirm-read" 
              className={cn(
                "text-sm leading-relaxed cursor-pointer select-none",
                !canConfirm && "opacity-50"
              )}
            >
              <span className="font-medium">Declaro que li e compreendi este comunicado.</span>
              <span className="block text-muted-foreground mt-1">
                Ao confirmar, você reconhece que tomou ciência do conteúdo acima e concorda com as informações apresentadas.
              </span>
            </label>
          </div>

          {/* Confirm button */}
          <Button 
            onClick={handleConfirm}
            disabled={!hasRead || !canConfirm}
            className={cn(
              "w-full h-12 text-base font-medium transition-all",
              hasRead && canConfirm 
                ? "bg-green-600 hover:bg-green-700" 
                : ""
            )}
          >
            {!canConfirm ? (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 animate-pulse" />
                Aguarde {timeRemaining}s para confirmar
              </span>
            ) : hasRead ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Confirmar Leitura
              </span>
            ) : (
              "Marque a caixa acima para confirmar"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Sua confirmação será registrada com data, hora e identificação.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
