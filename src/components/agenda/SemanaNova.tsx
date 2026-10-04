import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Cake, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getEventTypeStyle } from '@/lib/agenda/eventTypes';
import type { Event } from '@/hooks/useEvents';
import type { EventParticipantAvatar } from '@/hooks/agenda/useEventParticipantsBatch';
import { EventTypeLegend } from '@/components/agenda/EventTypeLegend';

/**
 * Agenda com visual novo (opção beta): visão de semana com grade de horas + painel do dia.
 *
 * É só apresentação. Quem busca os eventos, abre o formulário e salva é o CalendarView, que
 * entrega aqui os eventos já agrupados por dia e recebe de volta os cliques (abrir evento,
 * criar evento num dia/hora). Assim o formulário, a checagem de conflito e os participantes
 * continuam sendo exatamente os mesmos.
 */

type Aniversario = { id: string; title: string; isBirthday: true };
export type ItemDoDia = Event | Aniversario;

const HORA_PX = 56;
const HORA_INICIO_PADRAO = 7;
const HORA_FIM_PADRAO = 20;

const ehAniversario = (i: ItemDoDia): i is Aniversario => 'isBirthday' in i && !!i.isBirthday;

interface Props {
  dataFoco: Date;
  onMudarData: (d: Date) => void;
  porDia: Map<string, ItemDoDia[]>;
  participantes?: Record<string, EventParticipantAvatar[]>;
  espacos: Map<string, { name: string; color?: string | null }>;
  carregando: boolean;
  onNovo: (dia: Date, hora?: number) => void;
  onAbrirEvento: (evento: Event, e: React.MouseEvent) => void;
  seletorDeVista: React.ReactNode;
}

interface Posicionado {
  evento: Event;
  topo: number;
  altura: number;
  faixa: number;
  faixas: number;
}

/** Distribui eventos que se sobrepõem em faixas lado a lado dentro do mesmo dia. */
function posicionar(eventos: Event[], inicioGrade: number): Posicionado[] {
  const ordenados = [...eventos].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const itens = ordenados.map((evento) => {
    const ini = parseISO(evento.start_time);
    const fim = parseISO(evento.end_time);
    const minIni = ini.getHours() * 60 + ini.getMinutes();
    const dur = Math.max(30, differenceInMinutes(fim, ini));
    return { evento, minIni, minFim: minIni + dur, faixa: 0, faixas: 1 };
  });

  // Agrupa em "blocos" de sobreposição e reparte as faixas dentro de cada bloco.
  let bloco: typeof itens = [];
  let fimBloco = -1;
  const fechar = () => {
    if (bloco.length === 0) return;
    const fimPorFaixa: number[] = [];
    for (const it of bloco) {
      let f = fimPorFaixa.findIndex((fim) => fim <= it.minIni);
      if (f === -1) f = fimPorFaixa.length;
      fimPorFaixa[f] = it.minFim;
      it.faixa = f;
    }
    for (const it of bloco) it.faixas = fimPorFaixa.length;
    bloco = [];
  };
  for (const it of itens) {
    if (bloco.length > 0 && it.minIni >= fimBloco) {
      fechar();
      fimBloco = -1;
    }
    bloco.push(it);
    fimBloco = Math.max(fimBloco, it.minFim);
  }
  fechar();

  return itens.map((it) => ({
    evento: it.evento,
    topo: ((it.minIni - inicioGrade * 60) / 60) * HORA_PX,
    altura: Math.max(((it.minFim - it.minIni) / 60) * HORA_PX - 2, 26),
    faixa: it.faixa,
    faixas: it.faixas,
  }));
}

function Rostos({ pessoas }: { pessoas?: EventParticipantAvatar[] }) {
  if (!pessoas || pessoas.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {pessoas.slice(0, 4).map((p) => (
        <Avatar key={p.userId} className="h-5 w-5 border border-card" title={p.fullName}>
          <AvatarImage src={p.avatarUrl ?? undefined} alt={p.fullName} />
          <AvatarFallback className="bg-muted text-[8px] font-medium">
            {p.fullName
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
      ))}
      {pessoas.length > 4 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-muted text-[8px] font-semibold text-muted-foreground">
          +{pessoas.length - 4}
        </span>
      )}
    </div>
  );
}

export function SemanaNova({
  dataFoco,
  onMudarData,
  porDia,
  participantes,
  espacos,
  carregando,
  onNovo,
  onAbrirEvento,
  seletorDeVista,
}: Props) {
  const inicioSemana = startOfWeek(dataFoco, { locale: ptBR });
  const dias = eachDayOfInterval({ start: inicioSemana, end: endOfWeek(dataFoco, { locale: ptBR }) });

  const [diaSel, setDiaSel] = useState<Date>(() => (isSameDay(dataFoco, new Date()) ? new Date() : dataFoco));
  // Ao navegar para outra semana, o dia em foco acompanha: hoje, se estiver nela; senão o primeiro dia.
  useEffect(() => {
    if (!dias.some((d) => isSameDay(d, diaSel))) {
      const hoje = dias.find((d) => isToday(d));
      setDiaSel(hoje ?? dias[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioSemana.getTime()]);

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const doDia = (d: Date) => porDia.get(format(d, 'yyyy-MM-dd')) ?? [];

  // Eventos com hora vão para a grade; dia inteiro e aniversários ficam na faixa de cima.
  const { comHora, diaInteiro } = useMemo(() => {
    const comHora = new Map<string, Event[]>();
    const diaInteiro = new Map<string, ItemDoDia[]>();
    for (const d of dias) {
      const k = format(d, 'yyyy-MM-dd');
      const itens = porDia.get(k) ?? [];
      comHora.set(k, itens.filter((i): i is Event => !ehAniversario(i) && !i.all_day));
      diaInteiro.set(k, itens.filter((i) => ehAniversario(i) || i.all_day));
    }
    return { comHora, diaInteiro };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDia, inicioSemana.getTime()]);

  // A grade cobre o expediente e estica se algum evento cair fora dele.
  const { horaIni, horaFim } = useMemo(() => {
    let ini = HORA_INICIO_PADRAO;
    let fim = HORA_FIM_PADRAO;
    comHora.forEach((lista) =>
      lista.forEach((e) => {
        ini = Math.min(ini, parseISO(e.start_time).getHours());
        const f = parseISO(e.end_time);
        fim = Math.max(fim, f.getHours() + (f.getMinutes() > 0 ? 1 : 0));
      })
    );
    return { horaIni: ini, horaFim: Math.min(24, Math.max(fim, ini + 1)) };
  }, [comHora]);

  const horas = Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i);
  const alturaGrade = horas.length * HORA_PX;
  const temDiaInteiro = dias.some((d) => (diaInteiro.get(format(d, 'yyyy-MM-dd')) ?? []).length > 0);

  const itensDoDiaSel = doDia(diaSel);
  const eventosDoDiaSel = itensDoDiaSel
    .filter((i): i is Event => !ehAniversario(i))
    .sort((a, b) => (a.all_day === b.all_day ? a.start_time.localeCompare(b.start_time) : a.all_day ? -1 : 1));
  const aniversariosDoDiaSel = itensDoDiaSel.filter(ehAniversario);

  const tituloSemana = (() => {
    const fim = dias[6];
    return inicioSemana.getMonth() === fim.getMonth()
      ? `${format(inicioSemana, 'd')} – ${format(fim, "d 'de' MMMM yyyy", { locale: ptBR })}`
      : `${format(inicioSemana, "d 'de' MMM", { locale: ptBR })} – ${format(fim, "d 'de' MMM yyyy", { locale: ptBR })}`;
  })();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/60 bg-card p-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onMudarData(addDays(dataFoco, -7))} aria-label="Semana anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onMudarData(addDays(dataFoco, 7))} aria-label="Próxima semana">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="px-1 text-[17px] font-extrabold tracking-tight">{tituloSemana}</h2>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground" onClick={() => {
              const hoje = new Date();
              onMudarData(hoje);
              setDiaSel(hoje);
            }}>
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {seletorDeVista}
          <Button size="sm" className="h-10 rounded-xl px-4 font-bold shadow-sm" onClick={() => onNovo(diaSel)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Semana */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="max-h-[68vh] overflow-y-auto">
            <div className="sticky top-0 z-20 border-b border-border/60 bg-card">
              <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
                <div />
                {dias.map((d) => {
                  const hoje = isToday(d);
                  const sel = isSameDay(d, diaSel);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => setDiaSel(d)}
                      className="flex flex-col items-center gap-1 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="text-[11.5px] font-semibold capitalize text-muted-foreground">{format(d, 'EEE', { locale: ptBR }).replace('.', '')}</span>
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold',
                          hoje && 'bg-primary text-primary-foreground',
                          !hoje && sel && 'bg-muted'
                        )}
                      >
                        {format(d, 'd')}
                      </span>
                    </button>
                  );
                })}
              </div>
              {temDiaInteiro && (
                <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-t border-border/50">
                  <div className="py-1.5 pr-2 text-right text-[10px] text-muted-foreground/70">dia</div>
                  {dias.map((d) => (
                    <div key={d.toISOString()} className="flex min-w-0 flex-col gap-1 border-l border-border/40 p-1">
                      {(diaInteiro.get(format(d, 'yyyy-MM-dd')) ?? []).map((i) =>
                        ehAniversario(i) ? (
                          <div key={i.id} className="flex items-center gap-1 truncate rounded-md bg-pink-500/10 px-1.5 py-1 text-[10.5px] font-medium text-pink-600">
                            <Cake className="h-3 w-3 shrink-0" />
                            <span className="truncate">{i.title.replace('🎉 ', '').replace('!', '')}</span>
                          </div>
                        ) : (
                          <button
                            key={i.id}
                            type="button"
                            onClick={(e) => onAbrirEvento(i, e)}
                            className={cn('truncate rounded-md border px-1.5 py-1 text-left text-[10.5px] font-medium', getEventTypeStyle(i.event_type).tile)}
                          >
                            {i.title}
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carregando ? (
              <div className="p-5">
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <div className="relative grid grid-cols-[48px_repeat(7,minmax(0,1fr))]" style={{ height: alturaGrade }}>
                <div className="relative">
                  {horas.map((h, i) => (
                    <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-muted-foreground/70" style={{ top: i * HORA_PX, display: i === 0 ? 'none' : undefined }}>
                      {String(h).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {dias.map((d) => {
                  const k = format(d, 'yyyy-MM-dd');
                  const posicionados = posicionar(comHora.get(k) ?? [], horaIni);
                  const hoje = isToday(d);
                  const minAgora = agora.getHours() * 60 + agora.getMinutes();
                  const topoAgora = ((minAgora - horaIni * 60) / 60) * HORA_PX;
                  return (
                    <div key={k} className={cn('relative border-l border-border/40', hoje && 'bg-primary/[0.03]')}>
                      {horas.map((h, i) => (
                        <button
                          key={h}
                          type="button"
                          aria-label={`Criar evento em ${format(d, "d 'de' MMMM", { locale: ptBR })} às ${h}h`}
                          onClick={() => onNovo(d, h)}
                          className={cn('block w-full transition-colors hover:bg-muted/40', i > 0 && 'border-t border-border/40')}
                          style={{ height: HORA_PX }}
                        />
                      ))}
                      {posicionados.map((p) => {
                        const estilo = getEventTypeStyle(p.evento.event_type);
                        const Icone = estilo.icon;
                        const passou = parseISO(p.evento.end_time) < agora;
                        return (
                          <button
                            key={p.evento.id}
                            type="button"
                            onClick={(e) => onAbrirEvento(p.evento, e)}
                            className={cn(
                              'absolute overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] font-semibold leading-tight transition-colors',
                              estilo.tile,
                              passou && 'opacity-60'
                            )}
                            style={{
                              top: p.topo,
                              height: p.altura,
                              left: `calc(${(p.faixa / p.faixas) * 100}% + 2px)`,
                              width: `calc(${100 / p.faixas}% - 4px)`,
                            }}
                            title={`${p.evento.title} · ${format(parseISO(p.evento.start_time), 'HH:mm')}–${format(parseISO(p.evento.end_time), 'HH:mm')}`}
                          >
                            <span className="flex items-center gap-1">
                              <Icone className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2.5} aria-hidden="true" />
                              <span className="truncate">{p.evento.title}</span>
                            </span>
                            {p.altura >= 42 && (
                              <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                                {format(parseISO(p.evento.start_time), 'HH:mm')}–{format(parseISO(p.evento.end_time), 'HH:mm')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {hoje && topoAgora >= 0 && topoAgora <= alturaGrade && (
                        <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: topoAgora }}>
                          <div className="relative h-px bg-red-500">
                            <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel do dia */}
        <aside className="h-fit rounded-2xl border border-border/60 bg-card p-5 lg:sticky lg:top-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{isToday(diaSel) ? 'Hoje' : format(startOfDay(diaSel), 'EEEE', { locale: ptBR })}</p>
          <h3 className="mt-0.5 text-[20px] font-extrabold tracking-tight">{format(diaSel, "d 'de' MMMM", { locale: ptBR })}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {eventosDoDiaSel.length === 0 ? 'Dia livre' : `${eventosDoDiaSel.length} ${eventosDoDiaSel.length === 1 ? 'compromisso' : 'compromissos'}`}
          </p>

          {aniversariosDoDiaSel.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {aniversariosDoDiaSel.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl bg-pink-500/10 px-3 py-2 text-[13px] font-medium text-pink-600">
                  <Cake className="h-4 w-4 shrink-0" />
                  <span className="truncate">{a.title.replace('🎉 ', '').replace('!', '')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-1">
            {eventosDoDiaSel.map((e) => {
              const estilo = getEventTypeStyle(e.event_type);
              const espaco = e.space_id ? espacos.get(e.space_id) : undefined;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={(ev) => onAbrirEvento(e, ev)}
                  className="flex w-full gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className={cn('mt-0.5 w-1 shrink-0 self-stretch rounded-full', estilo.accent)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                      {e.all_day ? 'Dia inteiro' : `${format(parseISO(e.start_time), 'HH:mm')} – ${format(parseISO(e.end_time), 'HH:mm')}`}
                    </p>
                    <p className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{e.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground">
                      <span>{estilo.label}</span>
                      {espaco && <span className="truncate">· {espaco.name}</span>}
                      {e.location && (
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <Rostos pessoas={participantes?.[e.id]} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button variant="outline" className="mt-4 h-9 w-full rounded-xl text-[13px] font-semibold" onClick={() => onNovo(diaSel)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo evento neste dia
          </Button>

          <div className="mt-5 border-t border-border/50 pt-4">
            <EventTypeLegend />
          </div>
        </aside>
      </div>
    </div>
  );
}
