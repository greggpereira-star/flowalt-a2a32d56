import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Folder, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECOES, TipoDeItem, resumoDoItem, rotuloDaEtapa, tituloDoItem } from '@/lib/brandCore/campos';
import { formatarTamanho } from '@/lib/brandCore/arquivos';

export interface BrandDoPortal {
  sections: Partial<Record<TipoDeItem, Record<string, string>[]>>;
  folders: { name: string; files: { name: string; size: number; mime: string | null; url: string; added_at: string }[] }[];
}

type Aba = TipoDeItem | 'files';
const ORDEM: TipoDeItem[] = ['diagnosis', 'persona', 'competitor', 'offer'];

/** Brand Core visto pelo cliente: so as secoes e pastas que a equipe liberou, em leitura. */
export function BrandCoreDoPortal({ brand }: { brand: BrandDoPortal }) {
  const abas = useMemo(() => {
    const lista: { chave: Aba; rotulo: string; n: number }[] = ORDEM
      .filter(t => (brand.sections[t]?.length ?? 0) > 0)
      .map(t => ({ chave: t, rotulo: SECOES[t].titulo, n: brand.sections[t]!.length }));
    const totalArquivos = brand.folders.reduce((n, f) => n + f.files.length, 0);
    if (totalArquivos > 0) lista.push({ chave: 'files', rotulo: 'Arquivos', n: totalArquivos });
    return lista;
  }, [brand]);
  const [ativa, setAtiva] = useState<Aba | null>(null);
  const atual = abas.find(a => a.chave === ativa) ?? abas[0];
  if (!atual) return null;

  return (
    <section aria-label="Brand Core" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-[18px] w-[18px]" /></span>
        <div className="leading-tight">
          <h2 className="text-[15px] font-bold">Brand Core</h2>
          <p className="text-xs text-muted-foreground">O material estratégico da sua marca, organizado pela equipe.</p>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto border-b bg-muted/30 px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Seções do Brand Core">
        {abas.map(a => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={a.chave === atual.chave}
            onClick={() => setAtiva(a.chave)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              a.chave === atual.chave ? 'bg-card shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {a.rotulo}
            <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{a.n}</span>
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {atual.chave === 'files' ? (
          <div className="space-y-5">
            {brand.folders.map(p => (
              <div key={p.name}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Folder className="h-4 w-4 text-primary" /> {p.name}</p>
                <ul className="divide-y rounded-xl border">
                  {p.files.map(f => (
                    <li key={f.url} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatarTamanho(f.size)} · {format(new Date(f.added_at), 'dd/MM/yyyy')}</p>
                      </div>
                      <a href={f.url} download={f.name} rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {(brand.sections[atual.chave] ?? []).map((dados, idx) => {
              const def = SECOES[atual.chave as TipoDeItem];
              const unico = def.unico;
              const etapa = atual.chave === 'offer' ? rotuloDaEtapa(dados.etapa) : '';
              const campos = def.campos.filter(c => c.chave !== def.campoTitulo && (dados[c.chave] ?? '').trim());
              return (
                <li key={idx} className="rounded-xl border bg-background p-4">
                  {!unico && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold">{tituloDoItem(def, dados)}</h3>
                      {etapa && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{etapa}</span>}
                    </div>
                  )}
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {campos.map(c => {
                      const valor = c.tipo === 'select' ? c.opcoes?.find(o => o.valor === dados[c.chave])?.rotulo ?? dados[c.chave] : dados[c.chave];
                      if (c.chave === 'etapa') return null;
                      return (
                        <div key={c.chave} className={cn(c.tipo === 'longo' && 'sm:col-span-2')}>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.rotulo}</dt>
                          <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{valor}</dd>
                        </div>
                      );
                    })}
                  </dl>
                  {campos.length === 0 && <p className="text-sm text-muted-foreground">{resumoDoItem(def, dados) || 'Ainda sem detalhes.'}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
