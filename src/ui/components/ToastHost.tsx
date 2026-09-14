export interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastHostProps {
  messages: ToastMessage[];
  onDismiss(id: number): void;
}

export function ToastHost({ messages, onDismiss }: ToastHostProps) {
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {messages.map((message) => (
        <div key={message.id} className={`toast toast--${message.tone ?? 'info'}`}>
          <div>
            <strong>{message.title}</strong>
            {message.detail && <span>{message.detail}</span>}
          </div>
          <button type="button" onClick={() => onDismiss(message.id)} aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );
}
