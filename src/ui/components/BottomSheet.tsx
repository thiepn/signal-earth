import { useId, useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface BottomSheetProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose(): void;
  children: ReactNode;
}

export function BottomSheet({ open, title, eyebrow, onClose, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogFocus(open, dialogRef, onClose);
  if (!open) return null;

  return (
    <div className="sheet-layer">
      <button className="sheet-scrim" type="button" aria-label="Close panel" onClick={onClose} tabIndex={-1} />
      <section ref={dialogRef} className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close panel">×</button>
        </header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  );
}
