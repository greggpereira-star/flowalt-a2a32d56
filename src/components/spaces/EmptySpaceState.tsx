import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateFolderWithTemplateDialog } from '@/components/social-media/CreateFolderWithTemplateDialog';
import { 
  FolderPlus, 
  LayoutGrid, 
  List, 
  Calendar, 
  Network,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptySpaceStateProps {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
  spaceType?: string;
}

const viewOptions = [
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Organize cards em colunas por status',
    icon: LayoutGrid,
    color: '#6366f1',
  },
  {
    id: 'list',
    name: 'Lista',
    description: 'Visualização em tabela detalhada',
    icon: List,
    color: '#10b981',
  },
  {
    id: 'calendar',
    name: 'Calendário',
    description: 'Visualize por datas e prazos',
    icon: Calendar,
    color: '#f59e0b',
  },
  {
    id: 'gantt',
    name: 'Gantt',
    description: 'Timeline para projetos complexos',
    icon: Network,
    color: '#8b5cf6',
  },
  {
    id: 'mindmap',
    name: 'Mapa Mental',
    description: 'Visualização em árvore de ideias',
    icon: Lightbulb,
    color: '#f97316',
  },
];

export const EmptySpaceState: React.FC<EmptySpaceStateProps> = ({
  spaceId,
  spaceName,
  spaceColor = '#6366f1',
  spaceType = 'blank',
}) => {
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div 
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ backgroundColor: `${spaceColor}20` }}
          >
            <Sparkles className="w-8 h-8" style={{ color: spaceColor }} />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao {spaceName}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Este espaço está pronto para você personalizar. Comece criando uma pasta 
            para organizar seus cards e adicione as views que preferir.
          </p>
        </div>

        {/* Main CTA */}
        <Button 
          size="lg" 
          className="gap-2 px-6"
          onClick={() => setCreateFolderOpen(true)}
        >
          <FolderPlus className="w-5 h-5" />
          Criar Primeira Pasta
        </Button>

        {/* View Types Preview */}
        <div className="pt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Dentro de cada pasta, você pode criar:
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {viewOptions.map((view) => {
              const Icon = view.icon;
              return (
                <Card 
                  key={view.id}
                  className="relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <CardContent className="p-4 text-center">
                    <div 
                      className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: `${view.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: view.color }} />
                    </div>
                    <p className="font-medium text-sm">{view.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {view.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="pt-4 flex items-start gap-3 text-left bg-muted/30 rounded-lg p-4 max-w-lg mx-auto">
          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Dica:</strong> Você pode criar quantas pastas quiser 
            e combinar diferentes tipos de views. Por exemplo: uma pasta "Projetos" com Kanban + Calendário, 
            e outra "Tarefas Rápidas" só com Lista.
          </div>
        </div>
      </div>

      {/* Create Folder Dialog */}
      <CreateFolderWithTemplateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        spaceId={spaceId}
        spaceType={spaceType}
      />
    </div>
  );
};
