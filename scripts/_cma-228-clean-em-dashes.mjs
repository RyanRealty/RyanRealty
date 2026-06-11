#!/usr/bin/env node
/**
 * Clean visible-narrative em-dashes from the 228 SE Soft Tail CMA draft.
 *
 *   - Skip HTML comments (<!-- … -->)
 *   - Skip image alt text (alt="…")
 *   - Skip MLS quoted public_remarks (already safely ignored elsewhere)
 *
 * Replace patterns:
 *   "  —  " (parenthetical) → ". "
 *   "$X — $Y" (range)       → "$X to $Y"
 *   General "—" in <p>, <div>, <li>, <h*>, <td> body text → ". "
 *
 * This is a single-file mutation. Re-run safely.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const HTML_PATH = resolve(REPO_ROOT, 'public/drafts/cma-228-soft-tail/cma.html')

let html = readFileSync(HTML_PATH, 'utf8')

const replacements = [
  // Value range
  ['$745,000 — $819,000', '$745,000 to $819,000'],
  // 2024–2026 (en-dash) range — keep en-dash for date ranges? actually check; brand says no en-dash in body
  // Leave 2024–2026, 2025–2026 etc. (date ranges) as en-dash since they're number ranges; but rule says no en-dash either
  ['2024–2026', '2024 to 2026'],
  ['2025–2026', '2025 to 2026'],
  // Subject narrative paragraphs (page 2)
  ["10 years ago — record only", '10 years ago, record only'],
  ['Off-market — no MLS activity', 'Off-market. No MLS activity'],
  ["closes cleared $341–$464/sqft. The subject's 2022 close is no longer a price anchor — it is a starting basis only", "closes cleared $341 to $464/sqft. The subject's 2022 close is no longer a price anchor; it is a starting basis only"],
  ['$328–$388/sqft, and 2025–2026 closes cleared $341–$464/sqft', '$328 to $388/sqft, and 2025 to 2026 closes cleared $341 to $464/sqft'],
  // Subject narrative (page 2 - wide chunks)
  ['established subdivision in south Bend with a clean comp set. The subject is a well-built 2004 home in the most desirable size band for the neighborhood (2,000–2,200 sqft) on a standard lot. The recent sales spread is wide ($678K to $899K) but tracks predictably to size, lot, and bath count.', 'established subdivision in south Bend with a clean comp set. The subject is a well-built 2004 home in the most desirable size band for the neighborhood (2,000 to 2,200 sqft) on a standard lot. The recent sales spread is wide ($678K to $899K) but tracks predictably to size, lot, and bath count.'],
  ['The pricing question is not "what is a Hollow Pine home worth" but "where in the $678K–$899K band does this specific property sit." The answer turns on the 3-car oversized garage with RV parking, the corner lot, and the 2004 build vintage relative to the 2001–2005 comp set.', 'The pricing question is not "what is a Hollow Pine home worth" but "where in the $678K to $899K band does this specific property sit." The answer turns on the 3-car oversized garage with RV parking, the corner lot, and the 2004 build vintage relative to the 2001 to 2005 comp set.'],
  // Page 3 caption
  ['photo from Sept 2022 · current condition unverified', 'photo from Sept 2022. Current condition unverified'],
  // Page 5 section title
  ['<h2 class="section">Subdivision Comparable Sales — Hollow Pine Estate</h2>', '<h2 class="section">Subdivision Comparable Sales · Hollow Pine Estate</h2>'],
  // Page 5 small note
  ['Highlighted rows are the two primary anchors on page 15: <strong>217 SE Soft Tail Dr</strong> (closest floor plan, same vintage) and <strong>276 SE Soft Tail Dr</strong> (most-recent same-size close). Currently Active context: 217 SE Soft Tail re-listed May 12, 2026 at $875,000', 'Highlighted rows are the two primary anchors on page 15. <strong>217 SE Soft Tail Dr</strong> (closest floor plan, same vintage) and <strong>276 SE Soft Tail Dr</strong> (most-recent same-size close). Currently Active context. 217 SE Soft Tail re-listed May 12, 2026 at $875,000'],
  // Comp flyer "Why this matters" cells (each comp has one)
  ['Same plan, vintage, lot — primary anchor', 'Same plan, vintage, lot. Primary anchor'],
  ['Closest size + most-recent — pricing anchor', 'Closest size and most-recent. Pricing anchor'],
  ['Most-recent close — recency anchor (smaller home)', 'Most-recent close. Recency anchor (smaller home)'],
  ['Subject larger sqft + larger lot — adjusts up', 'Subject larger sqft + larger lot. Adjusts up'],
  ['Same lot type · 3-car · RV — strong proxy', 'Same lot type · 3-car · RV. Strong proxy'],
  ['Subject is single-level — different product tier', 'Subject is single-level. Different product tier'],
  ['Premium lot + 4 bd / 3 ba — ceiling reference', 'Premium lot + 4 bd / 3 ba. Ceiling reference'],
  ['Premium lot + solar — adjusted high reference', 'Premium lot + solar. Adjusted high reference'],
  ['Larger sqft + 3-bath — adjusts subject down', 'Larger sqft + 3-bath. Adjusts subject down'],
  // Page 15 (Pricing Strategy)
  ['<p>Two methods, one answer. Both bracket the subject in roughly the same place — that is the math check.</p>', '<p>Two methods, one answer. Both bracket the subject in roughly the same place. That is the math check.</p>'],
  ['<h3 class="subhead">Method 1 — Tiered price-per-sqft (mid-tier, standard lot)</h3>', '<h3 class="subhead">Method 1. Tiered price-per-sqft (mid-tier, standard lot)</h3>'],
  ['<h3 class="subhead">Method 2 — Closest comparable + adjustments</h3>', '<h3 class="subhead">Method 2. Closest comparable + adjustments</h3>'],
  ['<p>The 9 comps split into three tiers by lot, bath count, and condition. Strip the premium-lot and 4-bath outliers (351, 277, 368) and the smaller-home outlier (301). The remaining "mid-tier · standard lot · 3 bd / 2 ba" cluster — 217, 276, 392, 2149, 340 — clears $328–$388/sqft, with 2025 closes weighted to $341–$354/sqft. Apply $360–$385/sqft to the subject\'s 2,051 sqft.</p>', '<p>The 9 comps split into three tiers by lot, bath count, and condition. Strip the premium-lot and 4-bath outliers (351, 277, 368) and the smaller-home outlier (301). The remaining mid-tier homes (3 bd / 2 ba on a standard lot, namely 217, 276, 392, 2149, 340) cleared $328 to $388/sqft, with 2025 closes weighted to $341 to $354/sqft. Apply $360 to $385/sqft to the subject\'s 2,051 sqft.</p>'],
  ['<p>Anchor on 217 SE Soft Tail Drive — almost certainly the same builder and floor plan, 2005 build vs subject 2004, 0.22 ac lot. It closed Oct 2024 at $715,000 and is currently relisted Active at $875,000 (May 12, 2026). Adjust: subject is 127 sqft smaller than 217 (−$46K at $360/sqft marginal), the 3-car oversized garage with RV parking is a clear upgrade over 217\'s 2-car (+$15–25K), and 19 months of subdivision appreciation 2024 → 2026 (the 2025 closes cleared $341–$464/sqft vs 2024\'s $328–$421/sqft) adds roughly $60–80K to a 2024 close in this tier.</p>', '<p>Anchor on 217 SE Soft Tail Drive. It is almost certainly the same builder and floor plan, 2005 build vs subject 2004, 0.22 ac lot. It closed Oct 2024 at $715,000 and is currently relisted Active at $875,000 (May 12, 2026). Adjust: subject is 127 sqft smaller than 217 (−$46K at $360/sqft marginal), the 3-car oversized garage with RV parking is a clear upgrade over 217\'s 2-car (+$15K to $25K), and 19 months of subdivision appreciation 2024 to 2026 (the 2025 closes cleared $341 to $464/sqft vs 2024\'s $328 to $421/sqft) adds roughly $60K to $80K to a 2024 close in this tier.</p>'],
  ['<p>Cross-check on 276 SE Soft Tail (most-recent same-size, 8 months old): $760,000 close. Subject is 93 sqft smaller (−$33K), garage is comparable (3-car each), 8 months of appreciation (+$15–25K). Result: <code style="font-family:\'Geist Mono\',monospace; background: var(--navy-fill); padding:1px 5px; border-radius:3px;">$742K–$752K</code> — converges with the 217 anchor.</p>', '<p>Cross-check on 276 SE Soft Tail (most-recent same-size, 8 months old): $760,000 close. Subject is 93 sqft smaller (−$33K), garage is comparable (3-car each), 8 months of appreciation (+$15K to $25K). Result: <code style="font-family:\'Geist Mono\',monospace; background: var(--navy-fill); padding:1px 5px; border-radius:3px;">$742K to $752K</code>. Converges with the 217 anchor.</p>'],
  // Tier note
  ["Sits above 276 SE Soft Tail's Sept 2025 close ($760K) by the 3-car oversized + RV-parking premium and a partial appreciation credit. Comfortably below the premium-lot tier (277 at $800K, 351 at $895K). Tested against 217's current Active list of $875K — leaves room for buyer negotiation.", "Sits above 276 SE Soft Tail's Sept 2025 close ($760K) by the 3-car oversized + RV-parking premium and a partial appreciation credit. Comfortably below the premium-lot tier (277 at $800K, 351 at $895K). Tested against 217's current Active list of $875K. Leaves room for buyer negotiation."],
  // Page 16 narrative
  ['<p>Three comps cleared above $850K — 351 SE Soft Tail Loop ($895K · 4 bd / 3 ba on 0.38 ac), 277 SE Soft Tail Drive ($800K · 0.38 ac · solar + EV charger), and 368 SE Soft Tail Loop ($899K · 2,378 sqft · 3-bath · 2-story bonus room). None are direct subject comps. The subject is a 3 bd / 2 ba single-level on a standard 0.21-acre lot — it does not carry the +$50K–$150K premiums those three properties earned for premium lot, extra bedroom, extra bath, or solar package. Anchoring the recommended list on those three would mis-price the subject and produce DOM without offers.</p>', '<p>Three comps cleared above $850K. 351 SE Soft Tail Loop ($895K · 4 bd / 3 ba on 0.38 ac), 277 SE Soft Tail Drive ($800K · 0.38 ac · solar + EV charger), and 368 SE Soft Tail Loop ($899K · 2,378 sqft · 3-bath · 2-story bonus room). None are direct subject comps. The subject is a 3 bd / 2 ba single-level on a standard 0.21-acre lot. It does not carry the +$50K to $150K premiums those three properties earned for premium lot, extra bedroom, extra bath, or solar package. Anchoring the recommended list on those three would mis-price the subject and produce DOM without offers.</p>'],
  ["<p>2149 SE Harley Lane closed at $678,000 in July 2025 ($341/sqft). That comp sits on the smaller-lot end of the subdivision (0.17 ac vs subject's 0.21 ac) and is 65 sqft smaller. The 2149 close is a clean low anchor and the appropriate floor-of-the-band for a comparable sale within Hollow Pine — it tells us the subject should not list below ~$745K.</p>", "<p>2149 SE Harley Lane closed at $678,000 in July 2025 ($341/sqft). That comp sits on the smaller-lot end of the subdivision (0.17 ac vs subject's 0.21 ac) and is 65 sqft smaller. The 2149 close is a clean low anchor and the appropriate floor-of-the-band for a comparable sale within Hollow Pine. It tells us the subject should not list below roughly $745K.</p>"],
  ["<p>The recommended price sits in the upper third of the 2024–2026 mid-tier band ($678K–$760K closes plus the most-recent at $699K), reflects the 19 months of subdivision appreciation since the closest plan match (217 SE Soft Tail) closed at $715K, and credits the subject's 3-car oversized garage with RV-parking capacity that none of the standard-lot comps match at the same price point. It also leaves negotiating room: at $789K list, an offer in the high $760s to mid $770s is defensible and produces a close that the comp set fully supports. The current 217 SE Soft Tail Active list of $875K is aspirational — the 2024 close at $328/sqft is the harder data point — and 209 SE Soft Tail's Active list at $689,000 (1,823 sqft) confirms that smaller homes in the subdivision are seeking $370–$380/sqft right now.</p>", "<p>The recommended price sits in the upper third of the 2024 to 2026 mid-tier band ($678K to $760K closes plus the most-recent at $699K), reflects the 19 months of subdivision appreciation since the closest plan match (217 SE Soft Tail) closed at $715K, and credits the subject's 3-car oversized garage with RV-parking capacity that none of the standard-lot comps match at the same price point. It also leaves negotiating room. At $789K list, an offer in the high $760s to mid $770s is defensible and produces a close that the comp set fully supports. The current 217 SE Soft Tail Active list of $875K is aspirational. The 2024 close at $328/sqft is the harder data point. And 209 SE Soft Tail's Active list at $689,000 (1,823 sqft) confirms that smaller homes in the subdivision are seeking $370 to $380/sqft right now.</p>"],
  ['<p>If the seller has invested in updates since the 2022 close (kitchen, baths, flooring, paint, roof, HVAC) with documentation, the value range rebuilds upward using Pacific-region cost-vs-value recovery rates: kitchen 65–75% recovery, bath 60–70%, paint 60–80%, roof 60–70%, HVAC 60–80%. A $40,000 documented kitchen + bath refresh would lift the recommended list by roughly $25,000–$30,000. Conversely, deferred maintenance or condition issues would compress the range toward the conservative tier.</p>', '<p>If the seller has invested in updates since the 2022 close (kitchen, baths, flooring, paint, roof, HVAC) with documentation, the value range rebuilds upward using Pacific-region cost-vs-value recovery rates: kitchen 65 to 75% recovery, bath 60 to 70%, paint 60 to 80%, roof 60 to 70%, HVAC 60 to 80%. A $40,000 documented kitchen + bath refresh would lift the recommended list by roughly $25,000 to $30,000. Conversely, deferred maintenance or condition issues would compress the range toward the conservative tier.</p>'],
  // Verification trace
  ['Subject: <code>/v1/listings/20220901211339310776000000</code> — last MLS listing of 228 SE Soft Tail Dr', 'Subject: <code>/v1/listings/20220901211339310776000000</code>. Last MLS listing of 228 SE Soft Tail Dr'],
  ['the 9 comps split into three tiers by lot, bath count, and condition. Strip the premium-lot and 4-bath outliers', 'the 9 comps split into three tiers by lot, bath count, and condition. Strip the premium-lot and 4-bath outliers'], // no-op safety
  ['Comp set: <code>/v1/listings?_filter=City Eq \'Bend\' And SubdivisionName Eq \'Hollow Pine Estate\' And PropertyType Eq \'A\' And StandardStatus Eq \'Closed\' And CloseDate Ge 2024-05-26</code>. Result: 9 closed sales', 'Comp set: <code>/v1/listings?_filter=City Eq \'Bend\' And SubdivisionName Eq \'Hollow Pine Estate\' And PropertyType Eq \'A\' And StandardStatus Eq \'Closed\' And CloseDate Ge 2024-05-26</code>. Result: 9 closed sales'], // no-op safety
  ['No Spark × Supabase reconciliation step ran — the Supabase pooler returned Cloudflare 522 during the pull window, so all figures are direct from Spark.', 'No Spark × Supabase reconciliation step ran. The Supabase pooler returned Cloudflare 522 during the pull window, so all figures are direct from Spark.'],
]

let totalReplaced = 0
for (const [from, to] of replacements) {
  const idx = html.indexOf(from)
  if (idx === -1) {
    console.log(`  not found: "${from.slice(0, 80)}…"`)
  } else {
    html = html.slice(0, idx) + to + html.slice(idx + from.length)
    totalReplaced++
  }
}

writeFileSync(HTML_PATH, html)
console.log(`\nReplaced ${totalReplaced} of ${replacements.length} patterns`)

// Re-count em-dashes in narrative
const narrative = html
  .replace(/<p class="flyer-desc">[\s\S]*?<\/p>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<head[\s\S]*?<\/head>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/alt="[^"]*"/g, '')

const remaining = narrative.split('\n').filter(l => l.includes('—'))
console.log(`\nRemaining em-dash lines (excluding HTML comments + alt attrs + MLS quotes): ${remaining.length}`)
remaining.slice(0, 20).forEach((l, i) => {
  console.log(`  ${i + 1}: ${l.trim().slice(0, 200)}`)
})
