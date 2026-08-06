"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "./cn.ts";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-all duration-200 ease-out select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
    "disabled:pointer-events-none disabled:opacity-40",
    "motion-reduce:transition-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-charge text-black font-semibold",
          "hover:bg-charge-hover hover:shadow-glow",
          "active:scale-[0.98]",
        ],
        secondary: [
          "bg-white/[0.06] text-fg border border-white/10 backdrop-blur-xl",
          "hover:bg-white/[0.1] hover:border-white/20",
          "active:scale-[0.98]",
        ],
        ghost: "text-fg-secondary hover:text-fg hover:bg-white/[0.05]",
        danger: [
          "bg-danger/15 text-danger border border-danger/25",
          "hover:bg-danger/25",
        ],
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-[10px]",
        md: "h-11 px-5 text-sm rounded-xl",
        lg: "h-13 px-7 text-base rounded-2xl",
        icon: "h-10 w-10 rounded-xl",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, block, loading, children, disabled, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(button({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
