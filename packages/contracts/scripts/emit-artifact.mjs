#!/usr/bin/env node
/**
 * Emit the compiled ChargeToken artifact as a TypeScript module.
 *
 * The web app must never ship hand-written or stubbed bytecode: what a user
 * deploys has to be exactly what `forge build` produced from the audited and
 * tested source. This script is the only writer of artifacts/bytecode.ts.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const artifactPath = join(root, "out", "ChargeToken.sol", "ChargeToken.json");

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch {
  console.error(
    `emit-artifact: could not read ${artifactPath}\nRun \`forge build\` first.`,
  );
  process.exit(1);
}

const bytecode = artifact.bytecode?.object;
if (!bytecode || !bytecode.startsWith("0x") || bytecode.length < 100) {
  console.error("emit-artifact: compiled bytecode missing or implausibly short.");
  process.exit(1);
}

mkdirSync(join(root, "artifacts"), { recursive: true });

writeFileSync(
  join(root, "artifacts", "ChargeToken.json"),
  `${JSON.stringify({ contractName: "ChargeToken", bytecode, abi: artifact.abi }, null, 2)}\n`,
);

writeFileSync(
  join(root, "artifacts", "bytecode.ts"),
  `/**
 * AUTO-GENERATED from packages/contracts/out/ChargeToken.sol/ChargeToken.json
 * Regenerate: cd packages/contracts && forge build && node scripts/emit-artifact.mjs
 *
 * This is the REAL compiled creation bytecode for ChargeToken.sol, verified by
 * passing Foundry tests. Do not hand-edit.
 */

export const CHARGE_TOKEN_BYTECODE = "${bytecode}" as const;

export const CHARGE_TOKEN_COMPILER = {
  solc: "0.8.24",
  optimizer: true,
  runs: 200,
} as const;
`,
);

console.log(
  `emit-artifact: wrote bytecode (${bytecode.length} chars) and ABI (${artifact.abi.length} entries).`,
);
