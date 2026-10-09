import React from 'react';
import { Check } from 'lucide-react';
import { MockBrandCore, MockCalendario, MockModos } from '@/components/landing/Mockups';

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {itens.map(i => (
        <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
          <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

/** Aprovação: dois modos, escolhidos por cliente ou por post. */
export const AprovacaoSection: React.FC = () => (
  <section id="aprovacao" className="scroll-mt-20 py-20 lg:py-28" aria-labelledby="aprovacao-titulo">
    <div className="mx-auto max-w-6xl px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Aprovação</p>
        <h2 id="aprovacao-titulo" className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Do jeito que o seu cliente aprova.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Para o cliente de confiança, um clique. Para o mais criterioso, etapa por etapa. Você escolhe por cliente ou por post, e pode mandar só a ideia, só a legenda ou tudo de uma vez.
        </p>
      </div>

      <div className="mt-12"><MockModos /></div>

      <ul className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {[
          ['Cada decisão fica registrada', 'Nome, data e horário de quem aprovou ou pediu ajuste, com histórico por rodada.'],
          ['O ajuste vai direto para a equipe', 'O pedido avisa quem está no card e devolve o trabalho para produção.'],
          ['Conversa dentro do pedido', 'Dúvidas e ajustes ficam no mesmo lugar, sem caçar mensagem em outro app.'],
          ['Lembrete para quem não respondeu', 'O Flowalt cobra o cliente por você, antes que o prazo estoure.'],
        ].map(([t, d]) => (
          <li key={t}>
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/** Portal do cliente: um link com calendário, pendências e resumo. */
export const PortalSection: React.FC = () => (
  <section id="portal" className="scroll-mt-20 border-y bg-muted/20 py-20 lg:py-28" aria-labelledby="portal-titulo">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:px-8">
      <div>
        <p className="text-sm font-semibold text-primary">Portal do cliente</p>
        <h2 id="portal-titulo" className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Um link por cliente, com tudo o que ele precisa ver.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          O cliente abre o link e já está no calendário. Vê o que está esperando por ele, aprova e acompanha o que vem pela frente, com a cor e o logo da sua agência.
        </p>
        <Lista
          itens={[
            'Calendário em mês e semana; cada peça abre a própria aprovação',
            'Resumo do mês: aprovadas, ajustes, pendentes e publicadas',
            'Histórico de decisões do cliente',
            'Só aparece o que você já enviou ou publicou. Comentário interno nunca sai',
          ]}
        />
      </div>
      <MockCalendario />
    </div>
  </section>
);

/** Brand Core: o material de marca do cliente, organizado e liberado por você. */
export const BrandCoreSection: React.FC = () => (
  <section id="brand-core" className="scroll-mt-20 py-20 lg:py-28" aria-labelledby="brand-titulo">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:px-8">
      <div className="order-2 lg:order-1"><MockBrandCore /></div>
      <div className="order-1 lg:order-2">
        <p className="text-sm font-semibold text-primary">Brand Core</p>
        <h2 id="brand-titulo" className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          O que você sabe do cliente, num lugar que a equipe encontra.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Diagnóstico do perfil, várias personas, concorrentes, esteira de ofertas e os arquivos da marca. O conteúdo nasce de um material que todo mundo consulta.
        </p>
        <Lista
          itens={[
            'Cada ficha mostra o que falta preencher',
            'Arquivos em pastas, com acesso para toda a equipe ou só para gestores',
            'Você escolhe quais seções e pastas o cliente vê no portal',
          ]}
        />
      </div>
    </div>
  </section>
);
