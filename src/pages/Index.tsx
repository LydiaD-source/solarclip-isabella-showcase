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
      <a
        href="https://ovela.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-2 right-2 md:bottom-4 md:right-4 lg:right-[22rem] z-40 text-[10px] sm:text-xs font-medium badge-powered select-none pointer-events-auto"
        aria-label="Powered by Ovela AI"
      >
        Powered by Ovela<sup className="ml-0.5 text-[8px] align-super">™</sup> AI
      </a>
    </div>
  );
};

export default Index;