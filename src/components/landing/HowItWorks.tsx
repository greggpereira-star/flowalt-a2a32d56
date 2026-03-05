import React from 'react';
import { motion } from 'framer-motion';
import { Settings2, Workflow, Rocket } from 'lucide-react';

const steps = [
  { icon: Settings2, step: '01', title: 'Configure', desc: 'Crie seu workspace, defina espaços e convide sua equipe. Em minutos, não horas.' },
  { icon: Workflow, step: '02', title: 'Automatize', desc: 'Crie workflows, regras de automação e dashboards personalizados para seu time.' },
  { icon: Rocket, step: '03', title: 'Escale', desc: 'Acompanhe métricas em tempo real e otimize processos continuamente.' },
];

export const HowItWorks: React.FC = () => (
  <section id="how-it-works" className="py-24 lg:py-32">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">Como funciona</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Três passos para transformar sua operação
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="relative text-center"
          >
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/30 to-transparent" />
            )}

            <div className="relative mx-auto mb-6 inline-flex items-center justify-center h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10">
              <s.icon className="h-8 w-8 text-primary" />
              <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {s.step}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
