import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Gauge, Sparkles, GitBranch, Puzzle, BarChart3 } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Automações', desc: 'Crie regras que movem cards, notificam e atualizam status automaticamente.' },
  { icon: Gauge, title: 'Velocidade', desc: 'Interface otimizada para performance. Ações em milissegundos, não segundos.' },
  { icon: Sparkles, title: 'IA Integrada', desc: 'Estimativas inteligentes, sugestões e assistência contextual com IA.' },
  { icon: GitBranch, title: 'Workflows', desc: 'Workflows visuais com stages, gates e aprovações configuráveis.' },
  { icon: Puzzle, title: 'Integrações', desc: 'Conecte com as ferramentas que sua equipe já usa, sem atrito.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Dashboards em tempo real com métricas de produtividade e entrega.' },
];

export const FeaturesGrid: React.FC = () => (
  <section id="features" className="py-24 lg:py-32">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">Recursos</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Tudo que sua equipe precisa
        </h2>
        <p className="text-muted-foreground text-lg">
          Ferramentas poderosas que se adaptam ao seu fluxo de trabalho.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="group rounded-2xl border border-border/40 bg-card p-6 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="mb-4 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
