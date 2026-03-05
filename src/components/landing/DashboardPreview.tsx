import React from 'react';
import { motion } from 'framer-motion';

export const DashboardPreview: React.FC = () => (
  <section className="py-24 lg:py-32 bg-muted/20">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-2xl mx-auto mb-16"
      >
        <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">Produto</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Uma interface que você vai amar usar
        </h2>
        <p className="text-muted-foreground text-lg">
          Design limpo e intuitivo — construído para foco, não distração.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative"
      >
        <div className="rounded-2xl border border-border/40 bg-card shadow-2xl shadow-primary/5 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30 bg-muted/30">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive/50" />
              <div className="h-3 w-3 rounded-full bg-warning/50" />
              <div className="h-3 w-3 rounded-full bg-success/50" />
            </div>
            <div className="mx-auto rounded-lg bg-muted/50 h-6 w-80 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">app.flowalt.com</span>
            </div>
          </div>

          {/* Dashboard layout */}
          <div className="flex min-h-[420px]">
            {/* Sidebar */}
            <div className="hidden sm:block w-56 border-r border-border/30 bg-muted/10 p-4 space-y-3">
              <div className="h-6 w-20 rounded bg-primary/20 mb-6" />
              {['Dashboard', 'Tarefas', 'Tempo', 'Financeiro', 'Analytics', 'Configurações'].map((item) => (
                <div key={item} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/40">
                  <div className="h-4 w-4 rounded bg-muted-foreground/15" />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            {/* Main */}
            <div className="flex-1 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-3 w-24 rounded bg-foreground/15 mb-1" />
                  <div className="h-2 w-40 rounded bg-muted-foreground/10" />
                </div>
                <div className="h-8 w-24 rounded-lg bg-primary/20" />
              </div>

              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Tarefas', value: '24', color: 'bg-primary/20' },
                  { label: 'Concluídas', value: '18', color: 'bg-success/20' },
                  { label: 'Atrasadas', value: '3', color: 'bg-warning/20' },
                  { label: 'Horas', value: '142h', color: 'bg-info/20' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border/20 p-4">
                    <div className={`h-8 w-8 rounded-lg ${stat.color} mb-2`} />
                    <div className="text-lg font-bold text-foreground">{stat.value}</div>
                    <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border/20 h-40 flex items-end p-4 gap-1.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary/5"
                    style={{ height: `${30 + Math.random() * 60}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Glow */}
        <div className="absolute -inset-8 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-3xl -z-10 blur-3xl" />
      </motion.div>
    </div>
  </section>
);
