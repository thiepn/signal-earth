import { lazy, Suspense, type ComponentProps } from 'react';
import { LazyFeatureBoundary } from './LazyFeatureBoundary';

type SearchOverlayProps = ComponentProps<(typeof import('./SearchOverlayImpl'))['SearchOverlay']>;

const LazySearchOverlay = lazy(async () => ({ default: (await import('./SearchOverlayImpl')).SearchOverlay }));

export function SearchOverlay(props: SearchOverlayProps) {
  if (!props.open) return null;
  return (
    <LazyFeatureBoundary featureName="Search tools" className="search-layer">
      <Suspense fallback={<div className="search-layer" role="presentation"><div className="search-dialog search-dialog--phase12" role="status"><div className="search-context"><span>SEARCH + COMMAND</span><span>Loading search tools…</span></div></div></div>}>
        <LazySearchOverlay {...props} />
      </Suspense>
    </LazyFeatureBoundary>
  );
}
