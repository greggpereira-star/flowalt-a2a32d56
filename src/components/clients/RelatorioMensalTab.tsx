import React, { useEffect, useMemo, useState } from 'react';
import { Copy, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useApagarRascunho,
  useAtualizarRelatorio,
  useGerarRelatorio,
  useRelatoriosDoCliente,
  type RelatorioMensal,
} from '@/hooks/useRelatorioMensal';
import { primeiroDia, rotuloPeriodo } from '@/lib/inteligencia/relatorio-mensal';

// Meses oferecidos: o atual e os 5 anteriores, em AAAA-MM (UTC, como o resto do relatório).
function ultimosMeses(): string[] {
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, i) => primeiroDia(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))).slice(0, 7));
}

function Numero({ rotulo, valor, ajuda }: { rotulo: string; valor: string | number; ajuda?: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{valor}</p>
      {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

function Editor({ relatorio, clientId, clientName }: { relatorio: RelatorioMensal; clientId: string; clientName: string }) {
  const [texto, setTexto] = useState(relatorio.summary);
  useEffect(() => setTexto(relatorio.summary), [relatorio.id, relatorio.summary]);
  const atualizar = useAtualizarRelatorio(clientId);
  const gerar = useGerarRelatorio(clientId, clientName);
  const apagar = useApagarRascunho(clientId);
  const publicado = relatorio.status === 'published';
  const s = relatorio.snapshot;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Texto copiado.');
    } catch {
      toast.error('Não consegui copiar. Selecione e copie manualmente.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{rotuloPeriodo(s.periodo)}</h3>
        <Badge variant={publicado ? 'default' : 'secondary'}>{publicado ? 'Revisado' : 'Rascunho'}</Badge>
        <span className="text-xs text-muted-foreground">Números tirados em {new Date(relatorio.updated_at).toLocaleDateString('pt-BR')}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Numero rotulo="Entregas" valor={s.entregas.total} ajuda={s.entregas.mesAnterior ? `mês anterior: ${s.entregas.mesAnterior}` : undefined} />
        <Numero rotulo="No prazo" valor={s.prazos.percentual == null ? '—' : `${s.prazos.percentual}%`} ajuda={s.prazos.comPrazo ? `${s.prazos.noPrazo} de ${s.prazos.comPrazo} com prazo` : 'nenhuma com prazo'} />
        <Numero rotulo="Aprovações" valor={s.aprovacoes.enviadas} ajuda={`${s.aprovacoes.aprovadas} aprovadas · ${s.aprovacoes.ajustes} com ajuste`} />
        <Numero rotulo="Em andamento" valor={s.andamento.abertos} ajuda={s.andamento.atrasados ? `${s.andamento.atrasados} atrasadas` : 'nenhuma atrasada'} />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Texto do relatório {publicado ? '' : '(edite antes de marcar como revisado)'}</p>
        <Textarea value={texto} onChange={e => setTexto(e.target.value)} readOnly={publicado} rows={16} className="font-mono text-[13px] leading-relaxed" />
      </div>

      <div className="flex flex-wrap gap-2">
        {publicado ? (
          <Button variant="outline" onClick={() => atualizar.mutate({ id: relatorio.id, status: 'draft' })} disabled={atualizar.isPending}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Voltar a rascunho
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => atualizar.mutate({ id: relatorio.id, summary: texto }, { onSuccess: () => toast.success('Rascunho salvo.') })} disabled={atualizar.isPending || texto === relatorio.summary}>
              Salvar rascunho
            </Button>
            <Button
              onClick={() => atualizar.mutate({ id: relatorio.id, summary: texto }, { onSuccess: () => atualizar.mutate({ id: relatorio.id, status: 'published' }, { onSuccess: () => toast.success('Marcado como revisado.') }) })}
              disabled={atualizar.isPending || !texto.trim()}
            >
              Marcar como revisado
            </Button>
            <Button
              variant="ghost"
              onClick={() => confirm('Refazer troca os números e descarta o texto que você editou. Continuar?') && gerar.mutate({ periodo: s.periodo, existenteId: relatorio.id })}
              disabled={gerar.isPending}
            >
              Refazer com números de hoje
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => confirm('Apagar este rascunho?') && apagar.mutate(relatorio.id)} disabled={apagar.isPending}>
              Apagar rascunho
            </Button>
          </>
        )}
        <Button variant="outline" onClick={copiar}>
          <Copy className="mr-1.5 h-4 w-4" /> Copiar texto
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Este relatório ainda não é enviado ao cliente: copie o texto para mandar por e-mail ou WhatsApp depois de revisar.</p>
    </div>
  );
}

export function RelatorioMensalTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: relatorios, isLoading } = useRelatoriosDoCliente(clientId);
  const gerar = useGerarRelatorio(clientId, clientName);
  const meses = useMemo(ultimosMeses, []);
  const [mes, setMes] = useState(meses[1] ?? meses[0]);
  const [aberto, setAberto] = useState<string | null>(null);

  const existente = relatorios?.find(r => r.period === `${mes}-01`);
  const atual = relatorios?.find(r => r.id === aberto) ?? existente;

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Monta o rascunho do mês com os números reais de cards e aprovações deste cliente. Você revisa e edita antes de usar.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mes}
            onChange={e => { setMes(e.target.value); setAberto(null); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {meses.map(m => (
              <option key={m} value={m}>{rotuloPeriodo(m)}</option>
            ))}
          </select>
          {!existente && (
            <Button onClick={() => gerar.mutate({ periodo: mes })} disabled={gerar.isPending}>
              <FileText className="mr-1.5 h-4 w-4" /> {gerar.isPending ? 'Montando...' : 'Gerar rascunho'}
            </Button>
          )}
        </div>
      </div>

      {atual ? (
        <Editor relatorio={atual} clientId={clientId} clientName={clientName} />
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum relatório de {rotuloPeriodo(mes)} ainda.</p>
      )}
    </div>
  );
}
