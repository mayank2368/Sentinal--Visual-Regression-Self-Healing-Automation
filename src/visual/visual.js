// High-level visual-regression check: capture a screenshot, compare it to a
// stored baseline (creating the baseline on first run), and record a result the
// HTML report can render. Baselines are per-environment (font rendering differs
// across OS), so they are generated locally rather than committed.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { compare } from "./compare.js";

const UPDATE = process.env.UPDATE_BASELINES === "1";

/**
 * @param {import('playwright').Page} page
 * @param {string} name  stable check name, e.g. "login-page"
 * @param {{baselineDir?:string, outDir?:string, maxRatio?:number,
 *   fullPage?:boolean, clip?:object, mask?:import('playwright').Locator[],
 *   pixelThreshold?:number}} [opts]
 */
export async function visualCheck(page, name, opts = {}) {
  const baselineDir = opts.baselineDir ?? "baselines";
  const outDir = opts.outDir ?? "reports/visual";
  const maxRatio = opts.maxRatio ?? 0.005; // 0.5% of pixels may differ
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const current = await page.screenshot({
    fullPage: opts.fullPage ?? true,
    clip: opts.clip,
    mask: opts.mask,
    animations: "disabled",
    caret: "hide",
  });
  const currentPath = join(outDir, `${name}.current.png`);
  writeFileSync(currentPath, current);

  const baselinePath = join(baselineDir, `${name}.png`);
  if (UPDATE || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, current);
    return { name, status: "new", ratio: 0, baselinePath, currentPath, diffPath: null, maxRatio };
  }

  const baseline = readFileSync(baselinePath);
  const result = compare(baseline, current, { pixelThreshold: opts.pixelThreshold });
  const diffPath = join(outDir, `${name}.diff.png`);
  writeFileSync(diffPath, result.diffPng);

  return {
    name,
    status: result.ratio <= maxRatio ? "pass" : "changed",
    ratio: result.ratio,
    diffPixels: result.diffPixels,
    totalPixels: result.totalPixels,
    sizeMismatch: result.sizeMismatch,
    baselinePath,
    currentPath,
    diffPath,
    maxRatio,
  };
}

/**
 * Compare two live screenshots directly (no stored baseline) — used to assert
 * the engine both passes identical UI and flags a changed UI, deterministically
 * and independent of the OS it runs on.
 */
export function compareScreens(beforePng, afterPng, opts = {}) {
  return compare(beforePng, afterPng, { pixelThreshold: opts.pixelThreshold });
}
