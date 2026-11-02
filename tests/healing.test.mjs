import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { startApp, launchBrowser } from "./_harness.mjs";
import { SmartLocator } from "../src/healing/SmartLocator.js";
import { LocatorStore } from "../src/healing/store.js";

let app, browser, context;

const LOGIN_BTN = {
  selector: "[data-test='login-btn']",
  fingerprint: { role: "button", tag: "button", text: "Sign in", attrs: { type: "submit" } },
};

function newStore() {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-store-"));
  return new LocatorStore(join(dir, "locators.json"));
}

before(async () => {
  app = await startApp(4312);
  ({ browser, context } = await launchBrowser());
});
after(async () => {
  await browser?.close();
  app?.stop();
});

test("primary selector works on v1 and learns the fingerprint", async () => {
  const page = await context.newPage();
  const store = newStore();
  const sl = new SmartLocator(page, { store });
  await page.goto(`${app.baseUrl}/`);

  const { locator, healed } = await sl.find("loginButton", LOGIN_BTN);
  assert.equal(healed, false);
  assert.equal(await locator.innerText(), "Sign in");
  assert.ok(store.get("loginButton"), "fingerprint should be learned");
  await page.close();
});

test("self-heals when the markup/selectors change (dom=v2)", async () => {
  const page = await context.newPage();
  const store = newStore();
  const sl = new SmartLocator(page, { store });

  // 1) learn on the known-good page
  await page.goto(`${app.baseUrl}/`);
  await sl.find("loginButton", LOGIN_BTN);

  // 2) the markup gets refactored: data-test/id change, text/role/position stay
  await page.goto(`${app.baseUrl}/?dom=v2`);
  const healedBtn = await sl.find("loginButton", LOGIN_BTN);
  assert.equal(healedBtn.healed, true, "should have healed");
  assert.ok(healedBtn.score >= 0.6, `confidence ${healedBtn.score}`);
  assert.equal(await healedBtn.locator.innerText(), "Sign in");

  // and the healed element actually works: fill + submit -> dashboard
  await sl.find("username", { selector: "[data-test='username']", fingerprint: { role: "textbox", attrs: { name: "username", placeholder: "Username" } } });
  await page.fill('input[name="username"]', "demo");
  await page.fill('input[name="password"]', "demo");
  await healedBtn.locator.click();
  await page.waitForSelector("[data-test='stats']");
  assert.ok(await page.isVisible("[data-test='stat-orders']"));

  assert.ok(sl.getHeals().length >= 1, "a heal event should be recorded");
  await page.close();
});

test("fails clearly when the element is truly gone", async () => {
  const page = await context.newPage();
  const sl = new SmartLocator(page, { threshold: 0.6 }); // no store, no fingerprint
  await page.goto(`${app.baseUrl}/`);
  await assert.rejects(
    () => sl.find("ghost", { selector: "[data-test='does-not-exist']" }),
    /no fingerprint is known/,
  );
  await page.close();
});
