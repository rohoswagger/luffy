import React, { useEffect, useRef } from "react";

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
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

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
