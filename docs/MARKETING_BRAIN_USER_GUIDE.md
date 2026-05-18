# Marketing Brain — User guide

**Audience:** Matt Ryan.
**Status:** Operational manual.
**Locked:** 2026-05-17 (initial issue, post autonomous-pipeline-build).
**Source of truth:** the build provenance lives in `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md`. The day-to-day operating model lives here.

This guide is written for you, not for an agent. If something is ambiguous, that is a bug in this doc. Tell the agent and we fix the doc.

---

## What the brain is

A closed-loop system that reads analytics, decides what content to make, dispatches producers, surfaces drafts for your review, publishes after approval, and learns from the metrics that come back.

Eight layers:

1. **Snapshots.** Daily pulls from GA4, GSC, FUB, Meta Ads, Meta Page, X, LinkedIn, TikTok, GBP, YouTube into `marketing_channel_daily`. Runs at 6:30am Mountain via Vercel cron.
2. **Audits.** Four audits run weekly against the snapshots: `audit-website`, `audit-ads`, `audit-crm`, `competitor-recon`. Each emits findings.
3. **Diagnose.** `diagnose-performance` looks at week-over-week and month-over-month deltas, flags anomalies, ranks channels.
4. **Generate briefs.** The brain reads the audits + diagnose + competitor recon + platform trends + the active Q3 strategy, scores every candidate action against the priority function, and emits the top 12 as rows in `marketing_brain_actions` with `status='ready'`.
5. **Producers.** Each action row is picked up by its assigned producer, which renders the draft and writes it to disk in scratch (`out/`).
6. **Approval queue.** You review every draft at `/admin/approval-queue`. Approve, request changes, reject, or schedule.
7. **Publish.** On approval, the publish skill fans out to every requested platform and captures the post IDs.
8. **Performance ingestion.** At 48 hours, 7 days, and 30 days post-publish, performance cron handlers pull metrics from each platform and write them into `content_performance`. The brain reads these in its next cycle to bias the next batch of actions.

---

## Daily operations

### Morning

1. Open `/admin/approval-queue` in the browser. The page lists every action row where `status='ready'` or `status='needs_changes'`.
2. Per card, you see the producer name, the target (which listing or city or topic), the rendered preview (image carousel, embedded video, blog iframe, email HTML), per-platform captions in copy-friendly blocks, and a comments thread.
3. For each card, click one of:
   - **Approve & ship now.** The publish layer picks it up on the next sweep. You will see post URLs in a confirmation toast when the platforms return them.
   - **Approve & schedule.** A date and time picker opens. The post lands at the chosen Mountain Time. Used for staggering launches across the week.
   - **Request changes.** Type a note describing what to fix. The action flips to `status='needs_changes'`. The producer picks it up and re-drafts.
   - **Reject.** Confirmation prompt + reason. The action flips to `status='killed'` and never publishes.
   - **Duplicate as new variant.** Opens a dialog where you choose "same producer, new payload" or "spin off as new producer based on this one." Used when a winner deserves a fresh angle.
4. Use the filter sidebar to narrow by producer category (content / site / ops / comms / analyze) or by urgency.

### Comments

Every action row has a JSONB `comments` array. When you type a comment in the queue card and post it, a row is appended with `{author: 'matt', body: ..., posted_at, type: 'note' | 'change_request' | 'approval_note'}`. If the type is `change_request`, the row's status flips to `needs_changes` and the producer is notified.

### When you spot a producer that needs work

1. Open `/admin/producers`. The grid shows every producer with name, category, what it makes, 3 to 6 example thumbnails, required + optional inputs, status pill.
2. Click into the producer's detail page.
3. The full SKILL.md renders as MDX. The examples gallery shows every past approved render. An Edit producer panel sits at the bottom.
4. Type your change in the Edit panel. On submit, a row writes to `producer_change_requests`. The orchestrator agent picks it up, drafts a SKILL.md diff plus a sample render in the new style, surfaces both for your approval in the same UI.
5. Approve the diff and the new sample render. The change goes live for future runs of that producer.

### When the brain has emitted a bad action

1. From the queue, click Reject with reason "wrong topic" or "off-strategy" or whatever applies. The brain logs this as a `marketing_decisions` row with `decision_type='reject'`. Future cycles down-weight similar candidate actions.
2. If a whole class of actions keeps coming through wrong, open the `generate-briefs` skill in `/admin/producers/generate-briefs` and add a comment describing the pattern. The orchestrator surfaces a diff to the scoring function or the strategy doc for your approval.

---

## Weekly cadence

The brain's weekly cycle fires Sunday 7am Mountain. By Sunday 9am you should expect:

1. Eight to twelve new action rows in the approval queue.
2. The week's `KPI-dashboard.md` snapshot updated (you can view it at `marketing_brain_skills/strategy/KPI-dashboard.md` or rendered in the dashboard summary view).
3. A daily digest email landing in your inbox at 7am Mountain summarizing what the brain saw and what it dispatched.

You usually clear the queue in 20 to 40 minutes on Sunday or Monday. If you skip a week, the queue grows to the next week's 8 to 12. Backlog reviewing is fine, the brain does not run again until next Sunday.

---

## Reading the KPI dashboard

The dashboard is six panels matching the §1.5 hierarchy:

1. **North star (top panel, biggest).** Seller leads per month. Trend, target, weeks-to-target.
2. **Brand position.** Share of voice in Bend (mention count + sentiment), follower counts across `@ryanrealtybend`, branded search volume from GSC.
3. **Channel growth.** Per-platform followers, views, watch time, completion, save, share, comment, CTR. Sparklines plus week-over-week deltas.
4. **Site health.** Conversion rate on the seller-funnel landing page, organic rank for 30 long-tail seller queries, Core Web Vitals, home-valuation form completions.
5. **Ad health.** CPL, CTR, ROAS per channel; creative fatigue indicators; audience saturation.
6. **Operational hygiene.** GBP review velocity, FUB tag cleanliness, email deliverability.

Each KPI has: definition, source, current value, target, trend, owner, review cadence. The full list of 50+ metrics is in `marketing_brain_skills/strategy/KPI-dashboard.md`.

Color rules: green = on or above target, yellow = within 10% of target, red = more than 10% below target. The brain bumps yellow + red KPIs to the top of next-cycle action candidates.

---

## Revising the Q3 strategy

The strategy doc is `marketing_brain_skills/strategy/Q3-2026-strategy.md`. The `marketing_strategy` Supabase table has one row per quarter with `status` of `draft`, `active`, or `superseded`.

To revise:

1. Edit the strategy markdown file. Add a note at the top describing what changed and why.
2. Insert a new row in `marketing_strategy` for the next quarter (or a mid-quarter revision) with `status='draft'`.
3. Open the Producer Catalog UI, find the strategy review card, click "Activate revision." Supabase flips the old row to `status='superseded'`, the new row to `status='active'`, and stamps `superseded_by` on the old row.
4. The brain reads the new active row on its next cycle.

Emergency revisions (a sudden algorithm change, a major regulatory shift, a key staff change) can be done mid-quarter. The brain emits a `strategy:revision_proposal` action row when signals justify it.

---

## When the brain runs

- **Weekly cycle:** Sunday 7am Mountain (`vercel.json` cron `weekly-cycle`).
- **Daily channel snapshots:** 6:30am Mountain (one cron per platform).
- **Daily digest email:** 7am Mountain (`marketing-daily-digest`).
- **Inbox poll:** every 2 minutes (`marketing-inbox-poll`).
- **48h performance pull:** every 6 hours (`performance-pull-48h`).
- **7d performance pull:** daily 6am Mountain (`performance-pull-7d`).
- **30d performance pull:** Sunday 5am Mountain (`performance-pull-30d`).
- **Snapshot channels (consolidated):** daily 5am Mountain (`snapshot-channels`).
- **Ad-hoc trigger:** you can invoke any of these manually via `curl` with the `CRON_SECRET` bearer token. The exact curl invocations are documented in the runbook section of each cron handler file.

---

## How to escalate a stuck action

If an action row has been stuck in `in_production` for more than 30 minutes:

1. Check `producer_execution_failures` table for that action_id. If a row exists, read the `error_message` and `error_stack`.
2. If the producer is permanently broken, set the action row's `status='killed'` and `killed_reason='producer_broken'`.
3. Open the producer in `/admin/producers/<slug>` and file a change request describing the failure.
4. The brain skips this producer for the next cycle until the change request lands and the producer ships a new version.

If an action row has been stuck in `ready` for more than 7 days (you forgot to review), the brain emits a `comms:matt_alert` reminder via iMessage. You can configure the threshold in the active `marketing_strategy.channel_targets` JSONB.

If the publish layer fails after `approved` (action sits in `approved` forever without becoming `executed`):
1. Check the API logs for the platform that errored. The publish route logs structured errors.
2. The most common cause is OAuth token expiry. The `token-heartbeat` cron flags this proactively, but if you see it after-the-fact, refresh via the platform's authorize endpoint.
3. Re-trigger publish by setting `status='approved'` again (force the publish skill to retry).

---

## Where alerts land

| Severity | Channel | Examples |
|---|---|---|
| Critical | iMessage to your phone | Meta token expired, publish API returning 401 for over 1 hour, north-star metric dropped over 30% week over week |
| High | iMessage + dashboard banner | Producer execution failure rate over 25% in last 24 hours, paid CPL over 2x the campaign target, GBP review response SLA missed |
| Medium | Email + dashboard card | Brain emitted fewer than 5 actions this cycle, asset library bucket over 80% full, brand voice violations on more than 3 drafts this week |
| Low | Dashboard card only | Daily snapshot completed normally with notes, performance ingestion finished, strategy doc revision proposed |
| Summary | Daily digest email | The brain's plain-English summary of yesterday's audits + actions + outcomes |

You can tune the severity assignment in `marketing_brain_skills/producers/comms-matt-alert/SKILL.md`.

---

## Cost monitoring

The `marketing_cost_ledger` table records every Anthropic token call, every Replicate render, every ElevenLabs synthesis, every paid API quota hit. Query:

```sql
select cost_type, sum(amount_usd) as month_total
from marketing_cost_ledger
where recorded_at >= date_trunc('month', current_date)
group by cost_type
order by month_total desc;
```

A producer that exceeds its `cost_usd_estimate` (frontmatter field) by more than 50% triggers a `comms:matt_alert` of severity High. The action row's `failure_log` JSONB captures the over-budget event. You decide whether to kill the producer or expand its budget.

---

## Troubleshooting

### Common failure modes

| Symptom | Likely cause | Where to look |
|---|---|---|
| Action rows stuck in `pending` | content_engine routing broken, or producer slug mismatch | `automation_skills/content_engine/SKILL.md`, REGISTRY.md row for that action_type |
| Drafts pass scorecard but voice fails | Banned word slipped into a producer's recipe template | Producer's §5 recipe, voice_guidelines.md §11.0 |
| Publish 401s | OAuth token expired or never wired | `marketing-snapshot-meta-page` log + the platform's authorize endpoint |
| Caption renders with em-dash | Producer wrote the dash, publish guard caught it | `lib/punctuation-guard.ts` + the producer's draft step |
| Wrong CPL on FB seller funnel | Audience saturation or creative fatigue | `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` + `audit-ads` findings |
| Approval queue empty | weekly-cycle cron failed or strategy is draft, not active | Vercel cron logs + `marketing_strategy.status` |

### Where the logs live

- Vercel cron logs: in the Vercel dashboard, project ryanrealty, the Cron Jobs tab.
- Supabase logs: in the Supabase dashboard, project dwvlophlbvvygjfxcrhm, the Logs section.
- Producer execution failures: `producer_execution_failures` table, one row per failure with `error_stack`.
- Performance pull errors: `content_performance.metrics_*` JSONB will contain `{error: "..."}` on failure.

### When you do not know where to look

Ask the orchestrator. From a fresh Claude Code session in the repo, type:
> "Read AUTONOMOUS_PIPELINE_BRIEF.md, then tell me what could cause <symptom>."

The orchestrator has the entire system documented in the four bibles + the strategy doc + the brain decision logic + the publishing audit. It will trace the symptom to the right SKILL.md, the right table, the right cron.

---

## Onboarding new producers

When you want the brain to make a new kind of thing it does not already make:

1. From the catalog UI, click "New producer" (top-right). A form asks for: name, one-sentence description, output type, target platforms, required inputs.
2. The orchestrator drafts a SKILL.md from `marketing_brain_skills/producers/TEMPLATE.md` and a sample render.
3. Review the SKILL.md draft + the sample render in the same approval flow you use for content.
4. Approve. The producer goes into `status: Draft` and is available for the brain to dispatch, but on a 7-day human-review window where every output requires your explicit approval before publish (no auto-pipe).
5. After 7 days and 5 approved outputs without major changes, you flip it to `status: Canonical`.

---

## Onboarding the next agent

When you want to make a significant change to the system (new brain layer, new producer category, schema change, new platform), spin up a fresh Claude Code session and start with:

> "Read CLAUDE.md, then AUTONOMOUS_PIPELINE_BRIEF.md, then docs/MARKETING_BRAIN_USER_GUIDE.md. Then audit <subsystem>. Surface what would change and what would break. Do not commit anything until I sign off."

The agent now has the full context and the operating model.

---

## Glossary

- **Action row:** one row in `marketing_brain_actions`. The brain's unit of work.
- **Producer:** a SKILL.md that knows how to make one kind of thing. Brain dispatches actions to producers.
- **Brain skill:** internal-only skill (the 10 brain skills) that produces action rows, NOT content.
- **Capability:** a helper skill (asset-library, elevenlabs_voice, etc.) used INSIDE producers. Not brain-callable.
- **Bible:** one of the four research bibles. The producers' encyclopedic references.
- **Strategy doc:** the 27-section quarterly plan the brain executes against.
- **KPI dashboard:** the 50+ metric scorecard the brain optimizes for.
- **North star:** seller leads per month. The metric every action ladders to.
- **Verification trace:** the one-line proof that a stat is sourced from a primary source. Required by CLAUDE.md §0.

---

## When in doubt

The brief is the contract: `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md`.
The voice is the constraint: `marketing_brain_skills/brand-voice/voice_guidelines.md`.
The data is the ground truth: Supabase project `dwvlophlbvvygjfxcrhm`.

Everything else is plumbing.
