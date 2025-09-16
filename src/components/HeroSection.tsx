import { Button } from '@/components/ui/button';
import { Play, Send, Mic, Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CinematicCard } from './CinematicCard';
import { IsabellaAvatar } from './IsabellaAvatar';
import { useIsabella } from '@/hooks/useIsabella';
import { useWellnessGeniChat } from '@/hooks/useWellnessGeniChat';
import { createSolarClipPersona } from '@/utils/createPersona';

interface HeroSectionProps { 
  isExpanded?: boolean; 
  onChatToggle?: () => void;
}

const videoThumbnails = [
  { id: 'ceo', title: 'CEO Testimonial', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' },
  { id: 'board', title: 'Board Member', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' },
  { id: 'client', title: 'Happy Client', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' },
  { id: 'owner', title: 'Building Owner', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' }
];

export const HeroSection = ({ isExpanded = false, onChatToggle }: HeroSectionProps) => {
  const [showMeetButton, setShowMeetButton] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('EN');
  const [inputMessage, setInputMessage] = useState('');
  const { currentCard, closeCard, handleCardAction } = useIsabella('solarclip');
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
    toggleMicrophone 
  } = useWellnessGeniChat();
  
  const languages = ['EN', 'FR', 'DE', 'LB'];

  // Auto-greet once when chat opens
  useEffect(() => {
    if (isExpanded && messages.length === 0 && !isProcessing) {
      sendGreeting();
    }
  }, [isExpanded, messages.length, isProcessing, sendGreeting]);

  const handleMeetIsabella = () => {
    setShowMeetButton(false);
    onChatToggle?.();
  };

  const handleVideoThumbnail = (videoId: string) => {
    console.log(`Playing video: ${videoId}`);
    // TODO: Implement video modal with sliding card animation
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && !isProcessing) {
      sendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreatePersona = async () => {
    console.log('Creating SolarClip persona...');
    const result = await createSolarClipPersona();
    console.log('Persona creation result:', result);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Language Toggle - Top Right Corner of Isabella's Image */}
      <div className="absolute top-8 right-8 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const currentIndex = languages.indexOf(currentLanguage);
            const nextIndex = (currentIndex + 1) % languages.length;
            setCurrentLanguage(languages[nextIndex]);
          }}
          className="text-white/80 hover:text-white bg-transparent hover:bg-transparent p-2 font-medium tracking-wide relative group"
        >
          <span className={`transition-all duration-300 ${currentLanguage === languages[languages.indexOf(currentLanguage)] ? 'text-white language-active' : 'text-white/60'}`}>
            {currentLanguage}
          </span>
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center h-screen">
        
        {/* Left Column - Hero Content */}
        <div className="flex flex-col justify-center space-y-8 lg:mt-12" style={{ transform: 'translateY(-20px)' }}>
          {/* Main Headline */}
          <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-tight hero-text-glow">
            The Future of
            <span className="block lw-solar-text" data-text="Lightweight Solar">Lightweight Solar</span>
            is Here.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed hero-text-glow">
            SolarClip™ — the world's first clip-on / clip-off solar mounting system. 
            <span className="font-semibold text-white"> Fast. Reversible. Roof-safe.</span>
          </p>

          {/* Video Thumbnails */}
          <div className="flex gap-4 flex-wrap">
            {videoThumbnails.map((video) => (
              <div 
                key={video.id}
                className="video-thumbnail-interactive"
                onClick={() => handleVideoThumbnail(video.id)}
                title={video.title}
              >
                <img 
                  src={video.image} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    // Create a simple colored div fallback instead of external placeholder
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `
                      <div class="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        ${video.title.charAt(0)}
                      </div>
                    `;
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Isabella Avatar */}
        <div className="flex justify-center lg:justify-end items-center relative -mt-5">
          <div className="relative">
            <IsabellaAvatar onChatToggle={onChatToggle} isExpanded={false} />
            {showMeetButton && (
              <div className="hidden lg:block absolute bottom-[-22px] -left-36 xl:-left-44 text-center">
                <Button 
                  className="meet-isabella-btn-animated text-sm px-5 py-2"
                  onClick={handleMeetIsabella}
                  style={{ transform: 'scale(0.88)' }}
                >
                  <Play className="mr-2 w-5 h-5" />
                  Start Assistant
                </Button>
                 <p className="text-white/70 text-sm mt-2">Your AI guide to SolarClip™</p>
               </div>
             )}
             {/* Temporary Persona Creation Button - TODO: Remove after testing */}
             <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
               <Button 
                 onClick={handleCreatePersona}
                 variant="outline"
                 size="sm"
                 className="bg-red-500 text-white border-red-500 hover:bg-red-600"
               >
                 Create Persona (Test)
               </Button>
             </div>
           </div>
         </div>

        {/* Enhanced Chatbox Panel - Positioned with proper spacing from Isabella */}
        {isExpanded && (
          <div className="static lg:absolute lg:top-1/2 lg:left-[55%] xl:left-[57%] 2xl:left-[58%] transform lg:-translate-x-1/2 lg:-translate-y-[40%] w-[88vw] max-w-[340px] sm:w-[320px] lg:w-[320px] h-[460px] sm:h-[480px] mx-auto lg:mx-0 mt-4 lg:mt-0 bg-background/90 backdrop-blur-md border-2 border-accent/30 rounded-2xl shadow-premium z-30 flex flex-col overflow-hidden chatbox-glow">
            {/* Chat Header with Voice Controls */}
            <div className="flex justify-between items-center p-4 border-b border-accent/20">
              <h3 className="text-white font-medium">Isabella AI Assistant</h3>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleSpeaker}
                  className={`text-white/60 hover:text-white hover:bg-white/10 p-2 ${isSpeakerEnabled ? 'text-white' : 'text-white/40'}`}
                >
                  {isSpeakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleMicrophone}
                  className={`text-white/60 hover:text-white hover:bg-white/10 p-2 ${isMicEnabled ? 'text-white' : 'text-white/40'} ${isListening ? 'animate-pulse bg-red-500/20' : ''}`}
                >
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Chat Messages Area - Enhanced scrolling */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2 rounded-lg max-w-[80%] text-sm ${
                    message.sender === 'user' 
                      ? 'bg-primary/20 text-white' 
                      : 'bg-accent/20 text-white'
                  }`}>
                    {message.text}
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-accent/20 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse">Isabella is thinking...</div>
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Enhanced Input Area */}
            <div className="p-4 border-t border-accent/20">
              <div className="flex gap-2">
                <textarea 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask Isabella anything... (Shift+Enter for new line)"
                  className="flex-1 bg-white/10 border border-accent/30 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm focus:outline-none focus:border-accent resize-none min-h-[40px] max-h-[80px]"
                  disabled={isProcessing}
                />
                <Button 
                  size="sm" 
                  className="bg-accent/30 hover:bg-accent/50 text-white p-2"
                  onClick={handleSendMessage}
                  disabled={isProcessing || !inputMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0"
                  onClick={() => sendMessage("Show me the SolarClip video presentation")}
                  disabled={isProcessing}
                >
                  🎥 Videos
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0"
                  onClick={() => sendMessage("I need documentation about SolarClip")}
                  disabled={isProcessing}
                >
                  📄 Docs
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs text-white/70 border-white/20 hover:bg-white/10 flex-1 min-w-0"
                  onClick={() => sendMessage("Analyze solar potential for my address")}
                  disabled={isProcessing}
                >
                  🗺️ Solar
                </Button>
              </div>
              
              {/* Voice Interface */}
              <div className="flex gap-2 mt-3 pt-2 border-t border-accent/20">
                <Button 
                  size="sm" 
                  className={`bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 flex-1 ${isListening ? 'animate-pulse bg-red-500/20' : ''}`}
                  onClick={startListening}
                  disabled={!isMicEnabled || isListening || isProcessing}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {isListening ? 'Listening...' : 'Voice Input'}
                </Button>
                <Button 
                  size="sm" 
                  className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 flex-1"
                  onClick={() => sendMessage("Tell me about installation process")}
                  disabled={isProcessing}
                >
                  💬 Learn More
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="absolute bottom-4 right-6">
        <a 
          href="https://ovelainteractive.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-gradient-blue-footer hover:opacity-80 transition-opacity"
        >
          Powered by Ovela AI
        </a>
      </div>

      {/* Video Presentation Area - Reserved Space for Sliding Cards */}
      <div id="video-presentation-area" className="absolute top-1/2 left-8 lg:left-16 transform -translate-y-1/2 w-[350px] h-[250px] pointer-events-none">
        {/* This area is reserved for sliding video cards from Phase 2 */}
      </div>

      {/* Cinematic Cards */}
      {currentCard && (
        <CinematicCard
          card={currentCard}
          onClose={closeCard}
          onAction={handleCardAction}
        />
      )}

    </section>
  );
};