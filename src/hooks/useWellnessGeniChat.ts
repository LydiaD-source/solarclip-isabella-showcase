import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { usePerformanceMonitor } from './usePerformanceMonitor';

// Configuration - EMERGENCY KILL SWITCH
const DISPATCH_THROTTLE_MS = 5000;
const MIN_DISPATCH_LENGTH = 3;
const ENABLE_EARLY_DISPATCH = false; // 🚨 EMERGENCY KILL SWITCH - stops loops

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

  // REMOVED pre-warm to avoid initial duplicate talks
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
  const dispatchedTextsRef = useRef<string[]>([]);
  
  useEffect(() => {
    didQueueRef.current = didQueue;
  }, [didQueue]);
  
  const didVideoObjectUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const didAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastDirectUrlRef = useRef<string | null>(null);
  const lastDidTalkAtRef = useRef<number>(0);
  
  // STRICT single-talk management refs
  const lastDispatchedStrictRef = useRef<string>('');
  const talkLockRef = useRef<boolean>(false);
  const pendingQueueRef = useRef<string[]>([]);
  const currentTalkIdRef = useRef<string | null>(null);
  
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
        console.log('[PERF] Talk_end');
        talkLockRef.current = false;
        currentTalkIdRef.current = null;
        setTimeout(() => {
          setDidVideoUrl(null);
          if (didVideoObjectUrlRef.current) {
            try { URL.revokeObjectURL(didVideoObjectUrlRef.current); } catch {}
            didVideoObjectUrlRef.current = null;
          }
          // Process next queued item
          const nextQueued = pendingQueueRef.current.shift();
          if (nextQueued) {
            console.log('[PERF] Processing_queued_after_video_end:', nextQueued);
            setTimeout(() => dispatchToDid(nextQueued), 250);
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

  // Create session-based idempotency key
  const makeIdempotencyKey = useCallback((text: string) => {
    const sessionPart = sessionId.slice(-6); // Use last 6 chars of session
    return btoa(unescape(encodeURIComponent(`${sessionPart}|${text.trim()}`)));
  }, [sessionId]);

  // STRICT single-talk dispatch with queue and lock
  const dispatchToDid = useCallback(async (text: string) => {
    const cleanText = text.trim();
    console.log('[PERF] Dispatch_attempt:', cleanText);
    
    // Skip if too short
    if (cleanText.length < MIN_DISPATCH_LENGTH) {
      console.log('[PERF] Skipped_too_short:', cleanText);
      return;
    }

    // STRICT deduplication - skip exact duplicates
    if (cleanText === lastDispatchedStrictRef.current) {
      console.log('[PERF] Skipped_duplicate:', cleanText);
      return;
    }

    // If locked, add to queue (no duplicates in queue)
    if (talkLockRef.current) {
      if (!pendingQueueRef.current.includes(cleanText)) {
        pendingQueueRef.current.push(cleanText);
        console.log('[PERF] Enqueued_while_locked:', cleanText);
      }
      return;
    }

    // Acquire STRICT lock
    talkLockRef.current = true;
    lastDispatchedStrictRef.current = cleanText;

    // Show text in chat immediately
    const messageId = Date.now().toString() + '_dispatch';
    const assistantMessage: ChatMessage = {
      id: messageId,
      text: cleanText,
      sender: 'isabella',
      timestamp: new Date(),
    };
    
    setMessages(prev => {
      const updated = [...prev, assistantMessage];
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving messages:', error);
        }
      }
      return updated;
    });

    try {
      const idempotencyKey = makeIdempotencyKey(cleanText);

      console.log('[PERF] Dispatch_text:', cleanText);
      
      const response = await fetch('/functions/v1/did-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          session_id: sessionId,
          idempotency_key: idempotencyKey
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PERF] Dispatch_error:', response.status, errorText);
        
        if (response.status === 429) {
          console.log('[PERF] Rate_limited, waiting 3s');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        throw new Error(`D-ID request failed: ${response.status}`);
      }

      const data = await response.json();
      const talkId = data.talk_id;
      
      // Only set if this is still the active talk
      if (talkLockRef.current) {
        currentTalkIdRef.current = talkId;
        console.log('[PERF] Talk_created:', talkId);
        await pollTalkStatus(talkId);
      }

    } catch (error) {
      console.error('[PERF] Dispatch_error:', error);
    } finally {
      // Release lock and drain queue
      talkLockRef.current = false;
      console.log('[PERF] Talk_end');
      
      const nextQueued = pendingQueueRef.current.shift();
      if (nextQueued) {
        console.log('[PERF] Processing_queued:', nextQueued);
        setTimeout(() => dispatchToDid(nextQueued), 250);
      }
    }
  }, [makeIdempotencyKey, sessionId]);

  // Poll D-ID talk status with active talk binding
  const pollTalkStatus = useCallback(async (talkId: string) => {
    const pollStart = Date.now();
    let retryCount = 0;
    const maxRetries = 30; // 30s timeout

    while (retryCount < maxRetries && currentTalkIdRef.current === talkId) {
      try {
        const response = await fetch(`/functions/v1/did-avatar?talk_id=${talkId}`, {
          method: 'GET',
        });

        if (!response.ok) {
          console.error('[PERF] Poll_error:', response.status);
          break;
        }

        const data = await response.json();
        console.log('[PERF] DID_poll_status:', talkId, data.status);

        if (data.status === 'done' && data.result_url) {
          // Only proceed if this is still the active talk
          if (currentTalkIdRef.current !== talkId) {
            console.log('[PERF] Discarding_old_talk:', talkId);
            break;
          }

          const elapsed = Date.now() - pollStart;
          console.log('[PERF] DID_poll_videoReady:', elapsed + 'ms', talkId);

          // Create proxied video URL for streaming
          const proxiedVideoUrl = `/functions/v1/did-avatar?proxy_url=${encodeURIComponent(data.result_url)}&media_type=video`;
          
          // Only set video URL if this is still the active talk
          if (currentTalkIdRef.current === talkId) {
            setDidVideoUrl(proxiedVideoUrl);
            
            // Store for fallback
            lastDirectUrlRef.current = data.result_url;
          }

          break;
        }

        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Faster polling

      } catch (error) {
        console.error('[PERF] Poll_network_error:', error);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (retryCount >= maxRetries) {
      console.error('[PERF] Poll_timeout:', talkId);
      // Release lock on timeout
      if (currentTalkIdRef.current === talkId) {
        talkLockRef.current = false;
        currentTalkIdRef.current = null;
      }
    }
  }, []);

  // Attempt to dispatch partial text to D-ID (with kill switch)
  const attemptDispatchPartial = useCallback((text: string) => {
    // 🚨 EMERGENCY KILL SWITCH - disable early partial dispatch
    if (!ENABLE_EARLY_DISPATCH) {
      console.log('[PERF] Early_dispatch_disabled:', text);
      return;
    }
    
    if (text.length >= MIN_DISPATCH_LENGTH && 
        (text.endsWith('.') || text.endsWith('!') || text.endsWith('?') || text.length > 50)) {
      console.log('[PERF] Attempting partial dispatch:', text);
      dispatchToDid(text);
    }
  }, [dispatchToDid]);

  // Play audio from a direct URL (e.g., D-ID audio_url)
  const playDidAudio = useCallback(async (url: string) => {
    try {
      if (didAudioRef.current) {
        try { didAudioRef.current.pause(); } catch {}
        didAudioRef.current = null;
      }
      console.log('[D-ID] 🔊 Audio-first playback starting...');
      
      // Build GET streaming proxy URL for audio (no POST proxying)
      let audioSrc = `https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/did-avatar?proxy_url=${encodeURIComponent(url)}&media_type=audio`;

      
      const audio = new Audio();
      audio.src = audioSrc;
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
        if (talkId !== currentTalkIdRef.current) {
          console.log('[D-ID] Ignoring stale poll for', talkId);
          return;
        }
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
        if (data?.result_url && data?.status === 'done') {
          if (talkId !== currentTalkIdRef.current) {
            console.log('[D-ID] Stale ready result ignored for', talkId);
            return;
          }
          console.log(`[PERF] 🟢 DID_poll_videoReady=${Date.now() - pollStart}ms`);
          console.log('[D-ID] Video ready - using STREAMING proxy URL for playback');
          
          try {
            lastDirectUrlRef.current = data.result_url as string;
            
            // Check content length for proxy decision (prefer direct if small)
            let useDirect = false;
            let contentLength = 0;
            try {
              const headResponse = await fetch(data.result_url, { method: 'HEAD' });
              contentLength = parseInt(headResponse.headers.get('content-length') || '0');
              useDirect = contentLength > 0 && contentLength < 10_000_000;
            } catch (e) {
              console.warn('[D-ID] HEAD failed, will prefer proxy', e);
            }
            
            if (useDirect) {
              console.log(`[D-ID] Direct playback (${Math.round(contentLength/1024)}KB)`);
              setDidVideoUrl(data.result_url);
            } else {
              // Build GET streaming proxy URL for video (no POST proxying)
              const proxiedUrl = `https://mzikfyqzwepnubdsclfd.supabase.co/functions/v1/did-avatar?proxy_url=${encodeURIComponent(data.result_url)}&media_type=video`;
              console.log(`[D-ID] Streaming proxy (${contentLength ? Math.round(contentLength/1024) : 'unknown'}KB)`);
              setDidVideoUrl(proxiedUrl);

            }
          } catch (e) {
            console.error('[D-ID] Failed to set streaming proxied URL', e);
            setDidVideoUrl(data.result_url);
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

        // Add empty message that will be updated during streaming
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

        const { data, error } = await supabase.functions.invoke('wellnessgeni-chat', {
          body: payload,
        });

        const apiCallTimer = startTimer('wellnessgeni-api-call');
        endTimer('wellnessgeni-api-call');
        
        if (error) {
          console.error('[LLM] 🔴 API error:', error);
          setIsStreaming(false);
          setIsProcessing(false);
          toast({
            title: "Connection Issue",
            description: "I'm having trouble connecting right now. Please try again in a moment.",
            variant: "destructive",
          });
          return;
        }

        const response = data?.response;
        if (!response) {
          console.error('[LLM] 🔴 No response from API');
          setIsStreaming(false);
          setIsProcessing(false);
          return;
        }

        console.log(`[PERF] 🟢 LLM=${Date.now() - llmStartTime}ms`);

        if (data.streamed && Array.isArray(response)) {
          // Handle streaming response
          console.log('[LLM] Processing streaming response chunks:', response.length);
          
          for (const chunk of response) {
            if (chunk.choices?.[0]?.delta?.content) {
              const newText = chunk.choices[0].delta.content;
              accumulatedText += newText;
              
              // Add tokens for potential early dispatch with kill switch
              if (ENABLE_EARLY_DISPATCH) {
                setPartialTokens(prev => [...prev, newText]);
                
                // Clear timer and set new one for buffered dispatch
                if (tokenTimerRef.current) {
                  clearTimeout(tokenTimerRef.current);
                }
                
                tokenTimerRef.current = setTimeout(() => {
                  const combined = accumulatedText.trim();
                  if (combined !== lastDispatchRef.current && combined.length > 20) {
                    attemptDispatchPartial(combined);
                    lastDispatchRef.current = combined;
                  }
                }, 3000); // Buffer for 3s before dispatching partial
              }
              
              setStreamingText(accumulatedText);
              
              // Update the streaming message in real-time
              setMessages(prev => prev.map(msg => 
                msg.id === streamingMessageId 
                  ? { ...msg, text: accumulatedText }
                  : msg
              ));
            }
          }
        } else if (typeof response === 'string') {
          // Handle non-streaming response
          accumulatedText = response;
          setStreamingText(accumulatedText);
          
          // Update the streaming message
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, text: accumulatedText }
              : msg
          ));
        }

        // Clear any pending token timer
        if (tokenTimerRef.current) {
          clearTimeout(tokenTimerRef.current);
          tokenTimerRef.current = null;
        }

        // Dispatch final text when streaming ends (main dispatch point)
        if (accumulatedText) {
          console.log('[PERF] Final_streaming_dispatch:', accumulatedText);
          dispatchToDid(accumulatedText);
        }

        setIsStreaming(false);
        
        // Final message save
        const finalMessage: ChatMessage = {
          id: streamingMessageId,
          text: accumulatedText,
          sender: 'isabella',
          timestamp: new Date(),
        };
        
        setMessages(prev => {
          const updated = prev.map(msg => msg.id === streamingMessageId ? finalMessage : msg);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('isabella-chat-messages', JSON.stringify(updated));
            } catch (error) {
              console.error('Error saving messages:', error);
            }
          }
          return updated;
        });
        
        endTimer('user-to-response-total');
        setIsProcessing(false);
        console.log(`[PERF] 🟢 Total_user_to_response=${Date.now() - sttStartTime}ms`);

      } else {
        // Non-streaming fallback
        const { data, error } = await supabase.functions.invoke('wellnessgeni-chat', {
          body: payload,
        });

        endTimer('wellnessgeni-api-call');
        
        if (error) {
          console.error('[LLM] API error:', error);
          setIsProcessing(false);
          toast({
            title: "Connection Issue",
            description: "I'm having trouble connecting right now. Please try again in a moment.",
            variant: "destructive",
          });
          return;
        }

        const response = data?.response;
        if (!response) {
          console.error('[LLM] No response from API');
          setIsProcessing(false);
          return;
        }

        console.log(`[PERF] 🟢 LLM=${Date.now() - llmStartTime}ms`);

        const isabellaMessage: ChatMessage = {
          id: Date.now().toString(),
          text: response,
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
        
        // Dispatch to D-ID for animation
        dispatchToDid(response);
        
        endTimer('user-to-response-total');
        setIsProcessing(false);
        console.log(`[PERF] 🟢 Total_user_to_response=${Date.now() - sttStartTime}ms`);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsProcessing(false);
      setIsStreaming(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }, [isProcessing, messages, sessionId, startTimer, endTimer, toast, attemptDispatchPartial, dispatchToDid]);

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
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
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      try {
        recognition.stop();
        setIsListening(false);
        setIsWebSpeechActive(false);
        setLiveTranscript('');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }, [recognition, isListening]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(prev => !prev);
    if (!isSpeakerEnabled) {
      stopAudio();
    }
  }, [isSpeakerEnabled, stopAudio]);

  const toggleMicrophone = useCallback(() => {
    setIsMicEnabled(prev => !prev);
    if (isMicEnabled && isListening) {
      stopListening();
    }
  }, [isMicEnabled, isListening, stopListening]);

  // Legacy functions for compatibility
  const narrate = useCallback(async (text: string) => {
    console.log('[LEGACY] narrate called, delegating to dispatchToDid:', text);
    await dispatchToDid(text);
  }, [dispatchToDid]);

  const sendGreeting = useCallback(async (greeting: string = "Hello there! I'm Isabella Navia from ClearNanoTech. How can I help you with SolarClip today?") => {
    console.log('[LEGACY] sendGreeting called, delegating to dispatchToDid:', greeting);
    await dispatchToDid(greeting);
  }, [dispatchToDid]);

  return {
    messages,
    isProcessing,
    isThinking,
    isStreaming,
    streamingText,
    isSpeakerEnabled,
    isMicEnabled,
    isListening,
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
    registerDidVideoElement,
    narrate,
  };
};