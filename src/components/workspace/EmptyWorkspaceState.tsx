import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Layout, 
  Users, 
  Sparkles, 
  FolderPlus,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface EmptyWorkspaceStateProps {
  workspaceName: string;
  onCreateSpace: () => void;
  onInviteMembers?: () => void;
}

export const EmptyWorkspaceState: React.FC<EmptyWorkspaceStateProps> = ({
  workspaceName,
  onCreateSpace,
  onInviteMembers,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8 max-w-lg">
        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          Seu workspace está pronto!
        </h2>
        <p className="text-muted-foreground">
          O workspace <span className="font-medium text-foreground">{workspaceName}</span> foi criado. 
          Agora você pode criar seus próprios espaços conforme sua operação.
        </p>
      </div>

      {/* Checklist */}
      <div className="w-full max-w-md mb-8">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Próximos passos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FolderPlus className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Criar seu primeiro Espaço</p>
                <p className="text-xs text-muted-foreground">
                  Espaços organizam seu trabalho por área ou projeto
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                <Layout className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Criar Cards</p>
                <p className="text-xs text-muted-foreground">
                  Cards são tarefas, demandas ou projetos
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Convidar equipe</p>
                <p className="text-xs text-muted-foreground">
                  Adicione membros ao seu workspace
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          size="lg" 
          onClick={onCreateSpace}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Criar Espaço
        </Button>
        
        {onInviteMembers && (
          <Button 
            size="lg" 
            variant="outline"
            onClick={onInviteMembers}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Convidar Pessoas
          </Button>
        )}
      </div>

      {/* Templates hint */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
        Dica: Ao criar um espaço, você pode escolher templates prontos como Social Media, Design ou Tráfego.
      </p>
    </div>
  );
};
