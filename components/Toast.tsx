"use client";

import { useEffect } from "react";

export type ToastState = {
  message: string;
  /** 「元に戻す」を出したいときだけ渡す。 */
  onUndo?: () => void;
};

type Props = {
  toast: ToastState;
  onClose: () => void;
};

/** 何もしなければこの時間で自動的に消える。 */
const AUTO_CLOSE_MS = 7000;

export default function Toast({ toast, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="shine shine-top" aria-hidden="true" />
      <span className="glow glow-top" aria-hidden="true" />

      <span className="toast-message">{toast.message}</span>

      {toast.onUndo && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            toast.onUndo?.();
            onClose();
          }}
        >
          元に戻す
        </button>
      )}

      <button type="button" className="icon-button" aria-label="通知を閉じる" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
