#!/usr/bin/env node
// One-time project setup, run automatically by `npm install` (postinstall):
//   1. creates backend/.venv and installs Python requirements (only when they changed)
//   2. installs the Next.js frontend's npm dependencies
// Set SKIP_SETUP=1 to skip (e.g. in CI images that install things separately).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BACKEND_DIR, FRONTEND_DIR, VENV_DIR, venvPython } from "./python.mjs";

if (process.env.SKIP_SETUP === "1") {
  console.log("[setup] SKIP_SETUP=1, skipping.");
  process.exit(0);
}

// Executables are spawned without a shell so paths with spaces stay intact; only npm (a .cmd
// shim on Windows) needs one.
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  return result.status === 0;
}

function findSystemPython() {
  const candidates =
    process.platform === "win32"
      ? [["py", ["-3.12"]], ["py", ["-3"]], ["python", []]]
      : [["python3.12", []], ["python3", []], ["python", []]];
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(
      command,
      [...prefix, "-c", "import sys; print(sys.version_info >= (3, 12))"],
      { encoding: "utf8" },
    );
    if (probe.status === 0 && probe.stdout.trim() === "True") return [command, prefix];
  }
  return null;
}

// --- 1. Python backend -----------------------------------------------------------------------
const requirements = join(BACKEND_DIR, "requirements-dev.txt");
const stamp = join(VENV_DIR, ".requirements.sha256");
const wanted = createHash("sha256")
  .update(readFileSync(requirements))
  .update(readFileSync(join(BACKEND_DIR, "requirements.txt")))
  .digest("hex");

if (!existsSync(venvPython())) {
  const python = findSystemPython();
  if (!python) {
    console.error("[setup] Python 3.12+ is required for the backend. Install it from https://www.python.org/ and re-run `npm install`.");
    process.exit(1);
  }
  console.log("[setup] Creating backend virtualenv (backend/.venv)…");
  if (!run(python[0], [...python[1], "-m", "venv", VENV_DIR])) process.exit(1);
}

if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== wanted) {
  console.log("[setup] Installing backend Python dependencies…");
  const ok =
    run(venvPython(), ["-m", "pip", "install", "--disable-pip-version-check", "-q", "--upgrade", "pip"]) &&
    run(venvPython(), ["-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", requirements]);
  if (!ok) process.exit(1);
  writeFileSync(stamp, wanted);
} else {
  console.log("[setup] Backend dependencies are up to date.");
}

// --- 2. Next.js frontend ---------------------------------------------------------------------
console.log("[setup] Installing frontend dependencies…");
const npmOptions = { cwd: FRONTEND_DIR, shell: process.platform === "win32" };
if (!run("npm", ["install", "--no-audit", "--no-fund"], npmOptions)) process.exit(1);

console.log("[setup] Done. Next: `docker compose up -d`, `npm run seed`, `npm run dev`.");
