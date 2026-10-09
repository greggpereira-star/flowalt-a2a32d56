import React from 'react';

const LINHAS = [
  { antes: 'Briefing solto no WhatsApp', agora: 'Briefing, personas e arquivos na ficha de cada cliente' },
  { antes: 'Feedback em print de conversa', agora: 'Pedido de ajuste dentro do post, com histórico' },
  { antes: 'Cliente que não quer criar conta', agora: 'Link que abre direto, sem login nem cadastro' },
  { antes: 'Arte perdida em uma pasta do Drive', agora: 'Pastas por cliente, com acesso definido por pasta' },
];

export const ProblemSection: React.FC = () => (
  <section className="border-y bg-muted/20 py-20 lg:py-28" aria-labelledby="problema">
    <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:px-8">
      <div>
        <h2 id="problema" className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Aprovar um post não deveria depender de cinco abas abertas.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          O cliente pede sete alterações, você avisa o designer, ajusta a legenda e ainda procura a versão certa. O Flowalt põe cada coisa no lugar em que ela é encontrada.
        </p>
      </div>

      <ul className="divide-y rounded-2xl border bg-card">
        {LINHAS.map(l => (
          <li key={l.antes} className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:items-center sm:gap-6">
            <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">{l.antes}</span>
            <span className="text-[15px] font-semibold">{l.agora}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
