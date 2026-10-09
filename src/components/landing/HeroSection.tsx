import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MockAprovacao } from '@/components/landing/Mockups';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_75%_0%,hsl(var(--primary)/0.10),transparent)]" aria-hidden />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16 lg:px-8">
        <div>
          <p className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <span className="h-px w-7 bg-primary" aria-hidden /> Para agências e social medias
          </p>
          <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-foreground sm:text-6xl">
            Seu cliente aprova o post por um link.
          </h1>
          <p className="mt-6 text-xl font-medium text-primary sm:text-2xl">Sem login, sem cadastro, sem print no WhatsApp.</p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O Flowalt reúne o calendário, a aprovação por etapas, as tarefas e o material de marca de cada cliente. A equipe produz, o cliente decide, e tudo fica registrado.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-12 px-6 text-base" onClick={() => navigate('/auth')}>
              Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" className="h-12 px-0 text-base sm:px-5" asChild>
              <a href="#aprovacao">Ver como funciona</a>
            </Button>
          </div>
        </div>

        <div className="relative">
          <MockAprovacao />
          <p className="mt-3 text-center text-xs text-muted-foreground">Exemplo ilustrativo com um cliente fictício.</p>
        </div>
      </div>
    </section>
  );
};
