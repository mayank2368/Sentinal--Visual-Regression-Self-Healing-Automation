// End-to-end demo that produces the artifacts a reviewer wants to see:
//   - a baseline screenshot
//   - a visual check that PASSES (unchanged UI)
//   - a visual check that is FLAGGED (the ?ui=v2 change) with a diff image
//   - self-healing events (primary selector broken by ?dom=v2, recovered)
//   - an HTML report tying it all together
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { startApp, launchBrowser } from "../tests/_harness.mjs";
import { visualCheck } from "../src/visual/visual.js";
import { compare } from "../src/visual/compare.js";
import { SmartLocator } from "../src/healing/SmartLocator.js";
import { LocatorStore } from "../src/healing/store.js";
import { writeReport } from "../src/report.js";

const BASE = "baselines";
const OUT = "reports/visual";
mkdirSync(OUT, { recursive: true });

const app = await startApp(4320);
const { browser, context } = await launchBrowser();
const page = await context.newPage();
const visual = [];

// 1) baseline + unchanged pass
await page.goto(`${app.baseUrl}/`);
visual.push(await visualCheck(page, "login-page", { baselineDir: BASE, outDir: OUT }));
visual.push({ ...(await visualCheck(page, "login-page", { baselineDir: BASE, outDir: OUT })), name: "login-page (unchanged)" });

// 2) the UI regression: compare ?ui=v2 against the v1 baseline
await page.goto(`${app.baseUrl}/?ui=v2`);
const changed = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
const curPath = join(OUT, "login-page-uichange.current.png");
const diffPath = join(OUT, "login-page-uichange.diff.png");
writeFileSync(curPath, changed);
const result = compare(readFileSync(join(BASE, "login-page.png")), changed);
writeFileSync(diffPath, result.diffPng);
visual.push({
  name: "login-page (after ?ui=v2)",
  status: result.ratio <= 0.005 ? "pass" : "changed",
  ratio: result.ratio,
  maxRatio: 0.005,
  baselinePath: join(BASE, "login-page.png"),
  currentPath: curPath,
  diffPath,
  sizeMismatch: result.sizeMismatch,
});

// 3) self-healing: learn on v1, break selectors with ?dom=v2, recover
const store = new LocatorStore("reports/locators.json");
const sl = new SmartLocator(page, { store });
await page.goto(`${app.baseUrl}/`);
await sl.find("loginButton", { selector: "[data-test='login-btn']", fingerprint: { role: "button", tag: "button", text: "Sign in", attrs: { type: "submit" } } });
await sl.find("username", { selector: "[data-test='username']", fingerprint: { role: "textbox", attrs: { name: "username", placeholder: "Username" } } });

await page.goto(`${app.baseUrl}/?dom=v2`);
const btn = await sl.find("loginButton", { selector: "[data-test='login-btn']" });
const usr = await sl.find("username", { selector: "[data-test='username']" });

const reportPath = writeReport({ visual, heals: sl.getHeals() }, "reports/index.html");

console.log("\nVisual checks:");
for (const v of visual) console.log(`  - ${v.name}: ${v.status}${v.ratio != null ? ` (${(v.ratio * 100).toFixed(3)}%)` : ""}`);
console.log("\nSelf-heals:");
for (const h of sl.getHeals()) console.log(`  - ${h.name}: ${h.primarySelector}  ->  ${h.healedSelector}  (confidence ${h.confidence})`);
console.log(`\nButton healed: ${btn.healed} | Username healed: ${usr.healed}`);
console.log(`\nReport: ${reportPath}`);

await browser.close();
app.stop();
