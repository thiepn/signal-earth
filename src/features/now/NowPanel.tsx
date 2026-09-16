import { lazy, Suspense, type ComponentProps } from 'react';

type NowPanelProps = ComponentProps<(typeof import('./NowPanelImpl'))['NowPanel']>;

const LazyNowPanel = lazy(async () => ({ default: (await import('./NowPanelImpl')).NowPanel }));

export function NowPanel(props: NowPanelProps) {
  return (
    <Suspense fallback={<div className="now-panel"><div className="now-feed-intro"><div><span className="control-eyebrow">LIVE PRIORITY FEED</span><strong>What matters now</strong></div><span className="now-feed-count">…</span></div><div className="now-empty"><span aria-hidden="true">◌</span><strong>Loading priority feed…</strong></div></div>}>
      <LazyNowPanel {...props} />
    </Suspense>
  );
}
