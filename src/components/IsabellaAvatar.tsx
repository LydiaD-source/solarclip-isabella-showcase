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

  return (
    <div className="fixed top-20 right-6 z-50">
      {/* Tooltip */}
      {showTooltip && !isExpanded && (
        <div className="absolute -left-52 top-2 bg-card border border-border rounded-lg p-3 shadow-lg animate-fade-in-up">
          <p className="text-sm text-foreground">👋 Click to chat with me</p>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-card border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
        </div>
      )}

      {/* Avatar */}
      <div 
        className={`isabella-avatar w-28 h-28 cursor-pointer relative overflow-hidden rounded-full bg-gradient-to-br from-purple-100 to-blue-100 border-2 border-accent shadow-lg ${isPlaying ? 'animate-pulse border-accent-glow' : ''}`}
        onClick={onChatToggle}
      >
        {/* Isabella Navia Image */}
        <img 
          src={isabellaNavia} 
          alt="Isabella Navia - AI Solar Ambassador" 
          className="w-full h-full object-cover rounded-full"
        />
        
        {/* Status indicators */}
        {isPlaying && (
          <div className="absolute bottom-1 right-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>
        )}
      </div>

      {/* Expanded Chat Panel */}
      {isExpanded && (
        <Card className="absolute top-24 right-0 w-96 h-[500px] card-premium animate-fade-in-up">
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