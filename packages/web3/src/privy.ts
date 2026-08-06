/**
 * Privy configuration — the "continue with email" half of auth.
 *
 * Privy is optional at build time: without an app id the app must still build
 * and run with wallet-only login rather than crashing at import time. That was
 * a real failure mode in the previous build, so it is encoded here explicitly.
 */

export const PRIVY_APP_ID = process.env["NEXT_PUBLIC_PRIVY_APP_ID"] ?? "";

/**
 * A Privy app id looks like `cmxxxxxxxxxxxxxxxxxxxxxxx`. Placeholder values
 * ("", "your-app-id", "xxx") must not mount the provider.
 */
export function isPrivyConfigured(): boolean {
  const id = PRIVY_APP_ID.trim();
  if (id.length < 20) return false;
  if (/^(your|placeholder|todo|xxx)/i.test(id)) return false;
  return true;
}
