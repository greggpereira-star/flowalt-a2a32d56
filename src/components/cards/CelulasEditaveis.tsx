import React, { useState } from 'react';
import { toast } from 'sonner';
import { addDays } from 'date-fns';
import { Check, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { statusConfig, urgencyConfig } from './CardBadges';
import { useUpdateCard, type Card } from '@/hooks/useCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAddCardMember, useCardMembers, useRemoveCardMember } from '@/hooks/useCardMembers';
import { useQueryClient } from '@tanstack/react-query';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

/**
 * Editores de célula da visão Tabela. Cada um reaproveita o hook que a ficha do card já usa;
 * a troca de etapa passa pelo mesmo caminho do Kanban (regras de bloqueio do fluxo).
 * O gatilho ocupa a célula inteira, para o alvo de clique ser generoso, e não propaga o clique para a linha.
 */

const gatilho =
  'rounded-lg transition-[background-color,box-shadow,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const parar = (e: React.SyntheticEvent) => e.stopPropagation();

interface BaseProps {
  /** Com a seleção ativa a linha inteira vira alvo de seleção: a célula deixa de editar. */
  editavel: boolean;
}

export const CelulaEtapa: React.FC<
  BaseProps & { card: Card; etapas: CardStatus[]; rotulos?: Record<string, string>; aoTrocar: (card: Card, etapa: CardStatus) => void }
> = ({ card, etapas, rotulos, aoTrocar, editavel }) => {
  const [aberto, setAberto] = useState(false);
  const config = statusConfig[card.status];
  const rotulo = rotulos?.[card.status] || config.label;
  const pilula = (
    <span className={cn('flex w-full items-center justify-center rounded-lg px-2 text-[13px] font-medium', config.bgColor, config.color)}>
      <span className="truncate">{rotulo}</span>
    </span>
  );
  if (!editavel) return <div className="flex w-full items-stretch">{pilula}</div>;
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Alterar a etapa"
          aria-label={`Etapa: ${rotulo}. Alterar`}
          onClick={parar}
          className={cn(gatilho, 'flex w-full items-stretch hover:brightness-[0.97] hover:shadow-[0_0_0_1px_hsl(var(--border))]')}
        >
          {pilula}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5" onClick={parar}>
        <ul>
          {etapas.map(e => {
            const c = statusConfig[e];
            const atual = e === card.status;
            return (
              <li key={e}>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    if (!atual) aoTrocar(card, e);
                  }}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dotColor)} aria-hidden />
                  <span className="flex-1 truncate">{rotulos?.[e] || c.label}</span>
                  {atual && <Check className="h-4 w-4 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const PRIORIDADES: CardUrgency[] = ['low', 'medium', 'high', 'critical'];

export const CelulaPrioridade: React.FC<BaseProps & { card: Card }> = ({ card, editavel }) => {
  const [aberto, setAberto] = useState(false);
  const atualizar = useUpdateCard();
  const urg = urgencyConfig[card.urgency] ?? urgencyConfig.medium;
  const pilula = (
    <span className={cn('flex w-full items-center justify-center rounded-lg px-2 text-[13px] font-medium', urg.bgColor, urg.color)}>
      {urg.label}
    </span>
  );
  if (!editavel) return <div className="flex w-full items-stretch">{pilula}</div>;
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Alterar a prioridade"
          aria-label={`Prioridade: ${urg.label}. Alterar`}
          onClick={parar}
          className={cn(gatilho, 'flex w-full items-stretch hover:brightness-[0.97] hover:shadow-[0_0_0_1px_hsl(var(--border))]')}
        >
          {pilula}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1.5" onClick={parar}>
        <ul>
          {PRIORIDADES.map(p => {
            const c = urgencyConfig[p];
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() =>
                    atualizar.mutate(
                      { id: card.id, urgency: p },
                      {
                        onSuccess: () => {
                          setAberto(false);
                          toast.success('Prioridade atualizada');
                        },
                        onError: () => toast.error('Não foi possível alterar a prioridade'),
                      }
                    )
                  }
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn('rounded-md px-2 py-0.5 text-[13px] font-medium', c.bgColor, c.color)}>{c.label}</span>
                  {p === card.urgency && <Check className="ml-auto h-4 w-4 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export const CelulaPrazo: React.FC<BaseProps & { card: Card; children: React.ReactNode }> = ({ card, editavel, children }) => {
  const [aberto, setAberto] = useState(false);
  const atualizar = useUpdateCard();
  const atual = card.due_date ? new Date(card.due_date) : null;

  // Mantém o horário que o card já tinha (ou 18:00, o padrão dos prazos) ao trocar só o dia.
  const noDia = (dia: Date) =>
    new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), atual ? atual.getHours() : 18, atual ? atual.getMinutes() : 0);

  const aplicar = (novo: Date | null) =>
    atualizar.mutate(
      { id: card.id, due_date: novo ? novo.toISOString() : null },
      {
        onSuccess: () => {
          toast.success(novo ? 'Prazo atualizado' : 'Prazo removido');
          setAberto(false);
        },
        onError: () => toast.error('Não foi possível alterar o prazo'),
      }
    );

  if (!editavel) return <div className="flex w-full items-center gap-2 px-3 py-2">{children}</div>;

  const hoje = new Date();
  const atalhos: { rotulo: string; dia: Date | null }[] = [
    { rotulo: 'Hoje', dia: hoje },
    { rotulo: 'Amanhã', dia: addDays(hoje, 1) },
    { rotulo: 'Em 1 semana', dia: addDays(hoje, 7) },
    { rotulo: 'Sem prazo', dia: null },
  ];

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Alterar o prazo"
          aria-label="Alterar o prazo"
          onClick={parar}
          className={cn(gatilho, 'flex h-full w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/70')}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={parar}>
        <div className="mb-1 flex flex-wrap gap-1">
          {atalhos.map(a => (
            <Button key={a.rotulo} variant="ghost" size="sm" className="h-8" onClick={() => aplicar(a.dia ? noDia(a.dia) : null)}>
              {a.rotulo}
            </Button>
          ))}
        </div>
        <Calendar mode="single" selected={atual ?? undefined} onSelect={d => d && aplicar(noDia(d))} initialFocus />
      </PopoverContent>
    </Popover>
  );
};

export const CelulaResponsavel: React.FC<BaseProps & { card: Card; children: React.ReactNode }> = ({ card, editavel, children }) => {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const { data: membros } = useWorkspaceMembers();
  const { data: atuais } = useCardMembers(aberto ? card.id : undefined);
  const adicionar = useAddCardMember();
  const remover = useRemoveCardMember();

  if (!editavel) return <div className="flex w-full items-center px-3 py-2">{children}</div>;

  const alternar = async (userId: string) => {
    const ja = atuais?.find(m => m.user_id === userId);
    try {
      if (ja) await remover.mutateAsync({ cardId: card.id, memberId: ja.id });
      else await adicionar.mutateAsync({ cardId: card.id, userId });
      qc.invalidateQueries({ queryKey: ['card_member_assignments'] });
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível alterar o responsável');
    }
  };
  const ativos = (membros ?? []).filter(m => m.is_active);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Alterar os responsáveis"
          aria-label="Alterar os responsáveis"
          onClick={parar}
          className={cn(gatilho, 'flex h-full w-full items-center px-3 py-2 text-left hover:bg-muted/70')}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5" onClick={parar}>
        <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Responsáveis</p>
        <div className="max-h-64 overflow-y-auto">
          {ativos.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum membro ativo.</p>}
          {ativos.map(m => {
            const marcado = !!atuais?.some(a => a.user_id === m.user_id);
            return (
              <button
                key={m.user_id}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => alternar(m.user_id)}
                className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border">
                  {marcado && <Check className="h-3 w-3 text-primary" aria-hidden />}
                </span>
                <span className="truncate">{m.profile?.full_name || m.profile?.email || 'Membro'}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const IconeSemResponsavel: React.FC = () => (
  <span className="flex items-center gap-1.5 text-muted-foreground/60 transition-colors group-hover/linha:text-muted-foreground">
    <UserPlus className="h-4 w-4" aria-hidden />
  </span>
);
