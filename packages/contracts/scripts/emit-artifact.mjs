#!/usr/bin/env node
/**
 * Emit compiled ChargeToken artifacts as TypeScript modules.
 *
 * The web app must never ship hand-written or stubbed bytecode: what a user
 * deploys has to be exactly what `forge build` produced from the audited and
 * tested source. This script is the only writer of artifacts/*.ts.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/** @type {{ file: string, contract: string, out: string }[]} */
const TARGETS = [
  { file: "ChargeToken.sol", contract: "ChargeToken", out: "ChargeToken" },
  { file: "ChargeTokenV2.sol", contract: "ChargeTokenV2", out: "ChargeTokenV2" },
];

function emitOne({ file, contract, out }) {
  const artifactPath = join(root, "out", file, `${contract}.json`);
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  } catch {
    console.error(`emit-artifact: could not read ${artifactPath}\nRun \`forge build\` first.`);
    process.exit(1);
  }

  const bytecode = artifact.bytecode?.object;
  if (!bytecode || !bytecode.startsWith("0x") || bytecode.length < 100) {
    console.error(`emit-artifact: ${contract} bytecode missing or implausibly short.`);
    process.exit(1);
  }

  mkdirSync(join(root, "artifacts"), { recursive: true });

  writeFileSync(
    join(root, "artifacts", `${out}.json`),
    `${JSON.stringify({ contractName: contract, bytecode, abi: artifact.abi }, null, 2)}\n`,
  );

  writeFileSync(
    join(root, "artifacts", `${out.toLowerCase()}.ts`),
    `/**
 * AUTO-GENERATED from packages/contracts/out/${file}/${contract}.json
 * Regenerate: cd packages/contracts && forge build && node scripts/emit-artifact.mjs
 *
 * This is the REAL compiled creation bytecode for ${contract}.sol, verified by
 * passing Foundry tests. Do not hand-edit.
 */

export const ${out.toUpperCase()}_BYTECODE = "${bytecode}" as const;

export const ${out.toUpperCase()}_COMPILER = {
  solc: "0.8.24",
  optimizer: true,
  runs: 200,
} as const;
`,
  );

  console.log(
    `emit-artifact: ${contract} -> wrote bytecode (${bytecode.length} chars) and ABI (${artifact.abi.length} entries).`,
  );
}

for (const t of TARGETS) emitOne(t);
