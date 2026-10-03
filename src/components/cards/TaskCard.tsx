import React, { useMemo } from 'react';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { Card as CardUI, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UrgencyBadge } from './CardBadges';
import { CardRiskIndicators } from './CardRiskIndicators';
import { RiskRadar } from './RiskRadar';
import { CardQuickActions } from './CardQuickActions';
import { CardAssignees, type Assignee } from './CardAssignees';
import { VisibilityIcon } from '@/components/governance';
import { Calendar, Clock, Building2, BanknoteIcon, Share2, Layers, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { useCardIndicators } from '@/hooks/useCardIndicators';
import { useEtapasSla } from '@/hooks/useEtapasSla';
import { CardHoverActions } from './CardHoverActions';
import { peekHover } from '@/lib/cardPeek';
import { useMyRunningTimer } from '@/hooks/useTimeEntries';
import { MessageSquare, CheckCircle2, Hourglass, UserX, FileWarning, Moon } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSpaces } from '@/hooks/useSpaces';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskCardProps {
  card: Card;
  onClick?: () => void;
  isDragging?: boolean;
  isBlocked?: boolean;
  ownerUtilization?: number;
  clientName?: string;
  clientColor?: string;
  assignees?: Assignee[];
  onStatusChange?: (status: CardStatus) => void;
  onUrgencyChange?: (urgency: CardUrgency) => void;
  onDuplicate?: (targetSpaceId?: string, mode?: 'mirror' | 'copy') => void;
  onDelete?: () => void;
  showQuickActions?: boolean;
  /** Próxima coluna do quadro (para o atalho "Avançar" do visual novo). */
  proximoStatus?: CardStatus;
  proximoRotulo?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  card, 
  onClick, 
  isDragging,
  isBlocked = false,
  ownerUtilization = 0,
  clientName,
  clientColor,
  assignees = [],
  onStatusChange,
  onUrgencyChange,
  onDuplicate,
  onDelete,
  showQuickActions = true,
  proximoStatus,
  proximoRotulo,
}) => {
  const [menuAberto, setMenuAberto] = React.useState(false);
  const { respiro } = useNewUiBeta();
  const { data: indicadores } = useCardIndicators(respiro);
  const ind = indicadores?.get(card.id);
  const { data: etapasSla } = useEtapasSla(respiro);
  const { data: meuCronometro } = useMyRunningTimer();

  // Selos por exceção (só no visual novo): o card saudável fica limpo, e um selo só aparece quando
  // algo precisa de atenção. No máximo 2 por card, na ordem de importância abaixo.
  const excecoes: { chave: string; texto: string; titulo: string; tom: 'cr' | 'w' | 'g' | 'n'; icone: React.ReactNode }[] = [];
  if (respiro && !['delivered', 'approved', 'archived'].includes(card.status)) {
    const agora = Date.now();

    if (meuCronometro?.card_id === card.id) {
      excecoes.push({ chave: 'timer', texto: 'Cronômetro rodando', titulo: 'Você está com o cronômetro ligado neste card', tom: 'g', icone: <Timer className="h-3 w-3" /> });
    }

    const etapa = card.current_stage ? etapasSla?.get(card.current_stage) : undefined;
    if (etapa && card.stage_entered_at) {
      const horas = (agora - new Date(card.stage_entered_at).getTime()) / 3_600_000;
      const dias = Math.floor(horas / 24);
      if (etapa.sla_critical_hours && horas >= etapa.sla_critical_hours) {
        excecoes.push({
          chave: 'sla',
          texto: `${dias} d em ${etapa.name} · limite ${Math.round(etapa.sla_critical_hours / 24)} d`,
          titulo: `Está há ${dias} dias na etapa ${etapa.name}; o limite crítico é de ${Math.round(etapa.sla_critical_hours / 24)} dias`,
          tom: 'cr',
          icone: <Hourglass className="h-3 w-3" />,
        });
      } else if (etapa.sla_warning_hours && horas >= etapa.sla_warning_hours) {
        excecoes.push({
          chave: 'sla',
          texto: `${dias} d em ${etapa.name} · alerta ${Math.max(1, Math.round(etapa.sla_warning_hours / 24))} d`,
          titulo: `Está há ${dias} dias na etapa ${etapa.name}; o alerta é a partir de ${Math.max(1, Math.round(etapa.sla_warning_hours / 24))} dia(s)`,
          tom: 'w',
          icone: <Hourglass className="h-3 w-3" />,
        });
      }
    }

    if (assignees.length === 0) {
      excecoes.push({ chave: 'resp', texto: 'Sem responsável', titulo: 'Nenhuma pessoa responsável por este card', tom: 'w', icone: <UserX className="h-3 w-3" /> });
    }

    // O briefing só é exigido a partir de Em Produção; antes disso é esperado que esteja pendente.
    const emEtapaDeBriefing =
      ['em_producao', 'revisao', 'aprovacao'].includes(card.current_stage ?? '') ||
      ['in_progress', 'review'].includes(card.status);
    if (card.card_type !== 'quick' && !card.briefing_completed && emEtapaDeBriefing) {
      excecoes.push({ chave: 'briefing', texto: 'Briefing pendente', titulo: 'O briefing deste card ainda não foi concluído', tom: 'w', icone: <FileWarning className="h-3 w-3" /> });
    }

    const diasParado = Math.floor((agora - new Date(card.updated_at).getTime()) / 86_400_000);
    if (diasParado > 14) {
      excecoes.push({ chave: 'parado', texto: `parado há ${diasParado} d`, titulo: `Sem nenhuma alteração há ${diasParado} dias`, tom: 'n', icone: <Moon className="h-3 w-3" /> });
    }
  }
  // Atalhos do mouse: valem para cards ainda em andamento (não entregues nem arquivados).
  const podeAtalhos = respiro && !['delivered', 'archived'].includes(card.status);
  const excecoesVisiveis = excecoes.slice(0, 2);
  const excecoesOcultas = excecoes.length - excecoesVisiveis.length;
  const { data: allSpaces } = useSpaces();
  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered' && card.status !== 'approved';
  const isBillable = !!card.client_id;

  // Shared spaces logic
  const sharedSpaces = useMemo(() => {
    const spaceIds = (card as any).card_spaces?.map((cs: any) => cs.space_id) || [];
    if (spaceIds.length <= 1) return null;
    
    return spaceIds
      .map((id: string) => allSpaces?.find(s => s.id === id))
      .filter(Boolean);
  }, [card, allSpaces]);

  const hasQuickActions = showQuickActions && onStatusChange && onUrgencyChange && onDuplicate && onDelete;

  return (
    <CardUI
      className={cn(
        'cursor-pointer transition-all hover:shadow-md group relative',
        respiro && 'rounded-xl border-border/60 bg-card shadow-sm hover:border-border hover:shadow-md',
        isDragging && 'shadow-lg ring-2 ring-primary/50 rotate-2',
        isOverdue && 'border-destructive/50',
        isBlocked && 'border-purple-500/50'
      )}
      onClick={onClick}
      onMouseEnter={respiro ? () => peekHover.definir(card.id) : undefined}
      onMouseLeave={respiro ? () => peekHover.sair(card.id) : undefined}
    >
      {/* Client indicator bar */}
      {clientColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
          style={{ backgroundColor: clientColor }}
        />
      )}

      {/* Visibility indicator for restricted cards */}
      {card.visibility === 'restricted' && (
        <div className="absolute top-2 left-2 z-10">
          <VisibilityIcon level="restricted" />
        </div>
      )}

      {/* Top right actions area */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        {/* Shared space indicator */}
        {sharedSpaces && sharedSpaces.length > 1 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 hover:bg-blue-500/20 transition-colors">
                  <Layers className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-[10px] font-semibold mb-1">Compartilhado em:</p>
                <div className="flex flex-wrap gap-1">
                  {sharedSpaces.map((s: any) => (
                    <Badge key={s.id} variant="outline" className="text-[9px] h-4 py-0 px-1 border-blue-200 bg-blue-50 text-blue-700">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Quick actions button */}
        {hasQuickActions && (
          <CardQuickActions
            card={card}
            onStatusChange={onStatusChange}
            onUrgencyChange={onUrgencyChange}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
        
        {/* Risk Radar */}
        <RiskRadar 
          card={card} 
          isBlocked={isBlocked} 
          ownerUtilization={ownerUtilization}
          compact 
        />
      </div>

      {respiro ? (
        <>
          <CardHeader className={cn('p-4 pb-2 pr-14', clientColor && 'pt-5')}>
            <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug transition-colors group-hover:text-primary">
              {card.title}
            </h3>
            {clientName ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: clientColor || 'hsl(var(--muted-foreground))' }} />
                <span className="truncate">{clientName}</span>
                <span className="ml-auto shrink-0 rounded-md bg-green-500/10 px-1.5 text-[10.5px] font-bold text-green-700 dark:text-green-400" title="Card faturável (tem cliente)">
                  $
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-muted-foreground/80">Não faturável</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-1">
            <CardRiskIndicators card={card} />

            <div className="flex flex-wrap items-center gap-1.5">
              <UrgencyBadge urgency={card.urgency} />
              {dueDate && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    isOverdue
                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                      : isToday(dueDate)
                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                        : 'border-border/60 bg-muted/40 text-muted-foreground'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {isOverdue
                    ? `${format(dueDate, 'dd/MM')} · venceu há ${Math.max(1, Math.floor((Date.now() - dueDate.getTime()) / 86_400_000))} d`
                    : `${format(dueDate, 'dd/MM')} · ${format(dueDate, 'HH:mm')}`}
                </span>
              )}
              {card.actual_hours > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {card.actual_hours.toFixed(1)}h
                </span>
              )}
            </div>

            {excecoesVisiveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {excecoesVisiveis.map(e => (
                  <span
                    key={e.chave}
                    title={e.titulo}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      e.tom === 'cr' && 'border-destructive/25 bg-destructive/10 text-destructive',
                      e.tom === 'w' && 'border-amber-300/60 bg-amber-100/70 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
                      e.tom === 'g' && 'border-green-300/60 bg-green-100/70 text-green-800 dark:bg-green-500/15 dark:text-green-300',
                      e.tom === 'n' && 'border-border/60 bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {e.icone}
                    {e.texto}
                  </span>
                ))}
                {excecoesOcultas > 0 && (
                  <span
                    className="text-[11px] font-semibold text-muted-foreground"
                    title={excecoes.slice(2).map(e => e.texto).join(' · ')}
                  >
                    +{excecoesOcultas}
                  </span>
                )}
              </div>
            )}

            {ind && ind.total > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', ind.feitos === ind.total ? 'bg-green-500' : 'bg-primary/70')}
                  style={{ width: `${Math.round((ind.feitos / ind.total) * 100)}%` }}
                />
              </div>
            )}

            <div className="relative pt-0.5">
            <div
              className={cn(
                'flex items-center justify-between transition-opacity',
                podeAtalhos && 'group-hover:opacity-0 group-focus-within:opacity-0',
                podeAtalhos && menuAberto && 'opacity-0'
              )}
            >
              <CardAssignees assignees={assignees} maxVisible={3} size="sm" />
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                {ind && ind.total > 0 && (
                  <span className="inline-flex items-center gap-1" title="Itens do checklist concluídos">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {ind.feitos}/{ind.total}
                  </span>
                )}
                {ind && ind.comentarios > 0 && (
                  <span className="inline-flex items-center gap-1" title="Comentários">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {ind.comentarios}
                  </span>
                )}
              </div>
            </div>
            {podeAtalhos && (
              <CardHoverActions
                card={card}
                proximoRotulo={proximoRotulo}
                aoAvancar={proximoStatus && onStatusChange ? () => onStatusChange(proximoStatus) : undefined}
                aoMudarAberto={setMenuAberto}
                forcado={menuAberto}
              />
            )}
            </div>
          </CardContent>
        </>
      ) : (
        <>
      <CardHeader className={cn(respiro ? "p-4 pb-3 pr-12" : "p-3 pb-2 pr-12", clientColor && (respiro ? "pt-5" : "pt-4"))}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {card.title}
          </h3>
          <UrgencyBadge urgency={card.urgency} />
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", respiro ? "p-4 pt-0 space-y-3" : "p-3 pt-0 space-y-2")}>
        {/* Client Badge or Non-billable indicator */}
        {clientName ? (
          <Badge 
            variant="outline" 
            className="text-[10px] h-5 gap-1 max-w-full"
            style={clientColor ? { 
              borderColor: `${clientColor}40`,
              backgroundColor: `${clientColor}10`,
              color: clientColor 
            } : undefined}
          >
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{clientName}</span>
          </Badge>
        ) : (
          <Badge 
            variant="outline" 
            className="text-[10px] h-5 gap-1 text-muted-foreground border-muted"
          >
            <BanknoteIcon className="h-2.5 w-2.5" />
            Não faturável
          </Badge>
        )}

        {/* Risk indicators */}
        <CardRiskIndicators card={card} />

        {/* Description preview */}
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {extractPlainText(card.description)}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {dueDate && (
              <div
                className={cn(
                  'flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border transition-colors bg-background/50',
                  isOverdue 
                    ? 'text-destructive border-destructive/30 bg-destructive/5 font-semibold' 
                    : isToday(dueDate)
                      ? 'text-orange-600 border-orange-200 bg-orange-50'
                      : 'border-border/50'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {format(dueDate, 'dd/MM')}
                </span>
                <span className="flex items-center gap-1 border-l pl-1.5 border-border/30">
                  <Clock className="h-3 w-3" />
                  {format(dueDate, 'HH:mm')}
                </span>
              </div>
            )}
            {card.actual_hours > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border/50 bg-background/50">
                <Timer className="h-3 w-3" />
                <span>{card.actual_hours.toFixed(1)}h</span>
              </div>
            )}
          </div>

          {/* Assignees avatars */}
          <CardAssignees assignees={assignees} maxVisible={2} size="sm" />
        </div>
      </CardContent>
        </>
      )}
    </CardUI>
  );
};
