#!/usr/bin/env node
/**
 * Guard: React-context packages must exist exactly once.
 *
 * WHY THIS GATE EXISTS
 * Packages that publish React context (wagmi, react-query) or rely on
 * instanceof/type identity (viem) break in confusing, non-obvious ways when the
 * dependency tree contains two physical copies. The provider is mounted, but a
 * hook in another workspace package reads a *different* copy's context and
 * reports "Provider not found".
 *
 * This has now bitten this repo twice:
 *   1. viem  — duplicate copies produced two incompatible Chain types and
 *              typechecking failed across the whole monorepo.
 *   2. wagmi — apps/web and packages/web3 resolved to different physical
 *              copies, so WagmiProvider was invisible to useAccount and the
 *              production build crashed during prerender.
 *
 * Both were silent at install time and only surfaced as a baffling runtime or
 * build error, so the invariant is enforced mechanically instead of by memory.
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const SINGLETONS = ["viem", "wagmi", "@tanstack/react-query"];

/**
 * Read the pnpm virtual store directly.
 *
 * Directory names there encode the fully-resolved identity of each package
 * (`wagmi@3.7.6_<peer-hash>`), so two entries for one version means two
 * physical copies — precisely the fault we are guarding against. `pnpm list`
 * hides this by collapsing on version.
 */
function storeCopies(pkg) {
  const storeDir = join(process.cwd(), "node_modules", ".pnpm");

  let entries;
  try {
    entries = readdirSync(storeDir);
  } catch {
    console.error("check:singletons — node_modules/.pnpm not found. Run `pnpm install`.");
    process.exit(1);
  }

  // "@tanstack/react-query" is stored as "@tanstack+react-query@...".
  const prefix = `${pkg.replace("/", "+")}@`;

  return entries.filter(
    (e) => e.startsWith(prefix) && /^\d/.test(e.slice(prefix.length)),
  );
}

function versionOf(entry, pkg) {
  const prefix = `${pkg.replace("/", "+")}@`;
  return entry.slice(prefix.length).split("_")[0];
}

let failed = false;

for (const pkg of SINGLETONS) {
  const copies = storeCopies(pkg);

  if (copies.length === 0) {
    console.log(`check:singletons — ${pkg} not installed, skipping.`);
    continue;
  }

  const versions = [...new Set(copies.map((c) => versionOf(c, pkg)))];

  if (versions.length > 1) {
    failed = true;
    console.error(
      `\n✖ ${pkg}: ${versions.length} different versions installed: ${versions.join(", ")}`,
    );
    console.error(`  Pin one in package.json → pnpm.overrides["${pkg}"].`);
    continue;
  }

  if (copies.length > 1) {
    failed = true;
    console.error(
      `\n✖ ${pkg}: ${copies.length} physical copies of v${versions[0]} (peer-dependency fork).`,
    );
    for (const c of copies) console.error(`    ${c}`);
    console.error(
      `  Fix: add \`dedupe-peer-dependents=true\` and \`public-hoist-pattern[]=${pkg}\` to .npmrc,\n` +
        `  then reinstall. Two copies means React context will not cross the boundary.`,
    );
    continue;
  }

  console.log(`✓ ${pkg} — single copy (v${versions[0]})`);
}

if (failed) {
  console.error("\ncheck:singletons FAILED — duplicate context packages will break at runtime.\n");
  process.exit(1);
}

console.log("check:singletons OK — all context packages are singletons.");
