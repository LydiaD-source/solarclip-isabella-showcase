import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { usePerformanceMonitor } from './usePerformanceMonitor';
import { useWebSpeechRecognition } from './useWebSpeechRecognition';

export interface StreamingMessage {
  id: string;
  text: string;
  sender: 'user' | 'isabella';
  timestamp: Date;
  isStreaming?: boolean;
  audioUrl?: string;
  isPlaying?: boolean;
}

export const useStreamingChat = () => {
  const { toast } = useToast();
  const { startTimer, endTimer } = usePerformanceMonitor();
  
  // State management
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);
  
  // Speech recognition with Web Speech API
  const {
    isListening,
    transcript: speechTranscript,
    interimTranscript: liveTranscript,
    isSupported: webSpeechAvailable,
    startListening: startWebSpeech,
    stopListening: stopWebSpeech,
    resetTranscript,
  } = useWebSpeechRecognition(
    (result) => {
      if (result.isFinal && result.transcript.trim()) {
        console.log('[WebSpeech] Final result:', result.transcript);
        sendStreamingMessage(result.transcript.trim());
        resetTranscript();
      }
    },
    (error) => {
      console.error('[WebSpeech] Error:', error);
      // Only show error toast for serious errors, ignore "no-speech"
      if (error !== 'no-speech') {
        toast({
          title: "Speech Recognition Error",
          description: "There was an issue with speech recognition. Please try again.",
          variant: "destructive",
        });
      }
    }
  );
  
  // Audio states
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);
  
  // D-ID states
  const [didVideoUrl, setDidVideoUrl] = useState<string | null>(null);
  const [didQueue, setDidQueue] = useState<Array<{ text: string; priority: number }>>([]);
  const [isDidProcessing, setIsDidProcessing] = useState(false);
  
  // Refs for speech recognition
  const webSpeechRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamingTimeoutRef = useRef<NodeJS.Timeout>();
  const didAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Session management
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('isabella-streaming-session-id');
      if (saved) return saved;
    }
    const newId = `streaming_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isabella-streaming-session-id', newId);
    }
    return newId;
  });

  // Auto-send greeting when session starts (prevent duplicates across app)
  useEffect(() => {
    if (messages.length === 0) {
      if (typeof window !== 'undefined') {
        const w: any = window;
        if (w.__ISABELLA_GREETING_SENT) return;
        w.__ISABELLA_GREETING_SENT = true;
      }
      // Small delay to ensure proper initialization
      setTimeout(() => {
        sendStreamingMessage("Hello, I'm Isabella, a SolarClip ambassador at ClearNanoTech. I'd like to take you on a short visual journey to present our product, its features, applications, and how it compares to others. Would you like that? You can use the chat box to write your messages or activate your microphone to speak directly and I will do the same.");
      }, 200);
    }
  }, []);

  // Web Speech API is handled by the custom hook

  // Initialize audio context
  const initializeAudio = useCallback(async () => {
    if (!audioContext) {
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        setAudioContext(ctx);
        return ctx;
      } catch (error) {
        console.error('[Audio] Failed to initialize context:', error);
        return null;
      }
    }
    return audioContext;
  }, [audioContext]);

  // Stream LLM response with token-level updates
  const streamLLMResponse = useCallback(async (userMessage: string) => {
    startTimer('llm-streaming-total');
    
    try {
      // Create streaming message placeholder
      const streamingMessageId = `streaming_${Date.now()}`;
      const isabellaMessage: StreamingMessage = {
        id: streamingMessageId,
        text: '',
        sender: 'isabella',
        timestamp: new Date(),
        isStreaming: true,
      };
      
      setMessages(prev => [...prev, isabellaMessage]);
      setCurrentStreamingMessageId(streamingMessageId);
      setIsThinking(false); // Stop thinking when streaming starts
      
      // Call streaming endpoint
      const response = await fetch(`https://mzikfyqzwepnubdsclfd.functions.supabase.co/wellnessgeni-streaming`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aWtmeXF6d2VwbnViZHNjbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjYwOTAsImV4cCI6MjA3MzAwMjA5MH0.pU9K35VK1G2Zp6HATRAhaahMN-QWY_BSXjmtbXEIMrM`,
        },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          client_id: 'SolarClip',
          persona_id: 'solarclip',
          stream: true,
        }),
      });

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let sentenceBuffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const token = parsed.choices[0].delta.content;
                accumulatedText += token;
                sentenceBuffer += token;
                
                // Update UI immediately with each token
                setMessages(prev => prev.map(msg => 
                  msg.id === streamingMessageId 
                    ? { ...msg, text: accumulatedText }
                    : msg
                ));
                
                // Check if we have a complete sentence or enough content (optimized for speed)
                if ((/[.!?]\s*$/.test(sentenceBuffer.trim()) && sentenceBuffer.trim().length > 15) || 
                    sentenceBuffer.trim().length > 80) {
                  // Send to D-ID immediately for partial generation
                  const sentenceText = sentenceBuffer.trim();
                  console.log('[Streaming] Sending sentence to D-ID:', sentenceText);
                  
                  // Add to D-ID queue with priority based on order
                  setDidQueue(prev => [...prev, { 
                    text: sentenceText, 
                    priority: prev.length 
                  }]);
                  
                  sentenceBuffer = '';
                }
              }
            } catch (e) {
              console.warn('[Streaming] Failed to parse chunk:', e);
            }
          }
        }
      }
      
      // Send any remaining text to D-ID
      if (sentenceBuffer.trim()) {
        setDidQueue(prev => [...prev, { 
          text: sentenceBuffer.trim(), 
          priority: prev.length 
        }]);
      }
      
      // Mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, isStreaming: false, text: accumulatedText }
          : msg
      ));
      setCurrentStreamingMessageId(null);
      
      endTimer('llm-streaming-total');
      
    } catch (error) {
      console.error('[Streaming] LLM error:', error);
      setIsThinking(false);
      setCurrentStreamingMessageId(null);
      endTimer('llm-streaming-total');
    }
  }, [sessionId, startTimer, endTimer]);

  // Process D-ID queue with parallel generation
  useEffect(() => {
    if (didQueue.length > 0 && !isDidProcessing && isSpeakerEnabled) {
      processDidQueue();
    }
  }, [didQueue, isDidProcessing, isSpeakerEnabled]);

  const processDidQueue = useCallback(async () => {
    if (didQueue.length === 0 || isDidProcessing) return;
    
    setIsDidProcessing(true);
    const item = didQueue[0];
    
    try {
      console.log('[D-ID] Processing queue item:', item.text.slice(0, 50) + '...');
      startTimer(`did-generation-${item.priority}`);
      
      const { data, error } = await supabase.functions.invoke('did-avatar', {
        body: { 
          text: item.text, 
          source_url: 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg',
          fluent: false,
          auto_match: false,
        }
      });
      
      if (error) throw error;
      
      if (data?.talk_id) {
        // Start polling immediately
        pollDidTalkFast(data.talk_id, item.priority);
      }
      
    } catch (error) {
      console.error('[D-ID] Queue processing error:', error);
    } finally {
      // Remove processed item from queue
      setDidQueue(prev => prev.slice(1));
      setIsDidProcessing(false);
    }
  }, [didQueue, isDidProcessing, startTimer]);

  // Ultra-fast D-ID polling with immediate playback and error recovery
  const pollDidTalkFast = useCallback(async (talkId: string, priority: number) => {
    console.log('[D-ID] Starting ULTRA-FAST polling for:', talkId);
    
    for (let i = 0; i < 40; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('did-avatar', {
          body: { talk_id: talkId }
        });
        
        if (error) {
          console.error('[D-ID] Poll error:', error);
          // Skip failed polls quickly
          await new Promise(res => setTimeout(res, 50));
          continue;
        }
        
        if (data?.result_url) {
          console.log('[D-ID] Video ready in', i * 50, 'ms');
          endTimer(`did-generation-${priority}`);
          
          // Set video immediately for instant playback
          setDidVideoUrl(data.result_url);
          
          // Auto-hide after duration (with buffer)
          const hideDelay = Math.min((data.duration || 5) * 1000 + 500, 6000);
          setTimeout(() => {
            setDidVideoUrl(null);
          }, hideDelay);
          
          break;
        }
        
        if (data?.status === 'error') {
          console.error('[D-ID] Generation failed - retrying with fallback:', data);
          // Don't break on error, retry a few times
          if (i > 10) break;
        }
        
        // Ultra-aggressive polling: start at 50ms, gradually increase
        const delay = i < 3 ? 50 : i < 8 ? 100 : i < 15 ? 150 : 200;
        await new Promise(res => setTimeout(res, delay));
        
      } catch (error) {
        console.error('[D-ID] Polling error:', error);
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }, [endTimer]);

  // Enhanced speech-to-text with immediate feedback
  const startListening = useCallback(async () => {
    if (webSpeechAvailable) {
      startWebSpeech();
    } else {
      // Fallback to MediaRecorder for legacy browsers
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 24000, channelCount: 1 }
        });
        // Implement MediaRecorder fallback here if needed
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('[Speech] Error:', error);
      }
    }
  }, [webSpeechAvailable, startWebSpeech]);

  const stopListening = useCallback(() => {
    if (webSpeechAvailable) {
      stopWebSpeech();
    }
  }, [webSpeechAvailable, stopWebSpeech]);

  // Process audio to text using Whisper fallback
  const processAudioToText = useCallback(async () => {
    try {
      console.log('[Whisper] Processing audio chunks:', audioChunksRef.current.length);
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert to base64 for edge function
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];
          
          const { data, error } = await supabase.functions.invoke('speech-to-text', {
            body: { audio: base64Audio, mimeType: 'audio/webm' }
          });
          
          if (error) throw error;
          
          if (data?.text?.trim()) {
            console.log('[Whisper] Transcription:', data.text);
            sendStreamingMessage(data.text.trim());
          }
        } catch (error) {
          console.error('[Whisper] Processing error:', error);
        }
      };
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      console.error('[Whisper] Error:', error);
    }
  }, []);

  // Send message with immediate UI feedback and streaming response
  const sendStreamingMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;
    
    console.log('[Streaming] Sending message:', text);
    startTimer('total-response-time');
    
    // For Isabella's greeting, don't add as user message
    const isGreeting = text.includes("Hello, I'm Isabella");
    
    if (!isGreeting) {
      // Add user message immediately
      const userMessage: StreamingMessage = {
        id: `user_${Date.now()}`,
        text: text.trim(),
        sender: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    }
    
    setIsProcessing(true);
    setIsThinking(true); // Show thinking only briefly until streaming starts
    
    // Start streaming response immediately
    await streamLLMResponse(text.trim());
    
    setIsProcessing(false);
    endTimer('total-response-time');
  }, [isProcessing, streamLLMResponse, startTimer, endTimer]);

  // Manual message send
  const sendMessage = useCallback(async (text: string) => {
    await sendStreamingMessage(text);
  }, [sendStreamingMessage]);

  // Toggle functions
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => !prev);
  }, []);

  const toggleMicrophone = useCallback(() => {
    // For streaming chat, microphone is always available when Web Speech is supported
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    // State
    messages,
    isProcessing,
    isThinking,
    isListening,
    liveTranscript,
    isSpeakerEnabled,
    webSpeechAvailable,
    didVideoUrl,
    sessionId,
    
    // Actions
    sendMessage,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
    
    // Computed
    isMicEnabled: webSpeechAvailable || true, // Always show mic if we have fallback
  };
};