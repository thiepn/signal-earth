import { lazy, Suspense, type ComponentProps } from 'react';
import { LazyFeatureBoundary } from '../components/LazyFeatureBoundary';

type InspectorPanelProps = ComponentProps<(typeof import('./InspectorPanelImpl'))['InspectorPanel']>;

const LazyInspectorPanel = lazy(async () => ({ default: (await import('./InspectorPanelImpl')).InspectorPanel }));

export function InspectorPanel(props: InspectorPanelProps) {
  if (!props.entity) {
    return (
      <div className={props.compact ? 'empty-inspector' : 'inspector-panel panel-surface'}>
        {!props.compact && <header className="panel-header"><div><div className="panel-eyebrow">INSPECTOR</div><h2>Nothing selected</h2></div></header>}
        <div className="empty-state"><span className="empty-state__target" aria-hidden="true">＋</span><strong>Select a signal</strong><p>Click an earthquake, natural event, satellite, or any point on Earth.</p></div>
      </div>
    );
  }

  return (
    <LazyFeatureBoundary featureName="Signal inspector" className={props.compact ? 'inspector-content' : 'inspector-panel panel-surface'}>
      <Suspense fallback={<div className={props.compact ? 'inspector-content' : 'inspector-panel panel-surface'}><div className="empty-state"><span className="empty-state__target" aria-hidden="true">◎</span><strong>Loading signal intelligence…</strong><p>The selected object stays active while its detailed inspector loads.</p></div></div>}>
        <LazyInspectorPanel {...props} />
      </Suspense>
    </LazyFeatureBoundary>
  );
}
