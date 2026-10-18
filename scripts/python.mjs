import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BACKEND_DIR = join(ROOT_DIR, "backend");
export const FRONTEND_DIR = join(ROOT_DIR, "frontend");
export const VENV_DIR = join(BACKEND_DIR, ".venv");

export function venvPython() {
  return process.platform === "win32"
    ? join(VENV_DIR, "Scripts", "python.exe")
    : join(VENV_DIR, "bin", "python");
}
