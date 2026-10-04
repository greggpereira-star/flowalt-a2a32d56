import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Clapperboard, Copy, FileAudio, Loader2, MessageSquarePlus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useClientCardsByStatus } from '@/hooks/useClientCards';
import type { IdeaReference, MetricasEdicao } from '@/hooks/useIdeaReferences';
import {
  useIdeaAnalysis, useReferenciaAoVivo, pedidoAberto,
  type AnaliseCriativo, type OpcoesRoteiro, type PedidoIA, type RoteiroGerado, type RoteiroSalvo,
} from './useIdeaAnalysis';
import { BriefingCliente, completudeBriefing } from './BriefingCliente';
import { cn } from '@/lib/utils';

/**
 * Aba "Análise e roteiros" do detalhe de uma referência.
 *
 * 1) Transcrição: do arquivo de vídeo/áudio que a equipe subiu (processada na nossa VPS) ou colada à mão.
 * 2) Análise: estrutura, gancho, gatilhos e tom, a partir da transcrição (ou só da legenda, com aviso).
 * 3) Roteiros: novos roteiros com a mesma estrutura, escritos para o cliente escolhido a partir do briefing.
 * O agente só gera texto; a equipe revisa antes de qualquer uso.
 */

const ROTULO_STATUS_TRANSCRICAO: Record<string, string> = {
  processando: 'Transcrevendo…',
  pronta: 'Transcrição pronta',
  erro: 'Falha na transcrição',
};

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold tracking-tight">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  if (!itens?.length) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {itens.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function VisaoAnalise({ a }: { a: AnaliseCriativo }) {
  return (
    <div className="space-y-4 text-sm">
      <p>{a.resumo}</p>

      <div className="rounded-lg bg-muted/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gancho · {a.gancho.tipo}</p>
        <p className="mt-1 font-medium">“{a.gancho.trecho}”</p>
        <p className="mt-1 text-muted-foreground">{a.gancho.por_que_funciona}</p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estrutura</p>
        <ol className="space-y-2">
          {a.estrutura.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold">{e.etapa}</p>
                <p className="text-muted-foreground">{e.trecho}</p>
                <p className="text-xs text-muted-foreground/80">{e.funcao}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gatilhos</p>
        <div className="space-y-1.5">
          {a.gatilhos.map((g, i) => (
            <p key={i}>
              <span className="mr-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">{g.nome}</span>
              <span className="text-muted-foreground">{g.evidencia}</span>
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {([['Tom', a.tom_e_ritmo.tom], ['Ritmo', a.tom_e_ritmo.ritmo], ['Linguagem', a.tom_e_ritmo.linguagem]] as const).map(([r, v]) => (
          <div key={r} className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{r}</p>
            <p className="mt-0.5 text-[13px]">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Replicar</p>
          <Lista itens={a.o_que_replicar} />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Evitar</p>
          <Lista itens={a.o_que_evitar} />
        </div>
      </div>

      {a.edicao && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edição do vídeo</p>
          <p>{a.edicao.ritmo}</p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estrutura visual</p>
            <ol className="space-y-1.5">
              {a.edicao.estrutura_visual.map((e, i) => (
                <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
                  <span className="pt-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{e.tempo}</span>
                  <div><span className="font-semibold">{e.plano}.</span> <span className="text-muted-foreground">{e.o_que_aparece}</span></div>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-background/60 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Texto na tela</p>
              <p className="mt-0.5 text-[13px]">{a.edicao.texto_na_tela.estilo}</p>
              {a.edicao.texto_na_tela.exemplos.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Ex.: {a.edicao.texto_na_tela.exemplos.map(x => `“${x}”`).join(' · ')}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{a.edicao.texto_na_tela.quando_aparece}</p>
            </div>
            <div className="rounded-lg bg-background/60 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enquadramento e gancho visual</p>
              <p className="mt-0.5 text-[13px]">{a.edicao.enquadramento}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.edicao.gancho_visual}</p>
            </div>
          </div>
          <p className="text-[13px]"><span className="font-semibold">Áudio:</span> {a.edicao.audio_e_trilha}</p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Replicar na edição</p>
            <Lista itens={a.edicao.o_que_replicar} />
          </div>
          <p className="text-xs text-muted-foreground"><span className="font-semibold">Limites:</span> {a.edicao.limitacoes}</p>
        </div>
      )}

      {a.limitacoes && (
        <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
          <span className="font-semibold">Limites desta análise:</span> {a.limitacoes}
        </p>
      )}
    </div>
  );
}

function fmtSeg(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}min ${String(r).padStart(2, '0')}s` : `${Math.round(s * 10) / 10}s`;
}

function VisaoMetricas({ m }: { m: MetricasEdicao }) {
  const ativ = m.atividade_visual.por_segundo;
  const maior = Math.max(...ativ, 0.01);
  const ativos = new Set(m.atividade_visual.segundos_mais_ativos);
  const blocos: [string, string, string?][] = [
    ['Duração', fmtSeg(m.duracao_s)],
    ['Formato', `${m.largura}×${m.altura}`, `${m.orientacao} · ${m.fps} fps`],
    ['Cortes secos', String(m.cortes.quantidade), m.cortes.quantidade > 0 ? `1 a cada ${fmtSeg(m.cortes.plano_medio_s)}` : 'tomada contínua'],
    ['Atividade visual', String(m.atividade_visual.media), 'média (0 = imagem parada)'],
    ['Áudio', m.tem_audio ? `${Math.round(m.audio.proporcao_com_som * 100)}% com som` : 'sem áudio', m.audio.silencios.length ? `${m.audio.silencios.length} pausa(s)` : 'sem pausas longas'],
  ];
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {blocos.map(([r, v, sub]) => (
          <div key={r} className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{r}</p>
            <p className="mt-0.5 text-[15px] font-bold tracking-tight">{v}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Atividade visual por segundo</p>
        <div className="flex h-14 items-end gap-px" role="img" aria-label="Atividade visual de cada segundo do vídeo">
          {ativ.map((v, i) => (
            <div
              key={i}
              title={`${i}s · ${v}`}
              className={cn('min-w-[2px] flex-1 rounded-t-sm', ativos.has(i) ? 'bg-primary' : 'bg-primary/30')}
              style={{ height: `${Math.max((v / maior) * 100, 4)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0s</span><span>{fmtSeg(m.duracao_s)}</span></div>
      </div>
      <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
        Corte seco é a troca brusca de cena. Em vídeo gravado de uma vez, com a câmera em movimento, a mudança de enquadramento aparece na atividade visual (barras mais altas), não nos cortes.
        Texto na tela, enquadramento e estilo não saem destas medidas: a análise do agente lê os quadros do vídeo.
      </p>
    </div>
  );
}

function textoDoRoteiro(r: RoteiroGerado) {
  return [
    r.titulo,
    `Abordagem: ${r.abordagem}`,
    '',
    `GANCHO: ${r.gancho}`,
    '',
    ...r.cenas.map(c => `[${c.tempo}]\nFala: ${c.fala}\nVisual: ${c.visual}`),
    '',
    `CTA: ${r.cta}`,
    '',
    ...(r.direcao_de_edicao ? [`DIREÇÃO DE EDIÇÃO\nRitmo: ${r.direcao_de_edicao.ritmo}\nTexto na tela: ${r.direcao_de_edicao.texto_na_tela}\nPlanos: ${r.direcao_de_edicao.planos}\nÁudio: ${r.direcao_de_edicao.audio}${r.direcao_de_edicao.observacoes ? `\nObs.: ${r.direcao_de_edicao.observacoes}` : ''}`, ''] : []),
    `Legenda: ${r.legenda}`,
    r.hashtags?.length ? `Hashtags: ${r.hashtags.join(' ')}` : '',
  ].filter(l => l !== undefined).join('\n');
}

function CartaoRoteiro({
  r, nomeCliente, onCriarCard, onApagar,
}: { r: RoteiroSalvo; nomeCliente?: string; onCriarCard: (r: RoteiroSalvo) => void; onApagar: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const c = r.content;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoDoRoteiro(c));
      toast.success('Roteiro copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{r.title}</p>
          <p className="text-xs text-muted-foreground">{c.abordagem}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            {nomeCliente ? `${nomeCliente} · ` : ''}
            {format(new Date(r.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
          </p>
        </div>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden="true" />
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-border/50 p-3 text-sm">
          <div className="rounded-lg bg-primary/5 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Gancho</p>
            <p className="mt-0.5 font-medium">{c.gancho}</p>
          </div>
          <div className="space-y-2">
            {c.cenas.map((cena, i) => (
              <div key={i} className="grid grid-cols-[56px_1fr] gap-2">
                <span className="pt-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{cena.tempo}</span>
                <div>
                  <p>{cena.fala}</p>
                  <p className="text-xs italic text-muted-foreground">{cena.visual}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CTA</p>
            <p className="mt-0.5">{c.cta}</p>
          </div>
          {c.direcao_de_edicao && (
            <div className="space-y-1 rounded-lg border border-border/60 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Direção de edição</p>
              <p><span className="font-semibold">Ritmo:</span> {c.direcao_de_edicao.ritmo}</p>
              <p><span className="font-semibold">Texto na tela:</span> {c.direcao_de_edicao.texto_na_tela}</p>
              <p><span className="font-semibold">Planos:</span> {c.direcao_de_edicao.planos}</p>
              <p><span className="font-semibold">Áudio:</span> {c.direcao_de_edicao.audio}</p>
              {c.direcao_de_edicao.observacoes && <p className="text-xs text-muted-foreground">{c.direcao_de_edicao.observacoes}</p>}
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Legenda</p>
            <p className="mt-0.5 whitespace-pre-wrap">{c.legenda}</p>
            {c.hashtags?.length > 0 && <p className="mt-1 text-xs text-primary">{c.hashtags.join(' ')}</p>}
          </div>
          <p className="text-xs text-muted-foreground"><span className="font-semibold">Por que funciona para o cliente:</span> {c.por_que_funciona_para_o_cliente}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={copiar}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button>
            <Button size="sm" onClick={() => onCriarCard(r)}><MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />Criar card</Button>
            <Button
              size="sm" variant="ghost" className="ml-auto text-destructive"
              onClick={() => { if (window.confirm('Excluir este roteiro?')) onApagar(r.id); }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisPanel({
  reference, onCriarCard,
}: { reference: IdeaReference; onCriarCard: (ref: IdeaReference) => void }) {
  const { data: viva } = useReferenciaAoVivo(reference);
  const ref = viva ?? reference;
  const { salvarTranscricao, transcrever, medirEdicao, roteiros, apagarRoteiro, pedidos, criarPedido, cancelarPedido } = useIdeaAnalysis(ref.id);

  const [texto, setTexto] = useState(ref.transcript ?? '');
  const [clientId, setClientId] = useState('');
  const [opcoes, setOpcoes] = useState<OpcoesRoteiro>({ quantidade: 3, duracao_segundos: 30, objetivo: '', formato: 'Reels / TikTok', instrucoes: '' });

  // Mantém o texto da transcrição sincronizado quando ela termina em segundo plano.
  useEffect(() => { setTexto(ref.transcript ?? ''); }, [ref.id, ref.transcript]);

  const { data: ativos = [] } = useClientCardsByStatus('active');
  const { data: pausados = [] } = useClientCardsByStatus('paused');
  const clientes = useMemo(() => [...ativos, ...pausados], [ativos, pausados]);
  const cliente = clientes.find(c => c.id === clientId);
  const nomes = useMemo(() => new Map(clientes.map(c => [c.id, c.name])), [clientes]);

  const temArquivo = !!(ref.media_url || ref.file_url) && (ref.type === 'video' || /\.(mp4|mov|m4a|mp3|wav|webm|ogg|aac|mkv)$/i.test(ref.file_name ?? ''));
  const processando = ref.transcript_status === 'processando';
  const editando = ref.edit_metrics_status === 'processando';
  const temVideoArquivo = !!(ref.media_url || ref.file_url) && (ref.type === 'video' || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(ref.file_name ?? '')) && !ref.platform;
  const analise = ref.analysis as AnaliseCriativo | null;
  const temTexto = !!ref.transcript?.trim() || !!ref.title?.trim() || !!ref.description?.trim();
  const transcricaoMudou = texto.trim() !== (ref.transcript ?? '').trim();
  const completude = cliente ? completudeBriefing(cliente) : null;

  const listaPedidos = pedidos.data ?? [];
  const pedidoAnalise = listaPedidos.find(x => x.kind === 'analise' && pedidoAberto(x));
  const pedidoRoteiro = listaPedidos.find(x => x.kind === 'roteiros' && x.client_id === clientId && pedidoAberto(x));
  const ultimoErro = listaPedidos.find(x => x.status === 'erro');
  // Lacunas apontadas pelo agente no último lote de roteiros deste cliente.
  const lacunas = listaPedidos.find(x => x.kind === 'roteiros' && x.client_id === clientId && x.status === 'pronto')?.result?.lacunas_do_briefing ?? [];

  const pedirAnalise = () => criarPedido.mutate({ kind: 'analise' });
  const pedirRoteiros = () => { if (clientId) criarPedido.mutate({ kind: 'roteiros', clientId, opcoes }); };

  const criarCardDoRoteiro = (r: RoteiroSalvo) => {
    const c = r.content;
    onCriarCard({ ...ref, title: r.title, description: textoDoRoteiro(c) });
  };

  return (
    <div className="space-y-4">
      {/* 1. Transcrição */}
      <Secao
        titulo="1 · Transcrição"
        acao={ref.transcript_status && (
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
            ref.transcript_status === 'pronta' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
            ref.transcript_status === 'processando' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            ref.transcript_status === 'erro' && 'bg-red-500/10 text-red-600 dark:text-red-400',
          )}>
            {ROTULO_STATUS_TRANSCRICAO[ref.transcript_status] ?? ref.transcript_status}
          </span>
        )}
      >
        {ref.platform && !temArquivo && (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Este vídeo do {ref.platform === 'tiktok' ? 'TikTok' : ref.platform === 'instagram' ? 'Instagram' : 'YouTube'} é só incorporado: o Flowalt não tem o áudio.
            Cole a transcrição abaixo (ou envie o arquivo do vídeo em uma nova referência) para a análise ler a fala. Sem ela, só a legenda é analisada.
          </p>
        )}
        {ref.transcript_status === 'erro' && ref.transcript_error && (
          <p className="text-xs text-red-600 dark:text-red-400">{ref.transcript_error}</p>
        )}
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={6}
          placeholder="A fala do vídeo aparece aqui depois de transcrita. Você também pode colar ou corrigir o texto à mão."
          className="text-sm"
          disabled={processando}
        />
        <div className="flex flex-wrap gap-2">
          {temArquivo && (
            <Button size="sm" variant="outline" onClick={() => transcrever.mutate()} disabled={processando || transcrever.isPending}>
              {processando || transcrever.isPending
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <FileAudio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
              {ref.transcript ? 'Transcrever de novo' : 'Transcrever o arquivo'}
            </Button>
          )}
          <Button size="sm" onClick={() => salvarTranscricao.mutate(texto)} disabled={!transcricaoMudou || salvarTranscricao.isPending || processando}>
            Salvar transcrição
          </Button>
        </div>
        {processando && <p className="text-xs text-muted-foreground">Isso roda na nossa VPS e leva alguns segundos por minuto de vídeo. Pode continuar usando o sistema.</p>}
      </Secao>

      {/* Edição do vídeo (medições automáticas) */}
      {temVideoArquivo && (
        <Secao
          titulo="Edição do vídeo"
          acao={ref.edit_metrics_status && (
            <span className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
              ref.edit_metrics_status === 'pronta' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
              ref.edit_metrics_status === 'processando' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
              ref.edit_metrics_status === 'erro' && 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}>
              {ref.edit_metrics_status === 'pronta' ? 'Medida' : ref.edit_metrics_status === 'processando' ? 'Medindo…' : 'Falha na medição'}
            </span>
          )}
        >
          {ref.edit_metrics_status === 'erro' && ref.edit_metrics_error && (
            <p className="text-xs text-red-600 dark:text-red-400">{ref.edit_metrics_error}</p>
          )}
          {ref.edit_metrics ? <VisaoMetricas m={ref.edit_metrics} /> : !editando && (
            <p className="text-sm text-muted-foreground">Mede duração, formato, cortes, ritmo e movimento da imagem. Roda na nossa VPS, sem custo por uso.</p>
          )}
          <Button size="sm" variant={ref.edit_metrics ? 'outline' : 'default'} onClick={() => medirEdicao.mutate()} disabled={editando || medirEdicao.isPending}>
            {editando || medirEdicao.isPending
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Clapperboard className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {ref.edit_metrics ? 'Medir de novo' : 'Medir a edição'}
          </Button>
        </Secao>
      )}

      {/* 2. Análise */}
      <Secao
        titulo="2 · Análise do criativo"
        acao={
          <Button size="sm" variant={analise ? 'outline' : 'default'} onClick={pedirAnalise} disabled={!temTexto || !!pedidoAnalise || criarPedido.isPending}>
            {pedidoAnalise ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {pedidoAnalise ? (pedidoAnalise.status === 'processando' ? 'Agente analisando…' : 'Na fila do agente') : analise ? 'Pedir nova análise' : 'Pedir análise'}
          </Button>
        }
      >
        {pedidoAnalise && (
          <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            Pedido {pedidoAnalise.status === 'processando' ? 'em andamento' : 'na fila'}. O agente de copy processa a fila em ciclos; quando terminar, a análise aparece aqui sozinha.
            {pedidoAnalise.status === 'pendente' && (
              <button type="button" className="ml-2 font-semibold underline" onClick={() => cancelarPedido.mutate(pedidoAnalise.id)}>Cancelar pedido</button>
            )}
          </p>
        )}
        {analise ? <VisaoAnalise a={analise} /> : !pedidoAnalise && (
          <p className="text-sm text-muted-foreground">
            {ref.transcript?.trim()
              ? 'Peça a análise para ver o gancho, a estrutura, os gatilhos e o tom. O agente de copy responde aqui.'
              : 'Sem a transcrição, a análise só consegue ler o título e a legenda. Cole a transcrição para uma leitura completa.'}
          </p>
        )}
      </Secao>

      {/* 3. Roteiros */}
      <Secao titulo="3 · Roteiros para o cliente">
        <div>
          <label htmlFor="ar-cliente" className="mb-1 block text-[13px] font-semibold">Cliente</label>
          <select
            id="ar-cliente"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="h-9 w-full rounded-lg border border-border/60 bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Escolha o cliente…</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {cliente && <BriefingCliente key={cliente.id} cliente={cliente} />}

        {cliente && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ar-qtd" className="mb-1 block text-[13px] font-semibold">Quantidade</label>
                <Input id="ar-qtd" type="number" min={1} max={5} value={opcoes.quantidade}
                  onChange={e => setOpcoes(o => ({ ...o, quantidade: Number(e.target.value) }))} />
              </div>
              <div>
                <label htmlFor="ar-dur" className="mb-1 block text-[13px] font-semibold">Duração (s)</label>
                <Input id="ar-dur" type="number" min={10} max={120} value={opcoes.duracao_segundos}
                  onChange={e => setOpcoes(o => ({ ...o, duracao_segundos: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label htmlFor="ar-obj" className="mb-1 block text-[13px] font-semibold">Objetivo do vídeo <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <Input id="ar-obj" value={opcoes.objetivo} onChange={e => setOpcoes(o => ({ ...o, objetivo: e.target.value }))}
                placeholder="Ex.: gerar contatos no WhatsApp para a promoção de outubro" />
            </div>
            <div>
              <label htmlFor="ar-fmt" className="mb-1 block text-[13px] font-semibold">Formato</label>
              <Input id="ar-fmt" value={opcoes.formato} onChange={e => setOpcoes(o => ({ ...o, formato: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="ar-ins" className="mb-1 block text-[13px] font-semibold">Instruções extras <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <Textarea id="ar-ins" rows={2} value={opcoes.instrucoes} onChange={e => setOpcoes(o => ({ ...o, instrucoes: e.target.value }))}
                placeholder="Ex.: gravar em ambiente interno, sem aparecer o rosto; mencionar o frete grátis" className="text-sm" />
            </div>

            {completude && completude.preenchidos < 4 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                O briefing está com {completude.preenchidos} de {completude.total} campos essenciais. Os roteiros vão sair genéricos até você preencher: {completude.faltando.join(', ')}.
              </p>
            )}

            <Button onClick={pedirRoteiros} disabled={!!pedidoRoteiro || criarPedido.isPending || !temTexto} className="w-full">
              {pedidoRoteiro ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              {pedidoRoteiro
                ? (pedidoRoteiro.status === 'processando' ? 'O agente está escrevendo…' : 'Pedido na fila do agente')
                : `Pedir ${opcoes.quantidade} roteiro${opcoes.quantidade > 1 ? 's' : ''} para ${cliente.name}`}
            </Button>
            {pedidoRoteiro ? (
              <p className="text-center text-xs text-muted-foreground">
                O agente de copy processa a fila em ciclos; os roteiros aparecem abaixo quando ficarem prontos.
                {pedidoRoteiro.status === 'pendente' && (
                  <button type="button" className="ml-2 font-semibold underline" onClick={() => cancelarPedido.mutate(pedidoRoteiro.id)}>Cancelar pedido</button>
                )}
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">O pedido vai para a fila do agente de copy; o resultado não é instantâneo.</p>
            )}
            {ultimoErro && !pedidoRoteiro && !pedidoAnalise && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-400">
                O último pedido não deu certo: {ultimoErro.error ?? 'erro sem detalhe'}. Você pode pedir de novo.
              </p>
            )}

            {lacunas.length > 0 && (
              <div className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">O agente sentiu falta destas informações do cliente:</p>
                <Lista itens={lacunas} />
              </div>
            )}
          </>
        )}

        {(roteiros.data?.length ?? 0) > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Roteiros desta referência ({roteiros.data!.length})</p>
            {roteiros.data!.map(r => (
              <CartaoRoteiro
                key={r.id}
                r={r}
                nomeCliente={r.client_id ? nomes.get(r.client_id) : undefined}
                onCriarCard={criarCardDoRoteiro}
                onApagar={id => apagarRoteiro.mutate(id)}
              />
            ))}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Check className="h-3 w-3" aria-hidden="true" />
          O agente só escreve texto. Revise tudo antes de usar: ele pode errar e não inventa dados que não estão no briefing (usa [colchetes] no lugar).
        </p>
      </Secao>
    </div>
  );
}
