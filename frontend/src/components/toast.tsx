"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ring-1",
              toast.tone === "success"
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-rose-600 text-white ring-rose-700",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const notify = use(ToastContext);
  if (!notify) throw new Error("useToast must be used inside <ToastProvider>");
  return notify;
}
