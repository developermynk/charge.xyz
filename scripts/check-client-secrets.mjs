#!/usr/bin/env node
/**
 * Guard: server secrets must never reach the client bundle.
 *
 * WHY THIS GATE EXISTS
 * An earlier draft of the swap flow fetched the Circle kit key from an API
 * route and handed it to the browser. That leaks a server credential to every
 * visitor. The Arc docs are explicit that the kit key is OPTIONAL (it only
 * lifts a rate limit) and that browser wallets sign client-side — so there is
 * never a reason to ship it.
 *
 * This scans the built client chunks for the literal value of every
 * server-only env var. It is value-based, not name-based, so it catches the
 * leak even if the variable is renamed or inlined by the bundler.
 *
 * Run AFTER `next build`.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB = new URL("../apps/web/", import.meta.url).pathname;
/**
 * Scan the client chunks AND the server-rendered app chunks. Server chunks
 * matter because a page that inlines a secret into prerendered HTML leaks it
 * just as effectively as a JS bundle does.
 */
const SCAN_DIRS = [
  join(WEB, ".next", "static"),
  join(WEB, ".next", "server", "app"),
];
const ENV_FILE = join(WEB, ".env.local");

/**
 * Vars that must never appear in client code. NEXT_PUBLIC_* is intentionally
 * excluded: those are public by definition.
 */
const SERVER_ONLY = [
  "KIT_KEY",
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "PRIVATE_KEY",
  "PRIVY_APP_SECRET",
  "PRIVY_AUTHORIZATION_PRIVATE_KEY",
];

if (!SCAN_DIRS.some((d) => existsSync(d))) {
  console.error("check:secrets — no build found. Run `next build` first.");
  process.exit(1);
}

/** Parse .env.local into name -> value. */
function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Every .js/.html file under a build dir, recursively. */
function bundleFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...bundleFiles(full));
    else if (/\.(js|html|json|rsc)$/.test(entry)) out.push(full);
  }
  return out;
}

const env = readEnv(ENV_FILE);
const files = SCAN_DIRS.flatMap(bundleFiles);

/**
 * Check both the file value and process.env, so the gate still works in CI
 * where secrets come from the environment rather than .env.local.
 */
const secrets = SERVER_ONLY.map((name) => ({
  name,
  value: env[name] || process.env[name] || "",
}))
  .filter((s) => s.value.length >= 8)
  .filter(
    // Never treat a NEXT_PUBLIC_ value as a secret even if it collides.
    (s) => !s.name.startsWith("NEXT_PUBLIC_"),
  );

if (secrets.length === 0) {
  console.log("check:secrets — no server secrets configured; nothing to scan.");
  process.exit(0);
}

const leaks = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const { name, value } of secrets) {
    if (content.includes(value)) {
      leaks.push({ name, file: file.replace(WEB, "") });
    }
  }
}

if (leaks.length > 0) {
  console.error("check:secrets FAILED — server secrets found in client JS:\n");
  for (const l of leaks) console.error(`  ${l.name} leaked into ${l.file}`);
  console.error(
    "\nA server-only credential is being shipped to every visitor. " +
      "Move the call server-side, or drop the credential entirely.",
  );
  process.exit(1);
}

console.log(
  `check:secrets OK — scanned ${files.length} client chunks for ` +
    `${secrets.length} server secret(s); none leaked.`,
);
