// SmartLocator: a self-healing element finder for Playwright.
//
//   1. Try the primary selector. If it resolves, (re)learn the element's
//      fingerprint and return it — zero overhead on the happy path.
//   2. If it misses, score every on-page candidate against the learned
//      fingerprint and return the best match above a confidence threshold,
//      recording a "heal" event with a suggested replacement selector.
//   3. If nothing clears the threshold, fail loudly with the ranked candidates.
//
// This is the same idea behind commercial AI-healing tools (Testim, Healenium,
// Mabl): identify an element by multiple stable signals, not one brittle locator.
import { collectCandidatesScript, score } from "./fingerprint.js";

export class SmartLocator {
  /**
   * @param {import('playwright').Page} page
   * @param {{ store?: import('./store.js').LocatorStore, threshold?: number,
   *           llmSuggest?: (ctx:object)=>Promise<string|null> }} [opts]
   */
  constructor(page, opts = {}) {
    this.page = page;
    this.store = opts.store ?? null;
    this.threshold = opts.threshold ?? 0.6;
    this.llmSuggest = opts.llmSuggest ?? null; // optional AI hook (off by default)
    this.heals = [];
  }

  /**
   * @param {string} name   logical name, e.g. "loginButton"
   * @param {{selector:string, fingerprint?:object}} spec
   * @returns {Promise<{locator:import('playwright').Locator, healed:boolean, score?:number, suggestion?:string}>}
   */
  async find(name, spec) {
    const primary = this.page.locator(spec.selector).first();
    if ((await primary.count()) > 0 && (await primary.isVisible().catch(() => false))) {
      const fp = await this.#describe(primary);
      if (fp && this.store) this.store.learn(name, fp, spec.selector);
      return { locator: primary, healed: false };
    }

    // ---- primary missed: attempt to heal ----
    const target = this.store?.get(name) ?? spec.fingerprint;
    if (!target) {
      throw new Error(`SmartLocator: "${name}" primary selector "${spec.selector}" matched nothing and no fingerprint is known.`);
    }

    const viewport = this.page.viewportSize() ?? { width: 1280, height: 800 };
    const candidates = await this.page.evaluate(collectCandidatesScript());
    const ranked = candidates
      .map((c) => ({ c, s: score(target, c, viewport) }))
      .sort((a, b) => b.s - a.s);

    const best = ranked[0];
    if (best && best.s >= this.threshold) {
      const event = {
        name,
        primarySelector: spec.selector,
        healedSelector: best.c.selector,
        confidence: Number(best.s.toFixed(3)),
        at: new Date().toISOString(),
      };
      this.heals.push(event);
      return { locator: this.page.locator(best.c.selector).first(), healed: true, score: best.s, suggestion: best.c.selector };
    }

    // optional AI escalation when heuristics are not confident enough
    if (this.llmSuggest) {
      const suggestion = await this.llmSuggest({ name, target, candidates });
      if (suggestion) {
        const loc = this.page.locator(suggestion).first();
        if ((await loc.count()) > 0) {
          this.heals.push({ name, primarySelector: spec.selector, healedSelector: suggestion, confidence: null, source: "llm", at: new Date().toISOString() });
          return { locator: loc, healed: true, suggestion };
        }
      }
    }

    const top = ranked.slice(0, 3).map((r) => `${r.c.selector} (${r.s.toFixed(2)})`).join(", ");
    throw new Error(`SmartLocator: could not heal "${name}". Best candidates below threshold ${this.threshold}: ${top || "none"}`);
  }

  getHeals() {
    return this.heals;
  }

  async #describe(locator) {
    return locator.evaluate((el) => {
      const roleOf = (e) => {
        const tag = e.tagName.toLowerCase();
        const type = (e.getAttribute("type") || "").toLowerCase();
        if (tag === "a") return "link";
        if (tag === "button") return "button";
        if (tag === "select") return "combobox";
        if (tag === "textarea") return "textbox";
        if (tag === "input") return ["submit", "button", "reset"].includes(type) ? "button" : "textbox";
        return e.getAttribute("role") || "";
      };
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: roleOf(el),
        text: (el.innerText || el.value || "").trim().slice(0, 80),
        attrs: {
          "data-test": el.getAttribute("data-test") || "",
          name: el.getAttribute("name") || "",
          placeholder: el.getAttribute("placeholder") || "",
          "aria-label": el.getAttribute("aria-label") || "",
          type: (el.getAttribute("type") || "").toLowerCase(),
        },
        box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    });
  }
}
