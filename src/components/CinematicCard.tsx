import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Play, ExternalLink, Plus, Minus } from 'lucide-react';

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

// Import the new SolarMapContent component
const SolarMapContent = React.lazy(() => import('./SolarMapContent').then(module => ({ default: module.SolarMapContent })));

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
    }, 4000); // Match the swoop-out animation duration
  };

  const handleAutoExit = (exitType: 'video_ended' | 'solar_completed' | 'manual' = 'manual') => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      onAction?.('card_auto_exit', { exitType, cardType: card.type });
    }, 4000); // Match the swoop-out animation duration
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
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 bg-black rounded-lg overflow-hidden">
              <video 
                className="w-full h-full object-cover"
                autoPlay
                muted
                controls
                playsInline
                src="https://res.cloudinary.com/di5gj4nyp/video/upload/v1757341336/VIDEO-2025-04-11-11-30-14_1_xywu7x.mp4"
                onEnded={() => handleAutoExit('video_ended')}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        );

      case 'google_solar':
        // If an embed_url is provided, render it fullscreen like the Google demo
        if ((card as any)?.content?.embed_url || (card as any)?.content?.url) {
          const embed = (card as any).content.embed_url || (card as any).content.url;
          return (
            <iframe
              src={embed}
              className="w-full h-full border-0"
              title="Interactive Solar Map"
              loading="lazy"
              allow="geolocation"
            />
          );
        }
        // Fallback to legacy internal renderer
        return (
          <SolarMapContent 
            card={card} 
            onAction={onAction}
          />
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

  // Determine if this should be fullscreen
  const isFullscreen = card.type === 'google_solar';

  const containerVariants = {
    hidden: { 
      opacity: 0,
      x: isFullscreen ? "100%" : "-100%",
      scale: 0.7,
      rotateY: isFullscreen ? 25 : -25,
      filter: "blur(8px)"
    },
    visible: { 
      opacity: 1,
      x: 0,
      scale: 1,
      rotateY: 0,
      filter: "blur(0px)"
    },
    exit: {
      opacity: 0,
      x: isFullscreen ? "100%" : "-100%",
      scale: 0.8
    }
  };

  return (
    <AnimatePresence>
      {(isVisible || isClosing) && (
        <motion.div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={isFullscreen ? undefined : handleClose}
        >
          <div className={isFullscreen ? "w-full h-full min-h-screen" : "flex items-center justify-center min-h-screen p-4 mb-12 md:mb-16"}>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={isClosing ? "exit" : "visible"}
              transition={{
                duration: 4,
                ease: "easeInOut",
                staggerChildren: 0.2
              }}
              style={{ transformOrigin: "center" }}
            >
              <Card 
                className={`${
                  isFullscreen 
                    ? "w-full h-full rounded-none shadow-none"
                    : "w-[65vw] max-w-2xl aspect-video mx-auto shadow-2xl rounded-xl"
                } transform-gpu will-change-transform`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                tabIndex={0}
              >
          {!isFullscreen && (
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
          )}
          <CardContent className={isFullscreen ? "p-0 h-full" : "p-4 flex-1"}>
            <div className={isFullscreen ? "w-full h-full" : "w-full h-full overflow-hidden bg-background rounded-b-xl"}>
              {renderContent()}
            </div>
          </CardContent>
          {isFullscreen && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClose}
              aria-label="Close solar analysis"
              className="absolute top-4 right-4 z-50 bg-background/80 backdrop-blur-sm hover:bg-background/90"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};