import { useEffect, useRef, useState } from 'react';

interface IdleAvatarProps {
  imageUrl: string;
  alt: string;
  className?: string;
  isVisible: boolean;
}

export const IdleAvatar = ({ imageUrl, alt, className = "", isVisible }: IdleAvatarProps) => {
  const [microMovement, setMicroMovement] = useState(0);
  const [active, setActive] = useState(true);
  const startRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    startRef.current = Date.now();

    const scheduleNext = () => {
      if (!isVisible) return;
      const elapsed = Date.now() - (startRef.current || Date.now());

      // Cutoff idle after ~5s to avoid uncanny loops
      if (elapsed > 5000) {
        setActive(false);
        return;
      }

      // Rotate through subtle states
      setMicroMovement((prev) => (prev + 1) % 6);

      // Human-like random cadence 2.8s - 4.8s
      const delay = 2800 + Math.floor(Math.random() * 2000);
      timeoutRef.current = window.setTimeout(scheduleNext, delay);
    };

    scheduleNext();

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const getMicroMovementStyle = () => {
    if (!active) {
      // Natural still pose with very slight smile/brightness
      return { transform: 'translateX(0px) rotate(0deg)', opacity: 1, filter: 'brightness(1.015)' } as React.CSSProperties;
    }

    switch (microMovement) {
      case 0: return { transform: 'translateX(0px) translateY(0px) rotate(0deg)', opacity: 1 };
      case 1: return { transform: 'translateX(-1px) translateY(-0.5px) rotate(-1.1deg)', opacity: 0.99 };
      case 2: return { transform: 'translateX(1px) translateY(-0.5px) rotate(1.2deg)', opacity: 0.99 };
      case 3: return { transform: 'translateX(0px) translateY(0px) rotate(0deg)', opacity: 0.94 }; // soft blink
      case 4: return { transform: 'translateX(0px) translateY(0px) rotate(0deg)', opacity: 1, filter: 'brightness(1.03)' }; // subtle smile
      case 5: return { transform: 'translateX(0px) translateY(0px) rotate(0deg)', opacity: 1 };
      default: return { transform: 'translateX(0px) translateY(0px) rotate(0deg)', opacity: 1 };
    }
  };

  return (
    <img 
      src={imageUrl} 
      alt={alt}
      className={`transition-all duration-[2200ms] ease-in-out ${className}`}
      style={getMicroMovementStyle()}
    />
  );
};
