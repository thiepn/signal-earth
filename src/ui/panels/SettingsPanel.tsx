import { lazy, Suspense, type ComponentProps } from 'react';

type SettingsPanelProps = ComponentProps<(typeof import('./SettingsPanelImpl'))['SettingsPanel']>;

const LazySettingsPanel = lazy(async () => ({ default: (await import('./SettingsPanelImpl')).SettingsPanel }));

export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <Suspense fallback={<div className="settings-content"><section className="settings-section"><div className="settings-section__heading"><div><strong>Display tools</strong><span>Loading optional controls…</span></div><span className="quality-pill">LOAD</span></div></section></div>}>
      <LazySettingsPanel {...props} />
    </Suspense>
  );
}
