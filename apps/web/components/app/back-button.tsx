import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * BackButton
 *
 * Small, consistent "back" affordance used at the top of every /app sub-page
 * so users can return to the Portfolio. Ghost icon-button (Linear/Rainbow
 * style) — never a labelled link, to keep the page headers uncluttered.
 */
export function BackButton({ href = "/app" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Back to Portfolio"
      className="inline-flex size-8 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-fg/[0.06] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60"
    >
      <ArrowLeft className="size-4" aria-hidden />
    </Link>
  );
}
