import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { IsabellaAvatar } from '@/components/IsabellaAvatar';
import { HeroSection } from '@/components/HeroSection';
import { ProblemSection } from '@/components/ProblemSection';
import { VisualizerSection } from '@/components/VisualizerSection';
import { FeatureSection } from '@/components/FeatureSection';
import { ProofSection } from '@/components/ProofSection';
import { ROISection } from '@/components/ROISection';
import { PricingSection } from '@/components/PricingSection';
import { ResourcesSection } from '@/components/ResourcesSection';
import { FinalCTASection } from '@/components/FinalCTASection';
import { Footer } from '@/components/Footer';

const Index = () => {
  const [isIsabellaExpanded, setIsIsabellaExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <Navbar />
      
      {/* Isabella Avatar - Always Visible */}
      <IsabellaAvatar 
        isExpanded={isIsabellaExpanded}
        onChatToggle={() => setIsIsabellaExpanded(!isIsabellaExpanded)}
      />

      {/* Main Content - Add top padding for fixed navbar */}
      <div className="pt-16">
        {/* Hero Section */}
        <HeroSection />

        {/* Problem Section */}
        <ProblemSection />

        {/* Interactive Visualizer */}
        <VisualizerSection />

        {/* Feature Section */}
        <FeatureSection />

        {/* Visual Proof */}
        <ProofSection />

        {/* ROI Section */}
        <ROISection />

        {/* Pricing Section */}
        <PricingSection />

        {/* Resources Section */}
        <ResourcesSection />

        {/* Final CTA Section */}
        <FinalCTASection />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;