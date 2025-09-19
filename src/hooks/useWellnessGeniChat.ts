import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  audio?: string;
  isPlaying?: boolean;
}

export const useWellnessGeniChat = () => {
  const { toast } = useToast();
  // Initialize with empty messages - reset on each session
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
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
    // Reset session and start fresh each time
    setMessages([]);
    setDidVideoUrl(null);
    
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
    
    // Send initial greeting and get D-ID animation
    const sendInitialGreeting = async () => {
      const greeting = "Hello! I'm Isabella, your AI Solar Ambassador. I'm here to guide you through SolarClip™, the revolutionary clip-on solar mounting system. How can I help you today?";
      
      // Add greeting to chat
      const greetingMessage: ChatMessage = {
        id: Date.now().toString(),
        text: greeting,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages([greetingMessage]);
      
      // Get D-ID animation for greeting
      try {
        const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
          body: { text: greeting }
        });
        
        if (didError) {
          console.error('D-ID error:', didError);
        } else if (didData?.talk_id) {
          // Poll for video result
          pollDidVideo(didData.talk_id);
        }
      } catch (error) {
        console.error('Failed to create D-ID animation:', error);
      }
      
      // Narrate the greeting
      if (isSpeakerEnabled) {
        narrate(greeting);
      }
    };
    
    setTimeout(sendInitialGreeting, 1000);
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
    
    try {
      const ctx = await initializeAudio();
      if (!ctx) return;

      // Stop any currently playing audio
      if (currentSource) {
        currentSource.stop();
        setCurrentSource(null);
      }

      // Decode base64 audio
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
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

  const narrate = useCallback(async (text: string) => {
    if (!isSpeakerEnabled || !text.trim()) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: text,
          voice_id: 't0IcnDolatli2xhqgLgn'
        }
      });

      if (error) {
        console.error('TTS error:', error);
        return;
      }

      if (data?.audio) {
        await playAudio(data.audio);
      }
    } catch (error) {
      console.error('Error in narrate:', error);
    }
  }, [isSpeakerEnabled, playAudio]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Duplicate prevention
    const now = Date.now();
    const recent = lastSentRef.current;
    if (recent && recent.text === trimmed && (now - recent.time) < 2000) {
      console.log('Duplicate message detected, skipping');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '_user',
      text: trimmed,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

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

      let responseText = typeof chatData?.response === 'string' ? chatData.response : 
                         typeof chatData?.text === 'string' ? chatData.text : '';
      
      if (!responseText || !responseText.trim()) {
        throw new Error('Empty response from chat API');
      }

      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella',
        text: responseText,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, isabellaMessage]);

      // Always create D-ID animation for Isabella's response
      try {
        console.log('[D-ID] Creating animation for response');
        const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
          body: { text: responseText }
        });

        if (didError) {
          console.error('[D-ID] error', didError);
        } else if (didData?.talk_id) {
          console.log('[D-ID] talk created:', didData.talk_id);
          // Start polling for video completion
          pollDidVideo(didData.talk_id);
        }
      } catch (error) {
        console.error('[D-ID] Failed to create animation:', error);
      }

      // Generate speech with ElevenLabs if speaker is enabled
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
            return;
          }

          if (ttsData?.audio) {
            console.log('[TTS] got audio, playing...');
            // Play audio through standard audio system
            await playAudio(ttsData.audio);
          }
        } catch (error) {
          console.error('Error with TTS:', error);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        text: 'I\'m sorry, I encountered an error. Please try again.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [messages, sessionId, isSpeakerEnabled, playAudio]);

  const pollDidVideo = useCallback(async (talkId: string, maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const { data, error } = await supabase.functions.invoke('did-avatar', {
          body: { talk_id: talkId }
        });

        if (error) {
          console.error(`[D-ID] poll attempt ${i + 1} error:`, error);
          continue;
        }

        if (data?.status === 'done' && data?.result_url) {
          console.log('[D-ID] video ready:', data.result_url);
          setDidVideoUrl(data.result_url);
          break;
        } else if (data?.status === 'error') {
          console.error('[D-ID] video generation failed:', data);
          break;
        }

        console.log(`[D-ID] poll attempt ${i + 1}: ${data?.status || 'unknown'}`);
      } catch (error) {
        console.error(`[D-ID] poll attempt ${i + 1} exception:`, error);
      }
    }
  }, []);

  const processVoiceInput = useCallback(async (audioBlob: Blob) => {
    console.log('Processing voice input, blob size:', audioBlob.size);
    
    try {
      // Add processing message
      const processingMessage: ChatMessage = {
        id: Date.now().toString() + '_processing',
        text: '🎤 Processing voice input...',
        sender: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, processingMessage]);

      // Send audio blob as multipart/form-data to Supabase Edge Function
      const formData = new FormData();
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
      formData.append('file', audioBlob, `voice-input.${ext}`);

      // Invoke via direct fetch with multipart/form-data (functions.invoke doesn't reliably handle FormData)
      const resp = await fetch('https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aWtmeXF6d2VwbnViZHNjbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjYwOTAsImV4cCI6MjA3MzAwMjA5MH0.pU9K35VK1G2Zp6HATRAhaahMN-QWY_BSXjmtbXEIMrM',
          'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aWtmeXF6d2VwbnViZHNjbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjYwOTAsImV4cCI6MjA3MzAwMjA5MH0.pU9K35VK1G2Zp6HATRAhaahMN-QWY_BSXjmtbXEIMrM',
        },
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('Speech-to-text error:', resp.status, errText);
        throw new Error(`Speech-to-text failed: ${resp.status} - ${errText}`);
      }

      const sttData = await resp.json();

      console.log('Speech-to-text result:', sttData);

      // Remove processing message
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));

      if (sttData?.text && sttData.text.trim()) {
        const transcribedText = sttData.text.trim();
        console.log('Transcribed text:', transcribedText);
        
        // Add user message with clean transcribed text (no emoji prefix)
        const userMessage: ChatMessage = {
          id: Date.now().toString() + '_user',
          text: transcribedText,
          sender: 'user',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Send transcribed text as a message (this will get Isabella's response)
        await sendMessage(transcribedText);
      } else {
        const noSpeechMessage: ChatMessage = {
          id: Date.now().toString() + '_no_speech',
          text: 'I couldn\'t understand what you said. Please try speaking clearly or use the text input.',
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, noSpeechMessage]);
      }

    } catch (error) {
      console.error('Error processing speech to text:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_speech_error',
        text: 'Sorry, I had trouble processing your voice input. Please try speaking again or use the text input.',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [sendMessage]);

  const startListening = useCallback(async () => {
    if (!isMicEnabled) return;
    
    setIsListening(true);
    
    try {
      // Get user media for microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Create MediaRecorder with best available format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (audioBlob.size > 0) {
          await processVoiceInput(audioBlob);
        }
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        setIsListening(false);
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Auto-stop after 5 seconds for better UX
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
      
      toast({
        title: "Microphone Access",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [isMicEnabled, processVoiceInput, toast]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => !prev);
    if (currentSource) {
      currentSource.stop();
      setCurrentSource(null);
    }
  }, [currentSource]);

  const toggleMicrophone = useCallback(() => {
    setIsMicEnabled(prev => !prev);
    if (isListening) {
      stopListening();
    }
  }, [isListening, stopListening]);

  const sendGreeting = useCallback(async () => {
    // Global guard to avoid duplicate greetings (React StrictMode mounts, route remounts)
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__ISABELLA_GREETING_SENT) return; // already sent this page load
      w.__ISABELLA_GREETING_SENT = true;
    }
    if (greetingSentRef.current) return;
    greetingSentRef.current = true;
    
    console.log('[Isabella] Sending automated greeting');
    // This will send the greeting and get Isabella's response automatically
    await sendMessage("Hello, I'm Isabella, a SolarClip ambassador at ClearNanoTech. I'd like to take you on a short visual journey to present our product, its features, applications, and how it compares to others. Would you like that? You can use the chat box to write your messages or activate your microphone to speak directly and I will do the same.");
  }, [sendMessage]);

  return {
    messages,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    audioContext,
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