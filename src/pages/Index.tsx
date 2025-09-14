import { useState } from 'react';
import { HeroSection } from '@/components/HeroSection';

const Index = () => {
  const [isIsabellaExpanded, setIsIsabellaExpanded] = useState(false);

  return (
    <div className="min-h-screen cinematic-bg">
      {/* Single-Screen AI-First Landing Page */}
      <HeroSection 
        isExpanded={isIsabellaExpanded} 
        onChatToggle={() => setIsIsabellaExpanded(!isIsabellaExpanded)} 
      />

      {/* Powered by Ovela™ badge */}
      <div className="fixed bottom-3 right-3 z-50 text-xs sm:text-sm font-medium bg-gradient-to-r from-primary-glow to-accent-light bg-clip-text text-transparent select-none">
        Powered by Ovela™
      </div>
    </div>
  );
};

export default Index;