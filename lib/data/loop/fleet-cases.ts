/**
 * Live case-pack builder for the verification fleet (THE LOOP v1.6.x).
 * Not on the public barrel (file-size budget).
 * reachability: entry-point /api/fleet/cases + scripts/fleet-test-cases.ts
 *
 * Packs are generated FROM the work graph AT REQUEST TIME, so every closed
 * node updates what the bots test with zero human step. Each pack carries a
 * RUN-TOKEN that changes only when the graph or the deployed build changed —
 * bots fetch, compare to their last token, and end the run in seconds when
 * nothing is new (timers become cheap heartbeats; execution is event-driven).
 */
import 'server-only'

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

const PROD = 'https://ryan-realty.com'

export const FLEET_PACKS = ['core', 'regression', 'preflight', 'flows'] as const
export type FleetPack = (typeof FLEET_PACKS)[number]

type CaseDef = { id: string; url: string; expected: string; note?: string }

type NodeRow = {
  version_gap: string | null
  domain: string
  title: string
  accept: string
  state: string
  updated_at: string
}

const FLOW_IDENTITY =
  'Identity for ALL submits in this pack (the ONLY identity you may ever submit with): name "Fleet Test", email fleet-test+flow@ryan-realty.com, phone 500-555-0106. The system recognizes it and suppresses every side effect.'

const CORE_CASES: readonly CaseDef[] = [
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
      'Step 1 asks for the address only. Advancing shows step 2 asking email (required) and phone (optional). CTA language is "Value my home" style, never a "what is my home worth?" question on a button. STOP at the final submit — never submit (Flow Prover owns submits).',
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
]

const FLOW_CASES: readonly CaseDef[] = [
  {
    id: 'flow-newsletter',
    url: `${PROD}/`,
    expected: `Find the newsletter signup (footer or /newsletter). Submit it with the fleet identity. Expected: a clear confirmation state (subscribed / check-your-email style), no error, no crash. ${FLOW_IDENTITY}`,
  },
  {
    id: 'flow-valuation',
    url: `${PROD}/sell`,
    expected: `Complete the valuation: step 1 a real Bend address visible on the site's own listings, step 2 the fleet identity email + phone. SUBMIT it. Expected: a confirmation telling you what happens next (written valuation within 24 hours language), no error page. ${FLOW_IDENTITY}`,
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

export function isFleetPack(value: string): value is FleetPack {
  return (FLEET_PACKS as readonly string[]).includes(value)
}

/** Deterministic token: changes only when the graph or the deployed build changes. */
export function packRunToken(input: { pack: string; deploySha: string; graphStamp: string }): string {
  return createHash('sha256')
    .update(`${input.pack}|${input.deploySha}|${input.graphStamp}`)
    .digest('hex')
    .slice(0, 16)
}

function caseBlock(c: CaseDef): string {
  return [
    `### ${c.id}`,
    ``,
    `- URL: ${c.url}`,
    `- Expected: ${c.expected}`,
    c.note ? `- Note: ${c.note}` : null,
    `- If observed differs from expected: report ONE finding per distinct defect (case id ${c.id}).`,
    ``,
  ]
    .filter((l): l is string => l != null)
    .join('\n')
}

export async function buildFleetPack(pack: FleetPack): Promise<{ markdown: string; runToken: string }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('loop_work_nodes')
    .select('version_gap,domain,title,accept,state,updated_at')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`work graph unreadable: ${error.message}`)
  const nodes = (data ?? []) as NodeRow[]

  let cases: CaseDef[]
  if (pack === 'core') {
    cases = [...CORE_CASES]
  } else if (pack === 'flows') {
    cases = [...FLOW_CASES]
  } else if (pack === 'regression') {
    cases = nodes
      .filter((n) => n.state === 'done' && n.version_gap)
      .map((n) => ({
        id: `regress-${n.version_gap}`,
        url: PROD,
        expected: `${n.title}. Accept test that must still hold: ${n.accept}`,
        note: 'This shipped and was accepted — you are checking it STAYED true.',
      }))
  } else {
    cases = nodes
      .filter(
        (n) =>
          n.state === 'open' &&
          n.version_gap &&
          /public|site|page|search|listing|index|render|browse/i.test(n.accept + n.title),
      )
      .map((n) => ({
        id: `preflight-${n.version_gap}`,
        url: PROD,
        expected: `Record CURRENT state for upcoming work "${n.title}" [${n.domain}]. The accept it will eventually meet: ${n.accept}. Do not report the gap itself as a defect — report only NEW breakage you find while walking it, and note observed baseline facts as severity info.`,
      }))
  }

  const graphStamp = nodes.reduce(
    (acc, n) => (n.updated_at > acc ? n.updated_at : acc),
    `count:${nodes.length}`,
  )
  const deploySha = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 12)
  const runToken = packRunToken({ pack, deploySha, graphStamp: `${graphStamp}|${nodes.length}` })

  const markdown = [
    `RUN-TOKEN: ${runToken}`,
    ``,
    `# Fleet case pack: ${pack}`,
    ``,
    `Generated live ${new Date().toISOString()} from the durable work graph (deploy ${deploySha}).`,
    `IF the RUN-TOKEN above equals the one from your previous run: nothing changed — reply "no changes since last run (token match)" and END this run now.`,
    `Run each case at BOTH viewports unless your bot brief narrows it: mobile 390 wide first, then desktop 1280.`,
    `Rails (non-negotiable, also in your bot brief): browse signed-out on production only; LOOK never touch (Flow Prover's four flow submits with the designated fleet identity are the only exception anywhere); no admin; facts only.`,
    ``,
    ...cases.map(caseBlock),
  ].join('\n')

  return { markdown, runToken }
}
