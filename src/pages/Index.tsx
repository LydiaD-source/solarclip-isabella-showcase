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
    </div>
  );
};

export default Index;