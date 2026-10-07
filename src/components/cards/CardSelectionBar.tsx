import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Copy, FolderInput, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useDuplicationSpaces } from '@/hooks/useDuplicationSpaces';
import { useSelecaoDeCards } from '@/hooks/useCardSelection';
import { useBulkCardActions } from '@/hooks/useBulkCardActions';
import { separarArquivaveis } from '@/lib/cards/bulk';
import type { Card } from '@/hooks/useCards';

interface Props {
  /** Todos os cards que a tela mostra agora; a barra resolve a seleção a partir deles. */
  cards: Card[];
  spaceId?: string;
  /** Pasta da visão aberta: cópias no mesmo espaço entram nela, senão a visão não as mostraria. */
  folderId?: string;
}

/** Barra flutuante da seleção múltipla: duplicar, duplicar para outro espaço e arquivar. */
export const CardSelectionBar: React.FC<Props> = ({ cards, spaceId, folderId }) => {
  const sel = useSelecaoDeCards();
  const { user } = useAuth();
  const { canDeleteCards } = usePermissions();
  const { data: espacos } = useDuplicationSpaces();
  const { duplicar, arquivar, ocupado } = useBulkCardActions(spaceId);
  const [confirmando, setConfirmando] = useState(false);
  const [outroEspaco, setOutroEspaco] = useState(false);
  const [modo, setModo] = useState<'copy' | 'mirror'>('copy');

  const marcados = useMemo(() => cards.filter(c => sel?.tem(c.id)), [cards, sel]);
  const { permitidos, ignorados } = useMemo(
    () => separarArquivaveis(marcados, { podeArquivarTudo: canDeleteCards, userId: user?.id }),
    [marcados, canDeleteCards, user?.id]
  );

  // Esc encerra a seleção, a menos que haja um diálogo aberto (o Esc é dele).
  useEffect(() => {
    if (!sel?.ativa) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Só conta o que está aberto: um diálogo fechando (animação de saída) não deve segurar o Esc.
      if (document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="menu"][data-state="open"],[data-radix-popper-content-wrapper] [data-state="open"]')) return;
      sel.limpar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [sel]);

  if (!sel || !sel.ativa || marcados.length === 0) return null;
  const n = marcados.length;
  const nome = (q: number) => `${q} ${q === 1 ? 'card' : 'cards'}`;

  const rodarDuplicar = async (destino?: { spaceId: string; modo: 'copy' | 'mirror' }) => {
    setOutroEspaco(false);
    const r = await duplicar(marcados, destino, folderId);
    if (r.ok > 0) sel.limpar();
  };
  const rodarArquivar = async () => {
    setConfirmando(false);
    const r = await arquivar(permitidos, ignorados.length);
    if (r.ok > 0 || ignorados.length > 0) sel.limpar();
  };

  const barra = (
    <div
      role="toolbar"
      aria-label="Ações para os cards selecionados"
      className="fixed bottom-6 left-1/2 z-[60] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 max-sm:bottom-3 max-sm:left-3 max-sm:right-3 max-sm:grid max-sm:max-w-none max-sm:translate-x-0 max-sm:grid-cols-3 max-sm:gap-1.5 max-sm:p-2.5 rounded-2xl border border-border/70 bg-popover px-2.5 py-2 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.35)] animate-in fade-in-0 slide-in-from-bottom-4 duration-200 motion-reduce:animate-none"
    >
      <span className="px-2 text-sm font-semibold tabular-nums max-sm:col-span-2 max-sm:row-start-1 max-sm:px-1" aria-live="polite">
        {n} {n === 1 ? 'selecionado' : 'selecionados'}
      </span>
      <span className="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden />

      <Button variant="ghost" className="h-10 gap-2 px-3 max-sm:h-16 max-sm:flex-col max-sm:gap-1.5 max-sm:rounded-xl max-sm:bg-muted/50 max-sm:px-1 max-sm:text-xs" disabled={ocupado} onClick={() => rodarDuplicar()}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Duplicar
      </Button>

      <Popover open={outroEspaco} onOpenChange={setOutroEspaco}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-3 max-sm:h-16 max-sm:w-full max-sm:flex-col max-sm:gap-1.5 max-sm:rounded-xl max-sm:bg-muted/50 max-sm:px-1 max-sm:text-xs" disabled={ocupado}>
            <FolderInput className="h-4 w-4" />
            <span className="max-sm:hidden">Para outro espaço…</span>
            <span className="sm:hidden">Outro espaço</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" sideOffset={12} className="w-80 p-3">
          <div role="radiogroup" aria-label="Tipo de duplicação" className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            {([['copy', 'Cópia'], ['mirror', 'Espelho']] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={modo === valor}
                onClick={() => setModo(valor)}
                className={cn(
                  'h-9 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  modo === valor ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
            {modo === 'copy'
              ? 'Cria cards novos e independentes no espaço escolhido.'
              : 'O mesmo card passa a aparecer nos dois espaços, sincronizado.'}
          </p>
          <p className="mt-3 px-1 text-sm font-medium">Escolha o espaço</p>
          <ul className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto">
            {(espacos ?? []).map(e => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => rodarDuplicar({ spaceId: e.id, modo })}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color || undefined }} aria-hidden />
                  <span className="truncate">{e.name}</span>
                </button>
              </li>
            ))}
            {(espacos ?? []).length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">Nenhum espaço disponível.</li>}
          </ul>
        </PopoverContent>
      </Popover>

      <span className="mx-1 h-5 w-px bg-border max-sm:hidden" aria-hidden />

      <Button
        variant="ghost"
        className="h-10 gap-2 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive max-sm:h-16 max-sm:flex-col max-sm:gap-1.5 max-sm:rounded-xl max-sm:bg-destructive/5 max-sm:px-1 max-sm:text-xs"
        disabled={ocupado || permitidos.length === 0}
        title={permitidos.length === 0 ? 'Você só pode arquivar cards criados por você' : undefined}
        onClick={() => setConfirmando(true)}
      >
        <Archive className="h-4 w-4" />
        Arquivar
      </Button>

      <Button variant="ghost" size="icon" className="h-10 w-10 max-sm:col-start-3 max-sm:row-start-1 max-sm:justify-self-end" onClick={sel.limpar} aria-label="Limpar seleção">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      {createPortal(barra, document.body)}
      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar {nome(permitidos.length)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Eles saem do quadro, mas não são apagados. Logo depois você pode desfazer pelo aviso que aparece.
              {ignorados.length > 0 && ` ${nome(ignorados.length)} ${ignorados.length === 1 ? 'será ignorado' : 'serão ignorados'}, porque só quem criou o card ou um administrador pode arquivá-lo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={rodarArquivar}>
              Arquivar {nome(permitidos.length)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
