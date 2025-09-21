import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { usePerformanceMonitor } from './usePerformanceMonitor';

// D-ID source image to animate (same as the website avatar)
const DID_SOURCE_URL = 'https://res.cloudinary.com/di5gj4nyp/image/upload/v1747229179/isabella_assistant_cfnmc0.jpg';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'isabella';
  timestamp: Date;
  audio?: string;
  isPlaying?: boolean;
}

export const useWellnessGeniChat = () => {
  // Temporary flag: disable ElevenLabs TTS while credits are exhausted.
  // Set to true to re-enable without touching rest of the flow.
  const USE_ELEVENLABS_TTS = false;
  const { toast } = useToast();
  // Fresh messages on each page load for clean journey flow
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  
  // Performance monitoring
  const { startTimer, endTimer } = usePerformanceMonitor();
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
  
  // D-ID Animation State Management
  const [isDidProcessing, setIsDidProcessing] = useState(false);
  const [didQueue, setDidQueue] = useState<string[]>([]);
  
  const didVideoObjectUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const didAudioRef = useRef<HTMLAudioElement | null>(null);
  // Queue for parallel D-ID sentence clips
  const didClipQueueRef = useRef<{ url: string; duration: number }[]>([]);
  const didPlayingRef = useRef(false);
  const didNextIndexRef = useRef(0);

  // Initialize Web Speech API for real-time transcription
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isWebSpeechActive, setIsWebSpeechActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialize Web Speech API for real-time transcription
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true; // Real-time continuous recognition
        recognitionInstance.interimResults = true; // Show words as user speaks
        recognitionInstance.lang = 'en-US';
        
        recognitionInstance.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Show live transcript in input box
          setLiveTranscript(interimTranscript || finalTranscript);
          
          // Send final transcript
          if (finalTranscript.trim()) {
            console.log('Final transcript:', finalTranscript);
            sendMessage(finalTranscript);
            setLiveTranscript('');
            setIsListening(false);
            setIsWebSpeechActive(false);
          }
        };
        
        recognitionInstance.onerror = (event) => {
          console.log('Speech recognition error:', event.error);
          setIsListening(false);
          setIsWebSpeechActive(false);
          setLiveTranscript('');
        };
        
        recognitionInstance.onend = () => {
          setIsListening(false);
          setIsWebSpeechActive(false);
          setLiveTranscript('');
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

  // Play audio from a direct URL (e.g., D-ID audio_url)
  const playDidAudio = useCallback(async (url: string) => {
    try {
      if (didAudioRef.current) {
        try { didAudioRef.current.pause(); } catch {}
        didAudioRef.current = null;
      }
      console.log('[D-ID] proxying audio via edge function');
      const { data, error } = await supabase.functions.invoke('did-avatar', {
        body: { proxy_url: url, media_type: 'audio' }
      });
      if (error) throw error;
      if (!data?.base64) throw new Error('No proxied audio data');
      // Decode base64 to Blob
      const binary = atob(data.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);

      const audio = new Audio();
      audio.src = objectUrl;
      audio.crossOrigin = 'anonymous';
      didAudioRef.current = audio;

      await audio.play();
      audio.onended = () => {
        if (didAudioRef.current && didAudioRef.current.src === objectUrl) {
          didAudioRef.current = null;
        }
        try { URL.revokeObjectURL(objectUrl); } catch {}
      };
    } catch (e) {
      console.error('[D-ID] audio playback error', e);
    }
  }, []);

  const pollDidTalk = useCallback(async (talkId: string, shouldShowMessage = true) => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    console.log('[D-ID] Starting ULTRA-FAST poll for talk:', talkId);
    
    // REAL-TIME OPTIMIZATION: Sub-second polling for immediate response
    for (let i = 0; i < 60; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('did-avatar', {
          body: { talk_id: talkId }
        });
        if (error) {
          console.error('[D-ID] poll error', error);
          await delay(100); // Ultra-aggressive polling
          continue;
        }
        
        // SPEED: Ultra-aggressive polling - 100-200ms for real-time feel
        const pollInterval = i < 10 ? 100 : i < 20 ? 150 : 200;
        console.log('[D-ID] poll #' + i, { status: data?.status, hasResultUrl: !!data?.result_url, nextPoll: pollInterval });

        // IMMEDIATE PLAYBACK: Start video as soon as result_url is available
        if (data?.result_url) {
          console.log('[D-ID] Video ready - INSTANT playback');
          setDidVideoUrl(data.result_url);
          if (shouldShowMessage) {
            setIsThinking(false);
          }
          
          // FAST CYCLE: Quick auto-hide for rapid conversation flow
          const hideDelay = Math.min((data.duration || 5) * 1000 + 1000, 15000);
          setTimeout(() => {
            console.log('[D-ID] Auto-hiding video after', hideDelay/1000, 's');
            setDidVideoUrl(null);
          }, hideDelay);
          break;
        }
        if (data?.status === 'error') {
          console.error('[D-ID] poll status error', data);
          if (shouldShowMessage) setIsThinking(false);
          break;
        }
        
        await delay(pollInterval);
      } catch (e) {
        console.error('[D-ID] poll exception', e);
        await delay(100);
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

    // PERFORMANCE TRACKING: Start total user-to-response timer
    const totalTimer = startTimer('user-to-response-total');
    
    const now = Date.now();
    const trimmed = text.trim();
    // Increased deduplication window to prevent triple responses
    if (lastSentRef.current && lastSentRef.current.text === trimmed && now - lastSentRef.current.time < 5000) {
      console.log('Deduped repeated message within 5 seconds');
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
      startTimer('wellnessgeni-api-call');
      const { data: chatData, error: chatError } = await supabase.functions.invoke('wellnessgeni-chat', {
        body: payload,
      });
      endTimer('wellnessgeni-api-call');

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

      // Start thinking indicator before processing D-ID
      setIsThinking(true);

      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella',
        text: responseText,
        sender: 'isabella',
        timestamp: new Date(),
      };
      
      // Show Isabella's text immediately for better UX
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

      // OPTIMIZATION 5: Start D-ID processing immediately, don't wait for message addition
      if (isSpeakerEnabled && responseText.trim()) {
        console.log('[OPTIMIZATION] Starting parallel D-ID processing immediately');
        
        // Fire-and-forget D-ID processing for maximum speed
          (async () => {
            try {
              startTimer('did-api-call');
              if (USE_ELEVENLABS_TTS) {
                console.log('[TTS] request → elevenlabs-tts');
                const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
                  body: { text: responseText, voice_id: 't0IcnDolatli2xhqgLgn' }
                });
                if (ttsError) {
                  console.error('[TTS] error', ttsError);
                  console.log('[D-ID] Falling back to built-in TTS');
                  const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                    body: { text: responseText, source_url: DID_SOURCE_URL }
                  });
                  if (!didError && didData?.talk_id) {
                    startTimer('did-polling');
                    await pollDidTalk(didData.talk_id, true);
                    endTimer('did-polling');
                  }
                  endTimer('did-api-call');
                  endTimer('user-to-response-total');
                  return;
                }

                if (ttsData?.audio) {
                  console.log('[D-ID] FAST request → did-avatar with audio');
                  const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                    body: { audio_base64: ttsData.audio, source_url: DID_SOURCE_URL }
                  });
                  endTimer('did-api-call');
                  if (didError) {
                    console.error('[D-ID] error', didError);
                    setIsThinking(false);
                    endTimer('user-to-response-total');
                    return;
                  }
                  if (didData?.talk_id) {
                    try {
                      startTimer('did-polling');
                      await pollDidTalk(didData.talk_id, true);
                      endTimer('did-polling');
                      endTimer('user-to-response-total');
                    } catch (e) {
                      console.error('[D-ID] poll start error', e);
                      setIsThinking(false);
                      endTimer('user-to-response-total');
                    }
                  }
                }
              } else {
                console.log('[D-ID] FAST request → did-avatar (first sentence only, no parallel)');
                const sentences = (responseText.match(/[^.!?]+[.!?]?/g) || [responseText])
                  .map(s => s.trim())
                  .filter(s => s.length > 2);
                const firstSentence = sentences[0] || responseText.split(/[,;:]/)[0] || responseText;

                // Send ONLY the first sentence to D-ID to minimize generation time
                console.log('[D-ID] creating talk for first sentence:', firstSentence.slice(0, 80));
                startTimer('did-api-call');
                const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                  body: { text: firstSentence, source_url: DID_SOURCE_URL }
                });
                const didCreateMs = endTimer('did-api-call');
                if (didCreateMs > 2000) console.warn('[PERF] D-ID create took', didCreateMs.toFixed(0),'ms (>2s)');

                if (didError) {
                  console.error('[D-ID] error', didError);
                  setIsThinking(false);
                  endTimer('user-to-response-total');
                  return;
                }

                if (didData?.talk_id) {
                  try {
                    startTimer('did-polling');
                    await pollDidTalk(didData.talk_id, true);
                    const pollMs = endTimer('did-polling');
                    if (pollMs > 2000) console.warn('[PERF] D-ID poll took', pollMs.toFixed(0),'ms (>2s)');
                    endTimer('user-to-response-total');
                  } catch (e) {
                    console.error('[D-ID] poll start error', e);
                    setIsThinking(false);
                    endTimer('user-to-response-total');
                  }
                }
              }
            } catch (error) {
              console.error('Speech synthesis error:', error);
              setIsThinking(false);
              endTimer('user-to-response-total');
            }
          })();
      } else {
        // No speech enabled, stop thinking immediately
        setIsThinking(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsThinking(false);
      // Do not inject a static fallback message; rely on logs/UX to show failure state
    } finally {
      setIsProcessing(false);
      // Ensure timer ends even if D-ID isn't used
      if (!isSpeakerEnabled) {
        endTimer('user-to-response-total');
      }
    }
  }, [isProcessing, isSpeakerEnabled, playAudio, messages, sessionId]);

  const startListening = useCallback(async (force: boolean = false) => {
    if ((!isMicEnabled && !force) || isListening) return;
    
    try {
      setIsListening(true);
      setLiveTranscript('');
      
      // Use Web Speech API for real-time transcription
      if (recognition) {
        try {
          recognition.start();
          setIsWebSpeechActive(true);
          console.log('Web Speech API started for real-time transcription');
        } catch (e) {
          console.warn('Web Speech API start failed:', e);
        }
      }
      
      // OPTIMIZED: Enhanced microphone access with better audio quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // SPEED: Lower sample rate for faster processing
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
        audioBitsPerSecond: 64000 // SPEED: Lower bitrate for faster processing
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

      // Start recording with faster chunks
      mediaRecorder.start(500); // SPEED: Collect data every 500ms for responsiveness
      console.log('Started voice recording with mime type:', mimeType);

      // Auto-stop after 10 seconds for faster processing
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

      // OPTIMIZATION 8: Convert to base64 for faster processing
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('Converting audio and sending to speech-to-text function...');
      const audioBase64 = await base64Promise;
      
      // PERF: Measure STT latency
      startTimer('stt');
      // Use Supabase client for better performance
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: audioBase64 }
      });
      const sttMs = endTimer('stt');
      if (sttMs > 2000) console.warn('[PERF] STT took', sttMs.toFixed(0), 'ms (>2s)');

      if (error) {
        console.error('Speech-to-text error:', error);
        throw new Error(`Speech-to-text failed: ${error.message}`);
      }

      console.log('Speech-to-text result:', data);
      // Remove processing message immediately
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
        
        // Process transcribed text by calling Isabella's system directly
        // Use a timeout to ensure the user message is displayed first
        setTimeout(async () => {
          try {
            await processTranscribedText(transcribedText);
          } catch (error) {
            console.error('Error processing transcribed text:', error);
          }
        }, 100);
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
  }, []);

  // Separate handler for transcribed text to avoid duplication
  const processTranscribedText = useCallback(async (text: string) => {
    try {
      // Send to WellnessGeni via Supabase edge function
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const payload = {
        message: text,
        persona_id: 'solarclip',
        client_id: 'SolarClip', 
        session_id: sessionId,
        messages: history,
        context: {
          product: 'SolarClip',
          company: 'ClearNanoTech',
          persona_name: 'Isabella Navia',
          persona_role: 'ClearNanoTech Ambassador & SolarClip Product Promoter',
          max_response_duration: '20_seconds',
          tone: 'polite_professional_enthusiastic_concise',
          focus: 'SolarClip_products_solutions_lead_generation',
        },
      };

      const { data: chatData, error: chatError } = await supabase.functions.invoke('wellnessgeni-chat', {
        body: payload,
      });

      if (chatError) throw chatError;

      let responseText = typeof chatData?.response === 'string' ? chatData.response : 
                         typeof chatData?.text === 'string' ? chatData.text : '';
      
      if (!responseText || !responseText.trim()) {
        throw new Error('Empty response from chat API');
      }

      const isabellaMessage: ChatMessage = {
        id: Date.now().toString() + '_isabella_voice',
        text: responseText,
        sender: 'isabella',
        timestamp: new Date(),
      };
      
      // OPTIMIZATION 6: Ultra-fast parallel D-ID for voice responses  
      if (isSpeakerEnabled && responseText.trim()) {
        setIsThinking(true); // Show thinking for voice responses too
        
        (async () => {
          try {
            if (USE_ELEVENLABS_TTS) {
              console.log('[TTS] VOICE request → elevenlabs-tts');
              const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
                body: { text: responseText, voice_id: 't0IcnDolatli2xhqgLgn' }
              });
              if (ttsError) {
                console.error('[TTS] voice error', ttsError);
                // Fallback to built-in TTS
                const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                  body: { text: responseText, source_url: DID_SOURCE_URL }
                });
                if (!didError && didData?.talk_id) {
                  await pollDidTalk(didData.talk_id, true);
                }
              } else if (ttsData?.audio) {
                console.log('[D-ID] VOICE → did-avatar with audio');
                const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                  body: { audio_base64: ttsData.audio, source_url: DID_SOURCE_URL }
                });
                if (!didError && didData?.talk_id) {
                  await pollDidTalk(didData.talk_id, true);
                }
              }
            } else {
              console.log('[D-ID] VOICE request → did-avatar with built-in TTS');
              const voiceDidStart = performance.now();
              const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                body: { text: responseText, source_url: DID_SOURCE_URL }
              });
              console.log('[D-ID] Voice API call completed in:', (performance.now() - voiceDidStart).toFixed(0), 'ms');
              if (!didError && didData?.talk_id) {
                try { await pollDidTalk(didData.talk_id, true); } catch (e) { console.error('[D-ID] voice poll error', e); }
              }
            }
          } catch (error) {
            console.error('Voice speech synthesis error:', error);
          }
        })();
      }
      
      // Add message to chat immediately
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
    } catch (error) {
      console.error('Error in voice response processing:', error);
    }
  }, [messages, sessionId, isSpeakerEnabled, pollDidTalk]);

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
    const greetingText = "Hello, I'm Isabella, a SolarClip ambassador at ClearNanoTech. I'd like to take you on a short visual journey to present our product, its features, applications, and how it compares to others. Would you like that? You can use the chat box to write your messages or activate your microphone to speak directly.";
    
    // Start thinking state for greeting
    setIsThinking(true);
    
    // Prepare greeting message but don't show until D-ID is ready
    const isabellaMessage: ChatMessage = {
      id: Date.now().toString() + '_greeting',
      text: greetingText,
      sender: 'isabella',
      timestamp: new Date(),
    };
    
    // Start D-ID processing immediately as text appears
    let didProcessingPromise = Promise.resolve();
    if (isSpeakerEnabled) {
      console.log('[Isabella] Starting D-ID processing immediately for faster animation');
      didProcessingPromise = (async () => {
        try {
          if (USE_ELEVENLABS_TTS) {
            console.log('[TTS] request → elevenlabs-tts (greeting)');
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
              body: { text: greetingText, voice_id: 't0IcnDolatli2xhqgLgn' }
            });

            if (ttsError) {
              console.error('[TTS] error', ttsError);
              const { error: didErr } = await supabase.functions.invoke('did-avatar', { body: { text: greetingText, source_url: DID_SOURCE_URL } });
              if (didErr) console.error('[D-ID] greeting fallback (text) error', didErr);
              return;
            }

            if (ttsData?.audio) {
              console.log('[TTS] got greeting audio, sending to D-ID for animation');
              const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
                body: { audio_base64: ttsData.audio, source_url: DID_SOURCE_URL }
              });
              if (didError) {
                console.error('[D-ID] greeting error', didError);
              } else {
                console.log('[D-ID] greeting animation created:', didData);
                if (didData?.talk_id) {
                  // Add greeting message when D-ID animation is ready
                  pollDidTalk(didData.talk_id).then(() => {
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
                  }).catch(e => console.error('[D-ID] poll start error', e));
                }
              }
              console.log('[TTS] playing greeting audio');
              await playAudio(ttsData.audio);
            }
          } else {
            console.log('[D-ID] GREETING request → did-avatar with built-in TTS');
            const greetingStart = performance.now();
            const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
              body: { text: greetingText, source_url: DID_SOURCE_URL }
            });
            console.log('[D-ID] Greeting API call completed in:', (performance.now() - greetingStart).toFixed(0), 'ms');
            
            if (didError) {
              console.error('[D-ID] greeting error', didError);
              setIsThinking(false);
              return;
            }
            if (didData?.talk_id) {
              // OPTIMIZATION 7: Immediate message display with optimized polling
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
              
              // Start optimized polling
              try { 
                await pollDidTalk(didData.talk_id, true); 
              } catch (e) { 
                console.error('[D-ID] greeting poll error', e);
                setIsThinking(false);
              }
            }
          }
        } catch (error) {
          console.error('Greeting speech synthesis error:', error);
          setIsThinking(false);
        }
      })();
    } else {
      // If speaker disabled, show greeting immediately
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
        await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        setIsMicEnabled(true);
        console.log('Microphone enabled, starting to listen...');
        await startListening(true);
      } catch (error) {
        console.error('Microphone permission denied:', error);
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice features.",
          variant: "destructive",
        });
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

  // Narrate function - adds messages to chat and handles D-ID TTS with proper sequencing
  const narrate = useCallback(async (text: string) => {
    console.log('[Isabella] narrate called:', text.substring(0, 50) + '...');
    
    // Prevent multiple identical messages
    if (messages.some(msg => msg.text === text && msg.sender === 'isabella')) {
      console.log('[Isabella] skipping duplicate message');
      return;
    }

    // Check if D-ID is currently processing
    if (isDidProcessing) {
      console.log('[Isabella] D-ID busy, queueing narration:', text.substring(0, 30) + '...');
      setDidQueue(prev => [...prev, text]);
      return;
    }

    const isabellaMessage: ChatMessage = {
      id: Date.now().toString() + '_narrate',
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

    if (!isSpeakerEnabled || !text.trim()) {
      console.log('[Isabella] speaker disabled or empty text, skipping TTS');
      return;
    }

    try {
      if (USE_ELEVENLABS_TTS) {
        console.log('[Isabella] using ElevenLabs TTS');
        const { data, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
          body: { text, voice_id: 't0IcnDolatli2xhqgLgn' }
        });
        if (ttsError) {
          console.error('[TTS] narrate error', ttsError);
        }
        if (data?.audio) {
          // Play audio immediately and animate avatar in parallel for speed
          void playAudio(data.audio);
          const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
            body: { audio_base64: data.audio, source_url: DID_SOURCE_URL }
          });
          if (!didError && didData?.talk_id) {
            await pollDidTalk(didData.talk_id);
          }
        }
      } else {
        // Use D-ID built-in TTS with video avatar
        console.log('[Isabella] using D-ID TTS + avatar:', text.substring(0, 50) + '...');
        
        // Set D-ID as busy to prevent concurrent calls
        setIsDidProcessing(true);
        
        // Don't clear existing video to prevent cutouts - let new video replace smoothly
        
        const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
          body: { text, source_url: DID_SOURCE_URL }
        });
        
        if (didError) {
          console.error('[Isabella] D-ID API error:', didError);
          setIsDidProcessing(false);
          return;
        }
        
        if (didData?.talk_id) {
          console.log('[Isabella] D-ID talk created, polling for results:', didData.talk_id);
          await pollDidTalk(didData.talk_id);
        } else {
          console.warn('[Isabella] No talk_id received from D-ID');
        }
        
        // Mark D-ID as free and process next in queue
        setIsDidProcessing(false);
        if (didQueue.length > 0) {
          const nextText = didQueue[0];
          setDidQueue(prev => prev.slice(1));
          console.log('[Isabella] processing queued D-ID call:', nextText.substring(0, 30) + '...');
          setTimeout(() => narrate(nextText), 500);
        }
      }
    } catch (e) {
      console.error('[Isabella] narrate error:', e);
      setIsDidProcessing(false);
      if (didQueue.length > 0) {
        const nextText = didQueue[0];
        setDidQueue(prev => prev.slice(1));
        setTimeout(() => narrate(nextText), 500);
      }
    }
  }, [isSpeakerEnabled, playAudio, pollDidTalk, messages, isDidProcessing, didVideoUrl, didQueue]);

  return {
    messages,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    isThinking,
    didVideoUrl,
    liveTranscript,
    isWebSpeechActive,
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