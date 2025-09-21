import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Mic, Volume2, VolumeX, MicOff } from 'lucide-react';
import { useStreamingChat } from '@/hooks/useStreamingChat';

interface StreamingChatBoxProps {
  isExpanded: boolean;
  className?: string;
}

export const StreamingChatBox: React.FC<StreamingChatBoxProps> = ({ 
  isExpanded, 
  className = "" 
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isProcessing,
    isThinking,
    isListening,
    liveTranscript,
    isSpeakerEnabled,
    isMicEnabled,
    webSpeechAvailable,
    sendMessage,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
  } = useStreamingChat();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, liveTranscript]);

  // Update live transcript in input box for real-time feedback
  useEffect(() => {
    if (liveTranscript && isListening) {
      setInputMessage(liveTranscript);
    } else if (!isListening && liveTranscript) {
      // Keep transcript when listening stops but don't clear it immediately
      setInputMessage(liveTranscript);
    }
  }, [liveTranscript, isListening]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    await sendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isExpanded) return null;

  return (
    <div className={`w-[88vw] max-w-[340px] sm:w-[320px] lg:w-[320px] h-[420px] sm:h-[440px] bg-background/90 backdrop-blur-md border-2 border-accent/30 rounded-2xl shadow-premium flex flex-col overflow-hidden chatbox-glow ${className}`}>
      {/* Enhanced Chat Header */}
      <div className="flex justify-between items-center p-4 border-b border-accent/20">
        <div className="flex flex-col">
          <h3 className="text-white font-medium">Isabella AI Assistant</h3>
          <div className="text-xs text-white/60 mt-1">
            {webSpeechAvailable ? 'Real-time voice enabled' : 'Voice transcription available'}
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleSpeaker}
            className={`text-white/60 hover:text-white hover:bg-white/10 p-2 ${isSpeakerEnabled ? 'text-white' : 'text-white/40'}`}
            title={isSpeakerEnabled ? 'Audio enabled' : 'Audio disabled'}
          >
            {isSpeakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleMicrophone}
            className={`text-white/60 hover:text-white hover:bg-white/10 p-2 relative ${
              isListening ? 'text-red-400 animate-pulse bg-red-500/20' : 
              isMicEnabled ? 'text-white' : 'text-white/40'
            }`}
            title={isListening ? 'Listening...' : isMicEnabled ? 'Microphone ready' : 'Microphone disabled'}
          >
            {isListening ? <Mic className="w-4 h-4" /> : 
             isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {isListening && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
            )}
          </Button>
        </div>
      </div>
      
      {/* Messages Area with Streaming Support */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-lg max-w-[80%] text-sm ${
              message.sender === 'user' 
                ? 'bg-primary/20 text-white' 
                : 'bg-accent/20 text-white'
            }`}>
              <div className="relative">
                {message.text}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-white/60 ml-1 animate-pulse"></span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Live transcript display for real-time feedback */}
        {liveTranscript && (
          <div className="flex justify-end">
            <div className="bg-primary/10 border border-primary/30 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
              <div className="flex items-center gap-2">
                <Mic className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-white/80">{liveTranscript}</span>
                <span className="inline-block w-1 h-3 bg-primary animate-pulse"></span>
              </div>
            </div>
          </div>
        )}
        
        {/* Thinking indicator with enhanced animation */}
        {isThinking && !liveTranscript && (
          <div className="flex justify-start">
            <div className="bg-accent/20 text-white px-4 py-2 rounded-lg max-w-[80%] text-sm">
              <div className="flex items-center gap-2">
                <div>Isabella is thinking...</div>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Enhanced Input Area with Real-time Features */}
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
        
        {/* Quick Action Buttons */}
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
        
        {/* Voice Interface with Enhanced Feedback */}
        <div className="flex gap-2 mt-3 pt-2 border-t border-accent/20">
          <Button 
            size="sm" 
            className={`backdrop-blur-sm border text-white hover:bg-white/20 flex-1 relative ${
              isListening 
                ? 'bg-red-500/30 border-red-400/50 animate-pulse' 
                : 'bg-white/10 border-white/20'
            }`}
            onClick={handleVoiceToggle}
            disabled={!isMicEnabled || isProcessing}
          >
            <Mic className="w-4 h-4 mr-2" />
            {isListening ? 'Stop Recording' : webSpeechAvailable ? 'Voice Input' : 'Record Audio'}
            {isListening && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
            )}
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
        
        {/* Real-time Status Bar */}
        {(isListening || liveTranscript) && (
          <div className="mt-2 pt-2 border-t border-accent/10">
            <div className="flex items-center gap-2 text-xs text-white/60">
              {webSpeechAvailable ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Real-time transcription active
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    Recording for transcription
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};