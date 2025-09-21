import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Volume2, VolumeX, Mic, MicOff, FileText, Calculator, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWellnessGeniChat } from '@/hooks/useWellnessGeniChat';
import { IdleAvatar } from './IdleAvatar';
// Using approved Cloudinary image for Isabella Navia
const isabellaNavia = 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg';

interface IsabellaAvatarProps {
  onChatToggle?: () => void;
  isExpanded?: boolean;
  didVideoUrl?: string | null;
  showInlineChat?: boolean; // if false, hide internal chat UI (used when external chat panel is rendered)
}

export const IsabellaAvatar = ({ onChatToggle, isExpanded = false, didVideoUrl, showInlineChat = true }: IsabellaAvatarProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputText, setInputText] = useState('');
  
  const {
    messages,
    isProcessing,
    isThinking,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    didVideoUrl: hookDidVideoUrl,
    liveTranscript,
    isWebSpeechActive,
    sendMessage,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
    narrate,
  } = useWellnessGeniChat();

  // Prefer parent-provided video URL to avoid duplicate hook instances causing mismatch
  const videoUrl = didVideoUrl ?? hookDidVideoUrl;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Ensure video and audio (embedded) start together without separate audio element
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const v = videoRef.current;
      const tryPlay = async () => {
        try { await v.play(); } catch (e) { console.warn('Video play blocked, will retry on canplay', e); }
      };
      v.addEventListener('canplay', tryPlay, { once: true } as any);
      tryPlay();
      return () => { v.removeEventListener('canplay', tryPlay as any); };
    }
  }, [videoUrl]);

  useEffect(() => {
    // Show tooltip after delay but no auto-greeting - only when user clicks start
    const tooltipTimer = setTimeout(() => {
      setShowTooltip(true);
    }, 3000);

    return () => {
      clearTimeout(tooltipTimer);
    };
  }, []);

  const handleChatToggle = async () => {
    setShowTooltip(false); // Hide tooltip after first interaction
    // Initialize audio context to bypass browser restrictions
    await initializeAudio();
    onChatToggle?.();
  };

  const handleSendMessage = async () => {
    if (inputText.trim()) {
      await sendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="relative mx-auto lg:mx-0 z-50">
      {/* Avatar - Enlarged and centered without cropping */}
      <div 
        className={`isabella-avatar w-[62vw] h-[77vw] sm:w-[57vw] sm:h-[73vw] lg:w-[20.5rem] lg:h-[26.5rem] xl:w-[24.5rem] xl:h-[30.5rem] cursor-pointer relative overflow-hidden rounded-full bg-gradient-to-br from-purple-50 to-blue-50 border-4 border-accent shadow-2xl transition-all duration-300 hover:scale-105 shadow-black/20 hover:shadow-accent/20`}
        onClick={handleChatToggle}
      >
        {/* Isabella Navia Video (D-ID) - Fixed distortion with proper oval mask */}
        {videoUrl && (
          <div className="absolute inset-0 w-full h-full rounded-full overflow-hidden z-20">
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              playsInline
              muted={false}
              preload="auto"
              onLoadStart={() => console.log('[D-ID] Video loading started')}
              onCanPlay={() => console.log('[D-ID] Video can play')}
              onError={(e) => console.error('[D-ID] Video error:', e)}
              className="w-full h-full object-contain"
              style={{ 
                backgroundColor: 'black'
              }}
            />
          </div>
        )}
        
        {/* Animated Idle Avatar - Shows when processing or no video */}
        <IdleAvatar
          imageUrl={isabellaNavia}
          alt="Isabella Navia - AI Solar Ambassador"
          className="absolute inset-0 w-full h-full object-contain rounded-full p-2 z-10"
          isVisible={!videoUrl}
        />
        
        {/* Static Background - Base layer (only when video is present to avoid double image) */}
      </div>

      {/* Removed tooltip to prevent collision during beta testing */}

      {/* Expanded Chat Panel - Larger, Fluid Design */}
      {isExpanded && showInlineChat && (
        <Card className="absolute top-48 lg:top-72 xl:top-80 right-0 w-[90vw] sm:w-[26rem] lg:w-[28rem] xl:w-[32rem] h-[70vh] max-h-[600px] card-premium animate-fade-in-up border-0 shadow-xl bg-gradient-to-br from-card/95 to-secondary/90 backdrop-blur-lg">
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

          <div className="p-4 flex-1 flex flex-col">
            {/* Voice Controls */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-2">
                <Button
                  variant={isSpeakerEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSpeaker}
                  className="h-8 w-8 p-0"
                >
                  {isSpeakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button
                  variant={isMicEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMicrophone}
                  className="h-8 w-8 p-0"
                >
                  {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                {isMicEnabled && (
                  <Button
                    variant={isListening ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => startListening()}
                    disabled={isListening}
                    className="text-xs px-2"
                  >
                    {isListening ? "Listening..." : "Talk"}
                  </Button>
                )}
              </div>
            </div>

            {/* Messages - Auto-scroll to bottom for new messages */}
            <div 
              className="flex-1 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent"
              ref={(el) => {
                if (el && messages.length > 0) {
                  setTimeout(() => el.scrollTop = el.scrollHeight, 100);
                }
              }}
            >
              {/* Messages will show here when Isabella responds */}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-primary/10 ml-4'
                      : 'bg-secondary/50 mr-4'
                  }`}
                >
                  <p className="text-sm text-foreground">{message.text}</p>
                </div>
              ))}
              
              {isProcessing && (
                <div className="bg-secondary/50 rounded-lg p-3 mr-4">
                  <p className="text-sm text-muted-foreground">Isabella is thinking...</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border/50 bg-gradient-to-r from-secondary/30 to-accent/10">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask me about SolarClip™ installation, pricing, benefits..." 
                className="flex-1 px-4 py-3 text-sm border border-border/50 rounded-xl bg-background/80 backdrop-blur-sm transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-background"
                value={isWebSpeechActive ? liveTranscript : inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isProcessing}
                style={{ 
                  color: isWebSpeechActive ? '#059669' : undefined,
                  fontStyle: isWebSpeechActive ? 'italic' : undefined
                }}
              />
              {isWebSpeechActive && (
                <div className="absolute -top-6 left-4 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  🎤 Listening...
                </div>
              )}
              <Button 
                size="default" 
                variant="default" 
                onClick={handleSendMessage}
                disabled={isProcessing || !inputText.trim()}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-light hover:from-accent-light hover:to-accent transition-all duration-200 shadow-lg hover:shadow-accent/20"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};