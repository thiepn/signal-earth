import type { NowSignal, NowSignalKind } from './ranking';

interface NowPanelProps {
  signals: NowSignal[];
  loading?: boolean;
  compact?: boolean;
  onSelect(signal: NowSignal): void;
}

const GLYPHS: Record<NowSignalKind, string> = {
  earthquake: '◎',
  'natural-event': '△',
  'space-weather': '◌',
  orbit: '✦',
  local: '⌖',
};

function ageLabel(timestamp: number | null): string {
  if (!timestamp) return 'LIVE';
  const delta = timestamp - Date.now();
  const future = delta > 0;
  const minutes = Math.abs(Math.round(delta / 60_000));
  if (minutes < 2) return future ? 'SOON' : 'NOW';
  if (minutes < 60) return future ? `IN ${minutes}M` : `${minutes}M AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `IN ${hours}H` : `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

export function NowPanel({ signals, loading = false, compact = false, onSelect }: NowPanelProps) {
  return <div className={`now-panel${compact ? ' now-panel--compact' : ''}`}>
    <div className="now-feed-intro">
      <div><span className="control-eyebrow">LIVE PRIORITY FEED</span><strong>What matters now</strong></div>
      <span className="now-feed-count">{signals.length || '—'}</span>
    </div>
    <p className="now-feed-note">Ranked locally from the public data already loaded by Signal Earth. No AI-generated event claims.</p>

    {signals.length > 0 ? <div className="now-signal-list">
      {signals.map((signal) => <button
        key={signal.id}
        type="button"
        className={`now-signal now-signal--${signal.tone}${signal.rank === 1 ? ' now-signal--featured' : ''}`}
        onClick={() => onSelect(signal)}
        aria-label={`Explore ${signal.title}`}
      >
        <span className="now-signal__rank">{String(signal.rank).padStart(2, '0')}</span>
        <span className="now-signal__body">
<span className="now-signal__eyebrow"><b aria-hidden="true">{GLYPHS[signal.kind]}</b>{signal.eyebrow}</span>
<strong>{signal.title}</strong>
<small>{signal.summary}</small>
<span className="now-signal__source">{signal.source} · {ageLabel(signal.timestamp)}</span>
        </span>
        <span className="now-signal__metric">{signal.metric}</span>
      </button>)}
    </div> : <div className="now-empty">
      <span aria-hidden="true">◌</span>
      <strong>{loading ? 'Gathering live signals…' : 'No priority signals available'}</strong>
      <p>{loading ? 'Signal Earth is loading the current Earth, orbit and space-weather feeds.' : 'Try again when a provider is available, or explore the globe directly.'}</p>
    </div>}
  </div>;
}
