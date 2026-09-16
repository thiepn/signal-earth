import { lazy, Suspense, type ComponentProps } from 'react';
import { LazyFeatureBoundary } from '../../ui/components/LazyFeatureBoundary';

type AboveMeControlsProps = ComponentProps<(typeof import('./AboveMeControlsImpl'))['AboveMeControls']>;

const LazyAboveMeControls = lazy(async () => ({ default: (await import('./AboveMeControlsImpl')).AboveMeControls }));

export function AboveMeControls(props: AboveMeControlsProps) {
  return (
    <LazyFeatureBoundary featureName="Above Me">
      <Suspense fallback={<div className="above-me-empty"><div className="above-me-empty__icon">⌖</div><strong>Loading local observatory…</strong><p>Observer tools load only when Above Me is opened.</p></div>}>
        <LazyAboveMeControls {...props} />
      </Suspense>
    </LazyFeatureBoundary>
  );
}
