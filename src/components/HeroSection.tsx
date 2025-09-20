import { Button } from '@/components/ui/button';
import { Play, Send, Mic, Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CinematicCard } from './CinematicCard';
import { IsabellaAvatar } from './IsabellaAvatar';
import { useIsabella } from '@/hooks/useIsabella';
import { useWellnessGeniChat } from '@/hooks/useWellnessGeniChat';
import { useIsabellaJourney } from '@/hooks/useIsabellaJourney';
import solarclipLogo from '@/assets/solarclip-logo.png';

interface HeroSectionProps { 
  isExpanded?: boolean; 
  onChatToggle?: () => void;
}

const videoThumbnails = [
  { id: 'ceo', title: 'CEO Testimonial', image: '/alex-president.png' },
  { id: 'board', title: 'Board Member', image: '/partner-testimonial.png' },
  { id: 'client', title: 'Happy Client', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' },
  { id: 'owner', title: 'Building Owner', image: '/lovable-uploads/84300188-bbb0-42e2-adda-fbe17d6590ae.png' }
];

export const HeroSection = ({ isExpanded = false, onChatToggle }: HeroSectionProps) => {
  const [showMeetButton, setShowMeetButton] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('EN');
  const [inputMessage, setInputMessage] = useState('');
  const { currentCard, closeCard, handleCardAction, getSolarAnalysis, showCard } = useIsabella('solarclip');
  const { 
    messages, 
    isProcessing, 
    isSpeakerEnabled, 
    isMicEnabled, 
    isListening,
    sendMessage, 
    sendGreeting,
    startListening,
    stopListening,
    toggleSpeaker, 
    toggleMicrophone,
    initializeAudio,
    narrate,
    didVideoUrl,
  } = useWellnessGeniChat();
  const journey = useIsabellaJourney({ narrate, showCard, getSolarAnalysis });
  
  const languages = ['EN', 'FR', 'DE', 'LB'];


  const handleMeetIsabella = async () => {
    console.log('Meet Isabella button clicked, current stage:', journey.stage, 'hasStarted:', journey.hasStarted);
    setShowMeetButton(false);
    await initializeAudio();
    onChatToggle?.(); // Show chat immediately when button is clicked
    
    // Start journey only if it hasn't been started yet
    if (journey.stage === 'idle' && !journey.hasStarted) {
      console.log('Starting Isabella journey...');
      await journey.start();
    } else {
      console.log('Journey already started, skipping duplicate start');
    }
  };
  const handleVideoThumbnail = (videoId: string) => {
    console.log(`Playing video: ${videoId}`);
    if (videoId === 'ceo') {
      showCard({
        type: 'video',
        title: 'CEO Testimonial',
        content: { url: 'https://res.cloudinary.com/di5gj4nyp/video/upload/v1758373486/Alex1.2_gqfcft.mov' },
        animation: 'swoop-left'
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    // Let journey intercept when appropriate (await the async handler)
    const intercepted = await journey.handleUserInput(inputMessage.trim());
    if (intercepted) {
      setInputMessage('');
      return;
    }
    await sendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-bg">

      {/* Language Toggle - Top Right Corner of Isabella's Image - Lifted 3mm up, 2mm right */}
      <div className="absolute top-5 right-6 z-50">
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
          <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight mb-6 tracking-wide" style={{ color: 'hsl(var(--heading-navy))' }}>
            The Future of
            <span className="block">Lightweight Solar</span>
            is Here.
          </h1>

          {/* Subheadline with Logo - Repositioned for vertical alignment */}
          <div className="relative mb-8" style={{ transform: 'translateY(-5mm)' }}>
            {/* Logo and first line on same horizontal level */}
            <div className="flex items-start gap-3 mb-2">
              <img 
                src={solarclipLogo}
                alt="SolarClip Lightweight Solutions"
                className="h-6 sm:h-7 lg:h-8 w-auto flex-shrink-0"
              />
              <div className="text-xl sm:text-2xl leading-relaxed" style={{ color: 'hsl(var(--body-gray))' }}>
                – the world's first clip-on / clip-off
              </div>
            </div>
            
            {/* Lines 2 and 3 positioned under the red circle of the logo */}
            <div className="text-xl sm:text-2xl leading-relaxed ml-8" style={{ color: 'hsl(var(--body-gray))' }}>
              <div className="mb-1">
                solar mounting system. <span className="font-semibold" style={{ color: 'hsl(var(--heading-navy))' }}>Fast. Reversible.</span>
              </div>
              <div>
                <span className="font-semibold" style={{ color: 'hsl(var(--heading-navy))' }}>Roof-safe.</span>
              </div>
            </div>
          </div>

          {/* Video Thumbnails with Curved Labels - Lifted by 2mm */}
          <div className="flex gap-6 flex-wrap justify-start" style={{ transform: 'translateY(-8mm)' }}>
            {videoThumbnails.map((video, index) => {
              const labels = ['President', 'Partner', 'Client', 'Developer'];
              return (
                <div key={video.id} className="video-thumbnail-container">
                  <div className="curved-text">
                    {labels[index]}
                  </div>
                  <div 
                    className="video-thumbnail-interactive-large"
                    onClick={() => handleVideoThumbnail(video.id)}
                    title={video.title}
                  >
                    <img 
                      src={video.image} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `
                          <div class="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                            ${video.title.charAt(0)}
                          </div>
                        `;
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column - Isabella Avatar - Lifted for better balance */}
        <div className="flex justify-center lg:justify-end items-center relative" style={{ transform: 'translateY(-8mm)' }}>
          <div className="relative">
            <IsabellaAvatar onChatToggle={onChatToggle} isExpanded={isExpanded} didVideoUrl={didVideoUrl} showInlineChat={false} />
            {showMeetButton && (
              <div className="absolute bottom-[-1px] -left-36 xl:-left-44 text-center z-10">
                <Button 
                  className="text-sm px-5 py-2 transition-all duration-300 hover:shadow-2xl hover:scale-110 text-white rounded-full relative overflow-hidden group start-assistant-enhanced"
                  style={{ 
                    backgroundColor: 'hsl(var(--cta-emerald))',
                    borderColor: 'hsl(var(--cta-emerald))',
                    transform: 'scale(0.88)',
                    boxShadow: '0 8px 25px hsl(160 84% 39% / 0.4), 0 0 20px hsl(160 84% 39% / 0.3)'
                  }}
                  onClick={handleMeetIsabella}
                >
                  <Play className="mr-2 w-5 h-5" />
                  Start Assistant
                </Button>
                 <p className="text-white/70 text-sm mt-2">Your AI guide to SolarClip™</p>
                </div>
             )}
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
            
            {/* Chat Messages Area - Auto-scroll to bottom for new messages */}
            <div 
              className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent"
              ref={(el) => {
                if (el && messages.length > 0) {
                  setTimeout(() => el.scrollTop = el.scrollHeight, 100);
                }
              }}
            >
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
                  onClick={isListening ? stopListening : () => startListening()}
                  disabled={!isMicEnabled || isProcessing}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {isListening ? 'Stop' : 'Voice Input'}
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
          onAction={(action, data) => { handleCardAction(action, data); journey.onCardAction(action, data); }}
        />
      )}

    </section>
  );
};