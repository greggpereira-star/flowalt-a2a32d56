import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DadosDoItem,
  SECOES,
  SecaoDef,
  TipoDeItem,
  completude,
  limparDados,
  ordenarEsteira,
  resumoDoItem,
  rotuloDaEtapa,
  tituloDoItem,
} from '@/lib/brandCore/campos';
import { ItemDoBrandCore, useBrandCore, useExcluirItemDoBrandCore, useSalvarItemDoBrandCore } from '@/hooks/useBrandCore';

const igual = (a: DadosDoItem, b: DadosDoItem) => JSON.stringify(a) === JSON.stringify(b);
const quando = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

function Completude({ def, dados }: { def: SecaoDef; dados: DadosDoItem }) {
  const c = completude(def, dados);
  const completo = c.total > 0 && c.preenchidos === c.total;
  return (
    <span
      title={completo ? 'Todos os campos essenciais preenchidos' : `Falta: ${c.faltando.join(', ')}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        completo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
      )}
    >
      {completo ? <><Check className="h-3 w-3" /> Completa</> : `${c.preenchidos} de ${c.total} essenciais`}
    </span>
  );
}

interface EditorProps {
  def: SecaoDef;
  inicial: DadosDoItem;
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (dados: DadosDoItem) => void;
  onCancelar?: () => void;
  onExcluir?: () => void;
}

/** Formulario dos campos de uma peca. Guarda um rascunho local e so grava no botao Salvar. */
function EditorDoItem({ def, inicial, salvando, rotuloSalvar, onSalvar, onCancelar, onExcluir }: EditorProps) {
  const [rascunho, setRascunho] = useState<DadosDoItem>(inicial);
  const idBase = useMemo(() => `bc-${def.tipo}-${Math.random().toString(36).slice(2, 8)}`, [def.tipo]);

  // Quando o item muda por fora (outra pessoa salvou), atualiza o rascunho se ainda nao havia edicao local.
  const [base, setBase] = useState(inicial);
  useEffect(() => {
    if (!igual(inicial, base)) {
      if (igual(rascunho, base)) setRascunho(inicial);
      setBase(inicial);
    }
  }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps

  // Campos curtos formam pares lado a lado; o que ficaria sozinho na linha ocupa a largura toda.
  const larguraTotal = useMemo(() => {
    const r: boolean[] = [];
    let i = 0;
    while (i < def.campos.length) {
      const curto = def.campos[i].tipo !== 'longo';
      const par = curto && def.campos[i + 1] && def.campos[i + 1].tipo !== 'longo';
      if (par) { r[i] = false; r[i + 1] = false; i += 2; } else { r[i] = true; i += 1; }
    }
    return r;
  }, [def]);

  const limpo = limparDados(def, rascunho);
  const alterado = !igual(limpo, limparDados(def, base));
  const vazio = Object.keys(limpo).length === 0;

  return (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault();
        if (alterado && !vazio) onSalvar(rascunho);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {def.campos.map((c, idx) => {
          const id = `${idBase}-${c.chave}`;
          const largo = larguraTotal[idx];
          return (
            <div key={c.chave} className={cn('space-y-1.5', largo && 'sm:col-span-2')}>
              <Label htmlFor={id} className="flex items-center gap-1.5 text-sm">
                {c.rotulo}
                {c.essencial && <span className="rounded bg-muted px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">essencial</span>}
              </Label>
              {c.tipo === 'longo' ? (
                <Textarea
                  id={id}
                  rows={3}
                  value={rascunho[c.chave] ?? ''}
                  onChange={e => setRascunho(r => ({ ...r, [c.chave]: e.target.value }))}
                  placeholder={c.dica}
                  maxLength={4000}
                />
              ) : c.tipo === 'select' ? (
                <Select value={rascunho[c.chave] ?? ''} onValueChange={v => setRascunho(r => ({ ...r, [c.chave]: v }))}>
                  <SelectTrigger id={id}><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {c.opcoes!.map(o => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input id={id} value={rascunho[c.chave] ?? ''} onChange={e => setRascunho(r => ({ ...r, [c.chave]: e.target.value }))} placeholder={c.dica} maxLength={4000} />
              )}
              {c.tipo !== 'longo' && c.dica && c.tipo === 'select' && <p className="text-xs text-muted-foreground">{c.dica}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="submit" size="sm" disabled={salvando || !alterado || vazio}>
          <Save className="mr-1.5 h-4 w-4" /> {salvando ? 'Salvando…' : rotuloSalvar}
        </Button>
        {onCancelar && <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>{alterado ? 'Descartar' : 'Fechar'}</Button>}
        {alterado && <span className="text-xs text-amber-700 dark:text-amber-400" role="status">Alterações não salvas</span>}
        {onExcluir && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={onExcluir}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
          </Button>
        )}
      </div>
    </form>
  );
}

/** Uma secao do Brand Core: diagnostico (um so) ou lista de personas, concorrentes ou ofertas. */
export function SecaoBrandCore({ tipo, clientId }: { tipo: TipoDeItem; clientId: string }) {
  const def = SECOES[tipo];
  const { data, isLoading, isError } = useBrandCore(clientId);
  const salvar = useSalvarItemDoBrandCore(clientId);
  const excluir = useExcluirItemDoBrandCore(clientId);
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const itens = useMemo(() => {
    const doTipo = (data ?? []).filter(i => i.kind === tipo);
    return tipo === 'offer' ? ordenarEsteira(doTipo) : doTipo;
  }, [data, tipo]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  if (isError) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Não foi possível carregar agora. Tente novamente em instantes.</p>;

  // Diagnostico: um formulario so.
  if (def.unico) {
    const existente = itens[0];
    return (
      <div className="space-y-4">
        {existente && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Completude def={def} dados={existente.data} /> Atualizado {quando(existente.updated_at)}
          </p>
        )}
        <div className="rounded-2xl border bg-card p-5">
          <EditorDoItem
            key={existente?.id ?? 'novo'}
            def={def}
            inicial={existente?.data ?? {}}
            salvando={salvar.isPending}
            rotuloSalvar={existente ? 'Salvar diagnóstico' : 'Criar diagnóstico'}
            onSalvar={dados => salvar.mutate({ id: existente?.id, tipo, dados })}
          />
        </div>
      </div>
    );
  }

  const confirmarExclusao = (i: ItemDoBrandCore) => {
    if (window.confirm(`Excluir "${tituloDoItem(def, i.data)}"? Isso não pode ser desfeito.`)) {
      excluir.mutate(i.id, { onSuccess: () => setAberto(null) });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {itens.length === 0 ? 'Nada cadastrado' : `${itens.length} ${itens.length === 1 ? def.singular : `${def.singular}s`}`}
        </p>
        {!criando && (
          <Button size="sm" onClick={() => { setCriando(true); setAberto(null); }}>
            <Plus className="mr-1.5 h-4 w-4" /> {def.adicionar}
          </Button>
        )}
      </div>

      {criando && (
        <div className="rounded-2xl border border-primary/40 bg-card p-5 ring-2 ring-primary/10">
          <p className="mb-4 text-sm font-semibold">Nova {def.singular}</p>
          <EditorDoItem
            def={def}
            inicial={{}}
            salvando={salvar.isPending}
            rotuloSalvar={`Salvar ${def.singular}`}
            onCancelar={() => setCriando(false)}
            onSalvar={dados => salvar.mutate({ tipo, dados, position: itens.length }, { onSuccess: () => setCriando(false) })}
          />
        </div>
      )}

      {itens.length === 0 && !criando && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm font-semibold">{def.vazio.titulo}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{def.vazio.texto}</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {itens.map(i => {
          const abertoAgora = aberto === i.id;
          const resumo = resumoDoItem(def, i.data);
          const etapa = tipo === 'offer' ? rotuloDaEtapa(i.data.etapa) : '';
          return (
            <li key={i.id} className="rounded-2xl border bg-card">
              <button
                type="button"
                aria-expanded={abertoAgora}
                onClick={() => { setAberto(abertoAgora ? null : i.id); setCriando(false); }}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{tituloDoItem(def, i.data)}</span>
                    {etapa && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{etapa}</span>}
                  </span>
                  {resumo && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{resumo}</span>}
                </span>
                <Completude def={def} dados={i.data} />
                <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', abertoAgora && 'rotate-180')} />
              </button>
              {abertoAgora && (
                <div className="border-t p-5">
                  <EditorDoItem
                    def={def}
                    inicial={i.data}
                    salvando={salvar.isPending}
                    rotuloSalvar="Salvar alterações"
                    onCancelar={() => setAberto(null)}
                    onExcluir={() => confirmarExclusao(i)}
                    onSalvar={dados => salvar.mutate({ id: i.id, tipo, dados })}
                  />
                  <p className="mt-3 text-[11px] text-muted-foreground">Atualizado {quando(i.updated_at)}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
