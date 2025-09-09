import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IsabellaCard {
  type: 'video' | 'google_solar' | 'lead_form' | 'confirmation' | 'error';
  title: string;
  content: any;
  animation?: 'swoop-left' | 'fade-in';
}

interface IsabellaResponse {
  text: string;
  cards?: IsabellaCard[];
  actions?: string[];
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'isabella';
  timestamp: Date;
  cards?: IsabellaCard[];
}

export const useIsabella = (clientId: string = 'solarclip') => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [currentCard, setCurrentCard] = useState<IsabellaCard | null>(null);

  const addMessage = useCallback((text: string, sender: 'user' | 'isabella', cards?: IsabellaCard[]) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      sender,
      timestamp: new Date(),
      cards
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isProcessing) return;

    setIsProcessing(true);
    
    // Add user message
    addMessage(userMessage, 'user');

    try {
      // Call Isabella orchestrator
      const { data, error } = await supabase.functions.invoke('isabella-orchestrator', {
        body: {
          message: userMessage,
          client_id: clientId,
          session_id: sessionId,
          context: {
            previous_messages: messages.slice(-5) // Last 5 messages for context
          }
        }
      });

      if (error) throw error;

      const response: IsabellaResponse = data;
      
      // Add Isabella's response
      const message = addMessage(response.text, 'isabella', response.cards);

      // Show cards if any
      if (response.cards && response.cards.length > 0) {
        setCurrentCard(response.cards[0]);
      }

    } catch (error) {
      console.error('Error communicating with Isabella:', error);
      addMessage(
        "I apologize, but I'm having trouble processing your request right now. Please try again or contact our support team directly.",
        'isabella'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, addMessage, clientId, sessionId, messages]);

  const getSolarAnalysis = useCallback(async (address: string) => {
    if (!address.trim()) return;

    setIsProcessing(true);
    addMessage(`Analyzing solar potential for: ${address}`, 'user');

    try {
      const { data, error } = await supabase.functions.invoke('solar-map', {
        body: {
          client_id: clientId,
          address: address,
          session_id: sessionId
        }
      });

      if (error) throw error;

      addMessage(
        `Here's the solar analysis for ${address}. The results show great potential for solar installation!`,
        'isabella'
      );

      if (data.card) {
        setCurrentCard(data.card);
      }

    } catch (error) {
      console.error('Error getting solar analysis:', error);
      addMessage(
        "I couldn't retrieve solar data for that address. Please try a different address or contact us directly.",
        'isabella'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [addMessage, clientId, sessionId]);

  const submitLead = useCallback(async (leadData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    notes?: string;
  }) => {
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-lead', {
        body: {
          ...leadData,
          client_id: clientId,
          session_id: sessionId
        }
      });

      if (error) throw error;

      addMessage(data.message || 'Thank you! Your information has been captured.', 'isabella');

      if (data.card) {
        setCurrentCard(data.card);
      }

      return { success: true, leadId: data.lead_id };

    } catch (error) {
      console.error('Error submitting lead:', error);
      addMessage(
        "I apologize, but I couldn't save your information right now. Please try again or contact us directly.",
        'isabella'
      );
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [addMessage, clientId, sessionId]);

  const closeCard = useCallback(() => {
    setCurrentCard(null);
  }, []);

  const handleCardAction = useCallback(async (action: string, data?: any) => {
    switch (action) {
      case 'play_video':
        // Handle video play logic
        console.log('Playing video:', data);
        break;
      case 'submit_lead':
        // Extract form data and submit
        console.log('Submitting lead:', data);
        break;
      case 'request_address':
        addMessage("Please provide the address you'd like me to analyze for solar potential.", 'isabella');
        break;
      case 'card_auto_exit':
        // Handle auto-exit with Isabella's follow-up
        setTimeout(() => {
          if (data?.cardType === 'video') {
            addMessage(
              "I hope this gave you a clear view of our product. What would you like to explore next?", 
              'isabella'
            );
          } else if (data?.cardType === 'google_solar') {
            addMessage(
              "Would you like me to connect you with an expert or show you another feature?", 
              'isabella'
            );
          }
        }, 500); // Small delay after card exits
        break;
      default:
        console.log('Unknown action:', action, data);
    }
  }, [addMessage]);

  // Initialize with greeting
  const initializeGreeting = useCallback(() => {
    if (messages.length === 0) {
      addMessage(
        "Hello! I'm Isabella, your AI ambassador at SolarClip. Let me show you how our revolutionary clip-on technology changes solar forever. Would you like to see our complete presentation or explore solar potential for a specific address?",
        'isabella'
      );
    }
  }, [messages.length, addMessage]);

  return {
    messages,
    isProcessing,
    currentCard,
    sendMessage,
    getSolarAnalysis,
    submitLead,
    closeCard,
    handleCardAction,
    initializeGreeting,
    sessionId
  };
};