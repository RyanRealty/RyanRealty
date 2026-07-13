export const meta = {
  name: 'ryan-realty-design-audit-perpage',
  description: 'Per-page UI/UX review of every captured Ryan Realty page across 7 dimensions, then adversarial verification of P0/P1 findings. Complements the earlier cross-cutting run.',
  phases: [
    { title: 'Per-page review' },
    { title: 'Verify P0/P1' },
  ],
}

const ASSETS = 'docs/design-audit/assets'

// Embedded so the run does not depend on args delivery. [name, route, role, dCount, mCount]
const PAGES = [
  ['home', '/', 'first-impression / homepage', 14, 18],
  ['search', '/homes-for-sale', 'core discovery / search results', 3, 4],
  ['listing-detail', '/listing/20260328234720220317000000', 'core action / listing detail (mid $550k)', 14, 18],
  ['listing-luxury', '/listing/20250715233741474954000000', 'listing detail (luxury $11.9M)', 14, 0],
  ['sell', '/sell', 'seller funnel entry', 14, 18],
  ['sell-valuation', '/sell/valuation', 'seller conversion / valuation', 5, 6],
  ['lp-seller-home-value', '/lp/seller-home-value', 'paid LP / seller value', 7, 10],
  ['about', '/about', 'trust / about', 9, 13],
  ['team', '/team', 'trust / team', 8, 12],
  ['team-member', '/team/matthew-ryan', 'trust / broker profile', 10, 0],
  ['contact', '/contact', 'conversion / contact', 3, 5],
  ['cities', '/cities', 'discovery / cities hub', 11, 15],
  ['city-bend', '/cities/bend', 'discovery / city detail (Bend)', 14, 18],
  ['communities', '/communities', 'discovery / communities hub', 14, 18],
  ['community-tetherow', '/communities/tetherow', 'discovery / community detail', 14, 18],
  ['housing-market', '/housing-market', 'authority / market hub', 9, 12],
  ['market-report', '/housing-market/central-oregon', 'authority / market report', 11, 0],
  ['reviews', '/reviews', 'trust / reviews', 7, 15],
  ['blog', '/blog', 'content / blog index', 8, 13],
  ['blog-post', '/blog/understanding-home-appraisals', 'content / article', 10, 0],
  ['buy', '/buy', 'buyer funnel entry', 7, 0],
  ['luxury-homes-bend', '/luxury-homes-bend', 'SEO landing / luxury', 5, 0],
  ['faq', '/faq', 'support / faq', 5, 0],
  ['resources', '/resources', 'support / resources', 4, 0],
  ['open-houses', '/open-houses', 'discovery / open houses', 4, 0],
  ['tools-mortgage', '/tools/mortgage-calculator', 'tool / mortgage calc', 5, 0],
  ['login', '/login', 'account / login', 3, 0],
  ['signup', '/signup', 'account / signup', 3, 0],
]

const FINDING = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          route: { type: 'string' },
          viewport: { type: 'string', enum: ['desktop', 'mobile', 'both'] },
          dimension: { type: 'string', enum: ['first-impression', 'navigation', 'visual-hierarchy', 'component-consistency', 'states', 'trust', 'conversion'] },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          hurts: { type: 'array', items: { type: 'string', enum: ['understanding', 'trust', 'conversion'] } },
          title: { type: 'string' },
          evidence: { type: 'string', description: 'what is on screen + which panel file proves it' },
          fix: { type: 'string' },
          effort: { type: 'string', enum: ['quick', 'medium', 'large'] },
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
    note: { type: 'string' },
  },
  required: ['verdict', 'corrected_severity', 'note'],
}

const RUBRIC = `You are a senior product-design lead auditing a real-estate website on your first day.
Judge whether a NORMAL, non-expert user can (1) UNDERSTAND what this is and what to do, (2) TRUST it enough to act, and (3) CONVERT — finish the core action (find a home / inquire on a listing / request a home valuation) without reading docs.
Judge the EXPERIENCE, not whether it "looks nice." An ugly page that converts beats a pretty page that confuses.

Severity: P0 = blocks understanding/trust/conversion for many users or a broken/incoherent core surface (ship-blocker). P1 = materially hurts one of the three; clear friction most users hit. P2 = noticeable rough edge / consistency erosion / smaller conversion drag. P3 = minor nit.

KNOWN CONTEXT (do NOT re-report these; they are already covered by a separate cross-cutting pass):
- The site runs two different global headers (KbNav vs SiteHeader) and two footers. Only flag nav on THIS page if there is a page-specific nav problem beyond that split.
- IMPORTANT CAPTURE ARTIFACT: a small dark circular "N" badge in the extreme BOTTOM-LEFT corner of many screenshots is the Next.js DEV-MODE indicator (dev server only, absent in production). It is NOT a real site element. Do NOT report it as an overlapping badge / chat launcher / UI defect.

Be specific and evidence-based. Cite the exact panel filename that proves each finding. Every finding needs a concrete fix. effort=quick only for copy tweak, spacing/margin, button hierarchy/label, or a single obviously-safe swap. Do not invent problems; a strong page returns few findings. Focus on issues SPECIFIC to this page (its content, hierarchy, forms, empty/loading states, mobile cramping, tap targets, trust signals, and whether its core CTA is obvious and reachable). Return JSON only.`

const pad = (i) => String(i + 1).padStart(2, '0')
const names = (name, vp, n) => Array.from({ length: n }, (_, i) => `${ASSETS}/${name}-${vp}-${pad(i)}.png`)

phase('Per-page review')
const perPage = await parallel(PAGES.map(([name, route, role, d, m]) => () => {
  const dP = names(name, 'desktop', d)
  const mAll = names(name, 'mobile', m)
  const mSample = mAll.length <= 5 ? mAll : [mAll[0], mAll[Math.floor(mAll.length * 0.3)], mAll[Math.floor(mAll.length * 0.55)], mAll[Math.floor(mAll.length * 0.8)], mAll[mAll.length - 1]]
  const prompt = `${RUBRIC}

PAGE: "${name}"  ROUTE: ${route}  ROLE: ${role}

DESKTOP panels (top-to-bottom, full page):
${dP.map((f, i) => `  panel ${i + 1}: ${f}`).join('\n')}

MOBILE panels (sampled top-to-bottom):
${mSample.map((f) => `  ${f}`).join('\n') || '  (none — desktop-only page)'}

Read the actual pixels of every listed panel before asserting. To name a precise fix target you MAY grep the page source under app${route === '/' ? '/page.tsx' : route + '/page.tsx'} and components/, but the rendered experience is what you judge. Emit every real, page-specific issue.`
  return agent(prompt, { label: `page:${name}`, phase: 'Per-page review', schema: FINDING })
    .then((r) => (r?.findings || []).map((f) => ({ ...f, _src: `page:${name}` })))
    .catch(() => [])
}))

const all = perPage.filter(Boolean).flat()
log(`Per-page raw findings: ${all.length}`)

phase('Verify P0/P1')
const gating = all.filter((f) => f.severity === 'P0' || f.severity === 'P1')
const verified = await parallel(gating.map((f) => () => {
  const shot = `${ASSETS}/${(f.evidence.match(/([a-z0-9-]+-(?:desktop|mobile)-\d+|state-[a-z0-9-]+)\.png/i) || [])[0] || (f.page + '-desktop-01.png')}`
  return agent(`You are an adversarial verifier. Try to REFUTE this finding by reading the actual screenshot. Default to skepticism. Remember the bottom-left "N" is the Next.js dev indicator, not a site element.

FINDING (${f.severity}, ${f.dimension}, page=${f.page}): ${f.title}
CLAIMED EVIDENCE: ${f.evidence}
CLAIMED FIX: ${f.fix}

Read: ${shot} (if wrong/missing, read ${ASSETS}/${f.page}-desktop-01.png). Decide: confirmed = real at this severity; downgrade = real but less severe (set corrected_severity); reject = not real / misread / already fine.`, { label: `verify:${f.page}:${(f.title || '').slice(0, 22)}`, phase: 'Verify P0/P1', schema: VERDICT })
    .then((v) => ({ ...f, _verdict: v?.verdict, _severity_final: v?.corrected_severity || f.severity, _verify_note: v?.note }))
    .catch(() => ({ ...f, _verdict: 'unverified', _severity_final: f.severity }))
}))
const nonGating = all.filter((f) => f.severity !== 'P0' && f.severity !== 'P1').map((f) => ({ ...f, _verdict: 'unverified', _severity_final: f.severity }))
const survived = verified.filter((v) => v._verdict !== 'reject')
const rejected = verified.filter((v) => v._verdict === 'reject')
log(`Per-page verified: ${survived.length}/${gating.length} gating survived, ${rejected.length} rejected`)

return {
  summary: { raw: all.length, gating: gating.length, gatingSurvived: survived.length, gatingRejected: rejected.length },
  findings: [...survived, ...nonGating],
  rejected,
}
