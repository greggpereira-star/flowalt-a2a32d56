import React from 'react';
import { ChevronDown } from 'lucide-react';

// Cada resposta descreve o que o produto faz hoje. Onde há limite, o limite está dito.
const PERGUNTAS = [
  {
    p: 'O cliente precisa criar conta no Flowalt?',
    r: 'Não. Ele recebe um link, por e-mail, WhatsApp ou onde você preferir, abre e aprova ou pede ajuste. Nada de login nem cadastro.',
  },
  {
    p: 'Funciona para carrossel, reels e stories?',
    r: 'Sim. O pedido de aprovação aceita imagens, vídeos, documentos e texto, então serve para qualquer formato. A publicação automática cobre feed, carrossel, reels e stories no Instagram.',
  },
  {
    p: 'Preciso mandar o post pronto para aprovação?',
    r: 'Não. No modo em etapas você escolhe o que enviar: só o tema, só o conteúdo, a mídia, a legenda, ou tudo. Cada etapa tem a sua decisão.',
  },
  {
    p: 'Onde vejo os ajustes que o cliente pediu?',
    r: 'No card, dentro do pedido de aprovação, e nas notificações. Cada pedido tem a sua própria conversa, e o ajuste vem marcado com a etapa a que se refere.',
  },
  {
    p: 'O cliente vê tudo o que a agência faz?',
    r: 'Não. Ele vê só o que você enviou para aprovação, o que já foi publicado e as partes do Brand Core que você liberar. Comentários internos nunca aparecem para ele.',
  },
  {
    p: 'Quais redes publicam automaticamente?',
    r: 'Instagram e Facebook. Para as demais redes, o calendário e a aprovação funcionam normalmente, mas a publicação é feita por você.',
  },
  {
    p: 'O link do cliente é seguro?',
    r: 'Cada link é único e longo, e só vale para aquele cliente. Você pode gerar um novo ou revogar o acesso a qualquer momento, e as decisões ficam registradas com data e horário.',
  },
  {
    p: 'Dá para testar antes de assinar?',
    r: 'Dá para começar no plano gratuito e conhecer o fluxo com um cliente real. Os limites de cada plano aparecem na tela de planos, dentro do app.',
  },
];

export const FaqSection: React.FC = () => (
  <section id="perguntas" className="scroll-mt-20 border-t py-20 lg:py-28" aria-labelledby="perguntas-titulo">
    <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:px-8">
      <h2 id="perguntas-titulo" className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        Perguntas que as agências fazem.
      </h2>
      <div className="divide-y rounded-2xl border bg-card">
        {PERGUNTAS.map(({ p, r }) => (
          <details key={p} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {p}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-3 pr-8 text-[15px] leading-relaxed text-muted-foreground">{r}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
