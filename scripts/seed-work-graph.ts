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
