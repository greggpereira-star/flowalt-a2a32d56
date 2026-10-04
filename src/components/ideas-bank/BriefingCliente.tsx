import { useEffect, useState } from 'react';
import { ChevronDown, Check, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateClientCard, type ClientCard } from '@/hooks/useClientCards';
import { cn } from '@/lib/utils';

/**
 * Briefing do cliente para o agente de roteiros.
 *
 * Usa os mesmos campos do cadastro do cliente (aba de identidade/branding): o que o social media
 * escreve aqui fica salvo no cliente e passa a valer para todos os roteiros e para o resto do
 * sistema. Os seis primeiros campos são o mínimo para o agente escrever algo que soe como o
 * cliente; sem eles o roteiro sai genérico, e o agente avisa isso na resposta.
 */

/**
 * Os campos do briefing no cadastro do cliente podem estar em texto puro (antigos) ou em JSON do
 * editor de texto formatado (`{"type":"doc",...}`), inclusive um documento vazio. Aqui tudo vira
 * texto puro para exibir, contar e enviar ao agente.
 */
function extrairTexto(n: any): string {
  if (!n) return '';
  if (n.type === 'text') return n.text ?? '';
  const filhos: string[] = (n.content ?? []).map(extrairTexto);
  switch (n.type) {
    case 'doc': return filhos.join('\n').replace(/\n{3,}/g, '\n\n');
    case 'bulletList': return (n.content ?? []).map((li: any) => `- ${extrairTexto(li).trim()}`).join('\n');
    case 'orderedList': return (n.content ?? []).map((li: any, i: number) => `${i + 1}. ${extrairTexto(li).trim()}`).join('\n');
    case 'listItem': return filhos.join('\n');
    case 'hardBreak': return '\n';
    case 'mention': return `@${n.attrs?.label ?? n.attrs?.id ?? ''}`;
    default: return filhos.join('');
  }
}

export function textoPlano(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (s.startsWith('{') && s.includes('"type"')) {
    try {
      const doc = JSON.parse(s);
      if (doc?.type === 'doc') return extrairTexto(doc).trim();
    } catch { /* não era JSON: segue como texto */ }
  }
  return s;
}

type Chave =
  | 'about_client' | 'products_services' | 'target_audience' | 'objectives' | 'positioning'
  | 'relationship_tone' | 'language_style' | 'language_restrictions' | 'competitors';

export const CAMPOS_BRIEFING: { chave: Chave; rotulo: string; dica: string; essencial: boolean }[] = [
  { chave: 'about_client', rotulo: 'Quem é o cliente', dica: 'O que a empresa faz, há quanto tempo, o que a diferencia das outras.', essencial: true },
  { chave: 'products_services', rotulo: 'O que ele vende', dica: 'Principais produtos ou serviços, faixa de preço se ajudar.', essencial: true },
  { chave: 'target_audience', rotulo: 'Público-alvo', dica: 'Quem compra: idade, dores, desejos, onde está, como fala.', essencial: true },
  { chave: 'objectives', rotulo: 'O que busca com o conteúdo', dica: 'Metas: vender mais, gerar contatos, ser conhecido, fidelizar...', essencial: true },
  { chave: 'positioning', rotulo: 'Como quer ser percebido', dica: 'A imagem que a marca quer passar (premium, acessível, técnica, próxima...).', essencial: true },
  { chave: 'relationship_tone', rotulo: 'Tom de voz', dica: 'Como a marca conversa: descontraída, formal, didática, provocativa...', essencial: true },
  { chave: 'language_style', rotulo: 'Jeito de falar', dica: 'Expressões, gírias ou jargões que usa. Trata o público por "você"? "vocês"?', essencial: false },
  { chave: 'language_restrictions', rotulo: 'O que evitar', dica: 'Palavras, promessas ou assuntos que o cliente NÃO quer ver.', essencial: false },
  { chave: 'competitors', rotulo: 'Concorrentes', dica: 'Quem disputa o mesmo público (para não parecer igual).', essencial: false },
];

const preenchido = (c: ClientCard, k: Chave) => !!textoPlano(c[k]);

export function completudeBriefing(c: ClientCard) {
  const essenciais = CAMPOS_BRIEFING.filter(f => f.essencial);
  const ok = essenciais.filter(f => preenchido(c, f.chave));
  return {
    preenchidos: ok.length,
    total: essenciais.length,
    faltando: essenciais.filter(f => !preenchido(c, f.chave)).map(f => f.rotulo),
  };
}

export function BriefingCliente({ cliente }: { cliente: ClientCard }) {
  const { preenchidos, total } = completudeBriefing(cliente);
  const [aberto, setAberto] = useState(preenchidos < total);
  const [valores, setValores] = useState<Record<string, string>>({});
  const atualizar = useUpdateClientCard();

  // Recarrega o formulário quando troca o cliente ou quando o cadastro é atualizado.
  useEffect(() => {
    const ini: Record<string, string> = {};
    CAMPOS_BRIEFING.forEach(f => { ini[f.chave] = textoPlano(cliente[f.chave]); });
    setValores(ini);
    setAberto(completudeBriefing(cliente).preenchidos < total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  const mudou = CAMPOS_BRIEFING.some(f => (valores[f.chave] ?? '').trim() !== textoPlano(cliente[f.chave]));

  const salvar = () => {
    // Só grava o que a pessoa mudou aqui: campos intocados mantêm a formatação original do cadastro.
    const patch: Record<string, string | null> = {};
    CAMPOS_BRIEFING.forEach(f => {
      const novo = (valores[f.chave] ?? '').trim();
      if (novo !== textoPlano(cliente[f.chave])) patch[f.chave] = novo || null;
    });
    atualizar.mutate({ id: cliente.id, ...(patch as Partial<ClientCard>) });
  };

  const forca = preenchidos >= total ? 'bom' : preenchidos >= 4 ? 'medio' : 'fraco';

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Briefing de {cliente.name}</p>
          <p className="text-xs text-muted-foreground">
            {forca === 'bom'
              ? 'Completo: o agente tem base para escrever no tom do cliente.'
              : forca === 'medio'
                ? 'Quase lá: preencher o que falta deixa os roteiros mais certeiros.'
                : 'Incompleto: sem isso os roteiros saem genéricos.'}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
            forca === 'bom' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
            forca === 'medio' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            forca === 'fraco' && 'bg-red-500/10 text-red-600 dark:text-red-400',
          )}
        >
          {preenchidos}/{total}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden="true" />
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">
            O que você escrever aqui fica salvo no cadastro do cliente e vale para todos os roteiros.
          </p>
          {CAMPOS_BRIEFING.map(f => {
            const ok = !!(valores[f.chave] ?? '').trim();
            return (
              <div key={f.chave}>
                <label htmlFor={`brief-${f.chave}`} className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
                  {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Circle className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />}
                  {f.rotulo}
                  {!f.essencial && <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>}
                </label>
                <Textarea
                  id={`brief-${f.chave}`}
                  rows={2}
                  value={valores[f.chave] ?? ''}
                  onChange={e => setValores(v => ({ ...v, [f.chave]: e.target.value }))}
                  placeholder={f.dica}
                  className="text-sm"
                />
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button size="sm" onClick={salvar} disabled={!mudou || atualizar.isPending}>
              {atualizar.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Salvar briefing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
