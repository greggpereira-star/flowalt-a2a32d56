import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 pointer-events-none" />
      <div className="absolute top-1/4 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
              <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
              Plataforma de gestão inteligente
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              Gerencie projetos com{' '}
              <span className="bg-gradient-to-r from-primary to-[hsl(280,72%,55%)] bg-clip-text text-transparent">
                inteligência
              </span>{' '}
              e velocidade.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              FlowAlt unifica tarefas, automações e analytics em uma plataforma única.
              Pare de alternar entre ferramentas — tenha tudo sob controle.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="gap-2" onClick={() => navigate('/auth')}>
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                Ver Demo
              </Button>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Setup em 2 min
              </span>
            </div>
          </motion.div>

          {/* Product preview mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-lg shadow-2xl shadow-primary/5 overflow-hidden">
                {/* Mock toolbar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-destructive/60" />
                    <div className="h-3 w-3 rounded-full bg-warning/60" />
                    <div className="h-3 w-3 rounded-full bg-success/60" />
                  </div>
                  <div className="mx-auto rounded-md bg-muted/60 h-5 w-64" />
                </div>

                {/* Mock dashboard */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg bg-muted/40 p-4 space-y-2">
                        <div className="h-2 w-12 rounded bg-primary/20" />
                        <div className="h-6 w-16 rounded bg-primary/30 font-bold" />
                        <div className="h-1.5 w-full rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-muted/30 h-32 flex items-end p-4 gap-2">
                    {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary/10"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-lg bg-muted/40 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/20" />
                          <div className="space-y-1 flex-1">
                            <div className="h-2 w-20 rounded bg-muted" />
                            <div className="h-1.5 w-32 rounded bg-muted/60" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl -z-10 blur-2xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
