import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, FolderPlus, ImagePlus, MessageSquarePlus, X, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IdeaBoard } from '@/hooks/useIdeaBoards';

interface Props {
  boards: IdeaBoard[];
  hasCreatedCard: boolean;
  onCreateFolder: () => void;
  onOpenFirstBoard: () => void;
  onHowItWorks: () => void;
  onDismiss: () => void;
}

export const OnboardingChecklist: React.FC<Props> = ({
  boards, hasCreatedCard, onCreateFolder, onOpenFirstBoard, onHowItWorks, onDismiss,
}) => {
  const hasFolder = boards.length > 0;
  const hasReference = useMemo(
    () => boards.some(b => (b.reference_count ?? 0) > 0),
    [boards]
  );

  const items = [
    {
      key: 'folder',
      title: 'Crie sua primeira pasta',
      desc: 'Organize por cliente, campanha ou tema.',
      icon: FolderPlus,
      done: hasFolder,
      action: { label: 'Criar pasta', onClick: onCreateFolder, show: !hasFolder },
    },
    {
      key: 'reference',
      title: 'Adicione uma referência',
      desc: 'Imagem, vídeo, link, PDF ou nota — também aceita colar (Ctrl+V) e arrastar arquivos.',
      icon: ImagePlus,
      done: hasReference,
      action: { label: 'Abrir pasta', onClick: onOpenFirstBoard, show: hasFolder && !hasReference },
    },
    {
      key: 'card',
      title: 'Transforme uma ideia em card',
      desc: 'Passe o mouse numa referência e clique em "Criar card" para virar tarefa.',
      icon: MessageSquarePlus,
      done: hasCreatedCard,
      action: { label: 'Ver como', onClick: onHowItWorks, show: hasReference && !hasCreatedCard },
    },
  ];

  const completed = items.filter(i => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (allDone) return null;

  return (
    <section
      aria-labelledby="ib-checklist-title"
      className="relative rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-5"
    >
      <button
        onClick={onDismiss}
        aria-label="Fechar guia inicial"
        className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-start justify-between gap-3 mb-3 pr-8">
        <div className="min-w-0">
          <h2 id="ib-checklist-title" className="text-sm font-semibold">
            Vamos começar no Banco de Ideias
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completed} de {total} passos concluídos
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onHowItWorks} className="flex-shrink-0">
          <HelpCircle className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          <span>Como funciona</span>
        </Button>
      </div>

      <Progress value={(completed / total) * 100} className="h-1.5 mb-4" aria-label="Progresso do guia" />

      <ol className="space-y-2">
        {items.map((it) => {
          const I = it.icon;
          return (
            <li
              key={it.key}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-background/60 p-3 transition-colors',
                it.done && 'opacity-70'
              )}
            >
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  it.done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'
                )}
                aria-hidden="true"
              >
                {it.done ? <Check className="h-3.5 w-3.5" /> : <I className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', it.done && 'line-through text-muted-foreground')}>
                  {it.title}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{it.desc}</p>
              </div>
              {it.action.show && (
                <Button size="sm" variant="outline" onClick={it.action.onClick} className="flex-shrink-0">
                  {it.action.label}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
