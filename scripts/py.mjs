#!/usr/bin/env node
// Runs a command with the backend's virtualenv Python, from the backend folder.
//   node scripts/py.mjs -m pytest
// Works on Windows (.venv\Scripts) and macOS/Linux (.venv/bin).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { BACKEND_DIR, venvPython } from "./python.mjs";

const python = venvPython();
if (!existsSync(python)) {
  console.error(
    `Python virtualenv not found at ${join("backend", ".venv")}.\n` +
      "Run `npm install` (or `npm run setup`) in the project root first.",
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { cwd: BACKEND_DIR, stdio: "inherit" });
process.exit(result.status ?? 1);
