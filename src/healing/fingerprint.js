// Element "fingerprints": a small bundle of signals that identify an element by
// WHAT IT IS rather than one brittle selector — tag, role, visible text, stable
// attributes (name/placeholder/aria-label/type), and on-screen position. Healing
// is just: when the primary selector misses, score every candidate against the
// learned fingerprint and take the best match above a confidence threshold.

/**
 * Runs in the browser. Returns a descriptor for every interactive candidate on
 * the page, each with a unique CSS selector so Node can re-locate the winner.
 */
export function collectCandidatesScript() {
  return () => {
    const roleOf = (el) => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (tag === "a") return "link";
      if (tag === "button") return "button";
      if (tag === "select") return "combobox";
      if (tag === "textarea") return "textbox";
      if (tag === "input") {
        if (["submit", "button", "reset"].includes(type)) return "button";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        return "textbox";
      }
      return el.getAttribute("role") || "";
    };

    const cssPath = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
        let part = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (parent) {
          const sibs = [...parent.children].filter((c) => c.tagName === node.tagName);
          if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = node.parentElement;
      }
      return parts.join(" > ");
    };

    const sel = "input, button, a, select, textarea, [role], [data-test]";
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // skip hidden
      out.push({
        selector: cssPath(el),
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
      });
    }
    return out;
  };
}

// Weighted similarity between a learned fingerprint and a candidate descriptor.
// Only the signals present in the target contribute, and the score is normalised
// by the weights actually used, so missing signals don't unfairly penalise.
const WEIGHTS = {
  role: 0.15,
  tag: 0.1,
  text: 0.3,
  name: 0.2,
  placeholder: 0.15,
  "aria-label": 0.15,
  type: 0.1,
  position: 0.15,
};

export function score(target, candidate, viewport = { width: 1280, height: 800 }) {
  let got = 0;
  let max = 0;
  const add = (w, matched) => {
    max += w;
    if (matched) got += w;
  };

  if (target.role) add(WEIGHTS.role, target.role === candidate.role);
  if (target.tag) add(WEIGHTS.tag, target.tag === candidate.tag);
  if (target.text) add(WEIGHTS.text, target.text === candidate.text);

  for (const key of ["name", "placeholder", "aria-label", "type"]) {
    const tv = target.attrs?.[key];
    if (tv) add(WEIGHTS[key], tv === candidate.attrs?.[key]);
  }

  // position proximity: full credit when centres coincide, fading to 0 at a
  // quarter of the viewport diagonal away.
  if (target.box) {
    const tc = { x: target.box.x + target.box.w / 2, y: target.box.y + target.box.h / 2 };
    const cc = { x: candidate.box.x + candidate.box.w / 2, y: candidate.box.y + candidate.box.h / 2 };
    const dist = Math.hypot(tc.x - cc.x, tc.y - cc.y);
    const diag = Math.hypot(viewport.width, viewport.height);
    const prox = Math.max(0, 1 - dist / (diag / 4));
    add(WEIGHTS.position, false); // reserve the weight...
    got += WEIGHTS.position * prox; // ...and award the partial credit
  }

  return max === 0 ? 0 : Math.min(1, got / max);
}
