/**
 * Charge mark — a bolt inside a rounded square.
 *
 * Drawn as inline SVG rather than shipped as a PNG so it stays crisp at every
 * size, inherits currentColor, and costs no extra request.
 */
export function ChargeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Charge logo"
    >
      <defs>
        <linearGradient id="charge-mark" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#00E58A" />
          <stop offset="100%" stopColor="#2775CA" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#charge-mark)" />
      <path
        d="M17.6 6.5 10 17.4h4.9L13.9 25.5 22 14.3h-5.1l0.7-7.8Z"
        fill="#08090C"
      />
    </svg>
  );
}
