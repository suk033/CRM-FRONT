import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string; tone: "success" | "danger" };
type ToastApi = { notify: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastApi>({ notify: () => undefined });
const TOAST_MS = 4000;

/** In-app notifications shown in a polite live region (bottom-right). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = ++next.current;
      setToasts((items) => [...items, { id, message, tone }]);
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== id)),
        TOAST_MS,
      );
    },
    [],
  );
  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="ws-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ws-toast ws-toast-${toast.tone}`}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {toast.tone === "success" ? (
                <path
                  d="m4 10 4 4 8-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              ) : (
                <path
                  d="M10 5v6M10 14v1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              )}
            </svg>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Modal confirmation dialog; focus moves to the confirm button and Escape cancels. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const confirm = useRef<HTMLButtonElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement | null;
    confirm.current?.focus();
    return () => previous.current?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="ws-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="ws-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onCancel();
          }
        }}
      >
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descriptionId}>{description}</p>}
        <div className="ws-dialog-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirm}
            className="primary-action"
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
