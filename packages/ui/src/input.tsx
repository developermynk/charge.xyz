"use client";

import * as React from "react";

import { cn } from "./cn.ts";

/** Text input with the focus treatment used across the app. */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3",
        "text-sm text-fg placeholder:text-fg-tertiary",
        "transition-colors duration-200",
        "focus:border-charge/40 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-charge/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Numeric amount field.
 *
 * Uses inputMode="decimal" so mobile shows a numeric keypad, and tabular-nums
 * so digits do not shift width while typing.
 */
export const AmountInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    symbol?: string;
    onMax?: () => void;
  }
>(function AmountInput({ className, symbol, onMax, ...props }, ref) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5",
        "transition-colors duration-200 focus-within:border-charge/40 focus-within:bg-white/[0.05]",
        className,
      )}
    >
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="0.00"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-2xl font-medium tabular-nums text-fg",
          "placeholder:text-fg-tertiary focus:outline-none",
        )}
        {...props}
      />
      {symbol && (
        <span className="shrink-0 text-sm font-medium text-fg-secondary">
          {symbol}
        </span>
      )}
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          className="shrink-0 rounded-lg bg-charge/15 px-2.5 py-1 text-xs font-semibold text-charge transition-colors hover:bg-charge/25"
        >
          MAX
        </button>
      )}
    </div>
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium text-fg-secondary", className)}
      {...props}
    />
  );
}

/** Key/value row used for quote details — always tabular-nums on the value. */
export function DetailRow({
  label,
  value,
  emphasis,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-fg-secondary">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-fg" : "text-fg",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/[0.06] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "charge" | "accent" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "bg-white/[0.06] text-fg-secondary",
        tone === "charge" && "bg-charge/15 text-charge",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "danger" && "bg-danger/15 text-danger",
        className,
      )}
      {...props}
    />
  );
}
