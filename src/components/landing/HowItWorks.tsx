import React from 'react';

// Uma sequência de verdade: cada passo depende do anterior.
const PASSOS = [
  { t: 'Cadastre o cliente', d: 'Preencha o diagnóstico, as personas e guarde os arquivos da marca.' },
  { t: 'Produza e envie para aprovação', d: 'Escolha o modo rápido ou em etapas e mande o link ao cliente.' },
  { t: 'O cliente decide pelo link', d: 'Ele aprova ou pede ajuste, e você é avisado na hora.' },
  { t: 'Agende e publique', d: 'Com tudo aprovado, programe a publicação no Instagram e no Facebook.' },
];

export const HowItWorks: React.FC = () => (
  <section id="como-funciona" className="scroll-mt-20 py-20 lg:py-28" aria-labelledby="como-titulo">
    <div className="mx-auto max-w-6xl px-6 lg:px-8">
      <h2 id="como-titulo" className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        Do briefing à publicação, em quatro passos.
      </h2>

      <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {PASSOS.map((p, i) => (
          <li key={p.t} className="relative border-t-2 border-primary/25 pt-5">
            <span className="font-display text-sm font-bold text-primary tabular-nums">Passo {i + 1}</span>
            <p className="mt-2 font-semibold">{p.t}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{p.d}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
