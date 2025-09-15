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
  const [isExpandingToFullscreen, setIsExpandingToFullscreen] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [embedImgError, setEmbedImgError] = useState(false);
  
  // State for dynamic embed URL fallback
  const [embedSrc, setEmbedSrc] = useState<string>('');
  
  // Update embed source when card content changes
  useEffect(() => {
    const content: any = (card as any)?.content ?? {};
    const baseEmbed: string = String(
      content.mapsUrl || content.embed_url || content.embedUrl || content.url || ''
    );
    const projectRef = 'mzikfyqzwepnubdsclfd';
    let next = baseEmbed;

    if (baseEmbed.includes('maps.googleapis.com/maps/api/staticmap')) {
      try {
        const u = new URL(baseEmbed);
        const center = u.searchParams.get('center');
        let proxied = `https://${projectRef}.supabase.co/functions/v1/solar-map-image`;
        if (center) {
          proxied += `?center=${encodeURIComponent(center)}`;
        } else if (content?.coordinates?.lat && content?.coordinates?.lng) {
          proxied += `?lat=${content.coordinates.lat}&lng=${content.coordinates.lng}`;
        } else if (content?.summary?.address || content?.address) {
          const addr = content.summary?.address || content.address;
          proxied += `?address=${encodeURIComponent(addr)}`;
        }
        const zoom = u.searchParams.get('zoom');
        const size = u.searchParams.get('size');
        if (zoom) proxied += `&zoom=${zoom}`;
        if (size) proxied += `&size=${encodeURIComponent(size)}`;
        next = proxied;
      } catch {}
    }

    setEmbedSrc(next);
    setEmbedImgError(false);
  }, [card]);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset embed image error when card/content changes
  useEffect(() => {
    setEmbedImgError(false);
  }, [card]);

  useEffect(() => {
    // For google_solar cards, transition to fullscreen after swoosh settles
    if (card.type === 'google_solar' && isVisible && !isClosing) {
      const expandTimer = setTimeout(() => {
        setIsExpandingToFullscreen(true);
        // Complete fullscreen transition after 2s
        const fullscreenTimer = setTimeout(() => {
          setIsFullscreenMode(true);
        }, 2000);
        return () => clearTimeout(fullscreenTimer);
      }, 4000); // After swoosh animation completes
      return () => clearTimeout(expandTimer);
    }
  }, [card.type, isVisible, isClosing]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 4000); // Match the swoop-out animation duration
  };

  const handleMinimize = () => {
    // Return from fullscreen to card view
    setIsFullscreenMode(false);
    setIsExpandingToFullscreen(false);
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
        {
          const addr = (card as any)?.content?.address || (card as any)?.content?.summary?.address || '';
          return (
            <div className="w-full h-full relative bg-muted">
              <SolarMapContent address={addr} />
            </div>
          );
        }

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

  // For google_solar, render directly as fullscreen without card wrapper
  const isDirectFullscreen = card.type === 'google_solar';

  const containerVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.96,
      filter: "blur(8px)",
      x: 120
    },
    visible: { 
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      x: 0
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      filter: "blur(8px)",
      x: -80
    }
  };

  return (
    <AnimatePresence>
      {(isVisible || isClosing) && (
        <motion.div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={isDirectFullscreen ? undefined : handleClose}
        >
          {isDirectFullscreen ? (
            // Direct fullscreen solar map
            <motion.div
              className="w-full h-full animate-card-float-in perspective-1200"
              variants={containerVariants}
              initial="hidden"
              animate={isClosing ? "exit" : "visible"}
              transition={{ duration: 2, ease: "easeInOut" }}
            >
              <div className="w-full h-full relative">
                {renderContent()}
                {/* Close button for fullscreen */}
                <motion.div
                  className="absolute top-4 right-4 z-50"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleClose}
                    aria-label="Close solar analysis"
                    className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-800 shadow-lg"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            // Regular card layout for other types
            <div className="flex items-center justify-center min-h-screen p-4 mb-12 md:mb-16">
              <motion.div
                className="animate-card-float-in perspective-1200"
                variants={containerVariants}
                initial="hidden"
                animate={isClosing ? "exit" : "visible"}
                transition={{ duration: 4, ease: "easeInOut" }}
              >
                <Card 
                  className="w-[70vw] max-w-2xl aspect-video mb-12 mx-auto shadow-2xl rounded-2xl"
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
                  <CardContent className="p-4 flex-1">
                    <div className="w-full h-full overflow-hidden bg-background rounded-b-xl">
                      {renderContent()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};