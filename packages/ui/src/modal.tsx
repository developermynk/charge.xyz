"use client";

import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn.ts";

/**
 * Accessible modal.
 *
 * Handles the three things hand-rolled dapp modals usually miss:
 * Escape to close, body-scroll lock while open, and focus moving into the
 * dialog (then restoring to the trigger on close).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  /*
    Render into document.body via a portal.

    A `fixed` overlay is NOT enough on its own: any ancestor with
    backdrop-filter, filter, transform or contain creates a containing block
    AND a stacking context, which traps the overlay inside its parent's
    z-order. Our glass Cards use backdrop-blur, so a modal opened from inside
    one was being painted UNDER the card that opened it. Portalling to body
    escapes every ancestor stacking context for good.
  */
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so keyboard users are not stranded behind it.
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md rounded-3xl border border-white/10 bg-panel/95 backdrop-blur-2xl",
          "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] outline-none",
          "animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-fg-secondary">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-fg-tertiary transition-colors hover:bg-white/[0.06] hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
