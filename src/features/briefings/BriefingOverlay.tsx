import { useEffect, useRef } from 'react';
import type { TourState } from './types';

interface BriefingOverlayProps {
  state: TourState;
  onSkip(): void;
  onCancel(): void;
}

export function BriefingOverlay({ state, onSkip, onCancel }: BriefingOverlayProps) {
  const overlayRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state.status !== 'running' || !state.step) return;
    overlayRef.current?.focus({ preventScroll: true });
  }, [state.status, state.step?.id]);

  if (state.status !== 'running' || !state.step) return null;
  const current = state.stepIndex + 1;
  const progress = state.stepCount ? Math.max(state.progress, current / state.stepCount) : 0;
  return (
    <section ref={overlayRef} className="briefing-overlay" role="region" tabIndex={-1} aria-live="polite" aria-label="Active cinematic briefing">
      <div className="briefing-overlay__line"><span style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      <div className="briefing-overlay__meta">
        <span>{state.briefingTitle}</span>
        <span>{current}/{state.stepCount}</span>
      </div>
      <div className="briefing-overlay__eyebrow">{state.step.eyebrow}</div>
      <h2>{state.step.title}</h2>
      <p>{state.step.body}</p>
      <div className="briefing-overlay__actions">
        <button type="button" onClick={onSkip}>NEXT</button>
        <button type="button" onClick={onCancel}>EXIT</button>
      </div>
    </section>
  );
}
