import React from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Cog, Zap } from 'lucide-react';

const benefits = [
  { icon: Clock, title: 'Economize tempo', desc: 'Reduza tarefas manuais em até 60% com automações inteligentes.', metric: '60%', metricLabel: 'menos trabalho manual' },
  { icon: TrendingUp, title: 'Aumente produtividade', desc: 'Visibilidade total sobre entregas e gargalos do time.', metric: '2x', metricLabel: 'mais entregas por sprint' },
  { icon: Cog, title: 'Automatize processos', desc: 'De aprovações a notificações, tudo roda no piloto automático.', metric: '100+', metricLabel: 'automações ativas' },
  { icon: Zap, title: 'Reduza atrito', desc: 'Uma única plataforma elimina a fragmentação de ferramentas.', metric: '1', metricLabel: 'plataforma para tudo' },
];

export const BenefitsSection: React.FC = () => (
  <section id="benefits" className="py-24 lg:py-32 bg-muted/20">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">Benefícios</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Resultados que falam por si
        </h2>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-border/40 bg-card p-6 text-center hover:shadow-lg transition-all duration-300"
          >
            <div className="mx-auto mb-4 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{b.metric}</div>
            <div className="text-xs text-primary font-medium mb-3">{b.metricLabel}</div>
            <h3 className="text-base font-semibold text-foreground mb-2">{b.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
