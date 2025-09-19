import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'isabella';
  timestamp: Date;
  audio?: string;
  isPlaying?: boolean;
}

export const useWellnessGeniChat = () => {
  const { toast } = useToast();
  // Initialize messages from sessionStorage to prevent conversation resets
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('isabella-chat-messages');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        }
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    }
    return [];
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('isabella-session-id');
      if (saved) return saved;
    }
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isabella-session-id', newId);
    }
    return newId;
  });
  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);
  const lastSentRef = useRef<{ text: string; time: number } | null>(null);
  const greetingSentRef = useRef(false);
  const [didVideoUrl, setDidVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const pollDidTalk = useCallback(async (talkId: string) => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < 30; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('did-avatar', {
          body: { talk_id: talkId }
        });
        if (error) {
          console.error('[D-ID] poll error', error);
          await delay(1000);
          continue;
        }
        if (data?.result_url) {
          setDidVideoUrl(data.result_url);
          // Auto-hide after 15s
          setTimeout(() => setDidVideoUrl(null), 15000);
          break;
        }
        if (data?.status === 'error') {
          console.error('[D-ID] poll status error', data);
          break;
        }
        await delay(1000);
      } catch (e) {
        console.error('[D-ID] poll exception', e);
        await delay(1000);
      }
    }
  }, []);

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

    setMessages(prev => {
      const updated = [...prev, userMessage];
      // Persist to sessionStorage to prevent conversation resets
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving messages:', error);
        }
      }
      return updated;
    });
    setIsProcessing(true);
    lastSentRef.current = { text: trimmed, time: now };

    try {
      // Send to WellnessGeni via Supabase edge function with Isabella Navia persona
      // Include prior chat history so upstream has full context
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const payload = {
        message: text,
        persona_id: 'solarclip', // Maps to Isabella Navia - ClearNanoTech Ambassador
        client_id: 'SolarClip',
        session_id: sessionId,
        messages: history,
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
        throw new Error('Empty response from chat API');
      }

      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella',
        text: responseText,
        sender: 'isabella',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, isabellaMessage];
        // Persist to sessionStorage to prevent conversation resets
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
          } catch (error) {
            console.error('Error saving messages:', error);
          }
        }
        return updated;
      });

      // Generate speech with ElevenLabs + D-ID animation
      if (isSpeakerEnabled && responseText.trim()) {
        try {
          console.log('[TTS] request → elevenlabs-tts');
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
            body: {
              text: responseText,
              voice_id: 't0IcnDolatli2xhqgLgn' // Isabella Navia voice
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
              if (didData?.talk_id) {
                try { await pollDidTalk(didData.talk_id); } catch (e) { console.error('[D-ID] poll start error', e); }
              }
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
      // Do not inject a static fallback message; rely on logs/UX to show failure state
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isSpeakerEnabled, playAudio, messages, sessionId]);

  const startListening = useCallback(async () => {
    if (!isMicEnabled || isListening) return;
    
    try {
      setIsListening(true);
      
      // Try starting SpeechRecognition for quicker transcript
      if (recognition) {
        try {
          recognition.start();
          console.log('SpeechRecognition started');
        } catch (e) {
          console.warn('SpeechRecognition start failed:', e);
        }
      }
      
      // Enhanced microphone access with better error handling
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Microphone access granted successfully');
      
      // Reset audio chunks
      audioChunksRef.current = [];

      // Enhanced MediaRecorder with better format detection
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=pcm', 
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      let mimeType = 'audio/webm';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing audio...');
        setIsListening(false);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          await processAudioToText();
        } else {
          console.warn('No audio chunks recorded');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setIsListening(false);
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      console.log('Started voice recording with mime type:', mimeType);

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('Auto-stopping recording after 10 seconds');
          mediaRecorderRef.current.stop();
        }
      }, 10000);

    } catch (error) {
      console.error('Error starting voice input:', error);
      setIsListening(false);
      
      // Enhanced error message with specific guidance
      let errorText = 'Sorry, I couldn\'t access your microphone. ';
      if (error.name === 'NotAllowedError') {
        errorText += 'Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorText += 'No microphone found. Please check your device.';
      } else {
        errorText += 'Please check your browser permissions and try again.';
      }
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_mic_error',
        text: errorText,
        sender: 'isabella',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, errorMessage];
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
          } catch (error) {
            console.error('Error saving messages:', error);
          }
        }
        return updated;
      });
    }
  }, [isMicEnabled, isListening, recognition]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const processAudioToText = useCallback(async () => {
    try {
      console.log('Processing audio chunks:', audioChunksRef.current.length);
      
      if (audioChunksRef.current.length === 0) {
        console.warn('No audio chunks to process');
        return;
      }
      
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0]?.type || 'audio/webm' 
      });
      
      console.log('Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Using direct FormData upload to edge function; base64 conversion removed

      // Add processing message to UI
      const processingMessage: ChatMessage = {
        id: Date.now().toString() + '_processing',
        text: '🎤 Processing your voice...',
        sender: 'isabella',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, processingMessage];
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
          } catch (error) {
            console.error('Error saving messages:', error);
          }
        }
        return updated;
      });

      // Send audio blob as multipart/form-data to Supabase Edge Function
      const formData = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
      formData.append('file', audioBlob, `voice-input.${ext}`);

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: formData,
      });

      if (error) {
        console.error('Speech-to-text error:', error);
        throw new Error(error.message || 'Speech-to-text failed');
      }

      console.log('Speech-to-text result:', data);

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      if (data?.text && data.text.trim()) {
        const transcribedText = data.text.trim();
        console.log('Transcribed text:', transcribedText);
        
        // Add user message with clean transcribed text (no emoji prefix)
        const userMessage: ChatMessage = {
          id: Date.now().toString() + '_user',
          text: transcribedText,
          sender: 'user',
          timestamp: new Date(),
        };
        setMessages(prev => {
          const updated = [...prev, userMessage];
          // Persist to sessionStorage to prevent conversation resets
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
            } catch (error) {
              console.error('Error saving messages:', error);
            }
          }
          return updated;
        });
        
        // Send transcribed text as a message (this will get Isabella's response)
        await sendMessage(transcribedText);
      } else {
        const noSpeechMessage: ChatMessage = {
          id: Date.now().toString() + '_no_speech',
          text: 'I couldn\'t understand what you said. Please try speaking clearly or use the text input.',
          sender: 'isabella',
          timestamp: new Date(),
        };
        setMessages(prev => {
          const updated = [...prev, noSpeechMessage];
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
            } catch (error) {
              console.error('Error saving messages:', error);
            }
          }
          return updated;
        });
      }

    } catch (error) {
      console.error('Error processing speech to text:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_speech_error',
        text: 'Sorry, I had trouble processing your voice input. Please try speaking again or use the text input.',
        sender: 'isabella',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, errorMessage];
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
          } catch (error) {
            console.error('Error saving messages:', error);
          }
        }
        return updated;
      });
    }
  }, [sendMessage]);

  const sendGreeting = useCallback(async () => {
    // Global guard to avoid duplicate greetings (React StrictMode mounts, route remounts)
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__ISABELLA_GREETING_SENT) return; // already sent this page load
      w.__ISABELLA_GREETING_SENT = true;
    }
    if (greetingSentRef.current) return;
    greetingSentRef.current = true;
    
    // Use the structured journey greeting text
    const greetingText = "Hello, I'm Isabella, a SolarClip ambassador at ClearNanoTech. I'd like to take you on a short visual journey to present our product, its features, applications, and how it compares to others. Would you like that? You can use the chat box to write your messages or activate your microphone to speak directly and I will do the same.";
    
    // Add greeting message to UI
    const isabellaMessage: ChatMessage = {
      id: Date.now().toString() + '_greeting',
      text: greetingText,
      sender: 'isabella',
      timestamp: new Date(),
    };
    setMessages(prev => {
      const updated = [...prev, isabellaMessage];
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving messages:', error);
        }
      }
      return updated;
    });

    // Generate speech with ElevenLabs immediately
    if (isSpeakerEnabled) {
      try {
        console.log('[TTS] request → elevenlabs-tts (greeting)');
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
          body: {
            text: greetingText,
            voice_id: 't0IcnDolatli2xhqgLgn' // Isabella Navia voice
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
              if (didData?.talk_id) {
                try { await pollDidTalk(didData.talk_id); } catch (e) { console.error('[D-ID] poll start error', e); }
              }
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
      // Request microphone permission and immediately start listening
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicEnabled(true);
        await startListening();
      } catch (error) {
        console.error('Microphone permission denied:', error);
      }
    } else {
      setIsMicEnabled(false);
      if (isListening) {
        stopListening();
      }
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
    }
  }, [isMicEnabled, isListening, recognition, startListening, stopListening]);

  // Fallback narrate to ensure journey can always speak
  const narrate = useCallback(async (text: string) => {
    const isabellaMessage: ChatMessage = {
      id: Date.now().toString() + '_narrate_min',
      text,
      sender: 'isabella',
      timestamp: new Date(),
    };
    setMessages(prev => {
      const updated = [...prev, isabellaMessage];
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving messages:', error);
        }
      }
      return updated;
    });

    if (!isSpeakerEnabled || !text.trim()) return;
    try {
      const { data } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, voice_id: 't0IcnDolatli2xhqgLgn' }
      });
      if (data?.audio) {
        await playAudio(data.audio);
      }
    } catch (e) {
      console.error('[TTS] narrate fallback error', e);
    }
  }, [isSpeakerEnabled, playAudio]);

  return {
    messages,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    didVideoUrl,
    sendMessage,
    sendGreeting,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
    narrate,
  };
};