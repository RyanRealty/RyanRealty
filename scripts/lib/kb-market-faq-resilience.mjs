/**
 * kb-market-faq-resilience.mjs — the G52 rule that a KB data page's market
 * JSON-LD cannot vanish.
 *
 * WHAT THIS LOCKS IS THE OUTCOME, NOT ITS SPELLING. The regression it exists to
 * catch is a page whose Dataset/FAQPage markup disappears when the market read is
 * slow, missing, or omitted — `pulse ? buildMarketFaq(...) : null`. Every shape
 * below keeps the markup alive; a shape that can yield nothing does not.
 *
 * Extracted from scripts/check-kb-page-contract.mjs 2026-08-25 so the rule has a
 * failing fixture beside it (scripts/lib/kb-market-faq-resilience.test.mjs)
 * instead of being an inline regex only the live app exercises.
 *
 * @param raw  the page source as written — the two pulse arms read it untouched,
 *             exactly as they did before extraction
 * @param code the same source with comments stripped — prose describing a
 *             fallback must never stand in for one
 */
export function isResilientMarketFaq(raw, code) {
  // The market-truth shape (MARKET_TRUTH D26). These pages no longer read market
  // pulse at all — D19/D26 say a leftover miss OMITS and pulse never fills — so
  // there is no `pulse` identifier left to spell a fallback with. What replaced it
  // is stronger than a fallback: the page builds an input object whose every
  // figure is nullable and calls buildMarketFaq UNCONDITIONALLY, as a direct
  // assignment. No branch can take an empty arm and no row's timeout can swallow
  // the call, so a leftover miss omits one figure and the FAQPage, Dataset and
  // visible Q&A still emit.
  //
  // `=\s*buildMarketFaq\(` is what carries the guarantee: the vanishing shape
  // `const x = pulse ? buildMarketFaq(...) : null` puts a ternary between `=` and
  // the call, so it does not match and the page still fails. Requiring the input
  // to name `source: 'market-truth'` keeps this arm from green-lighting anything
  // outside that architecture.
  const marketTruthUnconditional =
    /source:\s*'market-truth'/.test(code) && /=\s*buildMarketFaq\(/.test(code)

  // The KB shape: buildMarketFaq(name, pulse ?? { ...verified figures }).
  const nullishInline = /buildMarketFaq\([^)]*\bpulse\s*\?\?/.test(raw)
  const nullishObject = /pulse\s*\?\?\s*\{[\s\S]*?\}/.test(raw)

  // The branch shape: pulse ? buildMarketFaq(name, pulse) : fallbackSet(...).
  // buildMarketFaq's prose is written for the single-family population, so a page
  // whose fallback numbers are a DIFFERENT population cannot route them through
  // `??` without publishing them under the wrong name in the Q&A, the FAQPage
  // markup and the Dataset variables at once (§0). A page that branches can name
  // what it actually read. The else arm must be a CALL — a builder that returns a
  // set — so `: null` still fails.
  const branchToBuilder =
    /\bpulse\b\s*(?:!=\s*null\s*)?\?(?!\.)[\s\S]{0,300}?buildMarketFaq\([\s\S]{0,300}?:\s*[A-Za-z_$][\w$]*\s*\(/.test(
      code,
    )

  return marketTruthUnconditional || nullishInline || nullishObject || branchToBuilder
}
