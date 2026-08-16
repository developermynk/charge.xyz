"use client";

import * as React from "react";

import { cn } from "./cn.ts";

/**
 * Glass surface — the core visual primitive.
 *
 * A translucent panel over the OLED base with a hairline top highlight, which
 * is what sells the "lit glass" look rather than a flat grey card.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { glow?: boolean }
>(function Card({ className, glow, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl border border-fg/[0.08] bg-fg/[0.03]",
        "backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-fg/20 before:to-transparent",
        glow && "shadow-[0_0_60px_-15px_rgba(110,84,255,0.32)]",
        className,
      )}
      {...props}
    />
  );
});

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pt-6 pb-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm text-fg-secondary", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}
