import { useState, useEffect } from 'react';
import { MessageCircle, Volume2, VolumeX, Mic, MicOff, FileText, Calculator, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWellnessGeniChat } from '@/hooks/useWellnessGeniChat';
// Using approved Cloudinary image for Isabella Navia
const isabellaNavia = 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg';

interface IsabellaAvatarProps {
  onChatToggle?: () => void;
  isExpanded?: boolean;
}

export const IsabellaAvatar = ({ onChatToggle, isExpanded = false }: IsabellaAvatarProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputText, setInputText] = useState('');
  
  const {
    messages,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    sendMessage,
    sendGreeting,
    startListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
  } = useWellnessGeniChat();

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

    // Send auto-greeting after page load
    const greetingTimer = setTimeout(() => {
      sendGreeting();
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(tooltipTimer);
      clearTimeout(greetingTimer);
    };
  }, [sendGreeting]);

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
        className={`isabella-avatar w-[65vw] h-[80vw] sm:w-[60vw] sm:h-[76vw] lg:w-[22rem] lg:h-[28rem] xl:w-[26rem] xl:h-[32rem] cursor-pointer relative overflow-hidden rounded-full bg-gradient-to-br from-purple-50 to-blue-50 border-4 border-accent shadow-2xl transition-all duration-300 hover:scale-105 shadow-black/20 hover:shadow-accent/20`}
        onClick={handleChatToggle}
      >
        {/* Isabella Navia Image */}
        <img 
          src={isabellaNavia} 
          alt="Isabella Navia - AI Solar Ambassador" 
          className="w-full h-full object-contain rounded-full p-2"
        />
      </div>

      {/* Animated Tooltip - Click to Chat Hint */}
      {showTooltip && !isExpanded && (
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg animate-[fade-in_0.5s_ease-out,pulse_2s_ease-in-out_infinite] pointer-events-none">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            💬 <span className="text-accent font-medium">Click to chat with me</span>
          </p>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-border"></div>
        </div>
      )}

      {/* Expanded Chat Panel */}
      {isExpanded && (
        <Card className="absolute top-64 lg:top-96 xl:top-112 right-0 w-80 sm:w-96 h-[500px] card-premium animate-fade-in-up">
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

            {/* Messages */}
            <div className="flex-1 space-y-3 max-h-60 overflow-y-auto">
              {messages.length === 0 && (
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-sm text-foreground">
                    Hello! I'm Isabella Navia, ClearNanoTech's ambassador for SolarClip™. I'm here to answer any questions about our company and our product. Let's explore the future of solar together.
                  </p>
                </div>
              )}
              
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

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask me about SolarClip™..." 
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isProcessing}
              />
              <Button 
                size="sm" 
                variant="default" 
                onClick={handleSendMessage}
                disabled={isProcessing || !inputText.trim()}
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