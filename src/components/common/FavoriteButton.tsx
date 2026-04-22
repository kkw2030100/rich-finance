'use client';

import { Star } from 'lucide-react';

interface FavoriteButtonProps {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: number;
}

export function FavoriteButton({ active, onClick, size = 16 }: FavoriteButtonProps) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
      style={{ lineHeight: 0 }}
      aria-label={active ? '관심종목 해제' : '관심종목 추가'}
    >
      <Star
        size={size}
        fill={active ? '#facc15' : 'none'}
        stroke={active ? '#facc15' : 'var(--text-muted)'}
        strokeWidth={2}
      />
    </button>
  );
}
