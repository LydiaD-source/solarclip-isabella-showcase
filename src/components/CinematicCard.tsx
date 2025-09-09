import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Play, ExternalLink } from 'lucide-react';

interface CinematicCardProps {
  card: {
    type: 'video' | 'google_solar' | 'lead_form' | 'confirmation' | 'error';
    title: string;
    content: any;
    animation?: 'swoop-left' | 'fade-in';
  };
  onClose: () => void;
  onAction?: (action: string, data?: any) => void;
}

export const CinematicCard = ({ card, onClose, onAction }: CinematicCardProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const renderContent = () => {
    switch (card.type) {
      case 'video':
        return (
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => onAction?.('play_video', card.content)}
                className="gap-2"
              >
                <Play className="h-5 w-5" />
                Play Video
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {card.content.description || "Click to play this video"}
            </p>
          </div>
        );

      case 'google_solar':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><strong>Annual Generation:</strong> {card.content.summary?.annual_kwh?.toLocaleString()} kWh</p>
                <p><strong>Panel Count:</strong> {card.content.summary?.panel_count}</p>
                <p><strong>CO₂ Saved:</strong> {card.content.summary?.co2_saved} tons/year</p>
              </div>
              <div className="space-y-2">
                <p><strong>Roof Area:</strong> {card.content.summary?.roof_area} m²</p>
                <p><strong>Monthly Avg:</strong> {Math.round((card.content.summary?.annual_kwh || 0) / 12).toLocaleString()} kWh</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open(card.content.embed_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View Full Solar Analysis
            </Button>
          </div>
        );

      case 'lead_form':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get a personalized solar analysis and free consultation
            </p>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Your Name" 
                className="w-full p-2 border rounded-md bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input 
                type="email" 
                placeholder="Email Address" 
                className="w-full p-2 border rounded-md bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input 
                type="tel" 
                placeholder="Phone (Optional)" 
                className="w-full p-2 border rounded-md bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <input 
                type="text" 
                placeholder="Property Address" 
                className="w-full p-2 border rounded-md bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button 
                className="w-full"
                onClick={() => onAction?.('submit_lead', {})}
              >
                Get Free Solar Analysis
              </Button>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="space-y-4 text-center">
            <div className="text-green-600 text-4xl">✓</div>
            <p className="text-sm">{card.content.message}</p>
            {card.content.next_steps && (
              <div className="space-y-2 text-left">
                <p className="font-medium text-sm">Next Steps:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {card.content.next_steps.map((step: string, index: number) => (
                    <li key={index}>• {step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 text-center">
            <div className="text-red-500 text-4xl">⚠</div>
            <p className="text-sm text-muted-foreground">{card.content.message}</p>
            <Button variant="outline" onClick={handleClose}>
              Try Again
            </Button>
          </div>
        );

      default:
        return <p>Unknown card type</p>;
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div className="flex items-center justify-center min-h-screen p-4 perspective-1200">
        <Card 
          className={`w-full max-w-md shadow-2xl transform-gpu will-change-transform ${
            isClosing ? 'animate-swoop-out' : (isVisible ? 'animate-swoop-in' : '')
          }`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{card.title}</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleClose}
                aria-label="Close card"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};