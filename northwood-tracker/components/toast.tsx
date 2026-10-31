"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

const TOAST_MS = 3000;

const ToastContext = createContext<(message: string) => void>(() => {});

// Returns a function that shows a toast at the top center of the screen.
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A new toast replaces the current one and restarts the timer.
  const show = useCallback((message: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      {/* Always mounted so screen readers announce each new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="animate-toast-in rounded-md bg-primary px-5 py-3 text-sm text-on-primary"
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext>
  );
}
