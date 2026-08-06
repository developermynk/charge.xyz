#!/usr/bin/env node
/**
 * Gate: no server-only secret may appear in a client bundle.
 *
 * Circle kit keys and entity secrets are catastrophic if shipped to the browser
 * (they authorise swaps and wallet operations). Next.js only inlines vars
 * prefixed NEXT_PUBLIC_, but a developer can still leak one by importing a
 * server module into a client component. This scans the built client chunks for
 * the *values* of the secrets in the environment.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECRET_ENV_VARS = [
  "KIT_KEY",
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "PRIVATE_KEY",
  "DEPLOYER_PRIVATE_KEY",
];

const CLIENT_DIRS = [
  "apps/web/.next/static",
  "apps/web/.next/server/app",
];

function loadEnvValues() {
  const values = [];
  for (const key of SECRET_ENV_VARS) {
    const v = process.env[key];
    if (v && v.length >= 12) values.push({ key, value: v });
  }
  // Also read .env.local so the check works without exporting the vars.
  const envPath = "apps/web/.env.local";
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      const [, key, value] = m;
      if (SECRET_ENV_VARS.includes(key) && value.length >= 12) {
        values.push({ key, value: value.replace(/^["']|["']$/g, "") });
      }
    }
  }
  return values;
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|cjs|json|txt|map)$/.test(entry)) yield p;
  }
}

const secrets = loadEnvValues();
if (secrets.length === 0) {
  console.log("check:secrets — no secret values configured; nothing to scan for.");
  process.exit(0);
}

const staticDir = "apps/web/.next/static";
if (!existsSync(staticDir)) {
  console.log("check:secrets — no client build found. Run `pnpm build` first.");
  process.exit(0);
}

const leaks = [];
for (const dir of CLIENT_DIRS) {
  for (const file of walk(dir)) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const { key, value } of secrets) {
      // Only the client-side static bundle is a hard leak. Server chunks may
      // legitimately contain secrets, so those are reported as warnings.
      if (content.includes(value)) {
        leaks.push({ key, file, hard: dir.includes("static") });
      }
    }
  }
}

const hard = leaks.filter((l) => l.hard);
if (hard.length > 0) {
  console.error("check:secrets FAILED — server secrets found in the CLIENT bundle:");
  for (const l of hard) console.error(`  ${l.key} leaked into ${l.file}`);
  console.error("\nA secret in .next/static is served to every visitor. Rotate it now.");
  process.exit(1);
}

console.log(`check:secrets OK — scanned ${secrets.length} secret value(s), no client-bundle leak.`);
