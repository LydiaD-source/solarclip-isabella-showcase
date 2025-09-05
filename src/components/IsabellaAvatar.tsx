import { useState, useEffect } from 'react';
import { MessageCircle, Volume2, FileText, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Using approved Cloudinary image for Isabella Navia
const isabellaNavia = 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg';

interface IsabellaAvatarProps {
  onChatToggle?: () => void;
  isExpanded?: boolean;
}

export const IsabellaAvatar = ({ onChatToggle, isExpanded = false }: IsabellaAvatarProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Auto-play greeting animation on mount
    const timer = setTimeout(() => {
      setIsPlaying(true);
      // Simulate D-ID animation duration (10 seconds)
      setTimeout(() => setIsPlaying(false), 10000);
    }, 1000);

    // Show tooltip after greeting
    const tooltipTimer = setTimeout(() => {
      setShowTooltip(true);
    }, 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(tooltipTimer);
    };
  }, []);

  const handleChatToggle = () => {
    setShowTooltip(false); // Hide tooltip after first interaction
    onChatToggle?.();
  };

  return (
    <div className="fixed top-24 right-4 lg:right-8 z-50">
      {/* Avatar - Much larger and prominent */}
      <div 
        className={`isabella-avatar w-40 h-40 sm:w-48 sm:h-48 lg:w-64 lg:h-64 xl:w-80 xl:h-80 cursor-pointer relative overflow-hidden rounded-full bg-gradient-to-br from-purple-50 to-blue-50 border-4 border-accent shadow-2xl transition-all duration-300 ${isPlaying ? 'animate-pulse border-accent-glow shadow-accent/30' : 'shadow-black/20 hover:shadow-accent/20'}`}
        onClick={handleChatToggle}
      >
        {/* Isabella Navia Image */}
        <img 
          src={isabellaNavia} 
          alt="Isabella Navia - AI Solar Ambassador" 
          className="w-full h-full object-cover rounded-full"
        />
        
        {/* Status indicators */}
        {isPlaying && (
          <div className="absolute bottom-2 right-2 w-4 h-4 bg-accent rounded-full animate-pulse"></div>
        )}
      </div>

      {/* Animated Tooltip - Click to Chat Hint */}
      {showTooltip && !isExpanded && (
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg animate-[fade-in_0.5s_ease-out,pulse_2s_ease-in-out_infinite] pointer-events-none">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            👋 <span className="text-accent font-medium">Click to chat</span> with me
          </p>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-border"></div>
        </div>
      )}

      {/* Expanded Chat Panel */}
      {isExpanded && (
        <Card className="absolute top-56 lg:top-80 xl:top-96 right-0 w-80 sm:w-96 h-[500px] card-premium animate-fade-in-up">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="isabella-avatar w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100">
                <img 
                  src={isabellaNavia} 
                  alt="Isabella Navia" 
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-foreground">Isabella Navia</h3>
                <p className="text-sm text-muted-foreground">AI Solar Ambassador</p>
              </div>
            </div>
          </div>

          <div className="p-4 flex-1">
            <div className="space-y-3">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-sm text-foreground">
                  Hello! I'm Isabella Navia, ClearNanoTech's ambassador for SolarClip™. I'm here to answer any questions about our company and our product. Let's explore the future of solar together.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-auto flex-col gap-1 p-3">
                  <Calculator className="w-4 h-4" />
                  <span className="text-xs">Get Quote</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto flex-col gap-1 p-3">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs">Guides</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto flex-col gap-1 p-3">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs">Voice Chat</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto flex-col gap-1 p-3">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">Text Chat</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask me about SolarClip™..." 
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
              <Button size="sm" variant="default">
                Send
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};