import type { CSSProperties } from 'react';
import type { SimulationClockSnapshot, SimulationSpeed } from '../../core/time/temporal';
import {
  TIMELINE_PRESETS,
  TIMELINE_RANGE_ORDER,
  TIMELINE_RANGES,
  timelineLivePosition,
  timelineModeLabel,
  timelineOffsetHours,
  timelineProgress,
  type TimelineRange,
} from './timeline';

const SPEEDS: SimulationSpeed[] = [1, 10, 100, 1000];

interface TimelineControlsProps {
  clock: SimulationClockSnapshot | null;
  range: TimelineRange;
  onRangeChange(range: TimelineRange): void;
  onSetOffsetHours(hours: number): void;
  onTogglePlay(): void;
  onSetSpeed(speed: SimulationSpeed): void;
  onReturnLive(): void;
  onReplayLast24Hours(): void;
  replayActive?: boolean;
  orbitAvailable?: boolean;
  activity?: { earthquakes: number; events: number };
  compact?: boolean;
}

function formatOffset(value: number): string {
  if (Math.abs(value) < 0.02) return 'NOW';
  const absolute = Math.abs(value);
  if (absolute >= 48) {
    const days = absolute / 24;
    const rounded = days >= 10 ? days.toFixed(0) : days.toFixed(days % 1 < 0.02 ? 0 : 1);
    return `${value > 0 ? '+' : '−'}${rounded}d`;
  }
  const rounded = absolute >= 10 ? absolute.toFixed(0) : absolute.toFixed(1);
  return `${value > 0 ? '+' : '−'}${rounded}h`;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toISOString().slice(11, 16);
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '---- -- --';
  return new Date(timestamp).toISOString().slice(0, 10);
}

function presetLabel(hours: number): string {
  if (hours === 0) return 'NOW';
  const absolute = Math.abs(hours);
  if (absolute >= 48 && absolute % 24 === 0) return `${hours > 0 ? '+' : '−'}${absolute / 24}D`;
  return `${hours > 0 ? '+' : '−'}${absolute}H`;
}

function boundaryLabel(hours: number): string {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24}D`;
  return `${hours}H`;
}

export function TimelineControls({
  clock,
  range,
  onRangeChange,
  onSetOffsetHours,
  onTogglePlay,
  onSetSpeed,
  onReturnLive,
  onReplayLast24Hours,
  replayActive = false,
  orbitAvailable = true,
  activity,
  compact = false,
}: TimelineControlsProps) {
  const config = TIMELINE_RANGES[range];
  const offset = Math.max(-config.pastHours, Math.min(config.futureHours, timelineOffsetHours(clock)));
  const live = clock?.mode === 'live';
  const mode = timelineModeLabel(clock);
  const progress = timelineProgress(clock, range);
  const livePosition = timelineLivePosition(range);
  const rangeStyle = {
    '--timeline-position': `${progress}%`,
    '--timeline-live-position': `${livePosition}%`,
  } as CSSProperties;
  const deepReplay = offset < -24.02;

  let context = 'Initializing simulation clock.';
  if (replayActive) context = 'Replaying the previous 24 hours to LIVE at 1000×. Playback stops when it catches wall time.';
  else if (mode === 'REPLAY' && deepReplay) context = orbitAvailable
    ? 'Deep replay · observed Earth layers follow recorded time.'
    : 'Deep replay · observed Earth layers remain time-aware; Orbit is limited to its certified ±24h window.';
  else if (mode === 'REPLAY') context = 'Observed signals appear only after their recorded event time.';
  else if (mode === 'FUTURE') context = 'Observed layers do not invent future events; predictable systems may continue forward.';
  else if (mode === 'LIVE') context = 'Following current UTC time.';

  return (
    <div className={compact ? 'timeline-controls timeline-controls--compact' : 'timeline-bar panel-surface'}>
      <div className="timeline-playback">
        <button
          className="timeline-play"
          type="button"
          onClick={onTogglePlay}
          aria-label={clock?.isPlaying ? 'Pause time' : 'Play time'}
        >
          {clock?.isPlaying ? 'Ⅱ' : '▶'}
        </button>
        <div className="timeline-time">
          <strong>{formatTime(clock?.simulationTime)}</strong>
          <span>{formatDate(clock?.simulationTime)} UTC</span>
        </div>
        <span className={`timeline-mode timeline-mode--${mode.toLowerCase()}`}>{mode}</span>
        {activity && <span className="timeline-activity" title="Visible observed signals at this simulation time">Q {activity.earthquakes} · E {activity.events}</span>}
      </div>

      <div className="timeline-track-wrap" style={rangeStyle}>
        <div className="timeline-labels" aria-hidden="true"><span>−{boundaryLabel(config.pastHours)}</span><span className="timeline-label-now" style={{ left: `${livePosition}%` }}>NOW</span><span>+{boundaryLabel(config.futureHours)}</span></div>
        <input
          className="timeline-range"
          type="range"
          min={-config.pastHours}
          max={config.futureHours}
          step={config.stepHours}
          value={offset}
          onChange={(event) => onSetOffsetHours(Number(event.target.value))}
          aria-label="Simulation time offset from current UTC time"
          aria-valuetext={live ? 'Live current time' : `${formatOffset(offset)} from current time`}
        />
        <div className="timeline-offset">{live ? 'LIVE' : formatOffset(offset)}</div>
      </div>

      <div className="timeline-speed-group" role="group" aria-label="Playback speed">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={clock?.speed === speed && clock.isPlaying ? 'is-active' : ''}
            aria-pressed={clock?.speed === speed && Boolean(clock.isPlaying)}
            onClick={() => onSetSpeed(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>

      <button className={`live-button ${live ? 'is-live' : ''}`} type="button" aria-pressed={Boolean(live)} onClick={onReturnLive}>
        <span aria-hidden="true" /> LIVE
      </button>

      <div className="timeline-range-group" role="group" aria-label="Historical timeline range">
        {TIMELINE_RANGE_ORDER.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={range === candidate ? 'is-active' : ''}
            aria-pressed={range === candidate}
            onClick={() => onRangeChange(candidate)}
          >
            {TIMELINE_RANGES[candidate].label}
          </button>
        ))}
      </div>

      <div className="timeline-presets" role="group" aria-label="Timeline presets">
        {TIMELINE_PRESETS[range].map((hours) => (
          <button
            key={hours}
            type="button"
            className={Math.abs(offset - hours) < 0.08 ? 'is-active' : ''}
            aria-pressed={Math.abs(offset - hours) < 0.08}
            onClick={() => hours === 0 ? onReturnLive() : onSetOffsetHours(hours)}
          >
            {presetLabel(hours)}
          </button>
        ))}
      </div>

      <button
        className={`timeline-replay-button ${replayActive ? 'is-active' : ''}`}
        type="button"
        aria-pressed={replayActive}
        onClick={onReplayLast24Hours}
        title="Replay the previous 24 hours at 1000× and stop automatically at LIVE"
      >
        ↻ 24H REPLAY
      </button>

      <div className="timeline-context">{context}</div>
    </div>
  );
}
