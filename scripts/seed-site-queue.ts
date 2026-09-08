/**
 * Seed the site queue mechanism — public-ux backlog for the public site.
 * (2026-09-07 conversion research, artifact 525cdcda.) Idempotent: upserts on
 * version_gap and never clobbers an existing node's state.
 *
 * This table is the only site backlog. Sessions pull the oldest open node
 * (npx tsx scripts/loop-brief.ts); they do not re-audit.
 *
 *   npx tsx scripts/seed-site-queue.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { assertWorkNodeDraft } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const SEEDS = [
  {
    versionGap: 'SITE-00',
    domain: 'public-ux',
    title: 'Site queue mechanism: boot serves the site node, site commits name their node, audits append not replace',
    objective:
      "Install the four-part mechanism from the 2026-09-07 conversion research (artifact 525cdcda): seed script, loop-brief site-first rule with stale auto-release, commit-msg node-trailer gate on app/** and components/site/**, process-canon arm for new audit docs. Matt 2026-09-07: seed the queue and build item 1.",
    output: 'scripts/seed-site-queue.ts, scripts/check-site-node.mjs (G72), loop-brief.ts edits, check-process-canon.mjs arm, docs rows, break-tests',
    accept:
      'npx tsx scripts/loop-brief.ts prints a public-ux node as NODE 1 when app/** or components/site/** changed in the last 14 days; a commit touching app/** without a Node: trailer is refused by the commit-msg hook; a new docs/plans/**/*AUDIT*.md without a Nodes: line fails ci:process-canon; all break-tests green.',
  },
  {
    versionGap: 'SITE-01',
    domain: 'public-ux',
    title: 'Resort community pages: address field in the first screen, verdict + pace answer, valuation request (win)',
    objective:
      "On app/communities/[slug] first (Search Console 2026-09-07: /communities/* carries 4,516 impressions, /cities/bend/* carries 17), then the Bend neighborhood route. An address field in the first viewport. On submit, with no contact ask, render the place's dated buyer/seller verdict (months of supply), days to pending, cash share, and the count of comparable closes the CMA engine finds for the address. NO dollar figure on the page (Matt 2026-09-07). Then one step: email required, phone optional, creating a cmas row with the place-page CmaOrigin, a crm_people row, sequence enrollment, and a same-minute system confirmation email (Matt 2026-09-07: system confirmation, not a broker send) carrying the verdict, comp count, and a /book link. Every figure carries a §0 source line. Copy per marketing_brain_skills/brand-voice/VOICE.md (2026-09-07 version).",
    output: 'V3PlaceValue primitive on the community route, a server action, the place-page CmaOrigin, GA4 event + rr_vid stitching, screenshots at 1440 and 375, a separate-agent taste review in parity.json',
    accept:
      '28 days after ship: public.cmas rows with request_source place-page > 0 (baseline 0) stitched to /communities/* sessions by rr_vid; Search Console clicks on the shipped community URLs do not fall versus the prior 28 days; every rendered figure has a source line.',
  },
  {
    versionGap: 'SITE-02',
    domain: 'public-ux',
    title: '/sell: show the sourced answer between the address and the contact step',
    objective:
      'Today the address step advances straight to email (required), phone, and timeline with nothing shown. Insert the neighborhood/city verdict, days to pending, and comp count between the address and the contact step; keep email required, phone optional (Matt 2026-09-07). No dollar figure on the page.',
    output: 'SellValueForm answer step + action changes',
    accept:
      'Over 28 days at least 30 percent of /sell address submits (GA4 event on form id=get-value) end in a cmas row with a non-null email, and each row shows a first broker touch in crm_timeline within one business day. Baseline pulled from GA4 and cmas before ship.',
  },
  {
    versionGap: 'SITE-03',
    domain: 'public-ux',
    title: 'Place hero button: live count + verdict, linking to the filtered search',
    objective:
      "Beside the place H1 a filled button reading the live active count and verdict, e.g. '673 homes for sale · 3.9 months · seller's market · 23 days to pending · read Sep 7', linking to the pre-filtered /homes-for-sale. City page first, then neighborhoods and communities. Figures from market_stats_cache with a trace.",
    output: 'One primitive used by the three place templates',
    accept:
      'GA4 click-through from place-page hero to /homes-for-sale/* per rr_vid rises versus the 28 days before ship; at least 10 percent of those searches end in a saved_searches row joined by rr_vid.',
  },
  {
    versionGap: 'SITE-04',
    domain: 'public-ux',
    title: "Place alerts: first callout after the intro, sticky repeat past the map, a real 30-day count as the promise, price-drop alert beside it",
    objective:
      "Move the email-only alerts form to the first callout after the place intro, repeat it as a sticky strip once the visitor scrolls past the map, and state the real promise: 'N new listings in Bend in the last 30 days. One email per listing' where N is the cache count. Add a price-drop alert with the last-30-day cut count.",
    output: 'V3 alerts strip primitive on city, neighborhood, community templates',
    accept:
      'Alert rows created from place-page paths per 100 place-page sessions at least double the 28-day pre-ship baseline; price-drop rows reported beside new-listing rows; unsubscribe rate in the first 30 days reported.',
  },
  {
    versionGap: 'SITE-05',
    domain: 'public-ux',
    title: "Sticky 'Value my home' control on /sell and place pages once the hero scrolls away",
    objective: "Desktop bottom-left pill, mobile bottom bar, labeled with the live place verdict, reusing the listing page's mobile CTA primitive.",
    output: 'Sticky control primitive + wiring',
    accept:
      "At least 15 percent of /sell valuation submits carry GA4 source='sticky' within 28 days, with no drop in total /sell submits versus the prior 28 days.",
  },
  {
    versionGap: 'SITE-06',
    domain: 'public-ux',
    title: 'Listing instrument gets an ending: base rate line, price-drop alert, tour slot, email-me-this-payment',
    objective:
      "Under the price-cut line on the listing page (app/listing/by-key, served at /homes-for-sale/listing/[key]): 'In Bend, X percent of homes that closed in the last 12 months took a cut; median cut Y percent; median Z days to pending', re-pulled per city with a trace. Then 'Tell me if this price drops' (email only), 'Tour' to a /book slot, and 'Email me this payment' under the mortgage calculator.",
    output: 'Listing page additions + alert/tour actions',
    accept:
      'Price-drop alert rows from listing pages reach at least 1 per 100 listing sessions over 28 days; tour requests plus calculator emails per 100 sessions exceed the pre-ship baseline; crm_people rows carry the listingKey; every new figure has a trace.',
  },
  {
    versionGap: 'SITE-07',
    domain: 'public-ux',
    title: 'Place-page payment calculator pre-filled with the place median and local financing mix, ending in a search at that ceiling',
    objective: "Rate editable, defaults from market_stats_cache (median list, cash share), result pinned, ending in 'See homes under $X in {place}'.",
    output: 'Calculator primitive on city and neighborhood templates',
    accept:
      'GA4 calculator_used on place pages > 0 and click-through from its result link to /homes-for-sale/* per rr_vid; both reported at 28 days against a zero baseline.',
  },
  {
    versionGap: 'SITE-08',
    domain: 'public-ux',
    title: 'Cited Q&A with FAQPage schema on neighborhood, community, subdivision pages',
    objective:
      'Five to eight pairs, one sourced dated number per answer (verdict, days to pending, sale-to-list, cash share), FAQPage JSON-LD from the same DAL call as the page body, last answer linking to the SITE-01 field.',
    output: 'V3Answers on the three templates + JSON-LD',
    accept:
      'Re-run the 16 non-brand AI answer queries: Ryan Realty named on more than 0; Search Console non-brand CTR on the shipped page set above the 0.14 percent baseline over 28 days, page list attached.',
  },
  {
    versionGap: 'SITE-09',
    domain: 'public-ux',
    title: 'Response clock on every site submit: system confirmation within a minute, broker SMS, five-minute untouched flag',
    objective:
      "Matt 2026-09-07: a same-minute confirmation to a visitor who just submitted their own request is a system confirmation, not a broker send, and the sequence the submit enrolls them in is approved. Acknowledgment carries the verdict, comp count, and a /book link; broker SMS with the CMA link the same minute; CRM timer flags any valuation, tour, or alert with no human touch after five minutes.",
    output: 'CRM send-path changes + timer + admin flag',
    accept:
      'Median time from row creation to first human touch in crm_timeline under five minutes during 8am to 8pm; no row older than 24 hours without a touch; measured over 28 days.',
  },
  {
    versionGap: 'SITE-10',
    domain: 'public-ux',
    title: 'Ask the selling timeframe after the answer, on /sell and the SITE-01 field; route the near-term lane to /book',
    objective:
      'The /sell timeline question exists (ready now / next 3 to 6 / exploring); ask it after the on-page answer, add it to the SITE-01 flow, route to CMA lane and CRM sequence, and give the near-term lane a booking prompt.',
    output: 'Form step + routing',
    accept:
      'At least 80 percent of valuation requests carry a timeframe; the near-term lane shows a booking or call in crm_timeline within 24 hours at a higher rate than the other lanes, over 28 days.',
  },
  {
    versionGap: 'SITE-11',
    domain: 'public-ux',
    title: 'Proof beside the ask: reviews, MLS-sourced record, per-listing outcome table, named broker cards on place pages',
    objective:
      "Matt 2026-09-07: named broker cards with headshots, Oregon license numbers, tel, text, and /book on place pages (same card as home and listing). Under the /sell form and on place pages: '5.0 from 25 verified Google reviews' with quotes, the MLS-sourced closed-sales line re-pulled, and a per-listing outcome table (sale-to-list and days to pending per Ryan Realty closing beside the Bend detached median for the same window, count stated, no percentage headline).",
    output: 'Proof block primitive + broker card wiring',
    accept:
      'tel:, sms:, and /book?agent= clicks attributed to place pages and /sell by rr_vid exceed zero in week one and grow month over month; every figure ships with a per-row trace or is cut.',
  },
  {
    versionGap: 'SITE-12',
    domain: 'public-ux',
    title: 'Homepage: live counts under the hero search, Sell tab renders the real address field without JS',
    objective:
      "Move the 'Central Oregon right now' strip out of the Homes dropdown to sit under the hero search with its read time; server-render the Sell tab with the same address field as /sell.",
    output: 'Homepage hero changes',
    accept:
      'Hero search submits per homepage session rise versus the prior 28 days; cmas rows with a home origin appear within 28 days; the Sell form markup is present in a curl of / with no JS; no figure ships without a trace.',
  },
  {
    versionGap: 'SITE-M1',
    domain: 'public-ux',
    title: 'Homepage brokers section on phones: open compact, faces + names + links in one screen',
    objective:
      "From the 2026-08-27 mobile audit, parked as Matt's call, answered 2026-09-07: FIX. On a phone the brokers section opens on one broker's headshot filling the viewport before names and links appear. Open the three cards compact with faces, names, license numbers, and tel/text/book links in one screen at 390px. (The other two parked items, the compare-map 429 and the 42-row /cities link wall, were KILLED by Matt the same day and are not nodes.)",
    output: 'Broker section change + 390px screenshot',
    accept:
      'At 390px the first screen of the brokers section shows all three faces, names, and at least one contact link each; screenshot attached as evidence.',
  },
] as const

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  for (const seed of SEEDS) assertWorkNodeDraft(seed)

  const rows = SEEDS.map((s) => ({
    version_gap: s.versionGap,
    domain: s.domain,
    title: s.title,
    objective: s.objective,
    output: s.output,
    accept: s.accept,
  }))

  const { data, error } = await sb
    .from('loop_work_nodes')
    .upsert(rows, { onConflict: 'version_gap', ignoreDuplicates: true })
    .select('id,version_gap')
  if (error) {
    console.error('seed failed:', error.message)
    process.exit(1)
  }
  console.log(`inserted ${data?.length ?? 0} new nodes (existing nodes untouched)`)

  // Print every row's id + version_gap, including pre-existing ones ignoreDuplicates
  // skipped on this call — the caller needs the full id table either way.
  const { data: allRows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,version_gap')
    .in(
      'version_gap',
      SEEDS.map((s) => s.versionGap),
    )
  if (readErr) {
    console.error('post-seed read failed:', readErr.message)
    process.exit(1)
  }
  const byGap = new Map((allRows ?? []).map((r) => [String(r.version_gap), String(r.id)]))
  console.log('')
  console.log('version_gap  id')
  for (const s of SEEDS) {
    console.log(`${s.versionGap.padEnd(12)} ${byGap.get(s.versionGap) ?? 'MISSING'}`)
  }

  // stat-source-ok: operational node count printed to the operator at seed time, never published
  const { count } = await sb.from('loop_work_nodes').select('id', { count: 'exact', head: true })
  console.log(`\nwork graph total nodes: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
