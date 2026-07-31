import React from 'react';

interface StatusBadgeProps {
  text: string;
  variant: 'alive' | 'dead' | 'speaking' | 'sheriff' | 'voted';
}

const VARIANT_STYLES: Record<string, string> = {
  alive: 'bg-green-600 text-white',
  dead: 'bg-gray-600 text-gray-300',
  speaking: 'bg-yellow-500 text-black',
  sheriff: 'bg-yellow-600 text-white',
  voted: 'bg-red-600 text-white',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, variant }) => {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${VARIANT_STYLES[variant] || VARIANT_STYLES.alive}`}>
      {text}
    </span>
  );
};
