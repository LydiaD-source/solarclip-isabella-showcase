import { useEffect, useState } from 'react';

interface IdleAvatarProps {
  imageUrl: string;
  alt: string;
  className?: string;
  isVisible: boolean;
}

export const IdleAvatar = ({ imageUrl, alt, className = "", isVisible }: IdleAvatarProps) => {
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 3000); // Change animation every 3 seconds

    return () => clearInterval(interval);
  }, [isVisible]);

  const getAnimationClass = () => {
    switch (animationPhase) {
      case 0: return 'animate-pulse duration-2000';
      case 1: return 'animate-fade-in duration-1000';
      case 2: return 'animate-pulse duration-2000';
      case 3: return 'animate-fade-in duration-1000';
      default: return '';
    }
  };
  if (!isVisible) return null;

  return (
    <img 
      src={imageUrl} 
      alt={alt}
      className={`transition-all ${getAnimationClass()} ${className}`}
    />
  );
};