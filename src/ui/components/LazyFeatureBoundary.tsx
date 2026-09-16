import { Component, type ErrorInfo, type ReactNode } from 'react';

interface LazyFeatureBoundaryProps {
  featureName: string;
  children: ReactNode;
  className?: string;
  detail?: string;
}

interface LazyFeatureBoundaryState {
  failed: boolean;
}

export class LazyFeatureBoundary extends Component<LazyFeatureBoundaryProps, LazyFeatureBoundaryState> {
  state: LazyFeatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyFeatureBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // React has already contained the rejected lazy import. Keep the failure
    // local to this feature; the rest of the observatory remains interactive.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const className = `${this.props.className ?? 'panel-surface'} lazy-feature-error`;
    return (
      <div className={className} role="alert">
        <div className="lazy-feature-error__card">
          <div className="panel-eyebrow">MODULE LOAD ERROR</div>
          <strong>{this.props.featureName} failed to load.</strong>
          <p>{this.props.detail ?? 'A deferred Signal Earth module could not be downloaded or initialized. Your current observatory state remains intact.'}</p>
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Reload Signal Earth</button>
        </div>
      </div>
    );
  }
}
