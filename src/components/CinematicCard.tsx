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

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

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
        // If an embed_url is provided, render it with enhanced cinematic experience
        if ((card as any)?.content?.embed_url || (card as any)?.content?.url) {
          const embed = (card as any).content.embed_url || (card as any).content.url;
          return (
            <div className="w-full h-full relative">
              <iframe
                src={embed}
                className="w-full h-full border-0 rounded-xl"
                title="Interactive Solar Map"
                loading="lazy"
                allow="geolocation"
              />
              {/* Fullscreen controls overlay */}
              {isFullscreenMode && (
                <motion.div 
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.8 }}
                >
                  {/* Legend */}
                  <motion.div 
                    className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg pointer-events-auto"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 2, duration: 0.6, ease: "easeOut" }}
                  >
                    <h3 className="font-semibold text-sm mb-3 text-gray-800">Solar Potential</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                        <span className="text-xs text-gray-700">High</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-xs text-gray-700">Medium</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-gray-700">Low</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Seasonal Controls */}
                  <motion.div 
                    className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg pointer-events-auto"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 2.5, duration: 0.6, ease: "easeOut" }}
                  >
                    <h3 className="font-semibold text-sm mb-3 text-gray-800">Season</h3>
                    <div className="flex gap-2">
                      {['Winter', 'Spring', 'Summer', 'Fall'].map((season) => (
                        <button
                          key={season}
                          className="px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  {/* Sun Angle Control */}
                  <motion.div 
                    className="absolute top-6 right-20 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg pointer-events-auto"
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 3, duration: 0.6, ease: "easeOut" }}
                  >
                    <h3 className="font-semibold text-sm mb-3 text-gray-800">Sun Angle</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Morning</span>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        defaultValue="50"
                        className="flex-1 accent-orange-500"
                      />
                      <span className="text-xs text-gray-600">Evening</span>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
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

  // Determine rendering mode based on expansion state
  const isFullscreen = isFullscreenMode;

  const containerVariants = {
    hidden: { 
      opacity: 0,
      x: "-100%",
      scale: 0.7,
      rotateY: -25,
      filter: "blur(8px)"
    },
    visible: { 
      opacity: 1,
      x: 0,
      scale: 1,
      rotateY: 0,
      filter: "blur(0px)"
    },
    expandToFullscreen: {
      opacity: 1,
      x: 0,
      scale: 1.2,
      rotateY: 0,
      filter: "blur(0px)"
    },
    fullscreen: {
      opacity: 1,
      x: 0,
      scale: 1,
      rotateY: 0,
      filter: "blur(0px)"
    },
    exit: {
      opacity: 0,
      x: "-100%",
      scale: 0.8
    }
  };

  return (
    <AnimatePresence>
      {(isVisible || isClosing) && (
        <motion.div 
          className={`fixed inset-0 z-50 ${
            isExpandingToFullscreen || isFullscreenMode ? 'bg-black/70' : 'bg-black/50'
          } backdrop-blur-sm`}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            backgroundColor: isExpandingToFullscreen || isFullscreenMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)'
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={isFullscreen ? undefined : handleClose}
        >
          <div className={isFullscreen ? "w-full h-full min-h-screen" : "flex items-center justify-center min-h-screen p-4 mb-12 md:mb-16"}>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={
                isClosing ? "exit" : 
                isExpandingToFullscreen ? "expandToFullscreen" :
                isFullscreenMode ? "fullscreen" :
                "visible"
              }
              transition={{
                duration: isExpandingToFullscreen ? 2 : 4,
                ease: isExpandingToFullscreen ? "easeInOut" : "easeInOut",
                staggerChildren: 0.2
              }}
              style={{ transformOrigin: "center" }}
            >
              <Card 
                className={`${
                  isFullscreenMode 
                    ? "w-screen h-screen rounded-none shadow-none fixed inset-0"
                    : isExpandingToFullscreen
                    ? "w-screen h-screen rounded-xl shadow-2xl fixed inset-0"
                    : "w-[70vw] max-w-2xl aspect-video mb-12 mx-auto shadow-2xl rounded-2xl"
                } transform-gpu will-change-transform transition-all duration-1000 ease-in-out`}
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
          {(isExpandingToFullscreen || isFullscreenMode) && (
            <motion.div
              className="absolute top-4 right-4 z-50 flex gap-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleMinimize}
                aria-label="Minimize to card view"
                className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-800 shadow-lg"
              >
                <Minus className="h-4 w-4" />
              </Button>
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
          )}
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};