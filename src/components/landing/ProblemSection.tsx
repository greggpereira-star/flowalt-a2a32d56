import React from 'react';
import { motion } from 'framer-motion';
import { Layers, Clock, Shuffle, AlertTriangle } from 'lucide-react';

const pains = [
  { icon: Layers, title: 'Ferramentas demais', desc: 'Sua equipe alterna entre 5+ plataformas todo dia, perdendo contexto e tempo.' },
  { icon: Clock, title: 'Tempo perdido', desc: 'Horas desperdiçadas em tarefas repetitivas que poderiam ser automatizadas.' },
  { icon: Shuffle, title: 'Falta de visibilidade', desc: 'Sem dashboard unificado, decisões são tomadas no escuro.' },
  { icon: AlertTriangle, title: 'Processos quebrados', desc: 'Sem padronização, cada projeto vira um caos diferente.' },
];

export const ProblemSection: React.FC = () => (
  <section className="py-24 lg:py-32">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">O problema</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Gestão fragmentada custa caro
        </h2>
        <p className="text-muted-foreground text-lg">
          Equipes perdem até 30% do tempo apenas alternando entre ferramentas e buscando informações.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {pains.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group rounded-2xl border border-border/40 bg-card p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300"
          >
            <div className="mb-4 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-destructive/10 text-destructive">
              <p.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{p.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
