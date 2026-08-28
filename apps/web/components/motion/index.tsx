"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

/**
 * Motion primitives for Chargefi.
 *
 * Thin, accessible wrappers over framer-motion. Every primitive honours
 * prefers-reduced-motion (auto-skips transforms/springs) and never changes
 * the semantic markup — they only add entrance + hover motion. Feature pages
 * keep all their data/logic; they just wrap their existing JSX in these.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + rise on mount. `delay` lets you stagger siblings. */
export function FadeIn({
  children,
  delay = 0,
  y = 14,
  className,
  ...rest
}: { children: React.ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggers its direct <FadeIn>-like children by index. */
export function Stagger({
  children,
  className,
  step = 0.06,
  ...rest
}: { children: React.ReactNode; step?: number } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : step } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: React.ReactNode } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card with subtle hover lift + glow. Drop-in replacement for the static
 * <Card> wrapper in tiles/lists. Keeps focus-visible ring for a11y.
 */
export function MotionCard({
  children,
  className,
  glow = true,
  ...rest
}: { children: React.ReactNode; glow?: boolean } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={
        reduce
          ? undefined
          : { y: -3, transition: { duration: 0.2, ease: EASE } }
      }
      style={
        glow
          ? { transformStyle: "preserve-3d" }
          : undefined
      }
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Wraps a page's content with an entrance + cross-route transition. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Client entrance wrapper for server-component pages (Swap/Bridge/Send/etc.).
 *
 * Deliberately does NOT animate opacity — the content is server-rendered and
 * visible on first paint, so a fade would cause a "show → hide → show" flash
 * (it fades the already-visible SSR content back to 0). Instead we only do a
 * short positional settle (translateY) on mount, which reads as motion without
 * ever blanking the panel. Reduced-motion users get zero movement.
 */
export function PageEnter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y: 12 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Animated underline / pill that slides to the active nav item (layoutId). */
export function NavPill({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      layoutId="nav-pill"
      className="absolute inset-0 -z-10 rounded-lg bg-fg/[0.06]"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}

/** Magnetic-ish hover tilt for hero/preview panels. Purely visual. */
export function HoverDepth({
  children,
  className,
  ...rest
}: { children: React.ReactNode } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={
        reduce ? undefined : { scale: 1.012, transition: { duration: 0.25, ease: EASE } }
      }
      style={{ transformStyle: "preserve-3d" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
