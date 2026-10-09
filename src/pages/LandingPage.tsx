import React, { useEffect } from 'react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { AprovacaoSection, PortalSection, BrandCoreSection } from '@/components/landing/RecursosDoProduto';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FaqSection } from '@/components/landing/FaqSection';
import { CTASection } from '@/components/landing/CTASection';
import { LandingFooter } from '@/components/landing/LandingFooter';

const TITULO = 'Flowalt — Aprovação de conteúdo para agências e social medias';
const DESCRICAO = 'O cliente aprova o post por um link, sem login. Calendário, aprovação por etapas, portal do cliente e Brand Core para agências e social medias.';

const LandingPage: React.FC = () => {
  // Título e descrição próprios da landing; ao sair, volta ao que o app usa.
  useEffect(() => {
    const tituloAntes = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const descricaoAntes = meta?.getAttribute('content') ?? null;
    document.title = TITULO;
    meta?.setAttribute('content', DESCRICAO);
    return () => {
      document.title = tituloAntes;
      if (meta && descricaoAntes !== null) meta.setAttribute('content', descricaoAntes);
    };
  }, []);

  return (
  <div className="min-h-screen bg-background text-foreground">
    <LandingNavbar />
    <main>
      <HeroSection />
      <ProblemSection />
      <AprovacaoSection />
      <PortalSection />
      <BrandCoreSection />
      <FeaturesGrid />
      <HowItWorks />
      <FaqSection />
      <CTASection />
    </main>
    <LandingFooter />
  </div>
  );
};

export default LandingPage;
