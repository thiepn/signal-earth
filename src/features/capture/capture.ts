import type { VisualMode } from '../../shared/types/layers';

export interface CaptureMetadata {
  timestamp: number;
  visualMode: VisualMode;
  pointOfView: { lat: number; lng: number; altitude: number };
}

export interface RecordingResult {
  blob: Blob;
  extension: 'webm' | 'mp4';
}

export function releaseFilename(kind: 'snapshot' | 'recording', timestamp = Date.now(), extension = kind === 'snapshot' ? 'png' : 'webm'): string {
  const stamp = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  return `signal-earth-${kind}-${stamp}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function composeSignalEarthCapture(source: Blob, metadata: CaptureMetadata): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D capture context is unavailable.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const dprScale = Math.max(1, Math.min(2, canvas.width / 1280));
  const pad = Math.round(28 * dprScale);
  const width = Math.round(330 * dprScale);
  const height = Math.round(94 * dprScale);
  context.fillStyle = 'rgba(2, 7, 12, 0.78)';
  context.fillRect(pad, pad, width, height);
  context.strokeStyle = 'rgba(158, 231, 255, 0.4)';
  context.lineWidth = Math.max(1, dprScale);
  context.strokeRect(pad + 0.5, pad + 0.5, width - 1, height - 1);
  context.fillStyle = '#edf6f8';
  context.font = `600 ${Math.round(20 * dprScale)}px system-ui, sans-serif`;
  context.fillText('SIGNAL EARTH', pad + Math.round(16 * dprScale), pad + Math.round(29 * dprScale));
  context.fillStyle = '#9ee7ff';
  context.font = `600 ${Math.round(10 * dprScale)}px ui-monospace, monospace`;
  context.fillText(new Date(metadata.timestamp).toISOString().replace('.000Z', 'Z'), pad + Math.round(16 * dprScale), pad + Math.round(51 * dprScale));
  context.fillStyle = '#c8d6dc';
  context.font = `500 ${Math.round(10 * dprScale)}px ui-monospace, monospace`;
  context.fillText(`${metadata.visualMode.toUpperCase()} · ${metadata.pointOfView.lat.toFixed(2)}°, ${metadata.pointOfView.lng.toFixed(2)}°`, pad + Math.round(16 * dprScale), pad + Math.round(72 * dprScale));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png');
  });
}

export function preferredRecordingMimeType(): { mimeType: string; extension: 'webm' | 'mp4' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: Array<{ mimeType: string; extension: 'webm' | 'mp4' }> = [
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

export async function recordCanvas(stream: MediaStream, durationMs = 10_000): Promise<RecordingResult> {
  const preferred = preferredRecordingMimeType();
  if (!preferred) throw new Error('Canvas recording is not supported by this browser.');
  const recorder = new MediaRecorder(stream, { mimeType: preferred.mimeType, videoBitsPerSecond: 7_000_000 });
  const chunks: BlobPart[] = [];
  return new Promise<RecordingResult>((resolve, reject) => {
    let timer = 0;
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.onerror = () => {
      window.clearTimeout(timer);
      for (const track of stream.getTracks()) track.stop();
      reject(new Error('The browser stopped the recording unexpectedly.'));
    };
    recorder.onstop = () => {
      window.clearTimeout(timer);
      for (const track of stream.getTracks()) track.stop();
      resolve({ blob: new Blob(chunks, { type: preferred.mimeType }), extension: preferred.extension });
    };
    recorder.start(500);
    timer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  });
}
