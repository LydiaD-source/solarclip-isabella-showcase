import { useCallback, useState } from 'react';

export type JourneyStage =
  | 'idle'
  | 'awaiting_start'
  | 'step_product_intro'
  | 'step_comparison'
  | 'step_installation'
  | 'map_prompt'
  | 'open_chat';

interface Card {
  type: 'video' | 'google_solar' | 'lead_form' | 'confirmation' | 'error';
  title: string;
  content: any;
  animation?: 'swoop-left' | 'fade-in';
}

interface UseIsabellaJourneyArgs {
  narrate: (text: string) => Promise<void> | void;
  showCard: (card: Card) => void;
  getSolarAnalysis: (address: string) => Promise<void> | void;
}

export const useIsabellaJourney = ({ narrate, showCard, getSolarAnalysis }: UseIsabellaJourneyArgs) => {
  const [stage, setStage] = useState<JourneyStage>('idle');

  const start = useCallback(async () => {
    // Initial greeting + ask for confirmation
    setStage('awaiting_start');
    await narrate(
      "Hello, I’m Isabella, a SolarClip ambassador at ClearNanoTech. I’d like to take you on a short visual journey to present our product, its features, applications, and how it compares to others. Would you like that? You can use the chat box to write your messages or activate your microphone to speak directly and I will do the same."
    );
  }, [narrate]);

  const runStep = useCallback(async (nextStage: JourneyStage) => {
    switch (nextStage) {
      case 'step_product_intro': {
        setStage('step_product_intro');
        await narrate("Excellent!! Let me begin. This is our trademarked product, SolarClip™.");
        showCard({
          type: 'video',
          title: 'SolarClip Product Intro',
          content: {
            url: 'https://res.cloudinary.com/di5gj4nyp/video/upload/v1757341336/VIDEO-2025-04-11-11-30-14_1_xywu7x.mp4'
          },
          animation: 'swoop-left'
        });
        break;
      }
      case 'step_comparison': {
        setStage('step_comparison');
        await narrate("This is how our solution compares to traditional installations.");
        showCard({
          type: 'video',
          title: 'SolarClip vs Traditional Install',
          content: {
            url: 'https://res.cloudinary.com/di5gj4nyp/video/upload/v1757341336/VIDEO-2025-04-11-11-30-14_1_xywu7x.mp4'
          },
          animation: 'swoop-left'
        });
        break;
      }
      case 'step_installation': {
        setStage('step_installation');
        await narrate("Here’s how SolarClip integrates directly into the roof structure.");
        showCard({
          type: 'video',
          title: 'Roof Integration & Installation',
          content: {
            url: 'https://res.cloudinary.com/di5gj4nyp/video/upload/v1757341336/VIDEO-2025-04-11-11-30-14_1_xywu7x.mp4'
          },
          animation: 'swoop-left'
        });
        break;
      }
      case 'map_prompt': {
        setStage('map_prompt');
        await narrate(
          "I can show you an interactive solar map with your roof's energy potential. Would you like to type in your building address to see how much power your roof can generate with SolarClip panels?"
        );
        break;
      }
      default:
        break;
    }
  }, [narrate, showCard]);

  const onCardAction = useCallback(async (action: string, data?: any) => {
    if (action !== 'card_auto_exit') return;
    if (stage === 'step_product_intro') {
      await runStep('step_comparison');
    } else if (stage === 'step_comparison') {
      await runStep('step_installation');
    } else if (stage === 'step_installation') {
      await runStep('map_prompt');
    }
  }, [stage, runStep]);

  const isPositive = (text: string) => /^(y|yes|yeah|sure|ok|okay|let's go|start)/i.test(text.trim());

  const handleUserInput = useCallback(async (text: string) => {
    if (stage === 'awaiting_start') {
      if (isPositive(text)) {
        await runStep('step_product_intro');
        return true;
      }
      const isNegative = /^\s*(no|not now|later|skip|nope|nah)\b/i.test(text);
      if (isNegative) {
        await narrate("No problem—let's continue in chat. Ask me anything about SolarClip.");
        setStage('open_chat');
        return true;
      }
    }
    if (stage === 'map_prompt') {
      // Treat any text as address unless clearly negative
      const negative = /^(no|not now|later|skip)/i.test(text.trim());
      if (!negative) {
        await narrate("Great, pulling up your solar analysis now.");
        await getSolarAnalysis(text.trim());
        setStage('open_chat');
        setTimeout(() => {
          narrate("We can continue in chat. Ask me anything about SolarClip, or I can send you product sheets and incentives. Would you like me to save your contact for a follow-up?");
        }, 1000);
        return true;
      } else {
        await narrate("No problem—let's continue in chat. Ask me anything about SolarClip.");
        setStage('open_chat');
        return true;
      }
    }
    return false;
  }, [stage, runStep, getSolarAnalysis, narrate]);

  return {
    stage,
    start,
    runStep,
    handleUserInput,
    onCardAction,
  };
};