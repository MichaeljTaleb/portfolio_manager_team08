import { useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Remove', onCancel, onConfirm }: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={isSubmitting ? undefined : onCancel}>
      <div
        className="modal card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="text-button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="danger-button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? `${confirmLabel.replace(/e$/, '')}ing…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
