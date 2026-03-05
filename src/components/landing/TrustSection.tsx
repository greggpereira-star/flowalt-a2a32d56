import React from 'react';
import { motion } from 'framer-motion';

const logos = [
  'Startups', 'Agências', 'Consultorias', 'Tech', 'Marketing', 'Design',
];

export const TrustSection: React.FC = () => (
  <section className="py-16 border-y border-border/30 bg-muted/20">
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-sm font-medium text-muted-foreground mb-8"
      >
        Usado por equipes de alta performance em todo o Brasil
      </motion.p>
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {logos.map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="text-lg font-semibold text-muted-foreground/40 tracking-wider uppercase select-none"
          >
            {name}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
