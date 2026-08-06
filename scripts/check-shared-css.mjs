#!/usr/bin/env node
/**
 * Guard: shared-package utilities must reach the CSS bundle.
 *
 * WHY THIS GATE EXISTS
 * Tailwind v4 auto-detects sources relative to the CSS entry, but the crawl
 * does not follow into sibling workspace packages. When packages/ui was not
 * listed with @source, every utility used ONLY by a shared component was
 * silently dropped: the build passed, TypeScript passed, the markup shipped
 * with `bg-panel/95` on it, and the modal rendered fully transparent so the
 * page behind bled through. Nothing failed except the pixels.
 *
 * This asserts that a sample of utilities used exclusively inside
 * packages/ui/src actually exists in the built CSS.
 *
 * Run AFTER `next build`.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB = new URL("../apps/web/", import.meta.url).pathname;
const STATIC = join(WEB, ".next", "static");

/**
 * Utilities that appear in packages/ui/src but NOT in apps/web source, so they
 * can only reach the bundle via the @source directive. Escaped the way
 * Tailwind writes them into a selector.
 */
const REQUIRED = [
  String.raw`bg-panel\/95`,
  String.raw`bg-black\/70`,
  "backdrop-blur-2xl",
];

if (!existsSync(STATIC)) {
  console.error("check:css — no build found. Run `next build` first.");
  process.exit(1);
}

function cssFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (e.endsWith(".css")) out.push(full);
  }
  return out;
}

const files = cssFiles(STATIC);
if (files.length === 0) {
  console.error("check:css FAILED — build produced no CSS at all.");
  process.exit(1);
}

const blob = files.map((f) => readFileSync(f, "utf8")).join("");
const missing = REQUIRED.filter((c) => !blob.includes(c));

if (missing.length > 0) {
  console.error(
    "check:css FAILED — utilities from packages/ui are absent from the CSS:\n",
  );
  for (const m of missing) console.error(`  ${m}`);
  console.error(
    "\nTailwind is not scanning the shared packages. Check the @source lines " +
      "at the top of apps/web/app/globals.css. Shared components will render " +
      "unstyled even though the build passes.",
  );
  process.exit(1);
}

console.log(
  `check:css OK — ${REQUIRED.length} shared-package utilities present in ` +
    `${files.length} CSS bundle(s).`,
);
