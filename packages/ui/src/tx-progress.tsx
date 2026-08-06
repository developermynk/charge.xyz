"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "./cn.ts";

export type StepState = "pending" | "active" | "done" | "error";

export interface TxStep {
  id: string;
  label: string;
  state: StepState;
  /** Optional detail shown under the label, e.g. an explorer link or reason. */
  detail?: React.ReactNode;
}

/**
 * Multi-stage transaction progress.
 *
 * Design review requirement: a CCTP bridge takes minutes and moves through
 * approve -> burn -> attest -> mint. Showing one indefinite spinner for that
 * whole window is the single worst UX failure in a bridge UI — users assume it
 * has hung and either refresh (losing the handle to the tx) or double-submit.
 * Every stage is therefore named and individually stateful.
 */
export function TxProgress({ steps }: { steps: readonly TxStep[] }) {
  return (
    <ol className="space-y-0" aria-label="Transaction progress">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                  step.state === "done" &&
                    "border-charge/40 bg-charge/15 text-charge",
                  step.state === "active" &&
                    "border-charge/50 bg-charge/10 text-charge",
                  step.state === "pending" &&
                    "border-white/10 bg-white/[0.03] text-fg-tertiary",
                  step.state === "error" &&
                    "border-danger/40 bg-danger/15 text-danger",
                )}
              >
                {step.state === "done" && <Check className="size-3.5" aria-hidden />}
                {step.state === "active" && (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                )}
                {step.state === "error" && (
                  <CircleAlert className="size-3.5" aria-hidden />
                )}
                {step.state === "pending" && (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                )}
              </span>
              {!last && (
                <span
                  className={cn(
                    "w-px flex-1 transition-colors duration-300",
                    step.state === "done" ? "bg-charge/30" : "bg-white/8",
                  )}
                />
              )}
            </div>

            <div className={cn("pb-5", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm leading-7",
                  step.state === "pending" && "text-fg-tertiary",
                  step.state === "active" && "font-medium text-fg",
                  step.state === "done" && "text-fg-secondary",
                  step.state === "error" && "font-medium text-danger",
                )}
              >
                {step.label}
              </p>
              {step.detail && (
                <div className="mt-0.5 text-xs text-fg-tertiary">{step.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Screen-reader-friendly live status line for async operations. */
export function StatusLine({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border px-3.5 py-2.5 text-sm",
        tone === "info" && "border-white/10 bg-white/[0.03] text-fg-secondary",
        tone === "success" && "border-charge/25 bg-charge/10 text-charge",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
      )}
    >
      {children}
    </p>
  );
}
