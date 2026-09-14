import type { CSSProperties } from 'react';
import type { SimulationClockSnapshot, SimulationSpeed } from '../../core/time/temporal';
import {
  TIMELINE_PRESETS,
  TIMELINE_WINDOW_HOURS,
  timelineModeLabel,
  timelineOffsetHours,
  timelineProgress,
} from './timeline';

const SPEEDS: SimulationSpeed[] = [1, 10, 100, 1000];

interface TimelineControlsProps {
  clock: SimulationClockSnapshot | null;
  onSetOffsetHours(hours: number): void;
  onTogglePlay(): void;
  onSetSpeed(speed: SimulationSpeed): void;
  onReturnLive(): void;
  compact?: boolean;
}

function formatOffset(value: number): string {
  if (Math.abs(value) < 0.02) return 'NOW';
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? '+' : ''}${rounded}h`;
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
  return `${hours > 0 ? '+' : '−'}${Math.abs(hours)}H`;
}

export function TimelineControls({
  clock,
  onSetOffsetHours,
  onTogglePlay,
  onSetSpeed,
  onReturnLive,
  compact = false,
}: TimelineControlsProps) {
  const offset = timelineOffsetHours(clock);
  const live = clock?.mode === 'live';
  const mode = timelineModeLabel(clock);
  const progress = timelineProgress(clock);
  const rangeStyle = { '--timeline-position': `${progress}%` } as CSSProperties;

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
      </div>

      <div className="timeline-track-wrap" style={rangeStyle}>
        <div className="timeline-labels" aria-hidden="true"><span>−24H</span><span>NOW</span><span>+24H</span></div>
        <input
          className="timeline-range"
          type="range"
          min={-TIMELINE_WINDOW_HOURS}
          max={TIMELINE_WINDOW_HOURS}
          step={0.05}
          value={offset}
          onChange={(event) => onSetOffsetHours(Number(event.target.value))}
          aria-label="Simulation time offset in hours"
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

      <div className="timeline-presets" role="group" aria-label="Timeline presets">
        {TIMELINE_PRESETS.map((hours) => (
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

      <div className="timeline-context">
        {mode === 'REPLAY' && 'Observed signals appear only after their recorded event time.'}
        {mode === 'FUTURE' && 'Observed layers do not invent future events; predictable systems may continue forward.'}
        {mode === 'LIVE' && 'Following current UTC time.'}
        {mode === 'READY' && 'Initializing simulation clock.'}
      </div>
    </div>
  );
}
