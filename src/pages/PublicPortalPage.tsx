import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, ChevronRight, Clock, Lock, MessageSquareWarning } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { varsDaMarca } from '@/lib/portal/marca';
import { CalendarioDoPortal, ItemDoCalendario } from '@/components/portal/CalendarioDoPortal';
import { BrandCoreDoPortal, BrandDoPortal } from '@/components/portal/BrandCoreDoPortal';

interface Pendente { id: string; title: string; round: number; sent_at: string }
interface Decidido { id: string; title: string; round: number; status: 'approved' | 'changes_requested'; decided_at: string | null; decided_by_name: string | null }
interface Portal {
  client: { name: string; logo_url: string | null };
  agency: { name: string | null; logo_url: string | null; brand_color: string | null };
  pending: Pendente[];
  history: Decidido[];
  calendar: ItemDoCalendario[];
  summary: { month: string; approved: number; changes: number; waiting: number; published: number };
  brand: BrandDoPortal | null;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const quando = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

async function carregarPortal(token: string): Promise<Portal> {
  const { data, error } = await supabase.functions.invoke('public-portal', { body: { token } });
  if (error) {
    let msg = 'Não foi possível carregar agora. Tente novamente.';
    try {
      const corpo = await (error as any).context?.json?.();
      if (corpo?.error) msg = corpo.error;
    } catch {
      /* mantem a mensagem padrao */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.portal as Portal;
}

export default function PublicPortalPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarPortal(token)
      .then(p => setPortal(p))
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (erro || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{erro ?? 'Este link não está mais disponível. Peça um novo link a quem enviou.'}</p>
        </div>
      </div>
    );
  }

  const mesNome = MESES[Number(portal.summary.month.slice(5, 7)) - 1] ?? '';
  return (
    <div className="min-h-screen bg-background" style={varsDaMarca(portal.agency.brand_color)}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          {portal.agency.logo_url && <img src={portal.agency.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{portal.agency.name ?? 'Portal do cliente'}</p>
            <p className="text-xs text-muted-foreground">Portal do cliente</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 pb-20">
        <section>
          <div className="flex items-center gap-3">
            {portal.client.logo_url && <img src={portal.client.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{portal.client.name}</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Aqui você acompanha o que estamos produzindo, aprova as peças e vê o que vem pela frente.</p>
        </section>

        <section aria-label="Aguardando você">
          <h2 className="mb-3 text-[15px] font-bold">Aguardando você</h2>
          {portal.pending.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Tudo em dia: nada aguarda a sua resposta.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {portal.pending.map(p => (
                <li key={p.id}>
                  <Link to={`/portal/${token}/aprovacao/${p.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm font-bold">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">Rodada {p.round} · enviado {quando(p.sent_at)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Ver e aprovar <ChevronRight className="h-3.5 w-3.5" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Resumo do mês">
          <h2 className="mb-3 text-[15px] font-bold">Resumo de <span className="capitalize">{mesNome}</span></h2>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { rotulo: 'Peças aprovadas', valor: portal.summary.approved },
              { rotulo: 'Ajustes pedidos', valor: portal.summary.changes },
              { rotulo: 'Aguardando você', valor: portal.summary.waiting },
              { rotulo: 'Publicadas', valor: portal.summary.published },
            ].map(k => (
              <li key={k.rotulo} className="rounded-2xl border bg-card px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">{k.rotulo}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{k.valor}</p>
              </li>
            ))}
          </ul>
        </section>

        <CalendarioDoPortal itens={portal.calendar} token={token} />

        {portal.brand && <BrandCoreDoPortal brand={portal.brand} />}

        <section aria-label="Histórico">
          <h2 className="mb-3 text-[15px] font-bold">Histórico de decisões</h2>
          {portal.history.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">As peças que você aprovar ou pedir ajustes ficam registradas aqui.</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-2xl border bg-card px-4">
              {portal.history.map(h => (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  {h.status === 'approved' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <MessageSquareWarning className="h-4 w-4 shrink-0 text-rose-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Rodada {h.round} · {h.status === 'approved' ? 'Aprovado' : 'Ajustes pedidos'}{h.decided_by_name ? ` por ${h.decided_by_name}` : ''}{h.decided_at ? ` em ${format(new Date(h.decided_at), 'dd/MM/yyyy')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
