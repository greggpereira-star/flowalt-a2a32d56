import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FolderPlus, ImagePlus, MessageSquarePlus, Sparkles, Keyboard,
  ClipboardPaste, MousePointerClick, Star, FolderInput, Link as LinkIcon, Layers,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreateFolder?: () => void;
  onAddReference?: () => void;
  canAddReference?: boolean;
}

const STEPS = [
  {
    icon: FolderPlus,
    title: '1. Crie uma pasta',
    desc: 'Cada pasta é um moodboard — agrupe por cliente, campanha ou tema. A capa é gerada automaticamente com as primeiras referências.',
  },
  {
    icon: Layers,
    title: '2. Encha de referências',
    desc: 'Solte vários arquivos de uma vez, cole vários links (um por linha) ou use Ctrl+V. Links viram cards com título e thumbnail automáticos.',
  },
  {
    icon: MessageSquarePlus,
    title: '3. Vire demanda',
    desc: 'Transforme uma referência única em card rápido — ou clique em "Virar demanda" no topo do moodboard para criar um briefing com TODAS as referências anexadas.',
  },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'V'], desc: 'Colar link ou imagem no quadro' },
  { keys: ['/'], desc: 'Focar a busca' },
  { keys: ['N'], desc: 'Adicionar nova referência' },
  { keys: ['?'], desc: 'Abrir esta ajuda' },
];

const TIPS = [
  { icon: Layers, label: 'Solte vários arquivos juntos ou cole vários links de uma vez — todos vão para a mesma pasta.' },
  { icon: LinkIcon, label: 'Cole uma URL e o sistema busca título, descrição e imagem automaticamente (preview estilo Pinterest).' },
  { icon: Sparkles, label: 'Use "Virar demanda" para criar um card já com o moodboard inteiro anexado como referência visual.' },
  { icon: ClipboardPaste, label: 'Ctrl+V direto no quadro: imagens são enviadas, links viram cards de link.' },
  { icon: MousePointerClick, label: 'Passe o mouse sobre uma referência para ver as ações rápidas.' },
  { icon: Star, label: 'Favorite referências para encontrá-las depois no filtro "Favoritas".' },
  { icon: FolderInput, label: 'Arraste uma referência para outra pasta sem precisar abrir menu.' },
];

export const HowItWorksDialog: React.FC<Props> = ({
  open, onOpenChange, onCreateFolder, onAddReference, canAddReference,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Como funciona o Banco de Ideias
          </DialogTitle>
          <DialogDescription>
            Um espaço para coletar inspirações e transformá-las em demandas reais sem perder o contexto.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="howto-steps" className="space-y-3 pt-2">
          <h3 id="howto-steps" className="text-sm font-semibold">Fluxo em 3 passos</h3>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s) => {
              const I = s.icon;
              return (
                <li key={s.title} className="rounded-xl border bg-card p-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <I className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-1">{s.desc}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="howto-tips" className="space-y-2 pt-2">
          <h3 id="howto-tips" className="text-sm font-semibold">Dicas práticas</h3>
          <ul className="space-y-1.5">
            {TIPS.map((t) => {
              const I = t.icon;
              return (
                <li key={t.label} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <I className="h-3.5 w-3.5 mt-0.5 text-foreground flex-shrink-0" aria-hidden="true" />
                  <span>{t.label}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="howto-shortcuts" className="space-y-2 pt-2">
          <h3 id="howto-shortcuts" className="text-sm font-semibold flex items-center gap-1.5">
            <Keyboard className="h-4 w-4" aria-hidden="true" />Atalhos de teclado
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <li key={s.desc} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">{s.desc}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">{k}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {onCreateFolder && (
            <Button variant="outline" onClick={() => { onOpenChange(false); onCreateFolder(); }}>
              <FolderPlus className="h-4 w-4 mr-2" aria-hidden="true" />Criar pasta
            </Button>
          )}
          {onAddReference && canAddReference && (
            <Button onClick={() => { onOpenChange(false); onAddReference(); }}>
              <ImagePlus className="h-4 w-4 mr-2" aria-hidden="true" />Adicionar referência
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
