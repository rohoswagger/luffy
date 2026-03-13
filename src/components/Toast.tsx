import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/** A non-blocking, auto-dismissing notification shown at the bottom of the screen. */
export const Toast = React.memo(function Toast({
  message,
  onDismiss,
  durationMs = 3000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div
      className="toast"
      role="alert"
      aria-live="polite"
      onClick={onDismiss}
      title="Click to dismiss"
    >
      {message}
    </div>
  );
});
