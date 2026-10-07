import { ArrowRight, FileText, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { IdeaReference } from '@/hooks/useIdeaReferences';
import { useIdeaAnalysis, useReferenciaAoVivo, type AnaliseCriativo } from './useIdeaAnalysis';

const duracao = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.round(s)} s`);

const Bloco: React.FC<{ titulo: string; acao?: React.ReactNode; children: React.ReactNode }> = ({ titulo, acao, children }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {acao}
    </div>
    {children}
  </section>
);

const Atalho: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {children}
    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
  </button>
);

/** O que a equipe mais precisa ver ao abrir uma ideia: o que foi entendido dela, sem trocar de aba. */
export const ResumoDaIdeia: React.FC<{ reference: IdeaReference; onAbrirAnalise: () => void }> = ({ reference, onAbrirAnalise }) => {
  const { data: viva } = useReferenciaAoVivo(reference);
  const ref = viva ?? reference;
  const { roteiros } = useIdeaAnalysis(ref.id);
  const analise = ref.analysis as AnaliseCriativo | null;
  const m = ref.edit_metrics;
  const transcricao = ref.transcript?.trim();
  const lista = roteiros.data ?? [];

  return (
    <>
      <Bloco titulo="O que entendemos desta ideia" acao={analise ? <Atalho onClick={onAbrirAnalise}>Análise completa</Atalho> : undefined}>
        {analise ? (
          <div className="space-y-3">
            <p className="max-w-[68ch] text-sm leading-relaxed text-foreground/90">{analise.resumo}</p>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Gancho · {analise.gancho.tipo}</p>
              <p className="mt-1.5 text-[15px] font-medium leading-snug">“{analise.gancho.trecho}”</p>
            </div>
            {analise.gatilhos?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analise.gatilhos.slice(0, 5).map(g => (
                  <Badge key={g.nome} variant="secondary" className="font-normal">{g.nome}</Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="space-y-2">
                <p className="text-sm font-medium">Esta ideia ainda não foi analisada.</p>
                <p className="text-sm text-muted-foreground">A análise mostra o gancho, a estrutura e os gatilhos, e libera a geração de roteiros para os clientes.</p>
                <Button size="sm" variant="outline" onClick={onAbrirAnalise}><Wand2 className="mr-2 h-4 w-4" />Analisar agora</Button>
              </div>
            </div>
          </div>
        )}
      </Bloco>

      {m && (
        <Bloco titulo="O vídeo em números">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {([
              ['Duração', duracao(m.duracao_s)],
              ['Formato', `${m.orientacao === 'vertical' ? 'Vertical' : m.orientacao === 'horizontal' ? 'Horizontal' : 'Quadrado'} · ${m.largura}×${m.altura}`],
              ['Cortes secos', m.cortes.quantidade === 0 ? 'Tomada contínua' : String(m.cortes.quantidade)],
              ['Áudio', m.tem_audio ? `${Math.round(m.audio.proporcao_com_som * 100)}% com som` : 'Sem áudio'],
            ] as const).map(([rotulo, valor]) => (
              <div key={rotulo} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
        </Bloco>
      )}

      {transcricao && (
        <Bloco titulo="Fala do vídeo" acao={<Atalho onClick={onAbrirAnalise}>Ver transcrição</Atalho>}>
          <p className="line-clamp-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{transcricao}</p>
        </Bloco>
      )}

      <Bloco
        titulo={lista.length > 0 ? `Roteiros gerados (${lista.length})` : 'Roteiros gerados'}
        acao={<Atalho onClick={onAbrirAnalise}>{lista.length > 0 ? 'Ver roteiros' : 'Gerar roteiros'}</Atalho>}
      >
        {lista.length > 0 ? (
          <ul className="space-y-1.5">
            {lista.slice(0, 3).map(r => (
              <li key={r.id} className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2.5 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{r.title}</span>
              </li>
            ))}
            {lista.length > 3 && <li className="px-1 text-xs text-muted-foreground">+ {lista.length - 3} na aba Análise e roteiros</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum roteiro ainda. Escolha um cliente na aba de análise para escrever roteiros nesta estrutura.</p>
        )}
      </Bloco>
    </>
  );
};
