// Merge capture + states manifests into workflow args. Writes _workflow-args.json.
import { readFileSync, writeFileSync } from 'node:fs'
const DIR = 'docs/design-audit/assets'
const cap = JSON.parse(readFileSync(`${DIR}/_capture-manifest.json`, 'utf8'))
let states = []
try { states = JSON.parse(readFileSync(`${DIR}/_states-manifest.json`, 'utf8')).filter(s => s.ok) } catch {}

const ROLE = Object.fromEntries([
  ['home', 'first-impression / homepage'], ['search', 'core discovery / search results'],
  ['listing-detail', 'core action / listing detail (mid $550k)'], ['listing-luxury', 'listing detail (luxury $11.9M)'],
  ['sell', 'seller funnel entry'], ['sell-valuation', 'seller conversion / valuation'],
  ['lp-seller-home-value', 'paid LP / seller value'], ['about', 'trust / about'], ['team', 'trust / team'],
  ['team-member', 'trust / broker profile'], ['contact', 'conversion / contact'], ['cities', 'discovery / cities hub'],
  ['city-bend', 'discovery / city detail (Bend)'], ['communities', 'discovery / communities hub'],
  ['community-tetherow', 'discovery / community detail'], ['housing-market', 'authority / market hub'],
  ['market-report', 'authority / market report'], ['reviews', 'trust / reviews'], ['blog', 'content / blog index'],
  ['blog-post', 'content / article'], ['buy', 'buyer funnel entry'], ['luxury-homes-bend', 'SEO landing / luxury'],
  ['faq', 'support / faq'], ['resources', 'support / resources'], ['open-houses', 'discovery / open houses'],
  ['tools-mortgage', 'tool / mortgage calc'], ['login', 'account / login'], ['signup', 'account / signup'],
])

const byName = {}
for (const r of cap) {
  if (!r.ok) continue
  byName[r.name] ??= { name: r.name, route: r.path, role: ROLE[r.name] || r.name, desktopPanels: [], mobilePanels: [] }
  byName[r.name].route = r.path
  if (r.vp === 'desktop') byName[r.name].desktopPanels = r.panels
  if (r.vp === 'mobile') byName[r.name].mobilePanels = r.panels
}
const pages = Object.values(byName)
const args = { assetsDir: DIR, pages, states: states.map(s => ({ name: s.name, route: s.route })) }
writeFileSync(`${DIR}/_workflow-args.json`, JSON.stringify(args, null, 2))
console.log(`args: ${pages.length} pages, ${args.states.length} states -> ${DIR}/_workflow-args.json`)
