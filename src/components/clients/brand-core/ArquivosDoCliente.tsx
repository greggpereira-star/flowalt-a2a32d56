import React, { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown, Download, Eye, File as ArquivoIcone, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, FolderPlus, Lock, MoreHorizontal, Pencil, Trash2, UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { TipoDeArquivo, formatarTamanho, tipoDoArquivo } from '@/lib/brandCore/arquivos';
import {
  ArquivoDoCliente, PastaDoCliente, abrirArquivo, useArquivosDoCliente, useEnviarArquivos, useExcluirArquivo, useGerenciarPastas,
} from '@/hooks/useArquivosDoCliente';

const ICONE: Record<TipoDeArquivo, React.ElementType> = {
  imagem: FileImage, video: FileVideo, pdf: FileText, planilha: FileSpreadsheet, documento: FileText, arquivo: ArquivoIcone,
};
const PAPEIS_DE_GESTAO = ['super_admin', 'owner', 'admin', 'coordinator'];
const PAPEIS_QUE_ESCREVEM = [...PAPEIS_DE_GESTAO, 'member'];

interface DadosDaPasta { name: string; access: 'team' | 'managers'; visible_to_client: boolean }

function DialogoDePasta({
  aberto, pasta, ehGestor, salvando, onFechar, onSalvar,
}: { aberto: boolean; pasta: PastaDoCliente | null; ehGestor: boolean; salvando: boolean; onFechar: () => void; onSalvar: (d: DadosDaPasta) => void }) {
  const [nome, setNome] = useState('');
  const [acesso, setAcesso] = useState<'team' | 'managers'>('team');
  const [cliente, setCliente] = useState(false);

  React.useEffect(() => {
    if (aberto) {
      setNome(pasta?.name ?? '');
      setAcesso(pasta?.access ?? 'team');
      setCliente(pasta?.visible_to_client ?? false);
    }
  }, [aberto, pasta]);

  const valido = nome.trim().length >= 1 && nome.trim().length <= 80;
  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{pasta ? 'Editar pasta' : 'Nova pasta'}</DialogTitle>
          <DialogDescription>Defina quem enxerga o que estiver dentro dela.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={e => {
            e.preventDefault();
            if (valido) onSalvar({ name: nome.trim(), access: acesso, visible_to_client: acesso === 'team' && cliente });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pasta-nome">Nome da pasta</Label>
            <Input id="pasta-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Logos e identidade visual" autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Quem da equipe vê</Label>
            <RadioGroup value={acesso} onValueChange={v => { setAcesso(v as 'team' | 'managers'); if (v === 'managers') setCliente(false); }} className="gap-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="team" className="mt-0.5" />
                <span><span className="block text-sm font-semibold">Toda a equipe</span><span className="block text-xs text-muted-foreground">Qualquer pessoa do workspace vê e baixa.</span></span>
              </label>
              <label className={cn('flex items-start gap-3 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5', ehGestor ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}>
                <RadioGroupItem value="managers" className="mt-0.5" disabled={!ehGestor} />
                <span>
                  <span className="block text-sm font-semibold">Só gestores</span>
                  <span className="block text-xs text-muted-foreground">{ehGestor ? 'Owner, admin e coordenação. Bom para contratos e dados sensíveis.' : 'Só gestores criam pastas restritas.'}</span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className={cn('flex items-start gap-3 rounded-xl border p-3', acesso === 'managers' && 'opacity-50')}>
            <Switch checked={acesso === 'team' && cliente} onCheckedChange={setCliente} disabled={acesso === 'managers'} id="pasta-cliente" className="mt-0.5" />
            <label htmlFor="pasta-cliente" className="cursor-pointer">
              <span className="block text-sm font-semibold">Mostrar ao cliente no portal</span>
              <span className="block text-xs text-muted-foreground">O cliente vê e baixa os arquivos pelo link do portal. Pasta restrita a gestores nunca aparece para ele.</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" disabled={!valido || salvando}>{salvando ? 'Salvando…' : pasta ? 'Salvar' : 'Criar pasta'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Pasta({
  pasta, arquivos, aberta, onAlternar, podeEscrever, ehGestor, meuId, clientId, onEditar, onExcluir,
}: {
  pasta: PastaDoCliente; arquivos: ArquivoDoCliente[]; aberta: boolean; onAlternar: () => void; podeEscrever: boolean; ehGestor: boolean; meuId: string | null;
  clientId: string; onEditar: () => void; onExcluir: () => void;
}) {
  const enviar = useEnviarArquivos(clientId);
  const excluirArquivo = useExcluirArquivo(clientId);
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);

  const subir = (lista: FileList | File[]) => {
    const arquivosEscolhidos = Array.from(lista);
    if (!arquivosEscolhidos.length) return;
    enviar.mutate({ folderId: pasta.id, arquivos: arquivosEscolhidos, aoProgredir: (feitos, total) => setProgresso(feitos >= total ? null : { feitos, total }) });
  };

  return (
    <li className="rounded-2xl border bg-card">
      <div className="flex items-center gap-1 pr-2">
        <button type="button" aria-expanded={aberta} onClick={onAlternar} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Folder className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{pasta.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">{arquivos.length} {arquivos.length === 1 ? 'arquivo' : 'arquivos'}</span>
              {pasta.access === 'managers' && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><Lock className="h-3 w-3" /> Só gestores</span>}
              {pasta.visible_to_client && <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><Eye className="h-3 w-3" /> Visível ao cliente</span>}
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberta && 'rotate-180')} />
        </button>
        {podeEscrever && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações da pasta ${pasta.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}><Pencil className="mr-2 h-4 w-4" /> Editar nome e acesso</DropdownMenuItem>
              {ehGestor && <DropdownMenuItem onClick={onExcluir} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir pasta</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {aberta && (
        <div className="space-y-3 border-t p-4">
          {podeEscrever && (
            <div
              onDragOver={e => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={e => { e.preventDefault(); setArrastando(false); subir(e.dataTransfer.files); }}
              className={cn('rounded-xl border-2 border-dashed p-4 text-center transition-colors', arrastando ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <input ref={entrada} type="file" multiple className="sr-only" onChange={e => { if (e.target.files) subir(e.target.files); e.target.value = ''; }} />
              <Button type="button" size="sm" variant="outline" disabled={enviar.isPending} onClick={() => entrada.current?.click()}>
                <UploadCloud className="mr-1.5 h-4 w-4" /> {enviar.isPending ? `Enviando ${progresso ? `${Math.min(progresso.feitos + 1, progresso.total)} de ${progresso.total}` : '…'}` : 'Enviar arquivos'}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">ou arraste para cá · até 50 MB por arquivo</p>
            </div>
          )}

          {arquivos.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Nenhum arquivo nesta pasta.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {arquivos.map(a => {
                const Icone = ICONE[tipoDoArquivo(a.mime_type, a.name)];
                const podeExcluir = podeEscrever && (ehGestor || a.uploaded_by === meuId);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatarTamanho(a.size_bytes)} · {format(new Date(a.created_at), 'dd/MM/yyyy')}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => abrirArquivo(a)} aria-label={`Baixar ${a.name}`}><Download className="h-4 w-4" /></Button>
                    {podeExcluir && (
                      <Button
                        size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={excluirArquivo.isPending} aria-label={`Excluir ${a.name}`}
                        onClick={() => window.confirm(`Excluir "${a.name}"? Isso não pode ser desfeito.`) && excluirArquivo.mutate(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Arquivos do cliente em pastas, com acesso por pasta (equipe ou só gestores) e opção de mostrar ao cliente no portal. */
export function ArquivosDoCliente({ clientId, meuId }: { clientId: string; meuId: string | null }) {
  const { currentRole } = useWorkspace();
  const { data, isLoading, isError } = useArquivosDoCliente(clientId);
  const { criar, atualizar, excluir } = useGerenciarPastas(clientId);
  const [aberta, setAberta] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ pasta: PastaDoCliente | null } | null>(null);

  const ehGestor = !!currentRole && PAPEIS_DE_GESTAO.includes(currentRole);
  const podeEscrever = !!currentRole && PAPEIS_QUE_ESCREVEM.includes(currentRole);

  const porPasta = useMemo(() => {
    const m = new Map<string, ArquivoDoCliente[]>();
    (data?.arquivos ?? []).forEach(a => m.set(a.folder_id, [...(m.get(a.folder_id) ?? []), a]));
    return m;
  }, [data]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>;
  if (isError) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Não foi possível carregar agora. Tente novamente em instantes.</p>;

  const pastas = data?.pastas ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">{pastas.length === 0 ? 'Nenhuma pasta' : `${pastas.length} ${pastas.length === 1 ? 'pasta' : 'pastas'}`}</p>
        {podeEscrever && <Button size="sm" onClick={() => setDialogo({ pasta: null })}><FolderPlus className="mr-1.5 h-4 w-4" /> Nova pasta</Button>}
      </div>

      {pastas.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm font-semibold">Nenhum arquivo organizado ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Crie pastas (logos, manual da marca, contratos, referências) e escolha quem vê cada uma, inclusive o cliente.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {pastas.map(p => (
            <Pasta
              key={p.id} pasta={p} arquivos={porPasta.get(p.id) ?? []} aberta={aberta === p.id} onAlternar={() => setAberta(aberta === p.id ? null : p.id)}
              podeEscrever={podeEscrever} ehGestor={ehGestor} meuId={meuId} clientId={clientId}
              onEditar={() => setDialogo({ pasta: p })}
              onExcluir={() => {
                const n = porPasta.get(p.id)?.length ?? 0;
                if (window.confirm(`Excluir a pasta "${p.name}"${n ? ` e os ${n} ${n === 1 ? 'arquivo' : 'arquivos'} dentro dela` : ''}? Isso não pode ser desfeito.`)) excluir.mutate({ id: p.id });
              }}
            />
          ))}
        </ul>
      )}

      <DialogoDePasta
        aberto={!!dialogo} pasta={dialogo?.pasta ?? null} ehGestor={ehGestor} salvando={criar.isPending || atualizar.isPending}
        onFechar={() => setDialogo(null)}
        onSalvar={d => {
          if (dialogo?.pasta) atualizar.mutate({ id: dialogo.pasta.id, ...d }, { onSuccess: () => setDialogo(null) });
          else criar.mutate({ ...d, position: pastas.length }, { onSuccess: id => { setDialogo(null); setAberta(id); } });
        }}
      />
    </div>
  );
}
