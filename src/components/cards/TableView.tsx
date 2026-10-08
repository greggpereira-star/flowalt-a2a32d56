import React, { useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Check, ChevronDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { statusConfig } from './CardBadges';
import { CaixaSelecao } from './SelecionavelCard';
import { useSelecaoDeCards } from '@/hooks/useCardSelection';
import { useKanbanColumns } from '@/hooks/useKanbanColumns';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useCardMemberAssignments } from '@/hooks/useCardMemberAssignments';
import { useClients } from '@/hooks/useClients';
import { useClientCards } from '@/hooks/useClientCards';
import { ehAtrasado } from '@/lib/metrics/definicoes';
import { atividadeParada, descricaoDaAtividade, diasSemAtividade, rotuloAtividade } from '@/lib/cards/atividade';
import { useCardStatusTransition } from '@/hooks/useCardStatusTransition';
import { CelulaEtapa, CelulaPrazo, CelulaPrioridade, CelulaResponsavel, IconeSemResponsavel } from './CelulasEditaveis';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

interface TableViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  viewId: string | null;
}

// Colunas: seleção · tarefa · responsável · etapa · prioridade · prazo · atualizado · cliente
const GRADE = 'grid grid-cols-[2.25rem_minmax(16rem,1fr)_9rem_9.5rem_8rem_8.5rem_9rem_10rem]';

const chaveDeGrupos = (viewId: string | null) => `flowalt:tabela:${viewId ?? 'espaco'}:recolhidos`;

function lerRecolhidos(viewId: string | null): CardStatus[] {
  try {
    const bruto = localStorage.getItem(chaveDeGrupos(viewId));
    return bruto ? (JSON.parse(bruto) as CardStatus[]) : [];
  } catch {
    return [];
  }
}

/**
 * Visão "Tabela": tarefas agrupadas por etapa, em seções recolhíveis, com etapa e prioridade em células
 * coloridas, situação do prazo por ícone e uma linha para adicionar tarefa no fim de cada grupo.
 * Respeita as colunas visíveis e os nomes configurados no Kanban da mesma visão.
 */
export const TableView: React.FC<TableViewProps> = ({ cards, onCardClick, onAddCard, viewId }) => {
  const sel = useSelecaoDeCards();
  const { visibleStatuses, columnLabels } = useKanbanColumns(viewId);
  const { mudarEtapa, aviso } = useCardStatusTransition({ aoAbrirCard: onCardClick });
  const { data: members } = useWorkspaceMembers();
  const { data: atribuicoes } = useCardMemberAssignments({ includeInactive: true });
  const { data: clientesAntigos } = useClients();
  const { data: clientes } = useClientCards();
  const [recolhidos, setRecolhidos] = useState<CardStatus[]>(() => lerRecolhidos(viewId));

  const alternarGrupo = (status: CardStatus) => {
    setRecolhidos(atual => {
      const proximo = atual.includes(status) ? atual.filter(s => s !== status) : [...atual, status];
      try {
        localStorage.setItem(chaveDeGrupos(viewId), JSON.stringify(proximo));
      } catch {
        /* sem armazenamento: o estado vale só nesta sessão */
      }
      return proximo;
    });
  };

  const pessoas = useMemo(() => {
    const mapa = new Map<string, { nome: string; avatar: string | null }>();
    members?.forEach(m => {
      if (m.profile) mapa.set(m.user_id, { nome: m.profile.full_name || m.profile.email, avatar: m.profile.avatar_url ?? null });
    });
    return mapa;
  }, [members]);

  const responsaveisDe = useMemo(() => {
    const mapa = new Map<string, string[]>();
    atribuicoes?.forEach(({ card_id, user_id }) => {
      if (!mapa.has(card_id)) mapa.set(card_id, []);
      mapa.get(card_id)!.push(user_id);
    });
    return (card: Card) => {
      const ids = mapa.get(card.id) ?? (card.owner_id ? [card.owner_id] : []);
      return ids.map(id => pessoas.get(id)).filter((p): p is { nome: string; avatar: string | null } => !!p);
    };
  }, [atribuicoes, pessoas]);

  const nomeDoCliente = useMemo(() => {
    const mapa = new Map<string, { nome: string; cor: string | null }>();
    clientesAntigos?.forEach(c => mapa.set(c.id, { nome: c.name, cor: c.color }));
    clientes?.forEach(c => mapa.set(c.id, { nome: c.name, cor: c.color || null }));
    return (id?: string | null) => (id ? mapa.get(id) : undefined);
  }, [clientesAntigos, clientes]);

  const grupos = useMemo(
    () =>
      visibleStatuses.map(status => ({
        status,
        cards: cards.filter(c => c.status === status).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
      })),
    [cards, visibleStatuses]
  );
  const ordemTela = useMemo(() => grupos.flatMap(g => g.cards.map(c => c.id)), [grupos]);

  const aoClicarNaLinha = (e: React.MouseEvent | React.KeyboardEvent, card: Card) => {
    const mod = 'shiftKey' in e && (e.shiftKey || e.metaKey || e.ctrlKey);
    if (sel && (sel.ativa || mod)) {
      sel.alternar(card.id, { intervalo: 'shiftKey' in e && e.shiftKey ? ordemTela : undefined });
      return;
    }
    onCardClick(card);
  };

  const caixaVisivel = (marcado: boolean) =>
    marcado || sel?.ativa ? 'opacity-100' : 'opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <div className="h-full overflow-auto px-4 pb-24 pt-2 sm:px-6" role="table" aria-label="Tarefas por etapa">
      <div className="min-w-[64rem] space-y-8">
        {grupos.map(({ status, cards: lista }) => {
          const config = statusConfig[status];
          const rotulo = columnLabels?.[status] || config.label;
          const fechado = recolhidos.includes(status);
          const ids = lista.map(c => c.id);
          const marcados = sel ? ids.filter(i => sel.tem(i)).length : 0;
          const todos = ids.length > 0 && marcados === ids.length;

          return (
            <section key={status} role="rowgroup" aria-label={rotulo}>
              <div className="group/linha mb-1 flex items-center gap-2 px-1">
                {sel && ids.length > 0 ? (
                  <CaixaSelecao
                    marcado={todos}
                    parcial={marcados > 0 && !todos}
                    rotulo={todos ? `Desmarcar todos de ${rotulo}` : `Selecionar todos de ${rotulo}`}
                    onChange={() => (todos ? sel.desmarcar(ids) : sel.marcar(ids))}
                    className={cn('shrink-0', caixaVisivel(todos || marcados > 0))}
                  />
                ) : (
                  <span className="w-[18px]" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => alternarGrupo(status)}
                  aria-expanded={!fechado}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-150', fechado && '-rotate-90')} aria-hidden />
                  <span className={cn('h-2 w-2 rounded-full', config.dotColor)} aria-hidden />
                  <span className={cn('text-[15px] font-semibold', config.color)}>{rotulo}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{lista.length}</span>
                </button>
              </div>

              {!fechado && (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <div className={cn(GRADE, 'items-center border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground', lista.length === 0 && 'hidden')} role="row">
                    <span role="columnheader" aria-label="Seleção" />
                    <span role="columnheader" className="px-3 py-2.5">Tarefa</span>
                    <span role="columnheader" className="px-3 py-2.5">Responsável</span>
                    <span role="columnheader" className="px-3 py-2.5 text-center">Etapa</span>
                    <span role="columnheader" className="px-3 py-2.5 text-center">Prioridade</span>
                    <span role="columnheader" className="px-3 py-2.5">Prazo</span>
                    <span role="columnheader" className="px-3 py-2.5">Atualizado</span>
                    <span role="columnheader" className="px-3 py-2.5">Cliente</span>
                  </div>

                  {lista.map(card => {
                    const marcado = !!sel?.tem(card.id);
                    const resp = responsaveisDe(card);
                    const cliente = nomeDoCliente(card.client_id);
                    const prazo = card.due_date ? new Date(card.due_date) : null;
                    const entregue = card.status === 'delivered';
                    const atrasado = !entregue && ehAtrasado(card);
                    const editavel = !sel?.ativa;

                    return (
                      <div
                        key={card.id}
                        role="row"
                        tabIndex={0}
                        aria-selected={marcado}
                        onClick={e => aoClicarNaLinha(e, card)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) aoClicarNaLinha(e, card);
                        }}
                        className={cn(
                          GRADE,
                          'group/linha min-h-11 cursor-pointer items-stretch border-b border-border/50 text-sm transition-colors duration-150 last:border-b-0',
                          'hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                          marcado && 'bg-primary/[0.05] hover:bg-primary/[0.08]'
                        )}
                      >
                        <div
                          role="cell"
                          className="flex items-center justify-center"
                          onClick={e => {
                            e.stopPropagation();
                            sel?.alternar(card.id, { intervalo: e.shiftKey ? ordemTela : undefined });
                          }}
                        >
                          {sel && (
                            <CaixaSelecao
                              marcado={marcado}
                              rotulo={`${marcado ? 'Desmarcar' : 'Selecionar'} o card ${card.title}`}
                              className={caixaVisivel(marcado)}
                            />
                          )}
                        </div>

                        <div role="cell" className="flex min-w-0 items-center px-3 py-2">
                          <span className="truncate font-medium">{card.title}</span>
                        </div>

                        <div role="cell" className="flex items-stretch">
                          <CelulaResponsavel card={card} editavel={editavel}>
                            {resp.length === 0 ? (
                              <IconeSemResponsavel />
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5">
                                  {resp.slice(0, 3).map(p => (
                                    <Avatar key={p.nome} className="h-6 w-6 ring-2 ring-card">
                                      {p.avatar && <AvatarImage src={p.avatar} alt={p.nome} />}
                                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                                        {p.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </div>
                                {resp.length === 1 && <span className="truncate text-muted-foreground">{resp[0].nome.split(' ')[0]}</span>}
                                {resp.length > 3 && <span className="text-xs text-muted-foreground">+{resp.length - 3}</span>}
                              </div>
                            )}
                          </CelulaResponsavel>
                        </div>

                        <div role="cell" className="flex items-stretch p-1.5">
                          <CelulaEtapa card={card} etapas={visibleStatuses} rotulos={columnLabels} aoTrocar={mudarEtapa} editavel={editavel} />
                        </div>

                        <div role="cell" className="flex items-stretch p-1.5">
                          <CelulaPrioridade card={card} editavel={editavel} />
                        </div>

                        <div role="cell" className="flex items-stretch">
                          <CelulaPrazo card={card} editavel={editavel}>
                            {prazo ? (
                            <>
                              {entregue ? (
                                <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Entregue" />
                              ) : atrasado ? (
                                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="Atrasado" />
                              ) : (
                                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              )}
                              <span className={cn('tabular-nums', atrasado && 'font-medium text-destructive', entregue && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
                                {format(prazo, "d MMM", { locale: ptBR })}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                          </CelulaPrazo>
                        </div>

                        <div role="cell" className="flex min-w-0 items-center gap-2 px-3 py-2">
                          {card.last_activity_at ? (
                            (() => {
                              const quem = card.last_activity_by ? pessoas.get(card.last_activity_by) : undefined;
                              const parado = atividadeParada(card);
                              return (
                                <span
                                  className="flex min-w-0 items-center gap-2"
                                  title={
                                    parado
                                      ? `Sem atividade há ${diasSemAtividade(card.last_activity_at)} dias. ${descricaoDaAtividade(card.last_activity_at, quem?.nome)}`
                                      : descricaoDaAtividade(card.last_activity_at, quem?.nome)
                                  }
                                >
                                  {quem && (
                                    <Avatar className="h-5 w-5 shrink-0">
                                      {quem.avatar && <AvatarImage src={quem.avatar} alt={quem.nome} />}
                                      <AvatarFallback className="bg-muted text-[9px]">
                                        {quem.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <span className={cn('truncate tabular-nums text-muted-foreground', parado && 'font-medium text-amber-600 dark:text-amber-400')}>
                                    {rotuloAtividade(card.last_activity_at)}
                                  </span>
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </div>

                        <div role="cell" className="flex min-w-0 items-center gap-2 px-3 py-2">
                          {cliente ? (
                            <>
                              <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" style={cliente.cor ? { backgroundColor: cliente.cor } : undefined} aria-hidden />
                              <span className="truncate text-muted-foreground">{cliente.nome}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => onAddCard(status)}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Adicionar tarefa
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {aviso}
    </div>
  );
};
