// Builds a single self-navigating HTML report: visual checks (baseline / current
// / diff side by side) and a self-healing event log. Images are referenced from
// the report's own folder.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (r) => `${(r * 100).toFixed(3)}%`;

export function writeReport({ visual = [], heals = [] }, outPath = "reports/index.html") {
  mkdirSync(dirname(outPath), { recursive: true });
  const base = dirname(outPath);
  const rel = (p) => (p ? relative(base, p).split("\\").join("/") : null);

  const badge = (status) => {
    const map = { pass: "#16a34a", new: "#2563eb", changed: "#dc2626" };
    return `<span class="badge" style="background:${map[status] || "#64748b"}">${esc(status)}</span>`;
  };

  const visualCards = visual
    .map((v) => {
      const imgs =
        v.status === "new"
          ? `<figure><figcaption>new baseline</figcaption><img src="${rel(v.currentPath)}"></figure>`
          : `<figure><figcaption>baseline</figcaption><img src="${rel(v.baselinePath)}"></figure>
             <figure><figcaption>current</figcaption><img src="${rel(v.currentPath)}"></figure>
             <figure><figcaption>diff</figcaption><img src="${rel(v.diffPath)}"></figure>`;
      const detail =
        v.status === "new"
          ? "baseline created"
          : `${pct(v.ratio)} changed (threshold ${pct(v.maxRatio)})${v.sizeMismatch ? " · size mismatch" : ""}`;
      return `<section class="card"><h3>${esc(v.name)} ${badge(v.status)}</h3><p class="muted">${detail}</p><div class="imgs">${imgs}</div></section>`;
    })
    .join("\n");

  const healRows = heals.length
    ? heals
        .map(
          (h) => `<tr><td>${esc(h.name)}</td><td><code>${esc(h.primarySelector)}</code></td>
            <td><code>${esc(h.healedSelector)}</code></td>
            <td>${h.confidence == null ? esc(h.source || "—") : h.confidence}</td></tr>`,
        )
        .join("\n")
    : `<tr><td colspan="4" class="muted">No heals in this run.</td></tr>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sentinel Report</title>
<style>
:root{color-scheme:light dark}
body{font-family:-apple-system,system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
header{background:#0f172a;color:#fff;padding:20px 28px}
header h1{margin:0;font-size:20px}header p{margin:4px 0 0;color:#94a3b8;font-size:13px}
main{max-width:1100px;margin:0 auto;padding:24px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#475569;margin:28px 0 12px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:16px}
.card h3{margin:0 0 4px;font-size:15px;display:flex;gap:8px;align-items:center}
.muted{color:#64748b;font-size:13px;margin:0 0 12px}
.badge{color:#fff;font-size:11px;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.imgs{display:flex;gap:14px;flex-wrap:wrap}
figure{margin:0}figcaption{font-size:12px;color:#64748b;margin-bottom:6px}
img{max-width:320px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
th{background:#f8fafc;color:#475569}code{background:#f1f5f9;padding:1px 6px;border-radius:5px;font-size:12px}
</style></head><body>
<header><h1>Sentinel — Visual Regression & Self-Healing report</h1><p>Generated ${new Date().toISOString()}</p></header>
<main>
  <h2>Visual regression</h2>
  ${visualCards || '<p class="muted">No visual checks.</p>'}
  <h2>Self-healing events</h2>
  <table><thead><tr><th>Locator</th><th>Primary (failed)</th><th>Healed to</th><th>Confidence</th></tr></thead>
  <tbody>${healRows}</tbody></table>
</main></body></html>`;

  writeFileSync(outPath, html);
  return outPath;
}
