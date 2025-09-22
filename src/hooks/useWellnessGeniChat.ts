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
  // Real-time optimization: D-ID only for speed
  const USE_ELEVENLABS_TTS = false;
  const ENABLE_STREAMING = true;
  const ENABLE_FIRST_SENTENCE_DISPATCH = true;
  const { toast } = useToast();
  
  // Fresh messages on each page load for clean journey flow
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  
  // Performance monitoring
  const { startTimer, endTimer, logPerf } = usePerformanceMonitor();
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

  // Pre-warm D-ID on page load
  useEffect(() => {
    const preWarm = async () => {
      try {
        console.log('[D-ID] Pre-warming session...');
        const { data } = await supabase.functions.invoke('did-avatar', {
          body: {
            text: 'Hi',
            source_url: DID_SOURCE_URL,
          }
        });
        if (data?.talk_id) {
          console.log('[D-ID] Pre-warm talk created:', data.talk_id, '(will be discarded)');
          // Don't poll or display this warmup talk
        }
      } catch (e) {
        console.log('[D-ID] Pre-warm failed (not critical):', e);
      }
    };
    
    // Pre-warm after 2s to let page settle
    const timer = setTimeout(preWarm, 2000);
    return () => clearTimeout(timer);
  }, []);

  const [currentSource, setCurrentSource] = useState<AudioBufferSourceNode | null>(null);
  const lastSentRef = useRef<{ text: string; time: number } | null>(null);
  const greetingSentRef = useRef(false);
  const [didVideoUrl, setDidVideoUrl] = useState<string | null>(null);
  
  // D-ID Animation State Management
  const [isDidProcessing, setIsDidProcessing] = useState(false);
  const [didQueue, setDidQueue] = useState<string[]>([]);
  const didQueueRef = useRef<string[]>([]);
  
  // Token streaming state for early dispatch
  const [partialTokens, setPartialTokens] = useState<string[]>([]);
  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioFirstStarted, setAudioFirstStarted] = useState(false);
  const lastDispatchRef = useRef<string>('');
  
  useEffect(() => {
    didQueueRef.current = didQueue;
  }, [didQueue]);
  
  const didVideoObjectUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const didAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastDirectUrlRef = useRef<string | null>(null);

  // Manage D-ID video element lifecycle to avoid cutoffs
  const didVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const registerDidVideoElement = useCallback((el: HTMLVideoElement | null) => {
    // Detach previous
    if (didVideoElementRef.current && didVideoElementRef.current !== el) {
      try { didVideoElementRef.current.onended = null; } catch {}
      try { (didVideoElementRef.current as any).onerror = null; } catch {}
    }
    didVideoElementRef.current = el;
    if (el) {
      el.onended = () => {
        console.log('[D-ID] Video ended — hiding after 0.8s');
        setTimeout(() => {
          setDidVideoUrl(null);
          if (didVideoObjectUrlRef.current) {
            try { URL.revokeObjectURL(didVideoObjectUrlRef.current); } catch {}
            didVideoObjectUrlRef.current = null;
          }
          // Allow next queued clip to start
          setIsDidProcessing(false);
          const next = didQueueRef.current?.[0];
          if (next) {
            setDidQueue(prev => prev.slice(1));
            setTimeout(() => narrate(next), 100);
          }
        }, 800);
      };

      // Fallback: if proxied GET playback fails, use direct S3 result_url
      (el as any).onerror = async () => {
        if (!lastDirectUrlRef.current) return;
        try {
          console.warn('[D-ID] Proxied playback failed — falling back to direct URL');
          setDidVideoUrl(lastDirectUrlRef.current);
        } catch (e) {
          console.error('[D-ID] Direct URL fallback exception', e);
        }
      };
    }
  }, []);

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
        
        recognitionInstance.onerror = (event: any) => {
          const err = event?.error || 'unknown';
          if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') {
            console.warn('Speech recognition benign error:', err);
            setIsListening(false);
            setIsWebSpeechActive(false);
            return;
          }
          console.log('Speech recognition error:', err);
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
      console.log('[D-ID] 🔊 Audio-first playback starting...');
      
      // Use streaming proxy for audio
      const proxiedUrl = `https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/did-avatar?proxy_url=${encodeURIComponent(url)}&media_type=audio`;
      
      const audio = new Audio();
      audio.src = proxiedUrl;
      audio.crossOrigin = 'anonymous';
      didAudioRef.current = audio;

      await audio.play();
      audio.onended = () => {
        if (didAudioRef.current === audio) {
          didAudioRef.current = null;
        }
      };
    } catch (e) {
      console.error('[D-ID] Audio-first playback error', e);
    }
  }, []);

  const pollDidTalk = useCallback(async (talkId: string, shouldShowMessage = true) => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const pollStart = Date.now();
    
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
        
        // SPEED: Ultra-aggressive polling - 100-500ms for real-time feel
        const pollInterval = i < 10 ? 100 : i < 20 ? 150 : 500;
        
        // AUDIO-FIRST: Play audio as soon as available
        if (data?.audio_url && !audioFirstStarted) {
          console.log(`[PERF] 🟢 DID_poll_firstAudio=${Date.now() - pollStart}ms`);
          setAudioFirstStarted(true);
          
          try {
            await playDidAudio(data.audio_url);
          } catch (e) {
            console.error('[D-ID] Audio-first playback failed', e);
          }
        }
        
        // VIDEO: Set up streaming proxy
        if (data?.result_url) {
          console.log(`[PERF] 🟢 DID_poll_videoReady=${Date.now() - pollStart}ms`);
          console.log('[D-ID] Video ready - using STREAMING proxy URL for playback');
          
          try {
            lastDirectUrlRef.current = data.result_url as string;
            
            // Check content length for proxy decision
            const headResponse = await fetch(data.result_url, { method: 'HEAD' });
            const contentLength = parseInt(headResponse.headers.get('content-length') || '0');
            
            if (contentLength > 0 && contentLength < 10_000_000) {
              // Direct for small files (<10MB)
              console.log(`[D-ID] Direct playback (${Math.round(contentLength/1024)}KB)`);
              setDidVideoUrl(data.result_url);
              logPerf('Video_playback_start', Date.now() - pollStart, { proxy_used: false, content_length: contentLength });
            } else {
              // Streaming proxy for larger files
              const proxiedUrl = `https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/did-avatar?proxy_url=${encodeURIComponent(data.result_url)}&media_type=video`;
              console.log(`[D-ID] Streaming proxy (${Math.round(contentLength/1024)}KB)`);
              setDidVideoUrl(proxiedUrl);
              logPerf('Video_playback_start', Date.now() - pollStart, { proxy_used: true, content_length: contentLength });
            }
          } catch (e) {
            console.error('[D-ID] Failed to set streaming proxied URL', e);
            setDidVideoUrl(data.result_url);
            logPerf('Video_playback_start', Date.now() - pollStart, { proxy_used: false, fallback: true });
          }
          
          if (shouldShowMessage) {
            setIsThinking(false);
          }
          console.log('[D-ID] Awaiting video end event to auto-hide (reported duration:', (data?.duration ?? 'unknown'), 's)');
          return { duration: data?.duration } as any;
        }
        
        if (data?.status === 'error') {
          console.error('[D-ID] poll status error', data);
          if (shouldShowMessage) setIsThinking(false);
          break;
        }
        
        logPerf('DID-poll', Date.now() - pollStart, { 
          status: data?.status, 
          hasResultUrl: !!data?.result_url, 
          hasAudioUrl: !!data?.audio_url,
          nextPoll: pollInterval 
        });
        
        await delay(pollInterval);
      } catch (e) {
        console.error('[D-ID] poll exception', e);
        await delay(100);
      }
    }
  }, [playDidAudio, logPerf, audioFirstStarted]);

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
    const sttStartTime = Date.now();
    
    const now = Date.now();
    const trimmed = text.trim();
    // Increased deduplication window to prevent triple responses
    if (lastSentRef.current && lastSentRef.current.text === trimmed && now - lastSentRef.current.time < 3000) {
      console.log('[PERF] 🟡 Deduped repeated message within 3 seconds');
      return;
    }
    
    console.log(`[PERF] 🟢 STT=${Date.now() - sttStartTime}ms`);

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

      console.log('[LLM] 🚀 Request → wellnessgeni-chat', { messageLen: text.length });
      const llmStartTime = Date.now();
      startTimer('wellnessgeni-api-call');

      if (ENABLE_STREAMING) {
        // Start streaming LLM response
        setIsStreaming(true);
        setStreamingText('');
        setPartialTokens([]);
        setAudioFirstStarted(false);
        lastDispatchRef.current = '';
        
        let accumulatedText = '';
        let firstSentenceSent = false;
        let firstSentenceValue: string | null = null;
        let firstClipDurationMs: number = 0;
        
        // Create streaming Isabella message
        const streamingMessageId = Date.now().toString() + '_streaming';
        const isabellaMessage: ChatMessage = {
          id: streamingMessageId,
          text: '',
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

        const { data: chatData, error: chatError } = await supabase.functions.invoke('wellnessgeni-chat', {
          body: payload,
        });
        const llmMs = endTimer('wellnessgeni-api-call');
        console.log(`[PERF] 🟢 LLM API call=${Date.now() - llmStartTime}ms`);
        if (llmMs > 2000) console.warn('[PERF] 🟠 LLM took ' + llmMs.toFixed(0) + 'ms (>2s)');

        if (chatError) {
          console.error('[LLM] ❌ Error', chatError);
          throw chatError;
        }

        let responseText = typeof chatData?.response === 'string' ? chatData.response : 
                           typeof chatData?.text === 'string' ? chatData.text : '';
        
        if (!responseText || !responseText.trim()) {
          throw new Error('Empty response from chat API');
        }

        console.log(`[LLM] ✅ Complete response received: ${responseText.length} chars`);

        // Real token streaming with early dispatch
        const words = responseText.split(' ');
        let wordIndex = 0;
        const firstTokenTime = Date.now();
        
        console.log(`[PERF] 🟢 LLM_first_token=${Date.now() - llmStartTime}ms`);

        const onTokenArrived = (token: string) => {
          setPartialTokens(prev => [...prev, token]);
          
          // Reset timer for long partial detection
          if (tokenTimerRef.current) {
            clearTimeout(tokenTimerRef.current);
          }
          tokenTimerRef.current = setTimeout(() => {
            attemptDispatchPartial('timeout');
          }, 1200); // 1.2s fallback
          
          // Check for early dispatch conditions
          const textSoFar = [...partialTokens, token].join(' ');
          if (/[.?!]\s*$/.test(textSoFar) || textSoFar.split(/\s+/).length >= 12) {
            attemptDispatchPartial('punctuation_or_length');
          }
        };

        const attemptDispatchPartial = (reason: string) => {
          if (partialTokens.length === 0) return;
          
          const textToSend = partialTokens.join(' ');
          if (textToSend === lastDispatchRef.current) return; // Avoid duplicates
          
          console.log(`[PERF] 🟢 LLM_first_clause_dispatch=${Date.now() - firstTokenTime}ms (${reason})`);
          console.log(`[D-ID] 🎬 Early dispatch: "${textToSend}" (${reason})`);
          
          lastDispatchRef.current = textToSend;
          setPartialTokens([]);
          firstSentenceSent = true;
          firstSentenceValue = textToSend;
          
          // Clear timer
          if (tokenTimerRef.current) {
            clearTimeout(tokenTimerRef.current);
            tokenTimerRef.current = null;
          }
          
          // PERFORMANCE: Start narration immediately
          narrate(textToSend);
        };

        const streamWords = () => {
          if (wordIndex < words.length) {
            const word = words[wordIndex];
            accumulatedText += (wordIndex > 0 ? ' ' : '') + word;
            wordIndex++;

            console.log(`[LLM] 📝 Token: "${word}" (${wordIndex}/${words.length})`);
            
            // Token-level processing
            onTokenArrived(word);
            
            // Update streaming text
            setStreamingText(accumulatedText);
            
            // Update message in real-time
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, text: accumulatedText }
                : msg
            ));

            // Continue streaming tokens
            setTimeout(streamWords, 80); // 80ms per word for natural feel
          } else {
            // Finished streaming
            setIsStreaming(false);
            console.log(`[LLM] ✅ Complete streaming finished: ${accumulatedText.length} chars`);
            
            // Final dispatch check
            if (!firstSentenceSent && partialTokens.length > 0) {
              attemptDispatchPartial('final_fallback');
            }
            
            // If we have a remaining portion after first sentence, queue it as second D-ID clip
            if (firstSentenceValue && firstSentenceValue.length < accumulatedText.length) {
              const remaining = accumulatedText.replace(firstSentenceValue, '').trim();
              if (remaining && remaining.length > 10) {
                console.log(`[D-ID] 🎬 Remaining text dispatch: "${remaining.substring(0, 50)}..."`);
                setTimeout(() => narrate(remaining), firstClipDurationMs || 3000);
              }
            } else if (!firstSentenceSent) {
              // Fallback: if no early dispatch happened, narrate the full response
              console.log(`[D-ID] 🎬 Fallback full response: "${accumulatedText.substring(0, 50)}..."`);
              narrate(accumulatedText);
            }
            
            const totalMs = endTimer('user-to-response-total');
            console.log(`[PERF] 🎯 total_perceived=${totalMs}ms`);
          }
        };

        // Start streaming after brief delay
        setTimeout(streamWords, 100);
      } else {
        // Non-streaming fallback
        const { data: chatData, error: chatError } = await supabase.functions.invoke('wellnessgeni-chat', {
          body: payload,
        });

        if (chatError) {
          console.error('[LLM] ❌ Error', chatError);
          throw chatError;
        }

        let responseText = typeof chatData?.response === 'string' ? chatData.response : 
                           typeof chatData?.text === 'string' ? chatData.text : '';
        
        if (!responseText || !responseText.trim()) {
          throw new Error('Empty response from chat API');
        }

        console.log(`[LLM] ✅ Complete response: ${responseText.length} chars`);

        const isabellaMessage: ChatMessage = {
          id: Date.now().toString(),
          text: responseText,
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

        if (isSpeakerEnabled) {
          narrate(responseText);
        }
        
        const totalMs = endTimer('user-to-response-total');
        console.log(`[PERF] 🎯 total_perceived=${totalMs}ms`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Communication Error",
        description: "Failed to connect to Isabella. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, messages, sessionId, isSpeakerEnabled, toast, startTimer, endTimer, partialTokens]);

  const narrate = useCallback(async (text: string) => {
    if (!text?.trim()) return;
    if (isDidProcessing && didQueueRef.current.length >= 2) {
      console.log('[D-ID] Queue full, skipping narration:', text.substring(0, 30));
      return;
    }

    if (isDidProcessing) {
      console.log('[D-ID] Queueing for later:', text.substring(0, 30));
      setDidQueue(prev => [...prev, text]);
      return;
    }

    setIsDidProcessing(true);
    setIsThinking(true); // Show thinking status
    const didStart = Date.now();

    console.log('[Isabella] narrate called:', text.substring(0, 50) + '...');

    try {
      // Choose TTS method based on configuration
      if (USE_ELEVENLABS_TTS) {
        console.log('[Isabella] using ElevenLabs TTS + D-ID avatar:', text.substring(0, 50) + '...');
        
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('elevenlabs-tts', {
          body: { text, voice: 'EXAVITQu4vr4xnSDxMaL' } // Sarah
        });

        if (ttsError) throw ttsError;
        if (!ttsData?.audioContent) throw new Error('No audio content from ElevenLabs');

        // Create D-ID talk with pre-generated audio
        const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
          body: {
            audio_base64: ttsData.audioContent,
            source_url: DID_SOURCE_URL,
          }
        });

        if (didError) throw didError;
        if (!didData?.talk_id) throw new Error('No talk_id returned from D-ID');

        console.log(`[PERF] 🟢 DID_create=${Date.now() - didStart}ms`);
        console.log('[Isabella] D-ID talk created, polling for results:', didData.talk_id);
        await pollDidTalk(didData.talk_id);
      } else {
        console.log('[Isabella] using D-ID TTS + avatar:', text.substring(0, 50) + '...');
        
        // Create D-ID talk with text-to-speech
        const { data: didData, error: didError } = await supabase.functions.invoke('did-avatar', {
          body: {
            text: text,
            source_url: DID_SOURCE_URL,
          }
        });

        if (didError) throw didError;
        if (!didData?.talk_id) throw new Error('No talk_id returned from D-ID');

        console.log(`[PERF] 🟢 DID_create=${Date.now() - didStart}ms`);
        console.log('[Isabella] D-ID talk created, polling for results:', didData.talk_id);
        await pollDidTalk(didData.talk_id);
      }
    } catch (error) {
      console.error('[Isabella] Narration error:', error);
      setIsThinking(false);
      setIsDidProcessing(false);
      
      // Process next queued item
      const next = didQueueRef.current?.[0];
      if (next) {
        setDidQueue(prev => prev.slice(1));
        setTimeout(() => narrate(next), 100);
      }
    }
  }, [isDidProcessing, pollDidTalk]);

  const startListening = useCallback(async () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsListening(true);
      setIsWebSpeechActive(true);
      setLiveTranscript('');
      recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
      setIsWebSpeechActive(false);
    }
  }, [recognition, toast]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
      setIsWebSpeechActive(false);
      setLiveTranscript('');
    }
  }, [recognition, isListening]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => !prev);
    if (isSpeakerEnabled) {
      stopAudio();
    }
  }, [isSpeakerEnabled, stopAudio]);

  const toggleMicrophone = useCallback(() => {
    setIsMicEnabled(prev => !prev);
    if (isMicEnabled && isListening) {
      stopListening();
    }
  }, [isMicEnabled, isListening, stopListening]);

  return {
    messages,
    isThinking,
    isStreaming,
    streamingText,
    isProcessing,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
    didVideoUrl,
    liveTranscript,
    isWebSpeechActive,
    sendMessage,
    startListening,
    stopListening,
    toggleSpeaker,
    toggleMicrophone,
    initializeAudio,
    registerDidVideoElement,
    narrate,
    sendGreeting: () => narrate("Hello! I'm Isabella, your SolarClip assistant. How can I help you today?"),
  };
};