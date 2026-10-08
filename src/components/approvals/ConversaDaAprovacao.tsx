import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, Pencil, SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface MensagemDaConversa {
  id: string;
  author_kind: 'member' | 'client';
  author_name: string;
  body: string;
  created_at: string;
}

interface Props {
  mensagens: MensagemDaConversa[];
  /** O pedido ainda aceita mensagens do cliente. */
  aberto: boolean;
  /** Nome da agencia, usado como legenda da equipe. */
  agencia: string | null;
  nome: string;
  onNome: (n: string) => void;
  mensagem: string;
  onMensagem: (m: string) => void;
  enviando: boolean;
  onEnviar: () => void;
}

const ETAPA_RE = /^\[(Tema|Conteúdo|Mídia|Legenda)\]\s*/;

const rotuloDoDia = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM", { locale: ptBR });
};

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '·';

/** Area de chat do pedido: historico em baloes (equipe a esquerda, cliente a direita) e o campo de mensagem preso ao rodape. */
export function ConversaDaAprovacao({ mensagens, aberto, agencia, nome, onNome, mensagem, onMensagem, enviando, onEnviar }: Props) {
  const lista = useRef<HTMLDivElement>(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const nomeValido = nome.trim().length >= 2;
  const pedirNome = !nomeValido || editandoNome;
  const podeEnviar = aberto && nomeValido && mensagem.trim().length > 0 && !enviando;

  // Mantem a ultima mensagem a vista, rolando so a lista do chat (nunca a pagina inteira).
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.length]);

  const grupos = useMemo(() => {
    const out: { dia: string; itens: MensagemDaConversa[] }[] = [];
    for (const m of mensagens) {
      const dia = rotuloDoDia(m.created_at);
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.itens.push(m);
      else out.push({ dia, itens: [m] });
    }
    return out;
  }, [mensagens]);

  return (
    <section aria-label="Conversa com a equipe" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="text-sm font-semibold">Conversa com a equipe</h2>
          <p className="truncate text-xs text-muted-foreground">
            {aberto ? 'Tire dúvidas ou comente. A equipe é avisada na hora.' : 'Esta conversa foi encerrada com a decisão.'}
          </p>
        </div>
        {mensagens.length > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {mensagens.length} {mensagens.length === 1 ? 'mensagem' : 'mensagens'}
          </span>
        )}
      </header>

      <div ref={lista} className="max-h-[420px] min-h-[160px] space-y-5 overflow-y-auto bg-muted/20 px-4 py-4" role="log" aria-live="polite">
        {mensagens.length === 0 ? (
          <div className="flex h-full min-h-[128px] flex-col items-center justify-center gap-1.5 text-center">
            <MessageCircle className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {aberto ? 'Escreva abaixo para falar com a equipe sobre esta entrega.' : 'Nada foi escrito neste pedido.'}
            </p>
          </div>
        ) : (
          grupos.map(g => (
            <div key={g.dia} className="space-y-3">
              <p className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                {g.dia}
              </p>
              <ul className="space-y-3">
                {g.itens.map(m => {
                  const cliente = m.author_kind === 'client';
                  const etapa = m.body.match(ETAPA_RE)?.[1] ?? null;
                  const texto = etapa ? m.body.replace(ETAPA_RE, '') : m.body;
                  return (
                    <li key={m.id} className={cn('flex items-end gap-2.5', cliente && 'flex-row-reverse')}>
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                          cliente ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground ring-1 ring-border',
                        )}
                        aria-hidden
                      >
                        {iniciais(m.author_name)}
                      </span>
                      <div className={cn('flex max-w-[82%] flex-col gap-1', cliente ? 'items-end' : 'items-start')}>
                        <p className="px-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">{cliente ? 'Você' : m.author_name}</span>
                          {!cliente && agencia && <span> · {agencia}</span>}
                          <span> · {format(new Date(m.created_at), 'HH:mm')}</span>
                        </p>
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                            cliente ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card',
                          )}
                        >
                          {etapa && (
                            <span
                              className={cn(
                                'mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                cliente ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary',
                              )}
                            >
                              {etapa}
                            </span>
                          )}
                          <span className="block whitespace-pre-wrap break-words">{texto}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {aberto ? (
        <form
          className="space-y-2 border-t bg-card p-3"
          onSubmit={e => {
            e.preventDefault();
            if (podeEnviar) onEnviar();
          }}
        >
          {pedirNome ? (
            <div className="flex items-center gap-2">
              <Input
                value={nome}
                onChange={e => onNome(e.target.value)}
                onBlur={() => nomeValido && setEditandoNome(false)}
                placeholder="Seu nome, para a equipe saber quem escreveu"
                autoComplete="name"
                aria-label="Seu nome"
                className="h-9 text-sm"
                autoFocus={editandoNome}
              />
              {editandoNome && nomeValido && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditandoNome(false)}>
                  Ok
                </Button>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              Escrevendo como <b className="font-semibold text-foreground">{nome.trim()}</b>
              <button type="button" onClick={() => setEditandoNome(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Pencil className="h-3 w-3" /> alterar
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={mensagem}
              onChange={e => onMensagem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (podeEnviar) onEnviar();
                }
              }}
              placeholder="Escreva uma mensagem…"
              aria-label="Mensagem para a equipe"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl"
            />
            <Button type="submit" size="icon" disabled={!podeEnviar} className="h-11 w-11 shrink-0 rounded-xl" aria-label="Enviar mensagem">
              <SendHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">Enter envia · Shift + Enter quebra a linha</p>
        </form>
      ) : (
        <p className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground">Pedido respondido: a conversa ficou só para consulta.</p>
      )}
    </section>
  );
}
