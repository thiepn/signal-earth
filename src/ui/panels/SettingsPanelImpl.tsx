import type { AccessibilityPreferences, ContrastPreference, MotionPreference, SystemAccessibilityPreferences } from '../../core/accessibility/preferences';
import type { DeviceCapabilities } from '../../core/device/capabilities';
import type { GlobeEngineMetrics } from '../../core/engine/globe.types';
import type { QualityLevel } from '../../core/engine/QualityManager';
import { assessPerformance } from '../../core/performance/certification';
import type { GlobeViewportQuality } from '../../features/globe/GlobeViewport';
import { SavedWorldsPanel } from '../../features/saved-worlds';
import type { VisualMode } from '../../shared/types/layers';

const VISUAL_MODES: Array<{ id: VisualMode; label: string; description: string; glyph: string }> = [
  { id: 'earth', label: 'Earth', description: 'Natural daylight', glyph: '◐' },
  { id: 'signal', label: 'Signal', description: 'Data-first cartography', glyph: '◎' },
  { id: 'night', label: 'Night', description: 'Low-light observatory', glyph: '✦' },
  { id: 'wireframe', label: 'Wireframe', description: 'Technical geometry', glyph: '⌗' },
];

interface SettingsPanelProps {
  quality: GlobeViewportQuality;
  metrics: GlobeEngineMetrics | null;
  visualMode: VisualMode;
  accessibility: AccessibilityPreferences;
  systemAccessibility: SystemAccessibilityPreferences;
  reducedMotion: boolean;
  highContrast: boolean;
  device: DeviceCapabilities;
  onVisualMode(mode: VisualMode): void;
  onQuality(value: 'auto' | QualityLevel): void;
  onMotionPreference(value: MotionPreference): void;
  onContrastPreference(value: ContrastPreference): void;
  releaseVersion: string;
  offlineReady: boolean;
  online: boolean;
  installAvailable: boolean;
  recording: boolean;
  recordingSupported: boolean;
  onShare(): void;
  onCapture(): void;
  onRecord(): void;
  onInstall(): void;
  onFullscreen(): void;
  onReset(): void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const assessment = assessPerformance(props.metrics, props.device.tier);
  const healthLabel = assessment.health === 'good' ? 'PASS' : assessment.health === 'watch' ? 'WATCH' : assessment.health === 'poor' ? 'OVER BUDGET' : 'WAITING';

  return (
    <div className="settings-content">
      <section className="settings-section">
        <div className="settings-section__heading">
          <div><strong>Earth view</strong><span>Scientific presentation modes</span></div>
          <span className="quality-pill">{props.visualMode.toUpperCase()}</span>
        </div>
        <div className="visual-mode-grid">
          {VISUAL_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={props.visualMode === mode.id ? 'visual-mode-card is-active' : 'visual-mode-card'}
              onClick={() => props.onVisualMode(mode.id)}
              aria-pressed={props.visualMode === mode.id}
            >
              <span className="visual-mode-glyph" aria-hidden="true">{mode.glyph}</span>
              <span><strong>{mode.label}</strong><small>{mode.description}</small></span>
            </button>
          ))}
        </div>
        <p className="settings-hint">Keyboard: 1 Earth · 2 Signal · 3 Night · 4 Wireframe</p>
      </section>

      <section className="settings-section">
        <div className="settings-section__heading">
          <div><strong>Rendering quality</strong><span>Adaptive by default</span></div>
          <span className="quality-pill">{props.quality.mode === 'auto' ? `AUTO · ${props.quality.level}` : props.quality.level.toUpperCase()}</span>
        </div>
        <div className="segmented-control segmented-control--four" role="group" aria-label="Rendering quality">
          {(['auto', 'low', 'medium', 'high'] as const).map((value) => {
            const active = value === 'auto' ? props.quality.mode === 'auto' : props.quality.mode === 'manual' && props.quality.level === value;
            return <button key={value} type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => props.onQuality(value)}>{value}</button>;
          })}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section__heading">
          <div><strong>Motion</strong><span>System preference is honored by default</span></div>
          <span className="quality-pill">{props.reducedMotion ? 'REDUCED' : 'FULL'}</span>
        </div>
        <div className="segmented-control segmented-control--three" role="group" aria-label="Motion preference">
          {(['system', 'reduced', 'full'] as const).map((value) => (
            <button key={value} type="button" className={props.accessibility.motion === value ? 'is-active' : ''} aria-pressed={props.accessibility.motion === value} onClick={() => props.onMotionPreference(value)}>{value}</button>
          ))}
        </div>
        <p className="settings-hint">System reports {props.systemAccessibility.reducedMotion ? 'reduced motion' : 'no reduced-motion preference'}. Reduced mode removes decorative pulses and converts camera flights to cuts.</p>
      </section>

      <section className="settings-section">
        <div className="settings-section__heading">
          <div><strong>Contrast</strong><span>Optional stronger UI boundaries</span></div>
          <span className="quality-pill">{props.highContrast ? 'HIGH' : 'NORMAL'}</span>
        </div>
        <div className="segmented-control segmented-control--three" role="group" aria-label="Contrast preference">
          {(['system', 'high', 'normal'] as const).map((value) => (
            <button key={value} type="button" className={props.accessibility.contrast === value ? 'is-active' : ''} aria-pressed={props.accessibility.contrast === value} onClick={() => props.onContrastPreference(value)}>{value}</button>
          ))}
        </div>
        <p className="settings-hint">Forced-colors: {props.systemAccessibility.forcedColors ? 'active' : 'off'} · System high contrast: {props.systemAccessibility.highContrast ? 'requested' : 'not requested'}</p>
      </section>

      <section className="settings-section">
        <div className="settings-section__heading"><div><strong>Runtime certification</strong><span>{props.device.tier} device profile</span></div><span className={`quality-pill runtime-health runtime-health--${assessment.health}`}>{healthLabel}</span></div>
        <dl className="metrics-grid metrics-grid--phase14">
          <div><dt>FPS</dt><dd>{props.metrics ? props.metrics.fps.toFixed(0) : '—'}</dd></div>
          <div><dt>Avg frame</dt><dd>{props.metrics ? `${props.metrics.frameMs.toFixed(1)} ms` : '—'}</dd></div>
          <div><dt>P95 frame</dt><dd>{props.metrics ? `${props.metrics.p95FrameMs.toFixed(1)} ms` : '—'}</dd></div>
          <div><dt>Long frames</dt><dd>{props.metrics ? `${(props.metrics.longFrameRate * 100).toFixed(0)}%` : '—'}</dd></div>
          <div><dt>Draw calls</dt><dd>{props.metrics?.drawCalls ?? '—'}</dd></div>
          <div><dt>Triangles</dt><dd>{props.metrics ? props.metrics.triangles.toLocaleString() : '—'}</dd></div>
          <div><dt>Textures</dt><dd>{props.metrics?.textures ?? '—'}</dd></div>
          <div><dt>Geometry</dt><dd>{props.metrics?.geometries ?? '—'}</dd></div>
        </dl>
        {(assessment.failed.length > 0 || assessment.warned.length > 0) && <div className="runtime-notes" role="status">
          {[...assessment.failed, ...assessment.warned].slice(0, 3).map((item) => <span key={item}>{item}</span>)}
        </div>}
      </section>

      <section className="settings-section">
        <div className="settings-section__heading"><div><strong>Device</strong><span>Capability snapshot</span></div><span className="quality-pill">{props.device.webgl2 ? 'WEBGL2' : 'WEBGL1'}</span></div>
        <dl className="metrics-grid">
          <div><dt>CPU threads</dt><dd>{props.device.hardwareConcurrency}</dd></div>
          <div><dt>Memory hint</dt><dd>{props.device.deviceMemoryGb ? `${props.device.deviceMemoryGb} GB` : '—'}</dd></div>
          <div><dt>Pointer</dt><dd>{props.device.coarsePointer ? 'coarse' : 'fine'}</dd></div>
          <div><dt>DPR</dt><dd>{props.device.devicePixelRatio.toFixed(1)}×</dd></div>
        </dl>
      </section>

      <section className="settings-section settings-section--saved-worlds">
        <div className="settings-section__heading">
          <div><strong>Saved Worlds</strong><span>Local observatory presets</span></div>
          <span className="quality-pill">LOCAL</span>
        </div>
        <SavedWorldsPanel onCaptureCurrentView={props.onShare} />
      </section>

      <section className="settings-section">
        <div className="settings-section__heading">
          <div><strong>Release tools</strong><span>Share, capture and offline app</span></div>
          <span className="quality-pill">V{props.releaseVersion}</span>
        </div>
        <div className="release-status-grid" aria-label="Release status">
          <div><span>Network</span><strong>{props.online ? 'ONLINE' : 'OFFLINE'}</strong></div>
          <div><span>Offline shell</span><strong>{props.offlineReady ? 'READY' : 'PENDING'}</strong></div>
        </div>
        <div className="release-action-grid">
          <button className="secondary-button" type="button" onClick={props.onShare}>Copy view link</button>
          <button className="secondary-button" type="button" onClick={props.onCapture}>Capture PNG</button>
          <button className="secondary-button" type="button" onClick={props.onRecord} disabled={!props.recordingSupported || props.recording}>{props.recording ? 'Recording…' : 'Record 10s'}</button>
          {props.installAvailable && <button className="secondary-button" type="button" onClick={props.onInstall}>Install app</button>}
        </div>
        <p className="settings-hint">Share links reproduce the public globe state but intentionally exclude your observer location and accessibility preferences. Recording support depends on the browser.</p>
      </section>

      <section className="settings-section settings-actions">
        <button className="secondary-button" type="button" onClick={props.onFullscreen}>Fullscreen</button>
        <button className="secondary-button" type="button" onClick={props.onReset}>Reset globe</button>
      </section>
    </div>
  );
}
