import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'isabella';
  timestamp: Date;
  audio?: string;
  isPlaying?: boolean;
}

export const useWellnessGeniChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  // Initialize audio context and speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';
        
        recognitionInstance.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          sendMessage(transcript);
          setIsListening(false);
        };
        
        recognitionInstance.onerror = () => {
          setIsListening(false);
        };
        
        recognitionInstance.onend = () => {
          setIsListening(false);
        };
        
        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const initializeAudio = useCallback(async () => {
    if (!audioContext) {
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        setAudioContext(ctx);
        return ctx;
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        return null;
      }
    }
    return audioContext;
  }, [audioContext]);

  const playAudio = useCallback(async (base64Audio: string) => {
    if (!isSpeakerEnabled) return;
    
    const ctx = await initializeAudio();
    if (!ctx) return;

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [isSpeakerEnabled, initializeAudio]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Send to WellnessGeni via Supabase edge function with Isabella Navia persona
      const payload = {
        message: text,
        persona_id: 'SolarClip', // Isabella Navia - ClearNanoTech Ambassador
        client_id: 'SolarClip',
        session_id: `session_${Date.now()}`,
        context: {
          product: 'SolarClip',
          company: 'ClearNanoTech',
          persona_name: 'Isabella Navia',
          persona_role: 'ClearNanoTech Ambassador & SolarClip Product Promoter',
          max_response_duration: '15_seconds',
          tone: 'polite_professional_enthusiastic_concise',
          focus: 'SolarClip_products_solutions_lead_generation',
        },
      };

      console.log('[WellnessGeni] request → wellnessgeni-chat', payload);
      const { data: chatData, error: chatError } = await supabase.functions.invoke('wellnessgeni-chat', {
        body: payload,
      });

      if (chatError) {
        console.error('[WellnessGeni] error', chatError);
        throw chatError;
      }

      console.log('[WellnessGeni] response', chatData);

      if (chatError) throw chatError;

      const responseText = chatData.text || "I'm here to help with SolarClip questions.";
      
      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella',
        text: responseText,
        sender: 'isabella',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, isabellaMessage]);

      // Generate speech if speaker is enabled
      if (isSpeakerEnabled) {
        try {
          console.log('[TTS] request → elevenlabs-tts');
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
            body: {
              text: responseText,
              voice_id: '9BWtsMINqrJLrRacOk9x' // Aria voice
            }
          });

          if (ttsError) {
            console.error('[TTS] error', ttsError);
          }

          if (ttsData?.audio) {
            console.log('[TTS] playing audio');
            await playAudio(ttsData.audio);
          }
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        text: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        sender: 'isabella',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isSpeakerEnabled, playAudio]);

  const startListening = useCallback(() => {
    if (recognition && isMicEnabled && !isListening) {
      setIsListening(true);
      recognition.start();
    }
  }, [recognition, isMicEnabled, isListening]);

  const sendGreeting = useCallback(async () => {
    // Send Isabella Navia's personalized SolarClip greeting
    await sendMessage("Hello! I'm Isabella Navia, ambassador for SolarClip™. I can show you how our lightweight, clip-on solar panels can save you time and money on your roof project. May I know your business address to show you an interactive map?");
  }, [sendMessage]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => !prev);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!isMicEnabled) {
      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicEnabled(true);
      } catch (error) {
        console.error('Microphone permission denied:', error);
      }
    } else {
      setIsMicEnabled(false);
      if (isListening && recognition) {
        recognition.stop();
      }
    }
  }, [isMicEnabled, isListening, recognition]);

  return {
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
  };
};