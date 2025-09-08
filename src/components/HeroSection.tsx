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

      {/* Language Toggle - Bottom Right Corner */}
      <div className="fixed bottom-4 right-4 z-50 bg-white/10 backdrop-blur-md rounded-full p-3 border border-white/20 hover:bg-white/20 transition-all duration-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const currentIndex = languages.indexOf(currentLanguage);
            const nextIndex = (currentIndex + 1) % languages.length;
            setCurrentLanguage(languages[nextIndex]);
          }}
          className="text-white hover:text-accent p-0"
        >
          <Globe className="w-4 h-4 mr-2" />
          {currentLanguage}
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
                {/* Desktop positioning - Moved down 20px and right 20px */}
                <div className="hidden lg:block absolute bottom-1 -left-36 xl:-left-44 text-center">
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

        {/* Futuristic Chatbox Panel - Floating Between Columns */}
        {isExpanded && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[500px] bg-background/90 backdrop-blur-md border-2 border-accent/30 rounded-2xl shadow-premium z-30 flex flex-col overflow-hidden chatbox-glow">
            {/* Chat Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
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
            </div>
            
            {/* Input Area */}
            <div className="p-4 border-t border-accent/20">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask Isabella anything..."
                  className="flex-1 bg-white/10 border border-accent/30 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm focus:outline-none focus:border-accent"
                />
                <Button size="sm" className="bg-accent/30 hover:bg-accent/50 text-white p-2">
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voice/Text Interface - Positioned Below Isabella When Expanded */}
      {isExpanded && !showMeetButton && (
        <div className="absolute bottom-32 right-8 lg:right-16 flex flex-col gap-3">
          <Button className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 px-6 py-3">
            <Mic className="w-5 h-5 mr-2" />
            Voice Chat
          </Button>
          <Button className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 px-6 py-3">
            💬 Text Chat
          </Button>
        </div>
      )}

      {/* Video Presentation Area - Reserved Space for Sliding Cards */}
      <div id="video-presentation-area" className="absolute top-1/2 left-8 lg:left-16 transform -translate-y-1/2 w-[350px] h-[250px] pointer-events-none">
        {/* This area is reserved for sliding video cards from Phase 2 */}
      </div>

    </section>
  );
};