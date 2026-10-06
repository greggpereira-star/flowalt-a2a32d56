import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, AtSign, Hash, LogOut, Lock, MessageCircle, Plus, Reply, Search, Send, SmilePlus, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  ChatMessage,
  Pessoa,
  useAbrirMensagemDireta,
  useAdicionarMembro,
  useAlterarPapel,
  useMembrosDoCanal,
  useRemoverMembro,
  useAlternarReacao,
  useApagarMensagem,
  useChatChannels,
  useChatMessages,
  useChatUnread,
  useCriarCanalPrivado,
  useEnviarMensagem,
  useMarcarComoLido,
  usePessoas,
} from '@/hooks/useChat';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '🙏', '✅'];

const iniciais = (nome: string) =>
  nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

function Foto({ pessoa, tamanho = 'h-8 w-8' }: { pessoa?: Pessoa; tamanho?: string }) {
  return (
    <Avatar className={tamanho}>
      {pessoa?.avatar && <AvatarImage src={pessoa.avatar} alt="" />}
      <AvatarFallback className="text-[11px] font-semibold">{iniciais(pessoa?.nome ?? '?')}</AvatarFallback>
    </Avatar>
  );
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Corpo da mensagem com as @menções destacadas (só as de pessoas realmente marcadas). */
function Corpo({ msg, pessoas }: { msg: ChatMessage; pessoas: Map<string, Pessoa> }) {
  const nomes = (msg.mentions ?? []).map(id => pessoas.get(id)?.nome).filter(Boolean) as string[];
  if (nomes.length === 0) return <span className="whitespace-pre-wrap break-words">{msg.body}</span>;
  const re = new RegExp(`(@(?:${nomes.map(escapar).join('|')}))`, 'g');
  return (
    <span className="whitespace-pre-wrap break-words">
      {msg.body.split(re).map((trecho, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded bg-primary/10 px-1 font-semibold text-primary">{trecho}</span>
        ) : (
          <React.Fragment key={i}>{trecho}</React.Fragment>
        ),
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Lista de canais
// ---------------------------------------------------------------------------------------------------------------------
function ListaDeCanais({
  canais,
  selecionado,
  onSelecionar,
  naoLidas,
  carregando,
  onNovaDm,
  onNovoPrivado,
}: {
  canais: ReturnType<typeof useChatChannels>['canais'];
  selecionado: string | null;
  onSelecionar: (id: string) => void;
  naoLidas: Map<string, { unread: number; mentions: number }>;
  carregando: boolean;
  onNovaDm: () => void;
  onNovoPrivado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => canais.filter(c => c.nomeExibido.toLowerCase().includes(busca.trim().toLowerCase())), [canais, busca]);

  const secoes: { titulo: string; itens: typeof filtrados; acao?: React.ReactNode }[] = [
    { titulo: 'Agência', itens: filtrados.filter(c => c.kind === 'workspace') },
    { titulo: 'Espaços', itens: filtrados.filter(c => c.kind === 'space') },
    { titulo: 'Clientes', itens: filtrados.filter(c => c.kind === 'client') },
    {
      titulo: 'Privados',
      itens: filtrados.filter(c => c.kind === 'private'),
      acao: (
        <button type="button" onClick={onNovoPrivado} aria-label="Novo canal privado" className="rounded p-1 text-muted-foreground hover:bg-muted">
          <Plus className="h-3.5 w-3.5" />
        </button>
      ),
    },
    {
      titulo: 'Mensagens diretas',
      itens: filtrados.filter(c => c.kind === 'dm'),
      acao: (
        <button type="button" onClick={onNovaDm} aria-label="Nova mensagem direta" className="rounded p-1 text-muted-foreground hover:bg-muted">
          <Plus className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <h1 className="mb-2 px-1 text-lg font-bold tracking-tight">Conversas</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar canal ou pessoa" className="h-10 pl-9" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 max-lg:pb-24">
        {carregando ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        ) : (
          secoes.map(s =>
            s.itens.length === 0 && !s.acao ? null : (
              <section key={s.titulo} className="mb-3">
                <header className="flex items-center justify-between px-2 pb-1 pt-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.titulo}</h2>
                  {s.acao}
                </header>
                {s.itens.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum ainda.</p>}
                <ul className="space-y-0.5">
                  {s.itens.map(c => {
                    const n = naoLidas.get(c.id);
                    const ativo = c.id === selecionado;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => onSelecionar(c.id)}
                          className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm', ativo ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70')}
                        >
                          {c.kind === 'private' ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : c.kind === 'dm' ? <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                          <span className={cn('min-w-0 flex-1 truncate', n?.unread ? 'font-bold' : 'font-medium')}>{c.nomeExibido}</span>
                          {!!n?.unread && (
                            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', n.mentions ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}>
                              {n.unread > 99 ? '99+' : n.unread}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Conversa (mensagens + campo de escrita)
// ---------------------------------------------------------------------------------------------------------------------
function Conversa({
  canal,
  pessoas,
  onVoltar,
}: {
  canal: ReturnType<typeof useChatChannels>['canais'][number];
  pessoas: Map<string, Pessoa>;
  onVoltar: () => void;
}) {
  const [membrosAberto, setMembrosAberto] = useState(false);
  const { user } = useAuth();
  const [limite, setLimite] = useState(80);
  const { data, isLoading } = useChatMessages(canal.id, limite);
  const enviar = useEnviarMensagem();
  const apagar = useApagarMensagem();
  const reagir = useAlternarReacao();
  const marcarLido = useMarcarComoLido();

  const [texto, setTexto] = useState('');
  const [mencoes, setMencoes] = useState<Map<string, string>>(new Map()); // nome -> id
  const [respondendo, setRespondendo] = useState<ChatMessage | null>(null);
  const [reagindoEm, setReagindoEm] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<string | null>(null); // mensagem tocada (celular)
  const [gatilho, setGatilho] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const mensagens = data?.mensagens ?? [];
  const reacoes = data?.reacoes ?? [];
  const porId = useMemo(() => new Map(mensagens.map(m => [m.id, m])), [mensagens]);

  // Rola para o fim ao abrir e quando chega mensagem, se a pessoa ja estava perto do fim.
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (perto || mensagens.length <= limite) fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length, canal.id]);

  useEffect(() => {
    setTexto(''); setMencoes(new Map()); setRespondendo(null); setLimite(80);
  }, [canal.id]);

  // Marca como lido ao abrir e a cada mensagem nova, com a aba visivel.
  useEffect(() => {
    if (document.visibilityState === 'visible') marcarLido(canal.id);
  }, [canal.id, mensagens.length, marcarLido]);

  const candidatos = useMemo(() => {
    if (gatilho === null) return [];
    const q = gatilho.toLowerCase();
    return [...pessoas.values()]
      .filter(p => p.id !== user?.id && p.nome.toLowerCase().includes(q))
      .slice(0, 6);
  }, [gatilho, pessoas, user?.id]);

  const aoDigitar = (valor: string, cursor: number) => {
    setTexto(valor);
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(valor.slice(0, cursor));
    setGatilho(m ? m[2] : null);
  };

  const inserirMencao = (p: Pessoa) => {
    const el = campoRef.current;
    const cursor = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor).replace(/@([^\s@]{0,30})$/, `@${p.nome} `);
    const depois = texto.slice(cursor);
    setTexto(antes + depois);
    setMencoes(prev => new Map(prev).set(p.nome, p.id));
    setGatilho(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(antes.length, antes.length);
    });
  };

  const mandar = () => {
    const corpo = texto.trim();
    if (!corpo || enviar.isPending) return;
    const ids = [...mencoes.entries()].filter(([nome]) => corpo.includes(`@${nome}`)).map(([, id]) => id);
    enviar.mutate(
      { channelId: canal.id, body: corpo, mentions: ids, replyTo: respondendo?.id ?? null },
      { onSuccess: () => { setTexto(''); setMencoes(new Map()); setRespondendo(null); setGatilho(null); } },
    );
  };

  const reacoesDe = (id: string) => {
    const mapa = new Map<string, { n: number; eu: boolean }>();
    reacoes.filter(r => r.message_id === id).forEach(r => {
      const atual = mapa.get(r.emoji) ?? { n: 0, eu: false };
      mapa.set(r.emoji, { n: atual.n + 1, eu: atual.eu || r.user_id === user?.id });
    });
    return [...mapa.entries()];
  };

  const Icone = canal.kind === 'private' ? Lock : canal.kind === 'dm' ? MessageCircle : Hash;
  const subtitulo =
    canal.kind === 'private' ? 'Canal privado: só quem foi convidado lê, nem owner nem admin.'
    : canal.kind === 'dm' ? 'Mensagem direta: só vocês dois leem.'
    : canal.kind === 'client' ? 'Canal do cliente: toda a equipe do workspace.'
    : canal.kind === 'space' ? 'Canal do espaço: toda a equipe do workspace.'
    : 'Canal geral da agência.';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-3">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="rounded-lg p-2 hover:bg-muted lg:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Icone className="h-4 w-4 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold leading-tight">{canal.nomeExibido}</h2>
          <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>
        </div>
        <button type="button" onClick={() => setMembrosAberto(true)} aria-label="Quem tem acesso" className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
          <Users className="h-3.5 w-3.5" /> Acesso
        </button>
        <MembrosDialog canal={canal} pessoas={pessoas} aberto={membrosAberto} onFechar={() => setMembrosAberto(false)} onSaiu={onVoltar} />
      </header>

      <div ref={listaRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {data?.temMais && (
          <div className="mb-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimite(l => l + 80)}>Carregar mensagens anteriores</Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-3/4 rounded-xl" />)}</div>
        ) : mensagens.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Comece a conversa</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Use @ para chamar alguém e responder para manter o assunto organizado.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {mensagens.map((m, i) => {
              const anterior = mensagens[i - 1];
              const dia = !anterior || !isSameDay(new Date(anterior.created_at), new Date(m.created_at));
              const novoBloco = dia || anterior.author_id !== m.author_id || new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() > 5 * 60_000 || !!m.reply_to;
              const autor = pessoas.get(m.author_id);
              const minha = m.author_id === user?.id;
              const citada = m.reply_to ? porId.get(m.reply_to) : null;
              const rs = reacoesDe(m.id);

              return (
                <React.Fragment key={m.id}>
                  {dia && (
                    <li className="my-3 flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {format(new Date(m.created_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      <span className="h-px flex-1 bg-border" />
                    </li>
                  )}
                  <li
                    onClick={() => setAtiva(a => (a === m.id ? null : m.id))}
                    className={cn('group relative flex gap-2.5 rounded-lg px-1.5 py-1 hover:bg-muted/50', novoBloco && 'mt-2', ativa === m.id && 'bg-muted/50')}
                  >
                    <div className="w-8 shrink-0">{novoBloco && <Foto pessoa={autor} />}</div>
                    <div className="min-w-0 flex-1">
                      {novoBloco && (
                        <p className="flex items-baseline gap-2 text-sm">
                          <span className="font-bold">{autor?.nome ?? 'Ex-membro'}</span>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(m.created_at), 'HH:mm')}</span>
                        </p>
                      )}
                      {citada && (
                        <p className="mb-1 truncate border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
                          {pessoas.get(citada.author_id)?.nome ?? 'Alguém'}: {citada.deleted_at ? 'mensagem apagada' : citada.body}
                        </p>
                      )}
                      {m.deleted_at ? (
                        <p className="text-sm italic text-muted-foreground">Mensagem apagada.</p>
                      ) : (
                        <p className="text-[14.5px] leading-relaxed"><Corpo msg={m} pessoas={pessoas} /></p>
                      )}
                      {rs.length > 0 && !m.deleted_at && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {rs.map(([emoji, v]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => reagir.mutate({ messageId: m.id, emoji, jaReagiu: v.eu, channelId: canal.id })}
                              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', v.eu ? 'border-primary/40 bg-primary/10' : 'bg-card')}
                            >
                              {emoji} <span className="font-semibold tabular-nums">{v.n}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!m.deleted_at && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className={cn('absolute -top-3 right-2 z-10 items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm', ativa === m.id ? 'flex' : 'hidden lg:flex lg:opacity-0 lg:group-hover:opacity-100')}
                      >
                        <button type="button" aria-label="Reagir" onClick={() => setReagindoEm(reagindoEm === m.id ? null : m.id)} className="rounded p-1.5 hover:bg-muted"><SmilePlus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Responder" onClick={() => { setRespondendo(m); campoRef.current?.focus(); }} className="rounded p-1.5 hover:bg-muted"><Reply className="h-3.5 w-3.5" /></button>
                        {minha && (
                          <button type="button" aria-label="Apagar" onClick={() => window.confirm('Apagar esta mensagem?') && apagar.mutate({ id: m.id, channelId: canal.id })} className="rounded p-1.5 text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                        {reagindoEm === m.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 flex gap-1 rounded-xl border bg-card p-1.5 shadow-md">
                            {EMOJIS.map(e => (
                              <button
                                key={e}
                                type="button"
                                className="rounded-lg px-1.5 py-1 text-lg hover:bg-muted"
                                onClick={() => {
                                  const v = rs.find(([emoji]) => emoji === e)?.[1];
                                  reagir.mutate({ messageId: m.id, emoji: e, jaReagiu: !!v?.eu, channelId: canal.id });
                                  setReagindoEm(null);
                                }}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        )}
        <div ref={fimRef} />
      </div>

      <div className="border-t p-3 max-lg:pr-[4.75rem]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {respondendo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
            <Reply className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Respondendo a <b>{pessoas.get(respondendo.author_id)?.nome ?? 'Alguém'}</b>: {respondendo.body}</span>
            <button type="button" aria-label="Cancelar resposta" onClick={() => setRespondendo(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="relative">
          {candidatos.length > 0 && (
            <ul className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border bg-card shadow-md">
              {candidatos.map(p => (
                <li key={p.id}>
                  <button type="button" onMouseDown={e => { e.preventDefault(); inserirMencao(p); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                    <Foto pessoa={p} tamanho="h-6 w-6" /> {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={campoRef}
              rows={1}
              value={texto}
              onChange={e => aoDigitar(e.target.value, e.target.selectionStart)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && candidatos.length === 0) { e.preventDefault(); mandar(); }
                if (e.key === 'Escape') { setGatilho(null); setRespondendo(null); }
              }}
              placeholder={`Mensagem em ${canal.nomeExibido}`}
              className="max-h-40 min-h-[44px] flex-1 resize-none"
            />
            <Button size="icon" className="h-11 w-11 shrink-0" disabled={!texto.trim() || enviar.isPending} onClick={mandar} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex">
          <AtSign className="h-3 w-3" /> @ chama alguém · Enter envia · Shift+Enter quebra a linha
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Quem tem acesso ao canal
// ---------------------------------------------------------------------------------------------------------------------
function MembrosDialog({
  canal,
  pessoas,
  aberto,
  onFechar,
  onSaiu,
}: {
  canal: ReturnType<typeof useChatChannels>['canais'][number];
  pessoas: Map<string, Pessoa>;
  aberto: boolean;
  onFechar: () => void;
  onSaiu: () => void;
}) {
  const { user } = useAuth();
  const fechado = canal.kind === 'private' || canal.kind === 'dm';
  const { data: membros, isLoading } = useMembrosDoCanal(canal.id, aberto && fechado);
  const adicionar = useAdicionarMembro();
  const remover = useRemoverMembro();
  const papel = useAlterarPapel();

  const meu = membros?.find(m => m.user_id === user?.id);
  const souAdmin = canal.kind === 'private' && meu?.role === 'admin';
  const idsNoCanal = new Set((membros ?? []).map(m => m.user_id));
  const podemEntrar = [...pessoas.values()].filter(p => !idsNoCanal.has(p.id));

  const texto =
    canal.kind === 'workspace' ? 'Aberto a toda a equipe do workspace.'
    : canal.kind === 'client' ? 'Aberto a toda a equipe do workspace, como o cadastro de clientes.'
    : canal.kind === 'space' ? 'Segue o acesso do espaço: toda a equipe, exceto se o espaço for restrito por papel (aí só quem tem o papel permitido).'
    : null;

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Quem tem acesso</DialogTitle>
          <DialogDescription>{canal.nomeExibido}</DialogDescription>
        </DialogHeader>

        {!fechado ? (
          <p className="rounded-xl bg-muted/60 p-4 text-sm">{texto} Quem sai do workspace perde o acesso na hora.</p>
        ) : isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : (
          <>
            <ul className="space-y-0.5">
              {(membros ?? []).map(m => {
                const p = pessoas.get(m.user_id);
                const eu = m.user_id === user?.id;
                return (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <Foto pessoa={p} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p?.nome ?? 'Ex-membro'}{eu ? ' (você)' : ''}</span>
                    {canal.kind === 'private' && (
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', m.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                        {m.role === 'admin' ? 'Admin' : 'Membro'}
                      </span>
                    )}
                    {souAdmin && !eu && (
                      <>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                          disabled={papel.isPending}
                          onClick={() => papel.mutate({ channelId: canal.id, userId: m.user_id, role: m.role === 'admin' ? 'member' : 'admin' })}
                        >
                          {m.role === 'admin' ? 'Tirar admin' : 'Tornar admin'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${p?.nome ?? 'pessoa'}`}
                          className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                          disabled={remover.isPending}
                          onClick={() => window.confirm(`Remover ${p?.nome ?? 'esta pessoa'} do canal?`) && remover.mutate({ channelId: canal.id, userId: m.user_id })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            {canal.kind === 'dm' && <p className="text-xs text-muted-foreground">Só vocês dois leem. Nem owner nem admin enxergam.</p>}
            {canal.kind === 'private' && !souAdmin && <p className="text-xs text-muted-foreground">Só admins do canal convidam, removem ou mudam papéis.</p>}

            {souAdmin && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionar pessoas</p>
                {podemEntrar.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todo mundo do workspace já está no canal.</p>
                ) : (
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                    {podemEntrar.map(p => (
                      <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                        <Foto pessoa={p} tamanho="h-6 w-6" />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.nome}</span>
                        <Button size="sm" variant="outline" disabled={adicionar.isPending} onClick={() => adicionar.mutate({ channelId: canal.id, userId: p.id })}>
                          Adicionar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {canal.kind === 'private' && (
              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={remover.isPending}
                  onClick={() =>
                    window.confirm('Sair deste canal? Você só volta se um admin convidar de novo.') &&
                    remover.mutate({ channelId: canal.id, userId: user!.id }, { onSuccess: () => { onFechar(); onSaiu(); } })
                  }
                >
                  <LogOut className="mr-1.5 h-4 w-4" /> Sair do canal
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Dialogos
// ---------------------------------------------------------------------------------------------------------------------
function NovaDmDialog({ aberto, onFechar, pessoas, onAbrir }: { aberto: boolean; onFechar: () => void; pessoas: Map<string, Pessoa>; onAbrir: (canalId: string) => void }) {
  const { user } = useAuth();
  const abrir = useAbrirMensagemDireta();
  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nova mensagem direta</DialogTitle>
          <DialogDescription>Só vocês dois leem.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {[...pessoas.values()].filter(p => p.id !== user?.id).map(p => (
            <li key={p.id}>
              <button
                type="button"
                disabled={abrir.isPending}
                onClick={() => abrir.mutate(p.id, { onSuccess: id => { onFechar(); onAbrir(id); } })}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
              >
                <Foto pessoa={p} /> {p.nome}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function NovoCanalDialog({ aberto, onFechar, pessoas, onCriado }: { aberto: boolean; onFechar: () => void; pessoas: Map<string, Pessoa>; onCriado: (canalId: string) => void }) {
  const { user } = useAuth();
  const criar = useCriarCanalPrivado();
  const [nome, setNome] = useState('');
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setEscolhidos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Novo canal privado</DialogTitle>
          <DialogDescription>Só quem você convidar lê e escreve. Nem owner nem admin enxergam.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do canal, ex.: Financeiro" maxLength={60} />
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Users className="h-3.5 w-3.5" /> Convidar</p>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border p-1.5">
            {[...pessoas.values()].filter(p => p.id !== user?.id).map(p => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                  <Checkbox checked={escolhidos.has(p.id)} onCheckedChange={() => alternar(p.id)} />
                  <Foto pessoa={p} tamanho="h-6 w-6" /> <span className="text-sm">{p.nome}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={nome.trim().length < 2 || criar.isPending}
            onClick={() => criar.mutate({ nome, membros: [...escolhidos] }, { onSuccess: id => { onFechar(); setNome(''); setEscolhidos(new Set()); onCriado(id); } })}
          >
            Criar canal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------------------------------------------------
export default function ConversasPage() {
  const { isEnabled, isReady } = useFeatureFlags();
  const ligada = isEnabled(FEATURE_FLAGS.TEAM_CHAT);
  const [params, setParams] = useSearchParams();
  const canalId = params.get('canal');
  const { canais, isLoading, erro } = useChatChannels(ligada);
  const { porCanal } = useChatUnread(ligada);
  const pessoas = usePessoas();
  const [dmAberta, setDmAberta] = useState(false);
  const [privadoAberto, setPrivadoAberto] = useState(false);

  if (!isReady) return <div className="p-6"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!ligada) return <Navigate to="/" replace />;

  const selecionar = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('canal', id); else p.delete('canal');
    setParams(p, { replace: false });
  };

  const atual = canais.find(c => c.id === canalId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-background">
      <aside className={cn('w-full shrink-0 border-r bg-card lg:flex lg:w-80', atual ? 'hidden' : 'flex')}>
        <div className="h-full w-full">
          <ListaDeCanais
            canais={canais}
            selecionado={atual?.id ?? null}
            onSelecionar={selecionar}
            naoLidas={porCanal}
            carregando={isLoading}
            onNovaDm={() => setDmAberta(true)}
            onNovoPrivado={() => setPrivadoAberto(true)}
          />
        </div>
      </aside>

      <main className={cn('min-w-0 flex-1', atual ? 'flex' : 'hidden lg:flex')}>
        {erro ? (
          <div className="m-auto max-w-sm p-6 text-center text-sm text-muted-foreground">Não foi possível carregar as conversas agora. Tente novamente em instantes.</div>
        ) : atual ? (
          <div className="h-full w-full"><Conversa canal={atual} pessoas={pessoas} onVoltar={() => selecionar(null)} /></div>
        ) : (
          <div className="m-auto max-w-xs p-6 text-center">
            <MessageCircle className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Escolha uma conversa</p>
            <p className="mt-1 text-xs text-muted-foreground">Cada cliente e cada espaço tem o seu canal. Mensagens diretas e canais privados só são lidos por quem participa.</p>
          </div>
        )}
      </main>

      <NovaDmDialog aberto={dmAberta} onFechar={() => setDmAberta(false)} pessoas={pessoas} onAbrir={selecionar} />
      <NovoCanalDialog aberto={privadoAberto} onFechar={() => setPrivadoAberto(false)} pessoas={pessoas} onCriado={selecionar} />
    </div>
  );
}
