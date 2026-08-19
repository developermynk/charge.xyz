"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

/**
 * VantaFog
 *
 * Animated fog background for the landing hero, themed to the Chargefi
 * purple palette. Three.js r134 + Vanta Fog 0.5.24 are vendored under
 * /public/vendor and loaded via next/script so they never block first paint
 * and are not fetched on every route.
 *
 * The canvas mounts behind all hero content (-z-10). If the libs fail to load
 * (offline), the hero keeps its CSS grid-bg + bloom fallback, so the page is
 * never blank.
 */

type VantaEffect = {
  destroy: () => void;
};

declare global {
  interface Window {
    THREE?: unknown;
    VANTA?: {
      FOG?: (opts: Record<string, unknown>) => VantaEffect;
    };
  }
}

export function VantaFog() {
  const elRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);
  const mountedRef = useRef(true);

  // Initialize Vanta Fog on the hero layer. Idempotent: bails if already
  // mounted or if the libs aren't present yet (onLoad / retry covers that).
  const start = () => {
    if (!mountedRef.current || effectRef.current) return;
    if (!elRef.current || !window.THREE || !window.VANTA?.FOG) return;

    // Match the fog palette to the active theme. In light mode we use a pale
    // lavender fog over white instead of the dark OLED fog.
    const dark = document.documentElement.classList.contains("dark");
    const palette = dark
      ? {
          highlightColor: 0xb8b4fe,
          midtoneColor: 0x6e54ff,
          lowlightColor: 0x15131c,
          baseColor: 0x0e100f,
        }
      : {
          highlightColor: 0x836ef9,
          midtoneColor: 0x6e54ff,
          lowlightColor: 0xecebf4,
          baseColor: 0xf6f6fb,
        };

    effectRef.current = window.VANTA!.FOG!({
      el: elRef.current,
      THREE: window.THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      blurFactor: 0.74,
      speed: 0.6,
      zoom: 0.6,
      ...palette,
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    // If the vendored scripts are already cached/ready, init now; otherwise
    // the vanta.fog onLoad handler below triggers it.
    start();

    return () => {
      mountedRef.current = false;
      effectRef.current?.destroy();
      effectRef.current = null;
    };
  }, []);

  return (
    <>
      <Script src="/vendor/three.r134.min.js" strategy="afterInteractive" />
      <Script
        src="/vendor/vanta.fog.min.js"
        strategy="afterInteractive"
        onLoad={() => requestAnimationFrame(start)}
      />
      <div
        ref={elRef}
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
      />
    </>
  );
}
