import { useSyncExternalStore } from 'react';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import { providerHealthRegistry, type ProviderHealthSnapshot, type ProviderHealthStatus } from '../../core/data/reliability';

function formatAge(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return '—';
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 60_000) return '<1m';
  if (ageMs < 60 * 60_000) return `${Math.floor(ageMs / 60_000)}m`;
  if (ageMs < 24 * 60 * 60_000) return `${Math.floor(ageMs / (60 * 60_000))}h`;
  return `${Math.floor(ageMs / (24 * 60 * 60_000))}d`;
}

function label(status: ProviderHealthStatus, online: boolean): string {
  if (!online && status !== 'error') {
    if (status === 'cached') return 'OFFLINE · CACHE';
    if (status === 'stale') return 'OFFLINE · STALE';
    if (status === 'idle') return 'OFFLINE';
  }
  switch (status) {
    case 'live': return 'LIVE';
    case 'cached': return 'CACHED';
    case 'stale': return 'STALE';
    case 'partial': return 'PARTIAL';
    case 'offline': return 'OFFLINE';
    case 'error': return 'ERROR';
    default: return 'IDLE';
  }
}

function overallStatus(health: readonly ProviderHealthSnapshot[], online: boolean): { label: string; tone: string } {
  if (!online) return { label: 'OFFLINE', tone: 'offline' };
  if (health.some((item) => item.status === 'error')) return { label: 'DEGRADED', tone: 'error' };
  if (health.some((item) => item.status === 'stale' || item.status === 'partial' || item.status === 'offline')) return { label: 'DEGRADED', tone: 'warning' };
  if (health.some((item) => item.status === 'live' || item.status === 'cached')) return { label: 'NOMINAL', tone: 'good' };
  return { label: 'WAITING', tone: 'idle' };
}

export function ProviderHealthPanel({ online }: { online: boolean }) {
  const health = useSyncExternalStore(providerHealthRegistry.subscribe, providerHealthRegistry.getSnapshot, providerHealthRegistry.getSnapshot);
  const overall = overallStatus(health, online);

  return (
    <section className="settings-section provider-health-section">
      <div className="settings-section__heading">
        <div><strong>Data reliability</strong><span>Provider health, cache state and source age</span></div>
        <span className={`quality-pill provider-overall provider-overall--${overall.tone}`}>{overall.label}</span>
      </div>

      <div className="provider-health-list" aria-label="Data provider health">
        {health.map((item) => {
          const source = SOURCE_REGISTRY[item.provider];
          return (
            <div className={`provider-health-row provider-health-row--${item.status}`} key={item.provider}>
              <div className="provider-health-main">
                <span className="provider-health-dot" aria-hidden="true" />
                <div><strong>{source.name}</strong><small>{item.detail ?? 'No reliability warning.'}</small></div>
              </div>
              <div className="provider-health-metrics">
                <span className="provider-health-state">{label(item.status, online)}</span>
                <span title="Age of source timestamp">SRC {formatAge(item.sourceUpdatedAt)}</span>
                <span title="Age of local fetch">FETCH {formatAge(item.fetchedAt)}</span>
                <span title="Last successful network latency">{item.latencyMs === null ? '— ms' : `${Math.round(item.latencyMs)} ms`}</span>
              </div>
              {(item.consecutiveFailures > 0 || item.cacheRecovered) && (
                <div className="provider-health-flags">
                  {item.consecutiveFailures > 0 && <span>{item.consecutiveFailures} fallback{item.consecutiveFailures === 1 ? '' : 's'}</span>}
                  {item.cacheRecovered && <span>CACHE RECOVERED</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="settings-hint">LIVE is a successful current provider load. CACHED is still within the provider freshness policy. STALE means a valid local fallback is being used after a failed refresh. PARTIAL means one provider sub-feed failed while usable sibling data remained available.</p>
    </section>
  );
}
