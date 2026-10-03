import React, { useState } from 'react';
import { toast } from 'sonner';
import { addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CalendarClock, Eye, Link2, Play, Square, UserPlus } from 'lucide-react';
import { abrirPeek } from '@/lib/cardPeek';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useMyRunningTimer, useStartTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { useUpdateCard, type Card } from '@/hooks/useCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useAddCardMember, useCardMembers, useRemoveCardMember } from '@/hooks/useCardMembers';

/**
 * Atalhos que aparecem sobre o rodapé do card quando o mouse passa por ele (visual novo do Kanban).
 * Cada atalho reaproveita o hook que a tela completa já usa; nada aqui cria regra nova:
 *  - cronômetro: useStartTimer/useStopTimer (o banco encerra o cronômetro anterior da pessoa);
 *  - atribuir: useAddCardMember/useRemoveCardMember (inclusive a notificação de atribuição);
 *  - prazo: useUpdateCard;
 *  - avançar etapa: o mesmo manipulador de mudança de status do quadro, que aplica as regras (gates)
 *    de cada etapa e mostra o aviso de bloqueio quando alguma não é cumprida.
 */

const botao =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11.5px] font-bold ' +
  'text-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50';

interface Props {
  card: Card;
  proximoRotulo?: string;
  aoAvancar?: () => void;
  aoMudarAberto: (aberto: boolean) => void;
  forcado: boolean;
}

function AtalhoCronometro({ card }: { card: Card }) {
  const { data: meu } = useMyRunningTimer();
  const iniciar = useStartTimer();
  const parar = useStopTimer();
  const rodandoAqui = meu?.card_id === card.id;
  const ocupado = iniciar.isPending || parar.isPending;

  return (
    <button
      className={cn(botao, rodandoAqui && 'bg-green-500/10 text-green-700 hover:bg-green-500/15 hover:text-green-700 dark:text-green-400')}
      disabled={ocupado}
      title={rodandoAqui ? 'Parar o cronômetro' : 'Iniciar o cronômetro neste card'}
      aria-label={rodandoAqui ? 'Parar o cronômetro' : 'Iniciar o cronômetro neste card'}
      onClick={() =>
        rodandoAqui && meu
          ? parar.mutate({ id: meu.id, card_id: card.id })
          : iniciar.mutate(
              { card_id: card.id },
              { onError: () => toast.error('Não foi possível iniciar o cronômetro') }
            )
      }
    >
      {rodandoAqui ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {/* Só o ícone quando parado, para a barra caber com o botão Avançar; "Parar" fica escrito. */}
      {rodandoAqui && 'Parar'}
    </button>
  );
}

function AtalhoAtribuir({ card, aoMudarAberto }: { card: Card; aoMudarAberto: (v: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const { data: membros } = useWorkspaceMembers();
  const { data: atuais } = useCardMembers(aberto ? card.id : undefined);
  const adicionar = useAddCardMember();
  const remover = useRemoveCardMember();

  const alternar = async (userId: string) => {
    const ja = atuais?.find(m => m.user_id === userId);
    try {
      if (ja) await remover.mutateAsync({ cardId: card.id, memberId: ja.id });
      else await adicionar.mutateAsync({ cardId: card.id, userId });
      // O quadro desenha os avatares a partir desta consulta; sem isto o card só atualizaria no próximo refresh.
      qc.invalidateQueries({ queryKey: ['card_member_assignments'] });
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível alterar o responsável');
    }
  };

  const ativos = (membros ?? []).filter(m => m.is_active);

  return (
    <Popover
      open={aberto}
      onOpenChange={v => {
        setAberto(v);
        aoMudarAberto(v);
      }}
    >
      <PopoverTrigger asChild>
        <button className={botao} title="Atribuir responsáveis">
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5" onClick={e => e.stopPropagation()}>
        <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Responsáveis</p>
        <div className="max-h-64 overflow-y-auto">
          {ativos.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum membro ativo.</p>}
          {ativos.map(m => {
            const marcado = !!atuais?.some(a => a.user_id === m.user_id);
            return (
              <button
                key={m.user_id}
                onClick={() => alternar(m.user_id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border">
                  {marcado && <Check className="h-3 w-3 text-primary" />}
                </span>
                <span className="truncate">{m.profile?.full_name || m.profile?.email || 'Membro'}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AtalhoPrazo({ card, aoMudarAberto }: { card: Card; aoMudarAberto: (v: boolean) => void }) {
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
          aoMudarAberto(false);
        },
        onError: () => toast.error('Não foi possível alterar o prazo'),
      }
    );

  const hoje = new Date();
  const atalhos: { rotulo: string; dia: Date | null }[] = [
    { rotulo: 'Hoje', dia: hoje },
    { rotulo: 'Amanhã', dia: addDays(hoje, 1) },
    { rotulo: 'Em 1 semana', dia: addDays(hoje, 7) },
    { rotulo: 'Sem prazo', dia: null },
  ];

  return (
    <Popover
      open={aberto}
      onOpenChange={v => {
        setAberto(v);
        aoMudarAberto(v);
      }}
    >
      <PopoverTrigger asChild>
        <button className={botao} title="Alterar o prazo">
          <CalendarClock className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex flex-wrap gap-1">
          {atalhos.map(a => (
            <button
              key={a.rotulo}
              onClick={() => aplicar(a.dia ? noDia(a.dia) : null)}
              className="rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <Calendar
          mode="single"
          locale={ptBR}
          selected={atual ?? undefined}
          defaultMonth={atual ?? undefined}
          onSelect={d => d && aplicar(noDia(d))}
        />
      </PopoverContent>
    </Popover>
  );
}

export function CardHoverActions({ card, proximoRotulo, aoAvancar, aoMudarAberto, forcado }: Props) {
  const copiarLink = async () => {
    const espaco = card.display_space_id || card.space_id;
    const url = `${window.location.origin}/space/${espaco}?card=${card.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link do card copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  return (
    <div
      // Sobrepõe o rodapé só enquanto o mouse está no card (ou algum menu está aberto).
      className={cn(
        'absolute inset-0 flex items-center gap-0.5 rounded-lg bg-card opacity-0 transition-opacity',
        'pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100',
        'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        forcado && 'pointer-events-auto opacity-100'
      )}
      // Evita que o clique nos atalhos abra o card ou inicie o arrasto.
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <AtalhoCronometro card={card} />
      <AtalhoAtribuir card={card} aoMudarAberto={aoMudarAberto} />
      <AtalhoPrazo card={card} aoMudarAberto={aoMudarAberto} />
      <button className={botao} title="Visualização rápida (Espaço)" onClick={() => abrirPeek(card.id)}>
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button className={botao} title="Copiar o link do card" onClick={copiarLink}>
        <Link2 className="h-3.5 w-3.5" />
      </button>
      {aoAvancar && (
        <button
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          title={proximoRotulo ? `Mover para ${proximoRotulo}` : 'Avançar para a próxima etapa'}
          onClick={aoAvancar}
        >
          Avançar
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
