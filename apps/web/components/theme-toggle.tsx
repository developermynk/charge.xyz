"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@charge/ui";

/**
 * ThemeToggle
 *
 * Day/night switch for the whole dApp. The "dark" class on <html> is the
 * single source of truth — globals.css swaps every token inside
 * :root:not(.dark), so flipping it inverts the entire product. Choice is
 * persisted to localStorage; the no-flash script in layout.tsx applies the
 * saved theme before paint.
 *
 * Reference pattern: the sun/moon icon-button used by Uniswap, Rainbow and
 * Coinbase Wallet — a single ghost icon that animates between states, never a
 * labelled switch.
 */

type Theme = "dark" | "light";

const STORAGE_KEY = "charge-theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  // Read from DOM class (set by no-flash script) to avoid hydration mismatch
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  // Sync theme across tabs/windows
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const next = e.newValue as Theme;
        document.documentElement.classList.toggle("dark", next === "dark");
        setTheme(next);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = React.useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-xl",
        "text-fg-secondary transition-colors hover:bg-fg/[0.06] hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60",
        "motion-reduce:transition-none",
        className,
      )}
    >
      {/* Both icons stacked; cross-fade + rotate on toggle. Hidden until
          mounted so we never flash the wrong glyph during SSR/CSR. */}
      <Sun
        className={cn(
          "size-5 transition-all duration-300",
          mounted && !isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-50 opacity-0",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute size-5 transition-all duration-300",
          mounted && isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-50 opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}
