import React from 'react';
import { useUserBirthday } from '@/hooks/useNoticesModule';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Cake, Eye, Users, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSkinNovo } from '@/components/ui/skin-novo';

interface BirthdayFormData {
  birth_date: string;
  visibility: 'public' | 'team' | 'private';
}

export const BirthdaySettings: React.FC = () => {
  const novo = useSkinNovo();
  const { birthday, isLoading, saveBirthday } = useUserBirthday();
  const { currentWorkspace } = useWorkspace();

  const { register, handleSubmit, setValue, watch } = useForm<BirthdayFormData>({
    defaultValues: {
      birth_date: birthday?.birth_date || '',
      visibility: birthday?.visibility || 'team',
    },
  });

  React.useEffect(() => {
    if (birthday) {
      setValue('birth_date', birthday.birth_date);
      setValue('visibility', birthday.visibility);
    }
  }, [birthday, setValue]);

  const visibility = watch('visibility');
  const birthDate = watch('birth_date');

  const onSubmit = async (data: BirthdayFormData) => {
    if (!currentWorkspace?.id) {
      toast.error('Workspace ainda carregando. Aguarde e tente novamente.');
      return;
    }
    try {
      await saveBirthday.mutateAsync(data);
    } catch {
      // onError in the mutation already toasts
    }
  };

  const visibilityOptions = [
    {
      value: 'public',
      label: 'Público',
      description: 'Todos do workspace veem o aviso',
      icon: Eye,
    },
    {
      value: 'team',
      label: 'Equipe',
      description: 'Apenas sua equipe/coordenadores',
      icon: Users,
    },
    {
      value: 'private',
      label: 'Privado',
      description: 'Apenas você e administradores',
      icon: Lock,
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-32 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className={novo ? "h-7 w-7 rounded-lg bg-pink-500/10 p-1.5 text-pink-500" : "h-5 w-5 text-pink-500"} />
          Meu Aniversário
        </CardTitle>
        <CardDescription>
          {novo
            ? 'Mostramos só o dia e o mês, nunca a idade. Você escolhe quem vê.'
            : 'Configure sua data de aniversário e quem pode ver. Não exibimos sua idade — apenas o dia da comemoração.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="birth_date">Data de nascimento</Label>
            <Input
              id="birth_date"
              type="date"
              {...register('birth_date', { required: true })}
              className={novo ? "h-11 max-w-xs rounded-xl" : "max-w-xs"}
            />
            {!novo && (
              <p className="text-xs text-muted-foreground">
                Usamos apenas o dia e mês para o aviso de aniversário.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Quem pode ver meu aniversário?</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {visibilityOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('visibility', option.value as 'public' | 'team' | 'private')}
                    className={`p-4 ${novo ? 'rounded-xl border max-sm:flex max-sm:items-center max-sm:gap-3 max-sm:p-3.5' : 'rounded-lg border-2'} text-left transition-all ${
                      visibility === option.value
                        ? `border-primary bg-primary/5 ${novo ? 'ring-1 ring-primary/40' : ''}`
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${novo ? 'max-sm:mb-0 max-sm:shrink-0' : ''} ${
                      visibility === option.value ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saveBirthday.isPending || !currentWorkspace?.id || !birthDate}
            className={novo ? 'h-10 w-full rounded-xl px-6 font-semibold sm:w-auto' : undefined}
          >
            {saveBirthday.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
