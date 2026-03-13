import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/** A non-blocking, auto-dismissing notification shown at the bottom of the screen. */
export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 16px",
        fontSize: 12,
        color: "var(--text-primary)",
        zIndex: 9999,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        maxWidth: 480,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title="Click to dismiss"
    >
      {message}
    </div>
  );
}
