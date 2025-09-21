import React from 'react';

interface IdleAvatarProps {
  className?: string;
}

export const IdleAvatar: React.FC<IdleAvatarProps> = ({ className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      {/* Subtle breathing animation while waiting for D-ID */}
      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/60 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 mx-auto mb-2 flex items-center justify-center animate-bounce">
              <div className="w-8 h-8 rounded-full bg-primary/40"></div>
            </div>
            <p className="text-sm">Isabella is preparing...</p>
          </div>
        </div>
        
        {/* Breathing effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent animate-pulse opacity-50"></div>
      </div>
    </div>
  );
};