// Optional AI escalation hook (OFF by default).
//
// When the heuristic scorer can't confidently heal a locator, you can hand the
// learned fingerprint + the page's candidate list to an LLM and ask it to pick
// the best selector. This file documents that seam WITHOUT making any network
// call — wire in your provider of choice and return a selector string (or null).
//
// Example shape of a real implementation:
//
//   export async function llmSuggest({ name, target, candidates }) {
//     const prompt = `We are looking for the element "${name}" whose known
//       fingerprint is ${JSON.stringify(target)}. Here are the on-page
//       candidates: ${JSON.stringify(candidates)}. Reply with ONLY the CSS
//       selector of the best match.`;
//     const reply = await callYourModel(prompt);   // e.g. Anthropic / OpenAI
//     return reply.trim() || null;
//   }
//
// Pass it to the SmartLocator:  new SmartLocator(page, { store, llmSuggest })

/** No-op default so the engine runs fully offline and deterministically. */
export async function llmSuggest() {
  return null;
}
