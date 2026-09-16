import { lazy, Suspense, type ComponentProps } from 'react';
import { LazyFeatureBoundary } from '../components/LazyFeatureBoundary';

type SettingsPanelProps = ComponentProps<(typeof import('./SettingsPanelImpl'))['SettingsPanel']>;

const LazySettingsPanel = lazy(async () => ({ default: (await import('./SettingsPanelImpl')).SettingsPanel }));

export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <LazyFeatureBoundary featureName="Display tools">
      <Suspense fallback={<div className="settings-content"><section className="settings-section"><div className="settings-section__heading"><div><strong>Display tools</strong><span>Loading optional controls…</span></div><span className="quality-pill">LOAD</span></div></section></div>}>
        <LazySettingsPanel {...props} />
      </Suspense>
    </LazyFeatureBoundary>
  );
}
