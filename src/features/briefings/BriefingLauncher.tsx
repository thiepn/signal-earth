import { lazy, Suspense, type ComponentProps } from 'react';

type BriefingLauncherProps = ComponentProps<(typeof import('./BriefingLauncherImpl'))['BriefingLauncher']>;

const LazyBriefingLauncher = lazy(async () => ({ default: (await import('./BriefingLauncherImpl')).BriefingLauncher }));

export function BriefingLauncher(props: BriefingLauncherProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={<div className="briefing-launcher-layer" role="presentation"><section className="briefing-launcher panel-surface" role="status"><header className="panel-header briefing-launcher__header"><div><div className="panel-eyebrow">DYNAMIC PLANETARY TOURS</div><h2>Planetary Briefings</h2></div></header><p className="briefing-launcher__intro">Loading briefing composer…</p></section></div>}>
      <LazyBriefingLauncher {...props} />
    </Suspense>
  );
}
