import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  onUndo?: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, onUndo, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            onUndo();
            onDismiss();
          }}
        >
          Undo
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
