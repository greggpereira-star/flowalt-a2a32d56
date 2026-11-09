import React, { useState } from 'react';
import { Swords } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAcoesDeDuelo, useDuelos } from '@/hooks/useDuelos';
import { useColegasDeKudos } from '@/hooks/useKudos';
import {
  CATEGORIAS_DE_DUELO,
  DURACAO_DO_DUELO_EM_DIAS,
  mensagemDeErroDeDuelo,
  placarDoDuelo,
  resultadoParaMim,
  rotuloDaCategoriaDeDuelo,
  tempoRestanteDoDuelo,
  type CategoriaDeDuelo,
  type Duelo,
} from '@/lib/gamificacao/duelos';
import { cn } from '@/lib/utils';

const iniciais = (nome: string | null) => (nome ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const primeiro = (nome: string | null) => (nome ?? 'Alguém').split(' ')[0];

function Foto({ nome, url }: { nome: string | null; url: string | null }) {
  return (
    <Avatar className="h-8 w-8 shrink-0">
      {url && <AvatarImage src={url} alt={nome ?? ''} />}
      <AvatarFallback>{iniciais(nome)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Duelos 1x1: um colega chama outro numa categoria, o duelo so existe se o outro aceitar e dura 7 dias a partir do aceite.
 * Nao da pontos nem muda o ranking: e so desafio e placar. Uma pessoa participa de um duelo por vez.
 */
export function DuelosCard() {
  const { user } = useAuth();
  const { duelos, carregando, indisponivel } = useDuelos();
  const colegas = useColegasDeKudos();
  const { desafiar, responder, cancelar } = useAcoesDeDuelo();
  const [oponente, setOponente] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDeDuelo>('entregas');

  if (carregando || indisponivel) return null;

  const meuId = user?.id;
  const ocupado = duelos.some(d => d.sou_participante && (d.status === 'pendente' || d.status === 'ativo'));
  const convitesParaMim = duelos.filter(d => d.posso_responder);
  const convitesEnviados = duelos.filter(d => d.posso_cancelar);
  const ativos = duelos.filter(d => d.status === 'ativo');
  const encerrados = duelos.filter(d => d.status === 'encerrado');

  const falhou = (e: unknown) => toast.error(mensagemDeErroDeDuelo(e));
  const enviar = () =>
    desafiar.mutate(
      { oponente, categoria },
      {
        onSuccess: () => {
          toast.success('Convite enviado');
          setOponente('');
        },
        onError: falhou,
      },
    );

  const Participantes = ({ d }: { d: Duelo }) => (
    <div className="flex items-center gap-2 text-sm">
      <Foto nome={d.desafiante_nome} url={d.desafiante_avatar} />
      <strong>{primeiro(d.desafiante_nome)}</strong>
      <span className="text-muted-foreground">x</span>
      <Foto nome={d.desafiado_nome} url={d.desafiado_avatar} />
      <strong>{primeiro(d.desafiado_nome)}</strong>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" aria-hidden /> Duelos
        </CardTitle>
        <CardDescription className="max-w-xl">
          Chame um colega para um duelo de {DURACAO_DO_DUELO_EM_DIAS} dias. Só vale se ele aceitar, e é só desafio: não dá pontos nem muda o ranking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {convitesParaMim.map(d => (
          <div key={d.id} className="rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm">
              <strong>{primeiro(d.desafiante_nome)}</strong> te chamou para um duelo de <strong>{rotuloDaCategoriaDeDuelo(d.categoria).toLowerCase()}</strong> por {DURACAO_DO_DUELO_EM_DIAS} dias.
            </p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" disabled={responder.isPending} onClick={() => responder.mutate({ id: d.id, aceitar: true }, { onSuccess: () => toast.success('Duelo aceito. Boa sorte!'), onError: falhou })}>
                Aceitar
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={responder.isPending} onClick={() => responder.mutate({ id: d.id, aceitar: false }, { onError: falhou })}>
                Agora não
              </Button>
            </div>
          </div>
        ))}

        {convitesEnviados.map(d => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm">
            <span>
              Convite enviado a <strong>{primeiro(d.desafiado_nome)}</strong> ({rotuloDaCategoriaDeDuelo(d.categoria).toLowerCase()}). Aguardando resposta.
            </span>
            <Button type="button" size="sm" variant="ghost" disabled={cancelar.isPending} onClick={() => cancelar.mutate(d.id, { onError: falhou })}>
              Cancelar convite
            </Button>
          </div>
        ))}

        {ativos.length > 0 && (
          <ul className="space-y-3">
            {ativos.map(d => {
              const p = placarDoDuelo(d);
              return (
                <li key={d.id} className={cn('rounded-xl border p-3', d.sou_participante && 'border-primary/30')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Participantes d={d} />
                    <span className="text-xs text-muted-foreground">
                      {rotuloDaCategoriaDeDuelo(d.categoria)} · {tempoRestanteDoDuelo(d.fim)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-6 text-right text-lg font-bold tabular-nums">{p.a}</span>
                    <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Placar ${p.a} a ${p.b}`}>
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${p.pctA}%` }} />
                      <div className="h-full bg-primary/30" style={{ width: `${100 - p.pctA}%` }} />
                    </div>
                    <span className="w-6 text-lg font-bold tabular-nums">{p.b}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!ocupado && (
          <div className="space-y-3 rounded-xl border p-3">
            <p className="text-sm font-medium">Chamar um colega</p>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Colega a desafiar"
                value={oponente}
                onChange={e => setOponente(e.target.value)}
                className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Escolha um colega</option>
                {colegas.map(c => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.nome ?? 'Membro'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria do duelo">
              {CATEGORIAS_DE_DUELO.map(c => (
                <button
                  key={c.chave}
                  type="button"
                  aria-pressed={categoria === c.chave}
                  title={c.descricao}
                  onClick={() => setCategoria(c.chave)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', categoria === c.chave ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
                >
                  {c.rotulo}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" onClick={enviar} disabled={!oponente || desafiar.isPending}>
              <Swords className="mr-2 h-4 w-4" aria-hidden /> Enviar convite
            </Button>
          </div>
        )}

        {encerrados.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Encerrados nos últimos 14 dias</p>
            <ul className="space-y-1">
              {encerrados.map(d => {
                const p = placarDoDuelo(d);
                const r = resultadoParaMim(d, meuId);
                const vencedor = d.vencedor_id === d.desafiante_id ? d.desafiante_nome : d.desafiado_nome;
                return (
                  <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{primeiro(d.desafiante_nome)}</strong> {p.a} x {p.b} <strong className="text-foreground">{primeiro(d.desafiado_nome)}</strong> · {rotuloDaCategoriaDeDuelo(d.categoria).toLowerCase()}
                    </span>
                    <span className={cn(r === 'venci' && 'font-semibold text-emerald-700 dark:text-emerald-400')}>
                      {d.vencedor_id == null ? 'empate' : r === 'venci' ? 'você venceu' : `${primeiro(vencedor)} venceu`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {duelos.length === 0 && ocupado === false && <p className="text-center text-xs text-muted-foreground">Nenhum duelo por enquanto. Que tal chamar alguém?</p>}
      </CardContent>
    </Card>
  );
}
