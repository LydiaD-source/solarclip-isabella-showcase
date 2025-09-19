import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Volume2, VolumeX, Mic, MicOff, Send } from 'lucide-react';
import { useWellnessGeniChat } from '@/hooks/useWellnessGeniChat';
// Using approved Cloudinary image for Isabella Navia
const isabellaNavia = 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg';

interface IsabellaAvatarProps {
  onChatToggle?: () => void;
  isExpanded?: boolean;
  hideTooltip?: boolean;
  size?: 'lg' | 'xl';
}

export const IsabellaAvatar = ({ onChatToggle, isExpanded = false, hideTooltip = false, size = 'xl' }: IsabellaAvatarProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    sendMessage,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
    narrate,
    didVideoUrl,
  } = useWellnessGeniChat();

  // Auto-show tooltip after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  const handleChatToggle = async () => {
    setShowTooltip(false);
    await initializeAudio();
    onChatToggle?.();
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const sizeClass = isExpanded ? 'w-20 h-20' : (size === 'xl' ? 'w-[24rem] h-[24rem] lg:w-[28rem] lg:h-[28rem]' : 'w-[20rem] h-[20rem] lg:w-[24rem] lg:h-[24rem]');
  return (
    <div className="relative">
      {/* Main Avatar Button - Large, Luminous Design */}
      <div 
        className={`relative cursor-pointer group transition-all duration-300 hover:scale-105 ${sizeClass}`}
        onClick={handleChatToggle}
      >
        {/* Outer glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/30 to-blue-400/30 blur-lg group-hover:blur-xl transition-all duration-500"></div>
        
        {/* Inner avatar container with D-ID video or image */}
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-br from-purple-100 to-blue-100">
          {didVideoUrl ? (
            <video 
              src={didVideoUrl} 
              autoPlay 
              loop 
              muted
              className="w-full h-full object-cover"
              onError={() => {
                console.log('D-ID video failed to load, falling back to image');
              }}
            />
          ) : (
            <img 
              src={isabellaNavia} 
              alt="Isabella Navia - AI Solar Ambassador" 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          )}
          
          {/* Voice indicator when speaking */}
          {isPlaying && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/40 to-blue-500/40 flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center animate-pulse">
                <Volume2 className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          )}
        </div>
        
        {/* Pulsing ring animation */}
        <div className="absolute inset-0 rounded-full border-2 border-purple-400/50 animate-ping"></div>
      </div>

      {/* Floating tooltip */}
      {showTooltip && !hideTooltip && !isExpanded && (
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg animate-[fade-in_0.5s_ease-out,pulse_2s_ease-in-out_infinite] pointer-events-none">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            💬 <span className="text-accent font-medium">Click to chat with me</span>
          </p>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-border"></div>
        </div>
      )}

      {/* Expanded Chat Panel - Larger, Fluid Design */}
      {isExpanded && (
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
                    onClick={startListening}
                    disabled={isListening}
                    className="text-xs px-2"
                  >
                    {isListening ? "Listening..." : "Talk"}
                  </Button>
                )}
              </div>
            </div>

            {/* Messages - Larger scrollable area */}
            <div 
              className="flex-1 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent"
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
              
              {/* Invisible element to scroll to */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-border/50 bg-gradient-to-r from-secondary/30 to-accent/10">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask me about SolarClip™ installation, pricing, benefits..." 
                className="flex-1 px-4 py-3 text-sm border border-border/50 rounded-xl bg-background/80 backdrop-blur-sm transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-background"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isProcessing}
              />
              <Button 
                size="default" 
                variant="default" 
                onClick={handleSendMessage} 
                disabled={isProcessing || !inputText.trim()}
                className="px-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
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