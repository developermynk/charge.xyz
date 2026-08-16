/**
 * Charge mark.
 *
 * Renders the 3D glass bolt-and-ring logo (charge-logo.png in /public) —
 * the brand mark shown in the sidebar, top nav, and landing. Kept as a single
 * component so every surface updates at once. The image sits inside the
 * rounded-square tile treatment so it reads consistently in light/dark modes.
 */

export function ChargeLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/charge-logo.png"
      alt="Charge"
      width={32}
      height={32}
      className={className ?? "size-8"}
    />
  );
}
