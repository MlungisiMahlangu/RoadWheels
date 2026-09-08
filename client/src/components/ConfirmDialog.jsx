import { useEffect, useRef } from 'react';

const ConfirmDialog = ({ open, title, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Focus cancel button for keyboard safety
      setTimeout(() => cancelRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmStyles = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 focus-ring-red'
    : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] focus-ring-accent';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[scaleIn_0.2s_ease-out]">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">{message}</p>
        <div className={`flex ${cancelLabel ? 'gap-3' : ''}`}>{cancelLabel && (
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
        )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-full text-white font-semibold text-sm transition-colors ${confirmStyles}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
