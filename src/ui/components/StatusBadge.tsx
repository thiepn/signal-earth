import type { ReactNode } from 'react';

interface StatusBadgeProps {
  tone?: 'live' | 'muted' | 'warning' | 'error';
  children: ReactNode;
}

export function StatusBadge({ tone = 'muted', children }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`} role="status">
      <span className="status-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
