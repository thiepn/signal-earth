import type { CSSProperties } from 'react';

export interface HoverPreviewModel {
  kind: string;
  title: string;
  metric: string;
  detail: string;
  source: string;
  x: number;
  y: number;
}

interface HoverPreviewProps {
  model: HoverPreviewModel | null;
}

export function HoverPreview({ model }: HoverPreviewProps) {
  if (!model) return null;
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;
  const left = Math.max(12, Math.min(model.x + 16, viewportWidth - 286));
  const top = Math.max(72, Math.min(model.y + 16, viewportHeight - 138));
  const style = { left, top } as CSSProperties;

  return (
    <div className="hover-preview panel-surface" style={style} aria-hidden="true">
      <div className="hover-preview__top"><span>{model.kind}</span><strong>{model.metric}</strong></div>
      <div className="hover-preview__title">{model.title}</div>
      <div className="hover-preview__detail">{model.detail}</div>
      <div className="hover-preview__source">{model.source} · CLICK TO INSPECT</div>
    </div>
  );
}
