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
          "btn-charge font-semibold",
          "hover:shadow-glow",
          "active:scale-[0.98]",
        ],
        secondary: [
          "btn-soft font-semibold",
          "active:scale-[0.98]",
        ],
        ghost: "text-fg-secondary hover:text-fg hover:bg-fg/[0.05]",
        danger: [
          "bg-danger/15 text-danger border border-danger/25",
          "hover:bg-danger/25",
        ],
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-[10px]",
        md: "h-11 px-5 text-sm rounded-xl",
        lg: "h-14 px-8 text-[15px] rounded-2xl",
        xl: "h-16 px-9 text-base rounded-2xl",
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
  /**
   * Render the child element instead of a <button>, merging in the button's
   * classes. Use for links: `<Button asChild><Link href="/x">Go</Link></Button>`.
   *
   * A <Link> nested inside a <button> is invalid HTML and breaks keyboard and
   * screen-reader navigation, so styled links must become real anchors.
   * Implemented locally rather than pulling in @radix-ui/react-slot for one
   * feature.
   */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      loading,
      asChild,
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    const classes = cn(button({ variant, size, block }), className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
      });
    }

    return (
      <button
        ref={ref}
        className={classes}
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
