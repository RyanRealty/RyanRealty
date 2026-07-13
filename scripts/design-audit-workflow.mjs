export const meta = {
  name: 'ryan-realty-design-audit',
  description: 'Full-site UI/UX audit of the Ryan Realty site from captured screenshots: per-page review across 7 dimensions, cross-cutting nav/design/conversion/states review, adversarial verification of P0/P1 findings.',
  phases: [
    { title: 'Per-page review' },
    { title: 'Cross-cutting review' },
    { title: 'Verify P0/P1' },
  ],
}

// args = { assetsDir, pages:[{name,route,role,desktopPanels:[],mobilePanels:[]}], states:[{name,route}] }
const A = args || {}
const ASSETS = A.assetsDir || 'docs/design-audit/assets'
const PAGES = A.pages || []
const STATES = A.states || []

const FINDING = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'page name (e.g. "home") or "global"' },
          route: { type: 'string' },
          viewport: { type: 'string', enum: ['desktop', 'mobile', 'both'] },
          dimension: { type: 'string', enum: ['first-impression', 'navigation', 'visual-hierarchy', 'component-consistency', 'states', 'trust', 'conversion'] },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          hurts: { type: 'array', items: { type: 'string', enum: ['understanding', 'trust', 'conversion'] } },
          title: { type: 'string', description: 'one-line issue statement' },
          evidence: { type: 'string', description: 'what is on screen + which panel file proves it' },
          fix: { type: 'string', description: 'specific actionable fix' },
          effort: { type: 'string', enum: ['quick', 'medium', 'large'], description: 'quick = copy/spacing/hierarchy/button fixable today' },
        },
        required: ['page', 'dimension', 'severity', 'hurts', 'title', 'evidence', 'fix', 'effort'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'downgrade', 'reject'] },
    corrected_severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    note: { type: 'string', description: 'why confirmed/downgraded/rejected after re-reading the screenshot' },
  },
  required: ['verdict', 'corrected_severity', 'note'],
}

const RUBRIC = `
You are a senior product-design lead auditing a real-estate website on your first day.
Judge whether a NORMAL, non-expert user can (1) UNDERSTAND what this is and what to do, (2) TRUST it enough to act, and (3) CONVERT — finish the core action (find a home / inquire on a listing / request a home valuation) without reading docs.
Judge the EXPERIENCE, not whether it "looks nice." An ugly page that converts beats a pretty page that confuses.

Severity:
- P0 = blocks understanding/trust/conversion for many users, or a broken/incoherent core surface. Ship-blocker.
- P1 = materially hurts one of understanding/trust/conversion; a clear friction point most users hit.
- P2 = noticeable rough edge; erodes polish/consistency; smaller conversion drag.
- P3 = minor nit.

Be specific and evidence-based. Cite the exact panel filename that proves each finding. Every finding needs a concrete fix. Mark effort=quick only if it is a copy tweak, spacing/margin, button hierarchy/label, or a single obviously-safe swap. Do NOT invent problems; if a page is strong, return few findings. Do NOT flag brand-token or pixel-nitpicks unless they hurt understanding/trust/conversion.
Return JSON only.`

const pad = (i) => String(i + 1).padStart(2, '0')
const panelNames = (name, vp, count) => Array.from({ length: count }, (_, i) => `${name}-${vp}-${pad(i)}.png`)

phase('Per-page review')
const perPage = PAGES.map((p) => () => {
  const dList = p.desktopPanels || panelNames(p.name, 'desktop', p.d || 0)
  const mList = p.mobilePanels || panelNames(p.name, 'mobile', p.m || 0)
  const dPanels = dList.map((f) => `${ASSETS}/${f}`)
  const mPanels = mList.map((f) => `${ASSETS}/${f}`)
  // Sample to bound cost: all desktop panels; mobile fold + up to 4 spread across the page.
  const mSample = mPanels.length <= 5 ? mPanels : [mPanels[0], mPanels[Math.floor(mPanels.length * 0.3)], mPanels[Math.floor(mPanels.length * 0.55)], mPanels[Math.floor(mPanels.length * 0.8)], mPanels[mPanels.length - 1]]
  const prompt = `${RUBRIC}

PAGE: "${p.name}"  ROUTE: ${p.route}  ROLE: ${p.role}

Read these DESKTOP screenshots (top-to-bottom panels of the full page):
${dPanels.map((f, i) => `  panel ${i + 1}: ${f}`).join('\n')}

Read these MOBILE screenshots (sampled top-to-bottom):
${mSample.map((f) => `  ${f}`).join('\n') || '  (none — desktop-only page)'}

Also: to locate a precise fix target, you MAY grep the repo for the page source (e.g. app${p.route === '/' ? '/page.tsx' : p.route + '/page.tsx'} and its components under components/), but keep it light — the rendered experience is what you judge.

Audit THIS page across all applicable dimensions: first-impression, navigation, visual-hierarchy, component-consistency, states (loading/empty/error if visible), trust, conversion. For mobile, specifically check tap-target size, overflow/cramping, and whether the core CTA survives.
Emit every real issue as a finding. Read the actual pixels before asserting.`
  return agent(prompt, { label: `page:${p.name}`, phase: 'Per-page review', schema: FINDING })
    .then((r) => (r?.findings || []).map((f) => ({ ...f, _src: `page:${p.name}` })))
    .catch(() => [])
})

phase('Cross-cutting review')
const cross = [
  () => agent(`${RUBRIC}

CROSS-CUTTING AUDIT: NAVIGATION & INFORMATION ARCHITECTURE consistency across the whole site.
The site appears to run TWO different header/nav systems: a "KB" nav on the homepage + listing/geo pages (uppercase HOMES / COMMUNITIES / CITIES / SELL / ACCOUNT / MENU+) and a different "SiteHeader" on the search page and utility pages (Homes / Sell / Market / Guides / About + Sign in / Get listing alerts / What's my home worth). Verify this by reading:
  ${ASSETS}/home-desktop-01.png
  ${ASSETS}/search-desktop-01.png
  ${ASSETS}/listing-detail-desktop-01.png
  ${ASSETS}/about-desktop-01.png
  ${ASSETS}/contact-desktop-01.png
  ${ASSETS}/state-nav-megamenu-desktop.png
  ${ASSETS}/state-nav-siteheader-desktop.png
  ${ASSETS}/state-nav-drawer-home-mobile.png
  ${ASSETS}/state-nav-drawer-site-mobile.png
Assess: Do the two navs confuse a user who moves between pages? Are labels/order/casing/CTAs inconsistent? Is the auth entry ("ACCOUNT" vs "Sign in") coherent? Is there a persistent phone/contact affordance? Is the footer consistent? Grep components/site for KbNav.client and SiteHeader if helpful.
Emit findings (page="global", dimension="navigation").`, { label: 'cross:nav-ia', phase: 'Cross-cutting review', schema: FINDING }).then(r => (r?.findings || []).map(f => ({ ...f, _src: 'cross:nav' }))).catch(() => []),

  () => agent(`${RUBRIC}

CROSS-CUTTING AUDIT: DESIGN-LANGUAGE / COMPONENT CONSISTENCY across surfaces.
Read the above-the-fold panel of many pages and compare button styles, card styles, heading treatment (display font usage), spacing rhythm, color use, and whether pages feel like one product:
  ${['home', 'search', 'listing-detail', 'sell', 'about', 'team', 'cities', 'city-bend', 'communities', 'housing-market', 'reviews', 'blog', 'contact', 'faq'].map(n => `  ${ASSETS}/${n}-desktop-01.png`).join('\n')}
Flag surfaces that look like a different site, inconsistent primary-button styling, heading fonts that drift from the display face, and any page that looks visibly less finished than the homepage. Emit findings (dimension="component-consistency"), naming the specific pages that diverge.`, { label: 'cross:design-language', phase: 'Cross-cutting review', schema: FINDING }).then(r => (r?.findings || []).map(f => ({ ...f, _src: 'cross:design' }))).catch(() => []),

  () => agent(`${RUBRIC}

CROSS-CUTTING AUDIT: CONVERSION PATHS. Trace the two core funnels as a first-time user and find the friction.
BUYER path: home -> search -> listing detail -> inquire/contact. Read:
  ${ASSETS}/home-desktop-01.png
  ${['search-desktop-01', 'search-desktop-02', 'listing-detail-desktop-01', 'listing-detail-desktop-02', 'listing-detail-desktop-03', 'listing-detail-desktop-04', 'contact-desktop-01'].map(n => `  ${ASSETS}/${n}.png`).join('\n')}
SELLER path: home -> sell -> valuation / seller-home-value LP. Read:
  ${['sell-desktop-01', 'sell-desktop-02', 'sell-valuation-desktop-01', 'sell-valuation-desktop-02', 'lp-seller-home-value-desktop-01', 'lp-seller-home-value-desktop-02'].map(n => `  ${ASSETS}/${n}.png`).join('\n')}
For each funnel: Is the next step obvious at every hop? Is there a clear primary CTA on the listing detail (request tour / contact / ask a question)? How many form fields before value is delivered? Are there dead-ends? Is a phone number ever offered? Emit findings (dimension="conversion") with the exact hop that leaks.`, { label: 'cross:conversion', phase: 'Cross-cutting review', schema: FINDING }).then(r => (r?.findings || []).map(f => ({ ...f, _src: 'cross:conversion' }))).catch(() => []),

  () => agent(`${RUBRIC}

CROSS-CUTTING AUDIT: LOADING / EMPTY / ERROR STATES. Read the state captures and judge whether a user who hits them stays oriented and has a way forward:
${STATES.map(s => `  ${ASSETS}/${s.name}.png  (${s.route})`).join('\n')}
Assess the 404 page (does it help the user recover, offer search/nav?), the invalid-listing state, and the empty-search-results state (is there a helpful empty state or a confusing blank?). If a state screenshot looks like a normal populated page (i.e. the empty/error state did NOT trigger), say so rather than inventing a problem. Emit findings (dimension="states").`, { label: 'cross:states', phase: 'Cross-cutting review', schema: FINDING }).then(r => (r?.findings || []).map(f => ({ ...f, _src: 'cross:states' }))).catch(() => []),
]

const [pageResults, crossResults] = await Promise.all([
  parallel(perPage),
  parallel(cross),
])
const all = [...pageResults, ...crossResults].filter(Boolean).flat()
log(`Collected ${all.length} raw findings (${pageResults.flat().length} per-page, ${crossResults.flat().length} cross-cutting)`)

// Verify only the gating findings (P0/P1) adversarially.
phase('Verify P0/P1')
const gating = all.filter(f => f.severity === 'P0' || f.severity === 'P1')
const verified = await parallel(gating.map((f) => () => {
  const shot = `${ASSETS}/${(f.evidence.match(/([a-z0-9-]+-(?:desktop|mobile)(?:-\d+)?|state-[a-z0-9-]+)\.png/i) || [])[0] || (f.page + '-desktop-01.png')}`
  return agent(`You are an adversarial verifier. A senior design lead claims this finding about the Ryan Realty site. Try to REFUTE it by reading the actual screenshot. Default to skepticism.

FINDING (${f.severity}, ${f.dimension}, page=${f.page}): ${f.title}
CLAIMED EVIDENCE: ${f.evidence}
CLAIMED FIX: ${f.fix}

Read the screenshot the evidence points to: ${shot}
(If that file does not exist or is the wrong panel, read ${ASSETS}/${f.page}-desktop-01.png instead.)

Decide: is the issue REAL and correctly severed? confirmed = real at this severity. downgrade = real but less severe (set corrected_severity). reject = not real / already handled / misread. Be honest — a wrongly-confirmed P0 wastes the team's time as much as a missed one.`, { label: `verify:${f.page}:${(f.title || '').slice(0, 24)}`, phase: 'Verify P0/P1', schema: VERDICT })
    .then((v) => ({ ...f, _verdict: v?.verdict, _severity_final: v?.corrected_severity || f.severity, _verify_note: v?.note }))
    .catch(() => ({ ...f, _verdict: 'unverified', _severity_final: f.severity }))
}))

const nonGating = all.filter(f => f.severity !== 'P0' && f.severity !== 'P1').map(f => ({ ...f, _verdict: 'unverified', _severity_final: f.severity }))
const confirmedGating = verified.filter(v => v._verdict !== 'reject')
const rejected = verified.filter(v => v._verdict === 'reject')
log(`Verified: ${confirmedGating.length}/${gating.length} gating findings survived, ${rejected.length} rejected`)

return {
  summary: {
    raw: all.length,
    perPage: pageResults.flat().length,
    crossCutting: crossResults.flat().length,
    gating: gating.length,
    gatingSurvived: confirmedGating.length,
    gatingRejected: rejected.length,
  },
  findings: [...confirmedGating, ...nonGating],
  rejected,
}
