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

      {/* Powered by Ovela badge */}
      <div className="fixed bottom-2 right-2 md:bottom-4 md:right-4 z-40 text-[10px] sm:text-xs font-medium badge-powered select-none pointer-events-none">
        Powered by Ovela (TM) AI
      </div>
    </div>
  );
};

export default Index;