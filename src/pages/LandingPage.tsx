import React from 'react';
import { usePageTracking } from '@/hooks/usePageTracking';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { TrustSection } from '@/components/landing/TrustSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SolutionSection } from '@/components/landing/SolutionSection';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { DashboardPreview } from '@/components/landing/DashboardPreview';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { BenefitsSection } from '@/components/landing/BenefitsSection';
import { CTASection } from '@/components/landing/CTASection';
import { LandingFooter } from '@/components/landing/LandingFooter';

const LandingPage: React.FC = () => {
  usePageTracking('landing');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <HeroSection />
      <TrustSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesGrid />
      <DashboardPreview />
      <HowItWorks />
      <BenefitsSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
