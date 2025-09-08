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
      {/* Product Logo - Top Left */}
      <div className="absolute top-8 left-8 z-50">
        <img 
          src="/clearnanotech-logo.png" 
          alt="ClearNanoTech - SolarClip" 
          className="w-[120px] lg:w-[180px] h-auto object-contain brightness-0 invert filter contrast-125 saturate-150"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png';
          }}
        />
      </div>

      {/* Language Toggle - Bottom Right */}
      <div className="language-toggle">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const currentIndex = languages.indexOf(currentLanguage);
            const nextIndex = (currentIndex + 1) % languages.length;
            setCurrentLanguage(languages[nextIndex]);
          }}
          className="text-white hover:text-accent"
        >
          <Globe className="w-4 h-4 mr-2" />
          {currentLanguage}
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center h-screen">
        
        {/* Left Column - Hero Content */}
        <div className="flex flex-col justify-center space-y-8">
          {/* Main Headline */}
          <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-tight">
            The Future of
            <span className="block text-gradient"> Lightweight Solar</span>
            is Here.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed">
            SolarClip™ — the world's first clip-on / clip-off solar mounting system. 
            <span className="font-semibold text-white"> Fast. Reversible. Roof-safe.</span>
          </p>

          {/* Video Thumbnails */}
          <div className="flex gap-4">
            {videoThumbnails.map((video) => (
              <div 
                key={video.id}
                className="video-thumbnail"
                onClick={() => handleVideoThumbnail(video.id)}
                title={video.title}
              >
                <img 
                  src={video.image} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://via.placeholder.com/64x64/4CAF50/ffffff?text=${video.title.charAt(0)}`;
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Isabella Avatar */}
        <div className="flex justify-center lg:justify-end items-center relative">
          <div className="relative">
            {/* Isabella Avatar */}
            <div className="isabella-avatar w-80 lg:w-96 max-w-full">
              <img 
                src="https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg"
                alt="Isabella Navia - AI Solar Ambassador"
                className="w-full h-full object-contain"
                onClick={onChatToggle}
              />
            </div>
            
            {/* Meet Isabella Button Overlay */}
            {showMeetButton && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button 
                  className="meet-isabella-btn"
                  onClick={handleMeetIsabella}
                >
                  <Play className="mr-2 w-5 h-5" />
                  Meet Isabella
                </Button>
              </div>
            )}
            
            {/* Tooltip when not expanded */}
            {!isExpanded && !showMeetButton && (
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 text-white text-sm border border-white/20">
                Click to talk with Isabella
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat/Microphone Interface - Show when expanded */}
      {isExpanded && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          <Button className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20">
            <Mic className="w-5 h-5 mr-2" />
            Voice Chat
          </Button>
          <Button className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20">
            💬 Text Chat
          </Button>
        </div>
      )}
    </section>
  );
};