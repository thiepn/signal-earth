export interface SignalHoverPreview {
  kind: string;
  title: string;
  metric: string;
  detail: string;
  source: string;
  x: number;
  y: number;
}

let host: HTMLDivElement | null = null;
let kindNode: HTMLSpanElement | null = null;
let metricNode: HTMLElement | null = null;
let titleNode: HTMLDivElement | null = null;
let detailNode: HTMLDivElement | null = null;
let sourceNode: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (host?.isConnected) return host;

  host = document.createElement('div');
  host.className = 'hover-preview';
  host.hidden = true;
  host.setAttribute('aria-hidden', 'true');

  const top = document.createElement('div');
  top.className = 'hover-preview__top';
  kindNode = document.createElement('span');
  metricNode = document.createElement('strong');
  top.append(kindNode, metricNode);

  titleNode = document.createElement('div');
  titleNode.className = 'hover-preview__title';
  detailNode = document.createElement('div');
  detailNode.className = 'hover-preview__detail';
  sourceNode = document.createElement('div');
  sourceNode.className = 'hover-preview__source';
  host.append(top, titleNode, detailNode, sourceNode);
  document.body.append(host);
  return host;
}

export function showSignalHoverPreview(preview: SignalHoverPreview | null): void {
  const element = ensureHost();
  if (!element) return;
  if (!preview || window.matchMedia?.('(pointer: coarse)').matches) {
    element.hidden = true;
    return;
  }

  const left = Math.max(12, Math.min(preview.x + 16, window.innerWidth - 286));
  const top = Math.max(72, Math.min(preview.y + 16, window.innerHeight - 138));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  if (kindNode) kindNode.textContent = preview.kind;
  if (metricNode) metricNode.textContent = preview.metric;
  if (titleNode) titleNode.textContent = preview.title;
  if (detailNode) detailNode.textContent = preview.detail;
  if (sourceNode) sourceNode.textContent = `${preview.source} · CLICK TO INSPECT`;
  element.hidden = false;
}

export function hideSignalHoverPreview(): void {
  if (host) host.hidden = true;
}
