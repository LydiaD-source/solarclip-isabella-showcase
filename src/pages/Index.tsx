import { useState } from 'react';
import { IsabellaAvatar } from '@/components/IsabellaAvatar';
import { HeroSection } from '@/components/HeroSection';
import { ProblemSection } from '@/components/ProblemSection';
import { VisualizerSection } from '@/components/VisualizerSection';
import { FeatureSection } from '@/components/FeatureSection';
import { ProofSection } from '@/components/ProofSection';

const Index = () => {
  const [isIsabellaExpanded, setIsIsabellaExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Isabella Avatar - Always Visible */}
      <IsabellaAvatar 
        isExpanded={isIsabellaExpanded}
        onChatToggle={() => setIsIsabellaExpanded(!isIsabellaExpanded)}
      />

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

      {/* ROI Section - Coming Next */}
      <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="card-premium max-w-2xl mx-auto p-8">
            <h2 className="font-heading font-bold text-3xl mb-4 text-gradient">
              More Sections Coming Soon
            </h2>
            <p className="text-muted-foreground">
              ROI Calculator, Pricing, Resources, and Final CTA sections will be added next.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;