import { useState, useCallback, useEffect, useRef } from 'react';

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

interface WebSpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useWebSpeechRecognition = (
  onResult?: (result: SpeechRecognitionResult) => void,
  onError?: (error: string) => void
): WebSpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          
          if (result.isFinal) {
            finalText += transcriptText;
            setTranscript(prev => prev + transcriptText);
            
            // Call onResult callback with final result
            if (onResult) {
              onResult({
                transcript: transcriptText,
                confidence: result[0].confidence || 0,
                isFinal: true
              });
            }
          } else {
            interimText += transcriptText;
          }
        }
        
        setInterimTranscript(interimText);
        
        // Call onResult callback with interim result for real-time feedback
        if (interimText && onResult) {
          onResult({
            transcript: interimText,
            confidence: 0,
            isFinal: false
          });
        }
      };
      
      recognition.onstart = () => {
        console.log('[WebSpeech] Recognition started');
        setIsListening(true);
      };
      
      recognition.onend = () => {
        console.log('[WebSpeech] Recognition ended');
        setIsListening(false);
        setInterimTranscript('');
      };
      
      recognition.onerror = (event: any) => {
        console.error('[WebSpeech] Recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
        
        // Only report meaningful errors, ignore "no-speech"
        if (onError && event.error !== 'no-speech') {
          onError(event.error);
        }
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn('[WebSpeech] Speech recognition not supported in this browser');
      setIsSupported(false);
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.warn('[WebSpeech] Error stopping recognition:', error);
        }
      }
    };
  }, [onResult, onError]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current || isListening) {
      return;
    }
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('[WebSpeech] Error starting recognition:', error);
      if (onError) {
        onError('Failed to start speech recognition');
      }
    }
  }, [isSupported, isListening, onError]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) {
      return;
    }
    
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.warn('[WebSpeech] Error stopping recognition:', error);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
};