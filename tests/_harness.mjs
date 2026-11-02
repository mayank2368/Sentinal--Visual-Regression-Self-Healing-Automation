// Shared helpers: boot the demo app as a child process and launch a browser with
// a fixed viewport so screenshots are deterministic.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function startApp(port = 4300) {
  const proc = spawn(process.execPath, [join(root, "app", "server.js")], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const baseUrl = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(baseUrl);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { baseUrl, stop: () => proc.kill() };
}

export async function launchBrowser() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  return { browser, context };
}
