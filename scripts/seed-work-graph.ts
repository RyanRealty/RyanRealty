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
      'REQUIREMENTS R-069/070/073/074/083/112/218: rebuild corpus under the live judge and measure flag rate, fix county/site resolver flags, one pricing engine across CMA/BPO/expired-audit, comp geography contract, send-to-reply funnel, listing Transparent-CMA after comp rework, seller CMA price-opinion spine (R-218).',
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
  {
    versionGap: 'G26',
    domain: 'nurture',
    title: 'Email tracking completeness (four untracked paths)',
    objective:
      'REQUIREMENTS R-137 / audit 2026-08-15: route the sequence SMS-to-email fallback (crm-sequence-engine ~line 443), home-valuation CMA delivery + acknowledgment (app/home-valuation/actions.ts), the admin one-off composer (app/actions/admin-email.ts), and the CMA request confirmation (lib/cma/request-emails.ts) through attributeOutbound/track.',
    output: 'All four paths tracked; a grep census shows zero consumer-facing sendEmail calls without tracking.',
    accept: 'A real send on each path lands open/click events in email_events tied to the person; census gate or test proves no bypass remains.',
  },
  {
    versionGap: 'G27',
    domain: 'sales-insights',
    title: 'Coming Soon count truth on served for-sale counts',
    objective:
      'REQUIREMENTS R-025: public listing access is sealed (2026-08-02). Residual: pulse active_count still SQL-includes Coming Soon. Exclude CS from served for-sale pulse counts or label the definition on every surface that shows the pulse number. Blast-radius dal-stat + public-site + reporting; §0 applies.',
    output: 'One definition, applied and labeled everywhere the pulse count renders.',
    accept: 'Bend spot-check: served pulse active_count matches its stated definition exactly (verified against boundary SFR query both ways: with CS and without).',
  },
  {
    versionGap: 'G31',
    domain: 'nurture',
    title: 'Newsletter redesign (look only)',
    objective:
      'REQUIREMENTS R-212 / Matt 2026-08-16 M1 CHANGE: restyle wrapBrandedEmail / wrapNewsletterHtml and the admin rendered preview so Matt can approve the look. Enroll and send stay Matt-manual. Zero sends. Do not change cohort enrollment logic in this node.',
    output: 'Redesigned shell + /admin/newsletters preview at 375 and 640; screenshots; G-NL-7 still green.',
    accept: 'Rendered preview at 375 and 640 is the look Matt can approve from /admin/newsletters/[id]. Brand-voice clean. Zero newsletter sends in the node evidence.',
  },
  {
    versionGap: 'G32',
    domain: 'social-presence',
    title: 'Matt ADD [major]: xAI-only image, video, voice, and content gen',
    objective:
      'REQUIREMENTS R-213 / Matt 2026-08-16 ADD: one generative product — xAI (https://docs.x.ai/overview). Image, video, voice, and content text go through lib/grok-*.ts. Inventory every third-party gen vendor. Produce the cancel list in xai-stack-accept.json. Executor must read the xAI docs (overview, models, Imagine, TTS, STT, custom voices) before writing a generate call. Do not invent a listing. Publishes stay approval-gated.',
    output:
      'Cancel list Matt can act on (cancel-now vs cancel-after-cutover). Chokepoint for image + video + voice + text. New generate paths refuse ElevenLabs / Replicate / fal / Synthesia / OpenAI images.',
    accept:
      'xai-stack-accept.json lists every billed gen vendor with cancel-now | cancel-after-cutover | keep-not-gen. cancel-now rows have no required live path. lib/grok-voice.ts exists. Required reads in xai-stack.md were loaded. No public post and no outbound in the evidence.',
  },
  {
    versionGap: 'G33',
    domain: 'factory',
    title: 'Matt ADD [major]: /admin/loop in plain English',
    objective:
      'REQUIREMENTS R-214 / Matt 2026-08-16 ADD: /admin/loop is the status surface for the work graph. Matt must be able to see what is being fixed, what is next, and what just finished, without shop jargon (sentinel, ledger, gap, p0, RUN-TOKEN, owner session ids). Sections fold. Do not invent a second status source. No factory ledger insert (open window ba3435dd). Do not claim a fleet node in the same session.',
    output:
      'Rewritten /admin/loop: Now / Next / Waiting / Finished in plain English; bots, measurement bets, and auto-start folded. Copy helpers under lib/data/loop/status-copy.ts.',
    accept:
      'Signed-in /admin/loop at 390+1280 shows a one-sentence now/next verdict, a Next list of real upcoming titles without Fleet finding / p0 / sentinel jargon, and Just finished in plain English. Folds work. Screenshot evidence. No factory ledger insert.',
  },
  {
    versionGap: 'G34',
    domain: 'leads',
    title: 'Page-tied public analytics',
    objective:
      'REQUIREMENTS R-219: one URL→page_type map for GTM/GA4/VisitTracker/section tracking. New public pages inherit the map. Do not add per-page GTM tags. Remove leftover the in-house CRM names from analytics events and cookies.',
    output: 'lib/analytics/page-type.ts + ci:page-analytics + GA4 page_type/crm_person_id dimensions.',
    accept: 'Live homepage has GTM-WV6R4NZ5, no extra gtag config for G-ST40, cookies list rr_pid not fub_cid. Gate green.',
  },
  {
    versionGap: 'G35',
    domain: 'public-ux',
    title: 'Redirect-only aliases emit HTTP 308',
    objective:
      'REQUIREMENTS R-220 / P5 IA: deal-signal survivor is /price-drops. Next 16 prerender turned page-level permanentRedirect() into a 200 empty shell. Declare redirect-only public aliases in next.config.ts and lock with ci:redirect-only.',
    output: 'next.config 308s for /motivated-sellers, /motivated-sellers/:city, /feed. Gate ci:redirect-only.',
    accept: 'Live /motivated-sellers returns 308 Location /price-drops. Landing H1 is Price drops. Screenshots 390+1280.',
  },
  {
    versionGap: 'G29',
    domain: 'factory',
    title: 'Stand the verification fleet up',
    objective:
      'REQUIREMENTS R-207 / VERIFICATION-FLEET.md: Matt creates the 5 starter bots from the briefs; prove the pipeline end-to-end with a synthetic finding (POST -> fleet_findings -> intake -> node -> rejected-as-test); first core+regression pass runs on routines.',
    output: 'Five bots live on routines; first real findings triaged through intake.',
    accept: 'A finding a bot POSTed appears as a work node via fleet-intake with reproduce-or-reject honored; regression pack ran clean or its findings are noded.',
  },
  {
    versionGap: 'G28',
    domain: 'transactions',
    title: 'Referral fee reaches the money math',
    objective:
      'REQUIREMENTS R-203 / audit 2026-08-15: inboundFeePct (25% recorded at intake) is write-only. Wire it so a referred person\u2019s closing pre-fills tc_commissions.referral_fee and destination GCI is computed after the fee.',
    output: 'Referral-linked closing shows referral_fee auto-populated from the recorded pct; admin referral desk shows GCI-after-fee.',
    accept: 'A test deal for a referred person computes net = gci - (pct \u00d7 side) without hand-typing; desk renders the figure with a \u00a70 trace.',
  },
  {
    versionGap: 'G36',
    // admin-crm is a plane, not a company domain; the broker's messaging surface sits under broker-tools.
    domain: 'broker-tools',
    title:
      'CRM group text: one thread per set of people (post into the Twilio group that already exists) and one party per participant row',
    objective:
      "Matt's screenshot 2026-09-15 3:55 PM PT: Text to Leisha Hogan + Tanya Hogan → 'Could not start one group thread — texted each person separately.' Vercel log: '[crm] group MMS failed, falling back to 1:1: projected address +1541…3095: Group MMS with given participant list already exists as Conversation CHaf1f40233b2944ec944df877e7c57ce9'. Twilio keys a group MMS by its number group and refuses a second Conversation for the same people; the Jul 31 group (CHaf1f40…) is still active on Twilio with all three participants. Every group text since Aug 1 (Aug 1, Aug 11 ×6, Sep 15 ×2) hit that refusal, the half-built conversation was deleted and the composer fell back to two 1:1s — with the reason swallowed in console.warn. Second defect from the same evidence: crm_conversation_participant keys a member by channel_address; the 1:1 send recorded the phone as the contact stores it while the inbound webhook recorded E.164, so one person became two rows, the sync trigger (rows > 1) flagged the one-person thread is_group=true, and the next 1:1 send could not find a non-group thread and opened a new one. Measured with the service role in two query shapes: 22 is_group=true conversations, 17 with exactly one person (12 as two spellings of one number, 5 phone+email), 0 genuine fan-outs; Tanya Hogan's texts split across EIGHT conversations since Aug 1.",
    output:
      'Shipped on claude/cool-fermi-0paep0 (PR #252): lib/crm/twilio-conversations.ts posts into the conversation Twilio names (wakes inactive, refuses closed, confirms our projected line, never deletes it; 6 tests); lib/crm/compose-group.ts groupFallbackNotice carries the reason; lib/crm/record-message.ts normalizes every participant address to E.164 / lower-case email with in-call dedupe (3 tests); supabase/migrations/20260916070000_conversation_participants_are_parties.sql — trigger counts distinct parties, rows normalized, fragmented 1:1 threads merged into each contact\'s earliest, rollups recomputed, one-1:1-per-contact index rebuilt so a leftover duplicate fails the migration.',
    accept:
      "Mechanical, in order: (1) PR #252 merged and deployed; (2) `npm run db:push` applied 20260916070000 \u2014 verify with two query shapes, read with the service role and printed: no crm_conversation row is a group (is_group true) without a Twilio conversation sid, and no primary contact holds more than one conversation without a Twilio conversation sid; Tanya Hogan (crm_people 57300) has ONE 1:1 conversation holding every sms row from Aug 1 on; (3) the next broker group text to Leisha + Tanya lands as ONE crm_message under the conversation whose twilio_conversation_sid = CHaf1f40233b2944ec944df877e7c57ce9 and the Twilio Conversation shows the new IM with delivery sent=all \u2014 read it back with a Twilio GET, never by texting anyone yourself (\u00a71: no outbound to real people from an agent); (4) the Vercel log shows no '[crm] group MMS failed' line for that send. Open until Matt or a session with DB access runs the migration; a session that cannot apply it records that plainly and does not mark done.",
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

  // stat-source-ok: backfill/ingest progress count, used to size or verify the run. Never published.
  const { count } = await sb.from('loop_work_nodes').select('id', { count: 'exact', head: true })
  console.log(`work graph total nodes: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
