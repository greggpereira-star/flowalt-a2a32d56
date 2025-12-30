import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Building2, Sparkles } from 'lucide-react';

const NewWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { createWorkspace } = useWorkspace();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.trim().length < 2) {
      toast({
        title: 'Nome inválido',
        description: 'O nome do workspace deve ter pelo menos 2 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await createWorkspace(name.trim());
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o workspace. Tente novamente.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Workspace criado!',
        description: 'Seu novo workspace está pronto para uso.',
      });
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-primary">Flowalt</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Building2 className="h-6 w-6" />
              Novo Workspace
            </CardTitle>
            <CardDescription>
              Crie um novo espaço de trabalho para sua equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Workspace</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Minha Empresa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Este será o nome visível para todos os membros da equipe.
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">O que será criado:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 6 espaços padrão (Designer, Audiovisual, etc.)</li>
                  <li>• Você será o proprietário do workspace</li>
                  <li>• Poderá convidar membros depois</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="mr-2 h-4 w-4" />
                )}
                Criar Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewWorkspace;
