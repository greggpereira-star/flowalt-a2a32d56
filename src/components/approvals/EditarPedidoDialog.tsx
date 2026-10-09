import React, { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAttachments } from '@/hooks/useAttachments';
import { ApprovalBundle, ETAPAS_DE_APROVACAO, EtapaDeAprovacao, rotuloDaEtapa, tipoDoArquivoDeAprovacao, useEditarPedido } from '@/hooks/useApprovals';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Midia { path: string; nome: string; tipo: string | null }
interface EstadoEtapa { ativa: boolean; texto: string; midias: string[] }

const SEM_ETAPA = '__rapido__';
const mesmaLista = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** Edita um pedido ainda em aberto: texto, midia e etapas que o cliente ainda nao respondeu. O link continua o mesmo. */
export function EditarPedidoDialog({ bundle, open, onOpenChange }: { bundle: ApprovalBundle; open: boolean; onOpenChange: (o: boolean) => void }) {
  const r = bundle.request;
  const porEtapas = r.mode === 'stages';
  const { data: anexos } = useAttachments(r.card_id);
  const editar = useEditarPedido();

  const decididas = useMemo(() => new Map(bundle.stages.filter(s => s.status !== 'pending').map(s => [s.stage, s])), [bundle.stages]);
  const existentes = useMemo(() => new Set(bundle.stages.map(s => s.stage)), [bundle.stages]);

  // Estado inicial a partir do pedido atual (tambem serve de base para saber o que mudou).
  const inicial = useMemo(() => {
    const doTexto = (chave: string | null) =>
      bundle.items.filter(i => i.kind === 'text' && (i.stage ?? SEM_ETAPA) === (chave ?? SEM_ETAPA)).map(i => i.body ?? '').join('\n\n');
    const dasMidias = (chave: string | null) =>
      bundle.items.filter(i => i.kind !== 'text' && (i.stage ?? SEM_ETAPA) === (chave ?? SEM_ETAPA) && i.storage_path).map(i => i.storage_path as string);
    const out: Record<string, EstadoEtapa> = {};
    if (porEtapas) {
      ETAPAS_DE_APROVACAO.forEach(e => {
        out[e.chave] = { ativa: existentes.has(e.chave), texto: doTexto(e.chave), midias: dasMidias(e.chave) };
      });
    } else {
      out[SEM_ETAPA] = { ativa: true, texto: doTexto(null), midias: dasMidias(null) };
    }
    return out;
  }, [bundle.items, existentes, porEtapas]);

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [estado, setEstado] = useState<Record<string, EstadoEtapa>>({});
  const [avisar, setAvisar] = useState(true);
  const [aviso, setAviso] = useState('');
  const [avisoEditado, setAvisoEditado] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo(r.title);
      setMensagem(r.message ?? '');
      setEstado(JSON.parse(JSON.stringify(inicial)));
      setAvisar(true);
      setAvisoEditado(false);
    }
    // so ao abrir: nao reabrir o formulario a cada atualizacao em tempo real do pedido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opcoes de midia: os anexos do card, mais pecas do pedido cujo anexo foi apagado (para nao sumirem sem querer).
  const opcoes: Midia[] = useMemo(() => {
    const lista: Midia[] = (anexos ?? []).map(a => ({ path: a.file_url, nome: a.file_name, tipo: a.file_type }));
    const conhecidos = new Set(lista.map(m => m.path));
    bundle.items.forEach(i => {
      if (i.kind !== 'text' && i.storage_path && !conhecidos.has(i.storage_path)) {
        lista.push({ path: i.storage_path, nome: i.file_name ?? 'arquivo', tipo: null });
        conhecidos.add(i.storage_path);
      }
    });
    return lista;
  }, [anexos, bundle.items]);

  const chaves = porEtapas ? ETAPAS_DE_APROVACAO.map(e => e.chave as string) : [SEM_ETAPA];
  const editavel = (chave: string) => !decididas.has(chave as EtapaDeAprovacao);
  const vazia = (e: EstadoEtapa) => !e.texto.trim() && e.midias.length === 0;

  // O que mudou, etapa por etapa.
  const mudancas = useMemo(() => {
    const lista: { chave: string; tipo: 'adicionou' | 'removeu' | 'atualizou' }[] = [];
    chaves.forEach(c => {
      if (!editavel(c)) return;
      const a = inicial[c];
      const b = estado[c];
      if (!a || !b) return;
      if (porEtapas && a.ativa && !b.ativa) lista.push({ chave: c, tipo: 'removeu' });
      else if (porEtapas && !a.ativa && b.ativa) lista.push({ chave: c, tipo: 'adicionou' });
      else if (b.ativa && (a.texto.trim() !== b.texto.trim() || !mesmaLista(a.midias, b.midias))) lista.push({ chave: c, tipo: 'atualizou' });
    });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, inicial]);
  const tituloMudou = titulo.trim() !== r.title || mensagem.trim() !== (r.message ?? '').trim();
  const houveMudanca = mudancas.length > 0 || tituloMudou;

  const resumo = useMemo(() => {
    if (mudancas.length === 0) return 'A equipe atualizou o pedido.';
    const partes = mudancas.map(m => `${m.tipo} ${porEtapas ? `a etapa ${rotuloDaEtapa(m.chave as EtapaDeAprovacao)}` : 'as peças'}`);
    return `A equipe atualizou o pedido: ${partes.join(', ')}.`;
  }, [mudancas, porEtapas]);
  useEffect(() => {
    if (!avisoEditado) setAviso(resumo);
  }, [resumo, avisoEditado]);

  const ativasPendentes = chaves.filter(c => editavel(c) && estado[c]?.ativa);
  const etapaVazia = chaves.find(c => editavel(c) && estado[c]?.ativa && vazia(estado[c]));
  const erro =
    !titulo.trim() ? 'Dê um título ao pedido.'
    : etapaVazia ? (porEtapas ? `A etapa ${rotuloDaEtapa(etapaVazia as EtapaDeAprovacao)} está vazia. Preencha ou desligue.` : 'Escolha pelo menos uma peça ou escreva o texto a aprovar.')
    : ativasPendentes.length === 0 ? 'Deixe pelo menos uma etapa aguardando o cliente.'
    : null;

  const alternarMidia = (chave: string, path: string) =>
    setEstado(prev => {
      const atual = prev[chave];
      const midias = atual.midias.includes(path) ? atual.midias.filter(p => p !== path) : [...atual.midias, path];
      return { ...prev, [chave]: { ...atual, midias } };
    });

  const salvar = () => {
    const itensDe = (e: EstadoEtapa) => [
      ...e.midias.map(path => {
        const m = opcoes.find(o => o.path === path);
        const original = bundle.items.find(i => i.storage_path === path);
        return { kind: original?.kind ?? tipoDoArquivoDeAprovacao(m?.tipo ?? null, m?.nome ?? path), storage_path: path, file_name: m?.nome ?? original?.file_name ?? '' };
      }),
      ...(e.texto.trim() ? [{ kind: 'text', body: e.texto.trim() }] : []),
    ];
    const stages = porEtapas
      ? mudancas.map(m => (m.tipo === 'removeu' ? { stage: m.chave, remove: true } : { stage: m.chave, items: itensDe(estado[m.chave]) }))
      : [{ items: itensDe(estado[SEM_ETAPA]) }];
    // Pedido rapido sem mudanca de pecas, so de titulo: reenvia as pecas atuais (a funcao troca o conjunto inteiro).
    editar.mutate(
      { request: r, title: titulo.trim(), message: mensagem.trim(), stages, notify: avisar && aviso.trim() ? aviso.trim() : null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
          <DialogDescription>
            O link continua o mesmo. O cliente vê a versão nova ao abrir ou atualizar a página. Etapas que ele já respondeu ficam travadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-titulo">Título</Label>
            <Input id="ed-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-msg">Mensagem para o cliente (opcional)</Label>
            <Textarea id="ed-msg" rows={2} value={mensagem} onChange={e => setMensagem(e.target.value)} />
          </div>

          {chaves.map(chave => {
            const def = ETAPAS_DE_APROVACAO.find(e => e.chave === chave);
            const e = estado[chave];
            if (!e) return null;
            const decisao = decididas.get(chave as EtapaDeAprovacao);
            const ehMidia = chave === 'midia' || !porEtapas;
            const ehTexto = chave !== 'midia';

            if (decisao) {
              return (
                <div key={chave} className="rounded-xl border bg-muted/30 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" /> {def?.rotulo}
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', decisao.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300')}>
                      {decisao.status === 'approved' ? 'Aprovada' : 'Ajuste pedido'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">O cliente já respondeu esta etapa. Para mudar, envie uma nova rodada.</p>
                </div>
              );
            }

            return (
              <div key={chave} className={cn('rounded-xl border p-3', porEtapas && !e.ativa && 'bg-muted/30')}>
                {porEtapas && (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{def?.rotulo}</p>
                      <p className="text-xs text-muted-foreground">{existentes.has(chave as EtapaDeAprovacao) ? 'Aguardando o cliente' : def?.dica}</p>
                    </div>
                    <Switch checked={e.ativa} onCheckedChange={v => setEstado(p => ({ ...p, [chave]: { ...p[chave], ativa: v } }))} aria-label={`Enviar ${def?.rotulo}`} />
                  </div>
                )}
                {e.ativa && (
                  <div className={cn('space-y-2.5', porEtapas && 'mt-2.5')}>
                    {ehMidia && (
                      opcoes.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">Este card ainda não tem arquivos. Anexe a arte ou o vídeo em "Arquivos & Anexos" e volte aqui.</p>
                      ) : (
                        <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-1.5">
                          {opcoes.map(m => (
                            <li key={m.path}>
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                <Checkbox checked={e.midias.includes(m.path)} onCheckedChange={() => alternarMidia(chave, m.path)} />
                                <span className="min-w-0 flex-1 truncate text-sm">{m.nome}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                    {ehTexto && (
                      <Textarea
                        rows={porEtapas && (chave === 'conteudo' || chave === 'legenda') ? 4 : porEtapas ? 2 : 4}
                        value={e.texto}
                        onChange={ev => setEstado(p => ({ ...p, [chave]: { ...p[chave], texto: ev.target.value } }))}
                        placeholder={porEtapas ? `Escreva ${chave === 'legenda' ? 'a legenda' : chave === 'tema' ? 'o tema' : 'o conteúdo'} que o cliente vai aprovar.` : 'Texto ou legenda a aprovar.'}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-2 rounded-xl border p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={avisar} onCheckedChange={v => setAvisar(v === true)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Avisar o cliente na conversa</span>
                <span className="block text-xs text-muted-foreground">Ele vê a mensagem ao abrir o link e sabe o que mudou.</span>
              </span>
            </label>
            {avisar && (
              <Textarea rows={2} value={aviso} onChange={e => { setAviso(e.target.value); setAvisoEditado(true); }} aria-label="Mensagem para o cliente" />
            )}
          </div>

          {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={editar.isPending || !!erro || !houveMudanca}>
            {editar.isPending ? 'Salvando…' : houveMudanca ? 'Salvar alterações' : 'Nenhuma alteração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
