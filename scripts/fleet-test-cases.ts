/**
 * fleet-test-cases — generate the verification fleet's case packs from
 * durable state (THE LOOP v1.6.0).
 *
 *   npx tsx scripts/fleet-test-cases.ts
 *
 * Sources, in order:
 *   1. REGRESSION pack — every DONE work node's accept test becomes a
 *      re-verification case (the fleet keeps shipped work honest).
 *   2. CORE pack — the standing money-path walks (home, search, listing,
 *      sell funnel, place indexes, sitemaps) at 390 and 1280.
 *   3. PREFLIGHT pack — open gap nodes whose accept test is browsable get a
 *      "current state" walk so the loop starts from observed reality.
 *
 * Output: out/fleet/cases/<pack>.md (paste-ready bot case briefs) +
 * out/fleet/cases/manifest.json. Bot identity briefs live in
 * docs/plans/ENTERPRISE_MAP/VERIFICATION-FLEET.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const PROD = 'https://ryanrealty.vercel.app'
const OUT = 'out/fleet/cases'

type NodeRow = {
  version_gap: string | null
  domain: string
  title: string
  accept: string
  state: string
}

const CORE_CASES = [
  {
    id: 'core-home',
    url: `${PROD}/`,
    expected:
      'Search door present and usable. Six town doors (Bend, La Pine, Redmond, Sunriver, Sisters, Terrebonne) each with a photograph, each opening its city page. Live market pulse numbers render (no zeros, no placeholders). One primary CTA per viewport.',
  },
  {
    id: 'core-search',
    url: `${PROD}/homes-for-sale`,
    expected:
      'Omnibox, filter chips (Beds/Baths/Price/More), Save search and Alerts controls, a result count with sort, and map+list in lockstep. Filtering changes both the list and the pins. No console errors visible in page behavior (blank sections, dead buttons).',
  },
  {
    id: 'core-listing',
    url: `${PROD}/homes-for-sale`,
    expected:
      'Open the first listing card. Detail page opens on a real photo hero (video shows UNMUTE top-right when present), price + beds/baths/sqft + address, listing agent attribution block (ODS), price/status history, similar listings, and a working contact CTA. LOOK do not touch: never submit the contact form.',
  },
  {
    id: 'core-sell',
    url: `${PROD}/sell`,
    expected:
      'Step 1 asks for the address only. Advancing shows step 2 asking email (required) and phone (optional). CTA language is "Value my home" style, never a "what is my home worth?" question on a button. STOP at the final submit — never submit.',
  },
  {
    id: 'core-places',
    url: `${PROD}/neighborhoods`,
    expected:
      'Neighborhood index renders with real active counts per area (numbers differ by area, no zeros-everywhere). Each tile opens its neighborhood page. Repeat for /subdivisions. On the place page, count shown matches the listings visible within a reasonable margin and every place name is a working door.',
  },
  {
    id: 'core-market',
    url: `${PROD}/housing-market`,
    expected:
      'Market hub renders live figures with methodology/freshness stamps. Any months-of-supply verdict label matches its number (4 or less seller, 4 to 6 balanced, 6 or more buyer). Charts draw as charts (no number-dump tables, no dead polylines).',
  },
  {
    id: 'core-sitemap',
    url: `${PROD}/sitemap.xml`,
    expected:
      'Sitemap index lists child sitemaps; open two children — listing and geo URLs present and a spot-checked URL from each returns a real page (not 404/empty shell).',
  },
] as const

function caseBlock(c: { id: string; url: string; expected: string; note?: string }): string {
  return [
    `### ${c.id}`,
    ``,
    `- URL: ${c.url}`,
    `- Expected: ${c.expected}`,
    c.note ? `- Note: ${c.note}` : null,
    `- If observed differs from expected: report ONE finding per distinct defect via the reporting instruction in your bot brief (case id ${c.id}).`,
    ``,
  ]
    .filter((l): l is string => l != null)
    .join('\n')
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('loop_work_nodes')
    .select('version_gap,domain,title,accept,state')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const nodes = (data ?? []) as NodeRow[]

  mkdirSync(OUT, { recursive: true })
  const stamp = new Date().toISOString()

  const regression = nodes
    .filter((n) => n.state === 'done' && n.version_gap)
    .map((n) => ({
      id: `regress-${n.version_gap}`,
      url: PROD,
      expected: `${n.title}. Accept test that must still hold: ${n.accept}`,
      note: 'This shipped and was accepted — you are checking it STAYED true.',
    }))

  const preflight = nodes
    .filter((n) => n.state === 'open' && n.version_gap && /public|site|page|search|listing|index|render|browse/i.test(n.accept + n.title))
    .map((n) => ({
      id: `preflight-${n.version_gap}`,
      url: PROD,
      expected: `Record CURRENT state for upcoming work "${n.title}" [${n.domain}]. The accept it will eventually meet: ${n.accept}. Do not report the gap itself as a defect — report only NEW breakage you find while walking it, and note observed baseline facts as severity info.`,
    }))

  const FLOW_IDENTITY =
    'Identity for ALL submits in this pack (the ONLY identity you may ever submit with): name "Fleet Test", email fleet-test+flow@ryan-realty.com, phone 500-555-0106. The system recognizes it and suppresses every side effect.'
  const flows = [
    {
      id: 'flow-newsletter',
      url: `${PROD}/`,
      expected: `Find the newsletter signup (footer or /newsletter). Submit it with the fleet identity. Expected: a clear confirmation state (subscribed / check-your-email style), no error, no crash. ${FLOW_IDENTITY}`,
    },
    {
      id: 'flow-valuation',
      url: `${PROD}/sell`,
      expected: `Complete the valuation: step 1 a real Bend address (e.g. 61855 SE Sweet Pea Pl style — any address visible on the site's own listings), step 2 the fleet identity email + phone. SUBMIT it. Expected: a confirmation telling you what happens next (written valuation within 24 hours language), no error page. ${FLOW_IDENTITY}`,
    },
    {
      id: 'flow-listing-contact',
      url: `${PROD}/homes-for-sale`,
      expected: `Open any listing, use the contact/tour CTA, fill with the fleet identity, SUBMIT. Expected: a human-readable confirmation, no raw error, the page stays usable after. ${FLOW_IDENTITY}`,
    },
    {
      id: 'flow-alert-save',
      url: `${PROD}/homes-for-sale`,
      expected: `Apply one filter, then use Save search / Alerts. Follow whatever the UI asks (email capture or sign-in prompt) using the fleet identity email. Expected: the flow completes to an explicit confirmation OR clearly explains its requirement (a sign-in prompt is a valid state — report the path you saw as severity info). ${FLOW_IDENTITY}`,
    },
  ]

  const packs: Array<{ name: string; cases: Array<{ id: string; url: string; expected: string; note?: string }> }> = [
    { name: 'core', cases: [...CORE_CASES] },
    { name: 'regression', cases: regression },
    { name: 'preflight', cases: preflight },
    { name: 'flows', cases: flows },
  ]

  for (const pack of packs) {
    const md = [
      `# Fleet case pack: ${pack.name}`,
      ``,
      `Generated ${stamp} from the durable work graph + standing money paths.`,
      `Run each case at BOTH viewports unless your bot brief narrows it: mobile 390 wide first, then desktop 1280.`,
      `Rails (non-negotiable, also in your bot brief): browse signed-out on production only; LOOK, never touch — no form submits, no sign-ups, no purchases, no admin URLs; report facts (expected vs observed + URL), never speculation.`,
      ``,
      ...pack.cases.map(caseBlock),
    ].join('\n')
    writeFileSync(`${OUT}/${pack.name}.md`, md)
  }

  writeFileSync(
    `${OUT}/manifest.json`,
    JSON.stringify(
      {
        generated_at: stamp,
        packs: packs.map((p) => ({ name: p.name, cases: p.cases.length })),
        reporting_endpoint: `${PROD}/api/fleet/findings`,
        note: 'Bot identity briefs: docs/plans/ENTERPRISE_MAP/VERIFICATION-FLEET.md',
      },
      null,
      2,
    ),
  )

  console.log(
    `packs written to ${OUT}: ` + packs.map((p) => `${p.name} (${p.cases.length} cases)`).join(', '),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
