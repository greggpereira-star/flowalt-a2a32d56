import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

const highlights = [
  'Tudo em uma plataforma — tarefas, tempo, financeiro e analytics',
  'Automações inteligentes que eliminam trabalho manual',
  'Dashboards em tempo real para decisões rápidas',
  'Workflows customizáveis por espaço de trabalho',
];

export const SolutionSection: React.FC = () => (
  <section className="py-24 lg:py-32 bg-muted/20">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        {/* Mock product screenshot */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="order-2 lg:order-1"
        >
          <div className="rounded-2xl border border-border/40 bg-card shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-warning/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/50" />
              </div>
            </div>
            <div className="p-5 space-y-3">
              {/* Kanban mock */}
              <div className="grid grid-cols-3 gap-3">
                {['A Fazer', 'Em Progresso', 'Concluído'].map((col, ci) => (
                  <div key={col} className="space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{col}</div>
                    {Array.from({ length: 3 - ci }).map((_, j) => (
                      <div key={j} className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5">
                        <div className="h-2 w-3/4 rounded bg-foreground/10" />
                        <div className="h-1.5 w-1/2 rounded bg-muted-foreground/10" />
                        <div className="flex gap-1 pt-1">
                          <div className="h-4 w-4 rounded-full bg-primary/20" />
                          <div className="h-4 w-12 rounded bg-success/15 ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="order-1 lg:order-2"
        >
          <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">A solução</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Uma plataforma. Zero caos.
          </h2>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            FlowAlt centraliza toda a operação da sua equipe — do briefing à entrega — com automações que trabalham por você.
          </p>

          <ul className="space-y-4">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <span className="text-sm text-foreground">{h}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  </section>
);
