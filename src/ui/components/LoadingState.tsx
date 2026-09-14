export function LoadingState() {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-mark" aria-hidden="true" />
      <div>
        <strong>Initializing Earth</strong>
        <span>Preparing the globe renderer</span>
      </div>
    </div>
  );
}
