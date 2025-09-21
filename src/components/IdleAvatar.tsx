import { useEffect, useState } from 'react';

interface IdleAvatarProps {
  imageUrl: string;
  alt: string;
  className?: string;
  isVisible: boolean;
}

export const IdleAvatar = ({ imageUrl, alt, className = "", isVisible }: IdleAvatarProps) => {
  const [microMovement, setMicroMovement] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Humanlike micro-movements: subtle head turns, blinking, soft smiles
    const interval = setInterval(() => {
      setMicroMovement(prev => (prev + 1) % 6);
    }, 4000); // Slower, more natural timing

    return () => clearInterval(interval);
  }, [isVisible]);

  const getMicroMovementStyle = () => {
    switch (microMovement) {
      case 0: return { transform: 'translateX(0px) rotate(0deg)', opacity: 1 }; // neutral
      case 1: return { transform: 'translateX(-1px) rotate(-0.5deg)', opacity: 0.98 }; // slight left turn
      case 2: return { transform: 'translateX(1px) rotate(0.5deg)', opacity: 0.98 }; // slight right turn  
      case 3: return { transform: 'translateX(0px) rotate(0deg)', opacity: 0.95 }; // soft blink
      case 4: return { transform: 'translateX(0px) rotate(0deg)', opacity: 1, filter: 'brightness(1.02)' }; // subtle smile
      case 5: return { transform: 'translateX(0px) rotate(0deg)', opacity: 1 }; // back to neutral
      default: return { transform: 'translateX(0px) rotate(0deg)', opacity: 1 };
    }
  };

  if (!isVisible) return null;

  return (
    <img 
      src={imageUrl} 
      alt={alt}
      className={`transition-all duration-[2000ms] ease-in-out ${className}`}
      style={getMicroMovementStyle()}
    />
  );
};