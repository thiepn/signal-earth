import { useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from '../../ui/hooks/useDialogFocus';
import { applyDynamicBriefings, getBriefingList } from './briefings';
import { composeDynamicBriefings } from './dynamic';
import type { BriefingDefinition, BriefingId } from './types';

interface BriefingLauncherProps {
  open: boolean;
  reducedMotion?: boolean;
  onClose(): void;
  onStart(id: BriefingId): void;
}

function stateLabel(briefing: BriefingDefinition): string {
  if (!briefing.dataDriven) return 'CURATED';
  if (briefing.dataState === 'live') return 'LIVE DATA';
  if (briefing.dataState === 'cached') return 'CACHED';
  if (briefing.dataState === 'partial') return 'PARTIAL';
  if (briefing.dataState === 'unavailable') return 'UNAVAILABLE';
  return 'FALLBACK';
}

export function BriefingLauncher({ open, reducedMotion = false, onClose, onStart }: BriefingLauncherProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [briefings, setBriefings] = useState(() => getBriefingList());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('Dynamic briefings refresh when this panel opens.');
  useDialogFocus(open, dialogRef, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setBriefings(getBriefingList());
    setRefreshing(true);
    setRefreshMessage('Refreshing USGS · NASA EONET · CelesTrak · NOAA SWPC…');
    composeDynamicBriefings(controller.signal).then(({ snapshot, definitions }) => {
      if (controller.signal.aborted) return;
      applyDynamicBriefings(definitions);
      setBriefings(getBriefingList());
      const availableProviders = [snapshot.earthquakes, snapshot.naturalEvents, snapshot.orbit, snapshot.spaceWeather].filter(Boolean).length;
      const issueCount = Object.keys(snapshot.errors).length;
      setRefreshMessage(`${availableProviders}/4 public briefing sources ready${issueCount ? ` · ${issueCount} degraded` : ''} · composed ${new Date(snapshot.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setBriefings(getBriefingList());
      setRefreshMessage(`Live briefing refresh failed; certified fallback tours remain available. ${error instanceof Error ? error.message : ''}`.trim());
    }).finally(() => {
      if (!controller.signal.aborted) setRefreshing(false);
    });
    return () => controller.abort();
  }, [open]);

  if (!open) return null;
  return (
    <div className="briefing-launcher-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="briefing-launcher panel-surface" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="panel-header briefing-launcher__header">
          <div><div className="panel-eyebrow">DYNAMIC PLANETARY TOURS</div><h2 id={titleId}>Planetary Briefings</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close briefings">×</button>
        </header>
        <p className="briefing-launcher__intro">Data-driven tours are composed from the same cached/public provider snapshots used by Signal Earth. Narration is deterministic and source-grounded; no generative model invents briefing claims.</p>
        <div className={`briefing-live-status ${refreshing ? 'is-refreshing' : ''}`} role="status">
          <span>{refreshing ? '↻' : '●'}</span><strong>{refreshing ? 'COMPOSING LIVE BRIEFINGS' : 'BRIEFING SNAPSHOT READY'}</strong><small>{refreshMessage}</small>
        </div>
        {reducedMotion && <p className="briefing-launcher__motion-note" role="status">Reduced motion is active. Camera flights become immediate cuts while briefing content and timing remain intact.</p>}
        <div className="briefing-grid">
          {briefings.map((briefing) => {
            const unavailable = briefing.available === false;
            const waiting = Boolean(briefing.dataDriven && refreshing);
            return (
              <button key={briefing.id} type="button" className={`briefing-card ${briefing.dataDriven ? 'briefing-card--dynamic' : ''} ${unavailable ? 'is-unavailable' : ''}`} disabled={unavailable || waiting} onClick={() => onStart(briefing.id)}>
                <span className="briefing-card__play" aria-hidden="true">{waiting ? '↻' : unavailable ? '—' : '▶'}</span>
                <span className="briefing-card__copy">
                  <small className="briefing-card__eyebrow-row"><span>{briefing.eyebrow}</span><b className={`briefing-data-chip briefing-data-chip--${briefing.dataState ?? 'static'}`}>{stateLabel(briefing)}</b></small>
                  <strong>{briefing.title}</strong>
                  <span>{unavailable ? briefing.unavailableReason ?? briefing.description : briefing.description}</span>
                  {briefing.dataSummary && <em>{briefing.dataSummary}</em>}
                </span>
                <span className="briefing-card__time">{unavailable ? '—' : `~${briefing.estimatedSeconds}s`}</span>
              </button>
            );
          })}
        </div>
        <p className="briefing-launcher__note">Dynamic definitions freeze when you press Play, so provider refreshes cannot change narration halfway through a tour. Any manual globe drag exits the active briefing and restores your previous Signal Earth state.</p>
      </section>
    </div>
  );
}
