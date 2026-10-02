import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Config {
  peso_entrega: number;
  peso_constancia: number;
  peso_colaboracao: number;
  peso_horas: number;
  meta_entregas: number;
  meta_dias: number;
  meta_colaboracao: number;
  meta_horas: number;
  valor_atraso: number;
}

const PADRAO: Config = {
  peso_entrega: 50,
  peso_constancia: 20,
  peso_colaboracao: 20,
  peso_horas: 10,
  meta_entregas: 12,
  meta_dias: 20,
  meta_colaboracao: 40,
  meta_horas: 20,
  valor_atraso: 70,
};

const PESOS: { chave: keyof Config; rotulo: string; ajuda: string }[] = [
  { chave: 'peso_entrega', rotulo: 'Entregas', ajuda: 'Cards concluídos em que a pessoa é responsável' },
  { chave: 'peso_constancia', rotulo: 'Constância', ajuda: 'Dias em que a pessoa usou o sistema' },
  { chave: 'peso_colaboracao', rotulo: 'Colaboração', ajuda: 'Comentários, movimentações e cards criados' },
  { chave: 'peso_horas', rotulo: 'Horas registradas', ajuda: 'Tempo apontado no cronômetro' },
];

const METAS: { chave: keyof Config; rotulo: string; ajuda: string; max: number }[] = [
  { chave: 'meta_entregas', rotulo: 'Meta de entregas', ajuda: 'cards em 30 dias para pontuar o máximo', max: 500 },
  { chave: 'meta_dias', rotulo: 'Meta de dias ativos', ajuda: 'dias em 30 para pontuar o máximo', max: 31 },
  { chave: 'meta_colaboracao', rotulo: 'Meta de colaboração', ajuda: 'ações (comentário vale 2) para o máximo', max: 1000 },
  { chave: 'meta_horas', rotulo: 'Meta de horas', ajuda: 'horas em 30 dias para o máximo', max: 744 },
];

export function RankingConfigDialog({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Config>(PADRAO);

  const { data: config } = useQuery({
    queryKey: ['people-ranking-config', workspaceId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('people_ranking_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      return (data ?? null) as Config | null;
    },
  });

  useEffect(() => {
    if (aberto) setForm({ ...PADRAO, ...(config ?? {}) });
  }, [aberto, config]);

  const soma = form.peso_entrega + form.peso_constancia + form.peso_colaboracao + form.peso_horas;
  const campoInvalido = METAS.some(m => !(form[m.chave] >= 1 && form[m.chave] <= m.max))
    || PESOS.some(p => !(form[p.chave] >= 0 && form[p.chave] <= 100))
    || !(form.valor_atraso >= 0 && form.valor_atraso <= 100);
  const podeSalvar = soma === 100 && !campoInvalido;

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('people_ranking_config').upsert(
        { workspace_id: workspaceId, ...form, updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: 'workspace_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pontuação atualizada. O ranking já foi recalculado.');
      queryClient.invalidateQueries({ queryKey: ['people-activity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['people-ranking-config', workspaceId] });
      setAberto(false);
    },
    onError: () => toast.error('Não foi possível salvar. Confira os valores.'),
  });

  const definir = (chave: keyof Config, valor: string) =>
    setForm(f => ({ ...f, [chave]: valor === '' ? NaN : Math.round(Number(valor)) }));

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Configurar pontuação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurar pontuação do ranking</DialogTitle>
          <DialogDescription>
            O score de 0 a 100 é a soma dos quatro pesos. Cada peso é atingido por inteiro quando a pessoa bate a meta correspondente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Pesos (precisam somar 100)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PESOS.map(p => (
                <div key={p.chave} className="space-y-1">
                  <Label htmlFor={p.chave}>{p.rotulo}</Label>
                  <Input
                    id={p.chave}
                    type="number"
                    min={0}
                    max={100}
                    value={Number.isNaN(form[p.chave]) ? '' : form[p.chave]}
                    onChange={e => definir(p.chave, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{p.ajuda}</p>
                </div>
              ))}
            </div>
            <p
              role="status"
              className={`mt-2 text-sm font-medium ${soma === 100 ? 'text-green-600' : 'text-destructive'}`}
            >
              Soma: {Number.isNaN(soma) ? '–' : soma}/100
              {soma !== 100 && !Number.isNaN(soma) && ` (${soma > 100 ? 'sobram' : 'faltam'} ${Math.abs(100 - soma)})`}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Metas para pontuar o máximo</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {METAS.map(m => (
                <div key={m.chave} className="space-y-1">
                  <Label htmlFor={m.chave}>{m.rotulo}</Label>
                  <Input
                    id={m.chave}
                    type="number"
                    min={1}
                    max={m.max}
                    value={Number.isNaN(form[m.chave]) ? '' : form[m.chave]}
                    onChange={e => definir(m.chave, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{m.ajuda}</p>
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="valor_atraso">Entrega com atraso vale (%)</Label>
                <Input
                  id="valor_atraso"
                  type="number"
                  min={0}
                  max={100}
                  value={Number.isNaN(form.valor_atraso) ? '' : form.valor_atraso}
                  onChange={e => definir('valor_atraso', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">100 = atraso não penaliza</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A mudança vale para todo o histórico dos últimos 30 dias, não só daqui para frente. O XP e o nível não mudam.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setForm(PADRAO)}>
            Restaurar padrão
          </Button>
          <Button type="button" disabled={!podeSalvar || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
