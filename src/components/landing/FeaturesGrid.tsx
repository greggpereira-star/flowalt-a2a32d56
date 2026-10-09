import React from 'react';
import { BarChart3, BellRing, CalendarCheck, FileText, KanbanSquare, Workflow } from 'lucide-react';

const ITENS = [
  { Icone: KanbanSquare, t: 'Kanban, Lista e Tabela', d: 'O mesmo trabalho, do jeito que cada pessoa da equipe prefere olhar, com a última atualização de cada card.' },
  { Icone: Workflow, t: 'Regras automáticas', d: 'Mova cards, avise as pessoas certas e mude prioridades sozinho, a partir de regras que você define.' },
  { Icone: BellRing, t: 'Lembretes inteligentes', d: 'Prazos e pendências chegam a quem precisa, sem ninguém ter que cobrar manualmente.' },
  { Icone: CalendarCheck, t: 'Publicação no Instagram e no Facebook', d: 'Agende e publique direto do card: feed, carrossel, reels e stories no Instagram.' },
  { Icone: BarChart3, t: 'Financeiro por cliente', d: 'Fee, custos e margem de cada cliente, para saber quais contas realmente compensam.' },
  { Icone: FileText, t: 'Relatório mensal', d: 'O rascunho do mês fica pronto para você revisar e enviar ao cliente.' },
];

export const FeaturesGrid: React.FC = () => (
  <section id="recursos" className="scroll-mt-20 border-t bg-muted/20 py-20 lg:py-28" aria-labelledby="recursos-titulo">
    <div className="mx-auto max-w-6xl px-6 lg:px-8">
      <div className="max-w-2xl">
        <h2 id="recursos-titulo" className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          O resto da operação roda junto.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Aprovar é só uma parte. Para a agência inteira trabalhar no mesmo lugar, o Flowalt também cuida de tarefas, prazos, publicação e dinheiro.
        </p>
      </div>

      <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {ITENS.map(({ Icone, t, d }) => (
          <li key={t} className="bg-card p-6">
            <Icone className="h-5 w-5 text-primary" aria-hidden />
            <p className="mt-4 font-semibold">{t}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
