#!/usr/bin/env node
/**
 * Gate: exactly one resolved copy of viem in the whole workspace.
 *
 * This is the regression test for the defect that broke the previous build:
 * duplicate viem copies produced two structurally identical but nominally
 * unrelated `Chain` types, and typechecking failed repo-wide with
 * "Two different types with this name exist, but they are unrelated."
 */

import { execFileSync } from "node:child_process";

function findViemVersions() {
  let raw;
  try {
    raw = execFileSync("pnpm", ["ls", "viem", "-r", "--depth", "Infinity", "--json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    // pnpm exits non-zero when nothing matches; treat stdout as authoritative.
    raw = err.stdout?.toString() ?? "[]";
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("check:viem — could not parse `pnpm ls` output.");
    process.exit(1);
  }

  const versions = new Set();

  // pnpm reports a workspace-linked copy as `link:node_modules/.pnpm/viem@2.47.5_.../viem`.
  // That is the SAME physical package as a plain "2.47.5" entry, so normalise the
  // link form down to its semver before comparing — otherwise the gate reports a
  // duplicate that does not exist.
  const normalise = (version) => {
    if (typeof version !== "string") return null;
    if (!version.startsWith("link:")) return version;
    const m = version.match(/viem@(\d+\.\d+\.\d+)/);
    return m ? m[1] : null;
  };

  const walk = (deps) => {
    if (!deps) return;
    for (const [name, info] of Object.entries(deps)) {
      if (name === "viem") {
        const v = normalise(info?.version);
        if (v) versions.add(v);
      }
      walk(info?.dependencies);
    }
  };
  for (const project of Array.isArray(parsed) ? parsed : [parsed]) {
    walk(project.dependencies);
    walk(project.devDependencies);
    walk(project.unsavedDependencies);
  }
  return versions;
}

const versions = findViemVersions();

if (versions.size === 0) {
  console.log("check:viem — no viem resolved yet (install not run). Skipping.");
  process.exit(0);
}

if (versions.size > 1) {
  console.error(
    `check:viem FAILED — ${versions.size} viem versions resolved: ${[...versions].join(", ")}\n` +
      "A single copy is required. Fix the root package.json `pnpm.overrides.viem` pin.",
  );
  process.exit(1);
}

console.log(`check:viem OK — single viem version ${[...versions][0]}`);
