import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { startApp, launchBrowser } from "./_harness.mjs";
import { compareScreens, visualCheck } from "../src/visual/visual.js";

let app, browser, context, page;

before(async () => {
  app = await startApp(4311);
  ({ browser, context } = await launchBrowser());
  page = await context.newPage();
});

after(async () => {
  await browser?.close();
  app?.stop();
});

test("identical UI reports no change (no false positives)", async () => {
  await page.goto(`${app.baseUrl}/`);
  const a = await page.screenshot({ fullPage: true, animations: "disabled" });
  await page.reload();
  const b = await page.screenshot({ fullPage: true, animations: "disabled" });
  const { ratio } = compareScreens(a, b);
  assert.ok(ratio <= 0.001, `expected ~0 difference, got ${(ratio * 100).toFixed(3)}%`);
});

test("a real visual change is detected", async () => {
  await page.goto(`${app.baseUrl}/`);
  const v1 = await page.screenshot({ fullPage: true, animations: "disabled" });
  await page.goto(`${app.baseUrl}/?ui=v2`);
  const v2 = await page.screenshot({ fullPage: true, animations: "disabled" });
  const { ratio } = compareScreens(v1, v2);
  assert.ok(ratio > 0.005, `expected the change to exceed the 0.5% threshold, got ${(ratio * 100).toFixed(3)}%`);
});

test("baseline workflow: first run creates, second run passes", async () => {
  const baselineDir = mkdtempSync(join(tmpdir(), "sentinel-base-"));
  const outDir = mkdtempSync(join(tmpdir(), "sentinel-out-"));
  await page.goto(`${app.baseUrl}/`);

  const first = await visualCheck(page, "login-page", { baselineDir, outDir });
  assert.equal(first.status, "new");

  const second = await visualCheck(page, "login-page", { baselineDir, outDir });
  assert.equal(second.status, "pass");
  assert.ok(second.ratio <= second.maxRatio);
});
