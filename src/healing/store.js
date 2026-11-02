// Persists learned element fingerprints between runs, so a locator can heal on a
// later run even after its primary selector stops matching. Plain JSON on disk.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class LocatorStore {
  constructor(path) {
    this.path = path;
    this.data = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  }

  get(name) {
    return this.data[name]?.fingerprint ?? null;
  }

  /** Record (or refresh) the known-good fingerprint for a logical name. */
  learn(name, fingerprint, selector) {
    this.data[name] = { selector, fingerprint, learnedAt: new Date().toISOString() };
    this.#flush();
  }

  #flush() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }
}
