import { useId, useRef } from 'react';
import { useDialogFocus } from '../../ui/hooks/useDialogFocus';
import { BRIEFING_LIST } from './briefings';
import type { BriefingId } from './types';

interface BriefingLauncherProps {
  open: boolean;
  reducedMotion?: boolean;
  onClose(): void;
  onStart(id: BriefingId): void;
}

export function BriefingLauncher({ open, reducedMotion = false, onClose, onStart }: BriefingLauncherProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogFocus(open, dialogRef, onClose);
  if (!open) return null;
  return (
    <div className="briefing-launcher-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="briefing-launcher panel-surface" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="panel-header briefing-launcher__header">
          <div><div className="panel-eyebrow">CINEMATIC TOURS</div><h2 id={titleId}>Planetary Briefings</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close briefings">×</button>
        </header>
        <p className="briefing-launcher__intro">Guided, deterministic tours assembled from the same live layers, camera controls and simulation clock used everywhere else in Signal Earth.</p>
        {reducedMotion && <p className="briefing-launcher__motion-note" role="status">Reduced motion is active. Camera flights become immediate cuts while the briefing content and timing remain intact.</p>}
        <div className="briefing-grid">
          {BRIEFING_LIST.map((briefing) => (
            <button key={briefing.id} type="button" className="briefing-card" onClick={() => onStart(briefing.id)}>
              <span className="briefing-card__play" aria-hidden="true">▶</span>
              <span className="briefing-card__copy">
                <small>{briefing.eyebrow}</small>
                <strong>{briefing.title}</strong>
                <span>{briefing.description}</span>
              </span>
              <span className="briefing-card__time">~{briefing.estimatedSeconds}s</span>
            </button>
          ))}
        </div>
        <p className="briefing-launcher__note">Any manual globe drag exits the active briefing. Tour settings are restored; a manual takeover keeps the camera viewpoint you chose.</p>
      </section>
    </div>
  );
}
