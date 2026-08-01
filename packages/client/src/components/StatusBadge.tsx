import React from 'react';

interface StatusBadgeProps {
  text: string;
  variant: 'alive' | 'dead' | 'speaking' | 'sheriff' | 'voted';
}

const VARIANT_STYLES: Record<string, string> = {
  alive: 'bg-camp-good/15 text-camp-good ring-camp-good/40',
  dead: 'bg-gray-500/10 text-gray-500 ring-gray-500/30',
  speaking: 'bg-gold-500/20 text-gold-300 ring-gold-400/50 shadow-gold-glow',
  sheriff: 'bg-gold-500/20 text-gold-300 ring-gold-400/50',
  voted: 'bg-wolfred-500/20 text-wolfred-400 ring-wolfred-500/40',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, variant }) => {
  return (
    <span className={`px-2 py-0.5 rounded-badge text-[10px] font-medium ring-1 shrink-0 ${VARIANT_STYLES[variant] || VARIANT_STYLES.alive}`}>
      {text}
    </span>
  );
};
