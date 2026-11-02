// Prints the path to the generated report (and opens it on macOS).
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const path = "reports/index.html";
if (!existsSync(path)) {
  console.error('No report yet. Run "npm run demo" first.');
  process.exit(1);
}
console.log(`Report: ${path}`);
if (process.platform === "darwin") spawn("open", [path]);
