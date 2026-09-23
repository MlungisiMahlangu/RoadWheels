import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Yes', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(onCancel);
  const id = useId();

  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.querySelector('button')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); }
      if (event.key === 'Tab') {
        const buttons = dialog?.querySelectorAll('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" role="presentation">
      <div className="absolute inset-0 bg-[#101a16]/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={onCancel} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-7 sm:p-8 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className={`mb-5 grid size-11 place-items-center rounded-2xl ${variant === 'danger' ? 'bg-red-50 text-red-700' : 'bg-[var(--color-soft)] text-[var(--color-accent)]'}`}><Icon name={variant === 'danger' ? 'close' : 'check'} size={22} /></div>
        <h2 id={`${id}-title`} className="text-2xl font-semibold mb-3">{title}</h2>
        <p id={`${id}-message`} className="text-sm text-[var(--color-text-muted)] leading-7 mb-7">{message}</p>
        <div className="flex flex-wrap gap-3">
          {cancelLabel && <button onClick={onCancel} className="btn-secondary flex-1 !text-xs">{cancelLabel}</button>}
          <button onClick={onConfirm} className={`btn-primary flex-1 !text-xs ${variant === 'danger' ? '!bg-red-700 hover:!bg-red-800' : ''}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>, document.body,
  );
}
