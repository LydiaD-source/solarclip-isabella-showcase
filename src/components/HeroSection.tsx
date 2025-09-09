import { Button } from '@/components/ui/button';
import { Globe, Play, Mic } from 'lucide-react';
import { useState } from 'react';

interface HeroSectionProps { 
  isExpanded?: boolean; 
  onChatToggle?: () => void;
}

const videoThumbnails = [
  { id: 'ceo', title: 'CEO Testimonial', image: 'https://res.cloudinary.com/di5gj4nyp/image/upload/c_thumb,w_64,h_64,g_face/v1747229179/ceo_thumbnail.jpg' },
  { id: 'board', title: 'Board Member', image: 'https://res.cloudinary.com/di5gj4nyp/image/upload/c_thumb,w_64,h_64,g_face/v1747229179/board_thumbnail.jpg' },
  { id: 'client', title: 'Happy Client', image: 'https://res.cloudinary.com/di5gj4nyp/image/upload/c_thumb,w_64,h_64,g_face/v1747229179/client_thumbnail.jpg' },
  { id: 'owner', title: 'Building Owner', image: 'https://res.cloudinary.com/di5gj4nyp/image/upload/c_thumb,w_64,h_64,g_face/v1747229179/owner_thumbnail.jpg' }
];

export const HeroSection = ({ isExpanded = false, onChatToggle }: HeroSectionProps) => {
  const [showMeetButton, setShowMeetButton] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('EN');
  
  const languages = ['EN', 'FR', 'DE', 'LB'];

  const handleMeetIsabella = () => {
    setShowMeetButton(false);
    onChatToggle?.();
  };

  const handleVideoThumbnail = (videoId: string) => {
    console.log(`Playing video: ${videoId}`);
    // TODO: Implement video modal with sliding card animation
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Language Toggle - Top Right Corner of Isabella's Image */}
      <div className="absolute top-8 right-8 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const currentIndex = languages.indexOf(currentLanguage);
            const nextIndex = (currentIndex + 1) % languages.length;
            setCurrentLanguage(languages[nextIndex]);
          }}
          className="text-white/80 hover:text-white bg-transparent hover:bg-transparent p-2 font-medium tracking-wide relative group"
        >
          <span className={`transition-all duration-300 ${currentLanguage === languages[languages.indexOf(currentLanguage)] ? 'text-white language-active' : 'text-white/60'}`}>
            {currentLanguage}
          </span>
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center h-screen">
        
        {/* Left Column - Hero Content */}
        <div className="flex flex-col justify-center space-y-8 lg:mt-12" style={{ transform: 'translateY(-20px)' }}>
          {/* Main Headline */}
          <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-tight hero-text-glow">
            The Future of
            <span className="block text-gradient"> Lightweight Solar</span>
            is Here.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed hero-text-glow">
            SolarClip™ — the world's first clip-on / clip-off solar mounting system. 
            <span className="font-semibold text-white"> Fast. Reversible. Roof-safe.</span>
          </p>

          {/* Video Thumbnails */}
          <div className="flex gap-4 flex-wrap">
            {videoThumbnails.map((video) => (
              <div 
                key={video.id}
                className="video-thumbnail-interactive"
                onClick={() => handleVideoThumbnail(video.id)}
                title={video.title}
              >
                <img 
                  src={video.image} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.src = `https://via.placeholder.com/64x64/4CAF50/ffffff?text=${video.title.charAt(0)}`;
                    target.onerror = null; // Prevent infinite loop
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Isabella Avatar */}
        <div className="flex justify-center lg:justify-end items-center relative -mt-5">
          <div className="relative group">
            {/* Isabella Avatar */}
            <div 
              className="isabella-avatar-refined w-72 lg:w-80 xl:w-96 max-w-[70vw] lg:max-w-full cursor-pointer"
              onClick={onChatToggle}
              title="Click to talk with Isabella"
            >
              <img 
                src="https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg"
                alt="Isabella Navia - AI Solar Ambassador"
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Meet Isabella Button - Aligned with Language Toggle */}
            {showMeetButton && (
              <>
                {/* Desktop positioning - Final alignment adjustment */}
                <div className="hidden lg:block absolute bottom-[-22px] -left-36 xl:-left-44 text-center">
                  <Button 
                    className="meet-isabella-btn-animated text-base px-6 py-3"
                    onClick={handleMeetIsabella}
                    style={{ transform: 'scale(1.15)' }}
                  >
                    <Play className="mr-2 w-5 h-5" />
                    Meet Isabella
                  </Button>
                  <p className="text-white/70 text-sm mt-2">Your AI guide to SolarClip™</p>
                </div>
                
                {/* Mobile positioning - Adjusted for better spacing */}
                <div className="lg:hidden absolute -bottom-32 left-1/2 transform -translate-x-1/2 text-center">
                  <Button 
                    className="meet-isabella-btn-animated text-base px-6 py-3"
                    onClick={handleMeetIsabella}
                    style={{ transform: 'scale(1.15)' }}
                  >
                    <Play className="mr-2 w-5 h-5" />
                    Meet Isabella
                  </Button>
                  <p className="text-white/70 text-sm mt-2">Your AI guide to SolarClip™</p>
                </div>
              </>
            )}
            
            {/* Hover Tooltip */}
            {!isExpanded && !showMeetButton && (
              <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 text-white text-sm border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Click to talk with Isabella
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Chatbox Panel - Positioned with proper spacing from Isabella */}
        {isExpanded && (
          <div className="static lg:absolute lg:top-1/2 lg:left-[63%] xl:left-[65%] 2xl:left-[66%] transform lg:-translate-x-1/2 lg:-translate-y-[40%] w-[88vw] max-w-[340px] sm:w-[320px] lg:w-[320px] h-[460px] sm:h-[480px] mx-auto lg:mx-0 mt-4 lg:mt-0 bg-background/90 backdrop-blur-md border-2 border-accent/30 rounded-2xl shadow-premium z-30 flex flex-col overflow-hidden chatbox-glow">
            {/* Chat Header with Clear Button */}
            <div className="flex justify-between items-center p-4 border-b border-accent/20">
              <h3 className="text-white font-medium">Isabella AI Assistant</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  // Clear conversation logic
                  console.log('Clearing conversation');
                }}
                className="text-white/60 hover:text-white hover:bg-white/10 p-2"
              >
                ↻
              </Button>
            </div>
            
            {/* Chat Messages Area - Enhanced scrolling */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
              <div className="flex justify-end">
                <div className="bg-primary/20 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
                  Hello Isabella, tell me about SolarClip™
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-accent/20 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
                  Welcome! I'm excited to show you our revolutionary SolarClip™ system. It's the world's first clip-on solar mounting solution that's completely reversible and roof-safe.
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-accent/20 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
                  Would you like me to show you how it works with a quick demonstration? I can present videos, documents, or answer any technical questions you have.
                </div>
              </div>
            </div>
            
            {/* Enhanced Input Area */}
            <div className="p-4 border-t border-accent/20">
              <div className="flex gap-2">
                <textarea 
                  placeholder="Ask Isabella anything... (Shift+Enter for new line)"
                  className="flex-1 bg-white/10 border border-accent/30 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm focus:outline-none focus:border-accent resize-none min-h-[40px] max-h-[80px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Submit message logic
                      console.log('Submitting message');
                    }
                  }}
                />
                <Button size="sm" className="bg-accent/30 hover:bg-accent/50 text-white p-2">
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0">
                  🎥 Videos
                </Button>
                <Button size="sm" variant="outline" className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0">
                  📄 Docs
                </Button>
                <Button size="sm" variant="outline" className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0">
                  🔊 Voice
                </Button>
              </div>
              
              {/* Voice/Text Interface - Integrated into chatbox */}
              <div className="flex gap-2 mt-3 pt-2 border-t border-accent/10">
                <Button size="sm" className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 flex-1">
                  <Mic className="w-4 h-4 mr-2" />
                  Voice Chat
                </Button>
                <Button size="sm" className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 flex-1">
                  💬 Text Chat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Video Presentation Area - Reserved Space for Sliding Cards */}
      <div id="video-presentation-area" className="absolute top-1/2 left-8 lg:left-16 transform -translate-y-1/2 w-[350px] h-[250px] pointer-events-none">
        {/* This area is reserved for sliding video cards from Phase 2 */}
      </div>

    </section>
  );
};