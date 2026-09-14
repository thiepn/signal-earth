interface RendererErrorProps {
  message: string;
}

export function RendererError({ message }: RendererErrorProps) {
  return (
    <div className="renderer-error" role="alert">
      <div className="panel-eyebrow">WEBGL UNAVAILABLE</div>
      <h2>The globe could not start.</h2>
      <p>{message}</p>
      <p>Enable hardware acceleration or use a browser/device with WebGL support.</p>
    </div>
  );
}
