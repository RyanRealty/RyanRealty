/**
 * Seed the durable work graph from the Company v1 manifest gap list
 * (docs/plans/ENTERPRISE_MAP/VERSION-1.md). Idempotent: upserts on
 * version_gap and never clobbers an existing node's state.
 *
 *   npx tsx scripts/seed-work-graph.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { assertWorkNodeDraft } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

const SEEDS = [
  {
    versionGap: 'G1',
    domain: 'seo-aeo',
    title: 'Close the 11 stranded seo-aeo ledger windows',
    objective:
      'Write actual_delta + verdict for every expired unlearned site_improvement_ledger row from GSC actuals (target_query_benchmark / site_signal), unfreezing the seo-aeo domain.',
    output: '11 closed ledger rows with §0-traceable actuals; scoreboard §0 and §3 updated.',
    accept: 'Probe ledger.expiredUnlearned = 0. Insert guard admits a new seo-aeo class.',
  },
  {
    versionGap: 'G2',
    domain: 'leads',
    title: 'Identity stitch: visitors link to CRM people',
    objective:
      'Lead-capture and sign-in paths write crm_person_id onto visitor_identity_map (1 of 164 stitched today). Planes: identity, ads-audiences, alerts.',
    output: 'Stitch writes live on every lead path; stitch rate visible on the packet.',
    accept: 'A real form submit produces a visitor_identity_map row with crm_person_id; stitched count rises and is reported in §1b.',
  },
  {
    versionGap: 'G3',
    domain: 'nurture',
    title: 'Stage truth: the Lead stage exists in reality',
    objective:
      'Stage writers + journey advance so the funnel is real (Lead stage = 0 of 22,672 people today, Nurture-heavy).',
    output: 'Stage transitions fire from real events; stage mix on the packet shows a living funnel.',
    accept: 'Lead stage is nonzero from real signal (not a backfill); each writer names its trigger.',
  },
  {
    versionGap: 'G4',
    domain: 'nurture',
    title: 'Alerts coverage: enrollment into listing_alerts',
    objective:
      'Enroll path from account/LP into listing_alerts (6 active today for 22,672 people). Sends never read legacy saved_searches.',
    output: 'Enrollment path live; alert counts rise on the packet.',
    accept: 'A real saved search creates an active listing_alerts row with crm_person_id.',
  },
  {
    versionGap: 'G5',
    domain: 'recruit-retain',
    title: 'Broker platform to Working: day-one checklist, permissions, own-book',
    objective: 'CAP-022 from Skeleton (2) to Working (3): a new broker has a day-one path and sees only their book.',
    output: 'Day-one checklist + own-book views shipped on admin.',
    accept: 'A non-Matt broker account walks day-one end to end; own-book scoping verified signed-in.',
  },
  {
    versionGap: 'G6',
    domain: 'broker-tools',
    title: 'Broker SMS agent to its plan definition of done',
    objective: 'CAP-035 to Working (3) per docs/plans/BROKER_SMS_AGENT_2026-07-31.md DoD, approval stamps per §1.',
    output: 'DoD checklist in the plan doc all green.',
    accept: 'End-to-end broker text -> agent reply -> approval stamp verified on the marketing line.',
  },
  {
    versionGap: 'G7',
    domain: 'seo-aeo',
    title: 'Westside backlog: execute or re-rank every item',
    objective: 'CAP-030: every WESTSIDE_BACKLOG.md item executed or re-ranked with evidence. Blocked behind G1 (WIP guard).',
    output: 'Backlog table fully dispositioned with per-item evidence.',
    accept: 'No backlog row without a disposition; shipped items carry ledger rows.',
  },
  {
    versionGap: 'G8',
    domain: 'transactions',
    title: 'SkySlope mirror re-sync ops',
    objective: 'INT-017: refresh the stale mirror (latest synced_at 2026-06-10) or document the ops path; feeds the Matt cutover decision (M2).',
    output: 'Mirror rows current or a written re-sync runbook with the blocker named.',
    accept: 'skyslope_transactions latest synced_at is current, or the blocker is named on the packet.',
  },
  {
    versionGap: 'G9',
    domain: 'public-ux',
    title: 'Look-walk baselines: public site + CMA rendered output',
    objective: 'Record first rendered baselines: public site at 390+1280 and a graded CMA render, so look stops being UNKNOWN on the packet.',
    output: 'Baseline screenshots + grades stored and referenced from the packet.',
    accept: 'Packet §1b CMA look and public-ux walk are no longer UNKNOWN.',
  },
  {
    versionGap: 'G10',
    domain: 'recruit-retain',
    title: 'Instrument /join conversion',
    objective: 'recruit-retain gets a number: /join visits and conversions tracked into the packet.',
    output: 'Conversion series lands in a queryable table read by the probe.',
    accept: 'Packet shows a /join conversion figure with a named source.',
  },
  {
    versionGap: 'G11',
    domain: 'factory',
    title: 'Meta audience heartbeat: hold green 7 days',
    objective: 'INT-007: first green run 2026-08-15T14:03Z; verify daily green through 2026-08-22 then flip FIX to KEEP.',
    output: 'meta_audience_log shows 7 consecutive daily runs; INTEGRATIONS cell flipped.',
    accept: 'Seven consecutive ran_at days ending on or after 2026-08-22; map cell updated with evidence.',
  },
  {
    versionGap: 'G12',
    domain: 'factory',
    title: 'Video decision docket for Matt: park or rebuild',
    objective: 'CAP-017: assemble the park-or-rebuild docket (costs, brain-path option, known breakage) so Matt can decide (M3).',
    output: 'One-page docket delivered on the packet.',
    accept: 'Docket exists with both options costed; decision recorded when Matt answers.',
  },
  {
    versionGap: 'G13',
    domain: 'factory',
    title: 'Probe every unknown-health integration once',
    objective: 'INT-021…036 unknowns (Sentry ingest, OpenAI/xAI call path, stock/gen media, VAPID, AdSense): one probe each, flip to green or park.',
    output: 'INTEGRATIONS matrix has zero unknown health cells; evidence per row.',
    accept: 'Health counts table shows unknown = 0 with per-row evidence in the log.',
  },
  {
    versionGap: 'G15',
    domain: 'public-ux',
    title: 'Search completeness to plan acceptance',
    objective:
      'REQUIREMENTS R-097…R-106: zoning as jurisdiction:code with definitions, long-tail disposition ledger, sold depth behind the VOW gate, user saved areas, filter/pan perf p75 targets.',
    output: 'Filter plan acceptance rows flip; disposition ledger exists; perf numbers recorded.',
    accept: 'Every FILTER_COMPLETENESS acceptance item is done or dispositioned with reason; p75 numbers measured on prod.',
  },
  {
    versionGap: 'G16',
    domain: 'sales-insights',
    title: 'CMA/pricing production residual',
    objective:
      'REQUIREMENTS R-069/070/073/074/083/112: rebuild corpus under the live judge and measure flag rate, fix county/site resolver flags, one pricing engine across CMA/BPO/expired-audit, comp geography contract, send-to-reply funnel, listing Transparent-CMA after comp rework.',
    output: 'Corpus rebuilt with flag-rate report; one engine; funnel report live.',
    accept: 'Flag rate measured and reported; engines unified with tests; funnel renders from real engagement events.',
  },
  {
    versionGap: 'G17',
    domain: 'broker-tools',
    title: 'Prospecting product to spec',
    objective:
      'REQUIREMENTS R-171/172/145: one dense sortable prospecting list, real detail page with send-audit, CRM person rollup of expired/FSBO/CMA engagement, per-channel compliance stops with open-channel CTAs.',
    output: 'Prospecting list + detail + rollup shipped; per-channel stops enforced at send.',
    accept: 'Broker works a weekly expired/FSBO pass phone-first on the new surfaces; sends respect per-channel stops (verified signed-in).',
  },
  {
    versionGap: 'G18',
    domain: 'sales-insights',
    title: 'Reporting collapse: one definition per metric',
    objective:
      'REQUIREMENTS R-026/077/078/080: one metric-definition registry, each metric computed once behind the DAL and rendered once, measurement stamps (first-broker-action, reply latency, CMA SLA) visible on admin.',
    output: 'Definition registry + single render path per metric + stamps on admin surfaces.',
    accept: 'No duplicate metric definitions remain (gate or census proves it); stamps render with real data.',
  },
  {
    versionGap: 'G19',
    domain: 'broker-tools',
    title: 'One person surface + unified SendPanel',
    objective: 'REQUIREMENTS R-170: one responsive person workspace; delete desktop/mobile forks; unified SendPanel so each concept has exactly one send path.',
    output: 'Forked person surfaces deleted; SendPanel unified over the governed-send chokepoint.',
    accept: 'Person workspace works at 390 and 1280 with one code path; every send flows the chokepoint (gate-verified).',
  },
  {
    versionGap: 'G20',
    domain: 'nurture',
    title: 'Buyer packet product (build side)',
    objective: 'REQUIREMENTS R-142: buyer packet with how-this-home-compares and what-to-think-about-offering; ask-first flow after broker yes. Sends remain Matt-gated per §1.',
    output: 'Packet builder + rendered preview on Today; ask-first draft flow.',
    accept: 'A real listing produces a rendered packet draft a broker can approve; zero sends without the per-action gate.',
  },
  {
    versionGap: 'G21',
    domain: 'public-ux',
    title: 'Public IA/mobile residual classes',
    objective:
      'REQUIREMENTS R-107/108/109: nav coverage, city section-order fan-out to neighborhood/community, KB desktop density, duplicate DOM streaming waste, dead-end map cards, sub-city data scoping, interstitial stacking, sticky broker bar.',
    output: 'Each class fixed everywhere it occurs (census-first per MOBILE_GRIND).',
    accept: 'Per-class census shows zero remaining instances; 390+1280 walks recorded.',
  },
  {
    versionGap: 'G22',
    domain: 'seo-aeo',
    title: 'SEO/AEO residual to money-path contracts',
    objective:
      'REQUIREMENTS R-119/120/124/125/126/129/130/151: money-path JSON-LD parity contracts, crawl-budget pruning on GSC evidence, GBP review-ask drafts on close, /luxury internal links, Lighthouse perf promote to error, contestable-SERP depth, out-of-area referral tier.',
    output: 'Contracts + JSON-LD shipped; pruning/link classes done; review-ask drafts staged.',
    accept: 'parity.json green on money paths; GSC shows the pruned classes; drafts appear on deal close (no sends).',
  },
  {
    versionGap: 'G23',
    domain: 'nurture',
    title: 'Email residue kill (FUB/Beacon)',
    objective: 'REQUIREMENTS R-147: stop FUB/Beacon archived nurture emails still sending via connected Gmail; purge FUB vocabulary and dead keys where safe.',
    output: 'Residue sends stopped at the source; purge list executed with evidence.',
    accept: 'Zero FUB/Beacon-originated sends observed over a full week of email_events; keys/vocab census clean.',
  },
  {
    versionGap: 'G24',
    domain: 'broker-tools',
    title: 'Admin dark mode reachable',
    objective: 'REQUIREMENTS R-116: both admin themes ship and are reachable (11F decision: ship both from day one).',
    output: 'Theme toggle reachable; dark tokens complete.',
    accept: 'Admin renders correctly in both themes at 390+1280 (screenshots).',
  },
  {
    versionGap: 'G25',
    domain: 'social-presence',
    title: 'Social fan-out calendar (build side)',
    objective:
      'REQUIREMENTS R-186: one idea fans out as per-channel variants (never identical cross-post); Loop G self-running draft-first calendar surfaces on Today. Publishes stay approval-gated per §1.',
    output: 'Fan-out builder + calendar drafts on Today.',
    accept: 'One idea produces distinct per-channel drafts on Today with humanApprovedAt gating; zero autonomous publishes.',
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

  // G7 (westside, seo-aeo) depends on G1 (Learn unfreezes the domain).
  const { data: nodes } = await sb
    .from('loop_work_nodes')
    .select('id,version_gap,depends_on')
    .in('version_gap', ['G1', 'G7'])
  const g1 = nodes?.find((n) => n.version_gap === 'G1')
  const g7 = nodes?.find((n) => n.version_gap === 'G7')
  if (g1 && g7 && !(g7.depends_on as string[]).includes(g1.id)) {
    await sb.from('loop_work_nodes').update({ depends_on: [g1.id] }).eq('id', g7.id)
    console.log('G7 now depends on G1')
  }

  const { count } = await sb.from('loop_work_nodes').select('id', { count: 'exact', head: true })
  console.log(`work graph total nodes: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
