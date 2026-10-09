import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CTASection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className="pb-20 lg:pb-28" aria-labelledby="cta-titulo">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl bg-primary px-8 py-14 text-primary-foreground sm:px-14 sm:py-16">
        <div className="max-w-2xl">
          <h2 id="cta-titulo" className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Leve o primeiro cliente para o link.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-primary-foreground/80">
            Cadastre um cliente, envie o próximo post para aprovação e veja a resposta chegar sem uma única mensagem de WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="secondary" className="h-12 px-6 text-base" onClick={() => navigate('/auth')}>
              Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" className="h-12 px-5 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => navigate('/auth')}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
};
