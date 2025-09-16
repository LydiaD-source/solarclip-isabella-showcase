import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);
  const lastSentRef = useRef<{ text: string; time: number } | null>(null);
  const greetingSentRef = useRef(false);

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
      // Stop any currently playing source before starting a new one
      if (currentSource) {
        try { currentSource.stop(); } catch {}
      }
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setCurrentSource(null);
      };
      setCurrentSource(source);
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [isSpeakerEnabled, initializeAudio, currentSource]);

  const stopAudio = useCallback(() => {
    if (currentSource) {
      try { currentSource.stop(); } catch {}
      setCurrentSource(null);
    }
  }, [currentSource]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const now = Date.now();
    const trimmed = text.trim();
    if (lastSentRef.current && lastSentRef.current.text === trimmed && now - lastSentRef.current.time < 30000) {
      console.log('Deduped repeated message');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    lastSentRef.current = { text: trimmed, time: now };

    try {
      // Send to WellnessGeni via Supabase edge function with Isabella Navia persona
      const payload = {
        message: text,
        persona_id: 'solarclip', // Maps to Isabella Navia - ClearNanoTech Ambassador
        client_id: 'SolarClip',
        session_id: sessionId,
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

      let responseText = typeof chatData?.response === 'string' ? chatData.response : 
                          typeof chatData?.text === 'string' ? chatData.text : '';
      
      if (!responseText || !responseText.trim()) {
        responseText = "Hi — I’m Isabella Navia, ClearNanoTech ambassador for SolarClip™. Ask me anything about SolarClip’s clip-on solar panels, installation, pricing, or roof suitability.";
      }
      
      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella',
        text: responseText,
        sender: 'isabella',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, isabellaMessage]);

      // Generate speech with ElevenLabs + D-ID animation
      if (isSpeakerEnabled && responseText.trim()) {
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
            // Fallback: animate with D-ID using text so the avatar still responds
            try {
              const { error: didErr } = await supabase.functions.invoke('did-avatar', {
                body: { text: responseText }
              });
              if (didErr) console.error('[D-ID] fallback (text) error', didErr);
            } catch (e) {
              console.error('[D-ID] fallback (text) exception', e);
            }
            return;
          }

          if (ttsData?.audio) {
            console.log('[TTS] got audio, sending to D-ID for animation');
            
            // Send audio to D-ID for avatar animation
            try {
              const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                body: {
                  audio_base64: ttsData.audio
                }
              });

              if (didError) {
                console.error('[D-ID] error', didError);
                // Fallback to just playing audio without animation
                await playAudio(ttsData.audio);
                return;
              }

              console.log('[D-ID] animation created:', didData);
              // Play the ElevenLabs audio directly while D-ID handles animation
              await playAudio(ttsData.audio);
              
            } catch (didError) {
              console.error('D-ID animation error:', didError);
              // Fallback to just playing audio
              await playAudio(ttsData.audio);
            }
          }
        } catch (error) {
          console.error('Speech synthesis error:', error);
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
    // Global guard to avoid duplicate greetings (React StrictMode mounts, route remounts)
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__ISABELLA_GREETING_SENT) return; // already sent this page load
      w.__ISABELLA_GREETING_SENT = true;
    }
    if (greetingSentRef.current) return;
    greetingSentRef.current = true;
    
    // Play Isabella's greeting directly with ElevenLabs voice
    const greetingText = "Hello! I'm Isabella Navia, ambassador for SolarClip™. I can show you how our lightweight, clip-on solar panels can save you time and money on your roof project. May I know your business address to show you an interactive map?";
    
    // Add greeting message to UI
    const isabellaMessage: ChatMessage = {
      id: Date.now().toString() + '_greeting',
      text: greetingText,
      sender: 'isabella',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, isabellaMessage]);

    // Generate speech with ElevenLabs immediately
    if (isSpeakerEnabled) {
      try {
        console.log('[TTS] request → elevenlabs-tts (greeting)');
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
          body: {
            text: greetingText,
            voice_id: '9BWtsMINqrJLrRacOk9x' // Aria voice
          }
        });

        if (ttsError) {
          console.error('[TTS] error', ttsError);
          // Fallback: animate with D-ID using text so the avatar still responds
          try {
            const { error: didErr } = await supabase.functions.invoke('did-avatar', {
              body: { text: greetingText }
            });
            if (didErr) console.error('[D-ID] greeting fallback (text) error', didErr);
          } catch (e) {
            console.error('[D-ID] greeting fallback (text) exception', e);
          }
          return;
        }

        if (ttsData?.audio) {
          console.log('[TTS] got greeting audio, sending to D-ID for animation');
          
          // Send audio to D-ID for avatar animation
          try {
            const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
              body: {
                audio_base64: ttsData.audio
              }
            });

            if (didError) {
              console.error('[D-ID] greeting error', didError);
            } else {
              console.log('[D-ID] greeting animation created:', didData);
            }
          } catch (didError) {
            console.error('D-ID greeting animation error:', didError);
          }

          // Play the ElevenLabs audio directly
          console.log('[TTS] playing greeting audio');
          await playAudio(ttsData.audio);
        }
      } catch (error) {
        console.error('Greeting speech synthesis error:', error);
      }
    }
  }, [isSpeakerEnabled, playAudio, setMessages]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => {
      const next = !prev;
      if (!next) {
        // Stop any ongoing audio immediately when disabling speaker
        stopAudio();
      }
      return next;
    });
  }, [stopAudio]);

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