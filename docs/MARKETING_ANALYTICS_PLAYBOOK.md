# Marketing Analytics Playbook — Ryan Realty

**Audience:** Matt + brokers. Not the brain, not engineers — the people making decisions about ads, content, and marketing spend.

**Purpose:** Sit down once a week, look at the right three numbers, decide what to keep doing and what to kill.

**Last updated:** 2026-05-18 (right after the analytics build-out)

---

## 1. The one question that matters

> **Are we generating qualified seller leads at a sustainable cost?**

Everything else is supporting evidence. If this number is going up, marketing is working. If it's flat or going down, something needs to change.

The brain tracks this as the **north-star metric** in Supabase. You can see it on the `/dashboard/marketing` page of `ryanrealty.vercel.app` — it pulls from FUB tag matching (`Seller Lead`, `Seller Intent`, etc.).

---

## 2. The three numbers to look at every Monday morning

Open `/dashboard/marketing` (the brain dashboard). Spend 10 minutes. Three rows answer the entire week:

| Metric | What it answers | Where it shows up |
|---|---|---|
| **Qualified seller leads (last 7d vs prior 7d)** | Did we generate leads? Is the trend up or down? | Top of dashboard |
| **Cost per qualified seller lead** (FB ad spend ÷ leads) | Are we paying too much? Is FB working? | FB Ads section |
| **Conversion rate per LP** (form submits ÷ LP visits) | Which landing page is converting and which isn't? | Per-LP funnel section |

If all three are healthy → keep doing what's working.
If lead volume drops → check the diagnostic playbook in §6.
If cost per lead spikes → §6 covers that too.
If one LP is converting at 8% and another at 1% → kill the 1% LP or rebuild it.

---

## 3. Where to look to answer specific questions

Different tools answer different questions. Don't open GA4 to ask "which broker handled this lead" and don't open FUB to ask "which FB ad drove this visit." Use the right surface:

| Question | Tool | Why |
|---|---|---|
| Did we get leads this week? | **Brain dashboard** (`/dashboard/marketing`) | Cross-channel total — FB + organic + direct |
| Which traffic source converted? | **GA4 → Acquisition → Traffic acquisition** | Filter by Conversions = `generate_lead` |
| How are FB ads performing? | **Meta Ads Manager** (impressions, CPM, CTR, spend) AND **brain dashboard** (leads-per-campaign attribution) | Meta has the spend, brain has the lead attribution |
| What's our seller-funnel conversion rate? | **GA4 → Explore → Seller Funnel Exploration** (once built) OR brain dashboard per-LP section | Funnel Exploration shows step-by-step drop-off |
| Which broker handled this lead? | **FUB** (assigned-to + activity log) | FUB is the system of record for who-touched-the-lead |
| Did the SEO blog post drive any leads? | **Brain dashboard** (organic source breakdown) | Joins GA4 sessions with FUB leads via session-source |
| Is our market report page getting visitors? | **GA4 → Engagement → Pages and screens** | Filter by page path containing "/market-report" or "/explore/" |
| Is someone we just emailed clicking through? | **FUB activity log** (per-person) | FUB tracks email opens / clicks per lead |

**Rule of thumb:** if you want a NUMBER, the brain dashboard is the answer. If you want a SPECIFIC PERSON or LEAD, FUB is the answer. If you want a DEEP DIVE on a specific channel, that channel's native UI (Meta Ads Manager, GA4 Explore, GSC) is the answer.

---

## 4. FB Ads — best practices (the only paid channel right now)

### URL format every FB ad must use

Every Facebook ad's destination URL must follow this exact pattern:

```
https://ryan-realty.com/lp/<lp-variant>/?utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign-slug>&utm_content=<ad-set-or-variant>&utm_term=<targeting>
```

| Parameter | What it should be | Examples |
|---|---|---|
| `utm_source` | Always `facebook` (or `instagram` for IG-specific placements) | `facebook`, `instagram` |
| `utm_medium` | Always `paid_social` for FB/IG ads | `paid_social` |
| `utm_campaign` | Kebab-case slug. **Match a `marketing_brain_actions.id` substring** when you can — the brain's seller-lead-attribution cron will pair the lead back to the action automatically. | `seller-funnel-may-2026`, `cma-promo-fall` |
| `utm_content` | The ad set or creative variant. Tells you which AD inside the campaign drove the lead. | `headline-a-bend-sunset`, `video-aerial-tetherow` |
| `utm_term` | Targeting / keyword bucket. Tells you which AUDIENCE converted. | `bend-sellers-55plus`, `tetherow-homeowners` |

**Why this matters:** if the URL doesn't follow this convention, the brain can't tell which campaign drove which lead. You'll see "FB ads generated 12 leads" but you won't know if it's the seller campaign or the buyer campaign or which creative is winning.

### Conversion event already wired (don't change it)

Every form submit on a Ryan Realty LP fires:
- **Browser-side**: Meta Pixel `Lead` event with the form's `lp_variant` and `value`
- **Server-side (CAPI)**: Meta Conversions API mirror of the same Lead event

Both share an `eventID` so Meta deduplicates them. **This is best practice.** It means iOS users and ad-blocker users still get counted, which boosts your audience reach by 10-30%.

### Creative + audience checklist before launching a new FB ad

- [ ] URL has all 5 UTM params (table above)
- [ ] `utm_campaign` slug is unique enough to identify this campaign in the brain
- [ ] Lead form on the destination LP has been tested in incognito today
- [ ] Audience is at least one of: 1% lookalike of existing leads, custom audience from CMA Downloaders / Engaged Sellers (no convert 30d), or geo-targeted to Bend/Redmond/Sisters/Sunriver homeowners
- [ ] Budget cap set in Meta Ads Manager (best practice: $20-50/day per ad set max while you're testing)
- [ ] Creative refers to a concrete fact specific to the user — neighborhood name, price band, recent comp. Generic "list your home" creative converts at 0.5%. Specific "Bend NW Crossing homes sold at $X last month — what's yours worth?" converts at 2-3%.

### When a FB ad isn't working

| Symptom | Likely cause | What to try |
|---|---|---|
| Cost per lead > $50 | Audience too broad, creative generic | Tighten audience to homeowners in 3-4 zip codes; replace generic creative with a market-specific stat |
| CTR < 1% on the ad | Hook is weak | Rewrite the first line of ad copy to a question or a fact ("Bend home prices dropped 4% in March — yours?") |
| Lots of clicks, no leads | LP is broken or form has friction | Test the LP in incognito; check form submit fires in DevTools; remove non-essential form fields |
| Lead spike but quality is low (no callbacks) | Targeting is off — getting "info-gatherers" | Tighten income/age targeting; add intent qualifier in ad copy ("if you're thinking of selling in the next 6 months...") |
| Suddenly all metrics dropped | Probably ad approval / policy issue; check Meta Ads Manager → Account quality | If account is restricted, escalate via Meta Business support |

---

## 5. Landing page best practices

Every NEW landing page Ryan Realty ships follows the convention documented in `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` — but for Matt's purposes, it boils down to:

1. **Page lives under `app/lp/<variant>/page.tsx`** — keeps URLs predictable as `/lp/<variant>/`
2. **Renders `<LandingPageTracker lpVariant="<variant>" />` at the top** — fires `view_landing_page` with UTM context on mount
3. **Form fires `trackEvent('generate_lead', { lp_variant, source, ...form_fields })`** on submit — so the brain can attribute the lead to the LP
4. **Form ALSO fires `fbq('track', 'Lead', { content_name: '<variant>', value: <intent_value> }, { eventID: result.eventId })`** — for Meta dedup
5. **Server-side CAPI mirror** for the same Lead event (already wired globally via the AgentFire CAPI mirror)

**On the conversion side:**
- Above-the-fold hero with **one** primary CTA. Two CTAs cut conversion by 30%+.
- The CTA copy is what the user GETS, not what we want ("Get my home value" beats "Submit").
- Form has 3-5 fields max. Every additional field cuts conversion ~10%.
- Social proof above the fold (1-2 sentences of a real client testimonial or a recent sold-comp stat).
- Mobile-tested. Most paid-social traffic is mobile.
- Phone CTA visible (`541.703.3095` — the FUB-tracked number, NOT Matt's direct).

**Anti-patterns:**
- Multiple CTAs competing for the same attention (kills conversion)
- "Contact us" without saying what the user gets (kills conversion)
- Long-form copy on a paid-traffic LP (kills conversion — long-form is for SEO/organic, not paid)
- Auto-playing video (kills retention — users bounce in 3 seconds)
- Forms that don't validate inline (kills completion — users hit submit, see error, give up)

---

## 6. Weekly review checklist (Monday morning, 10 min)

Open these in order. Spend 90 seconds on each. Decide one thing at the end.

1. **Brain dashboard** (`/dashboard/marketing`)
   - North-star metric (qualified seller leads) — up or down vs prior week?
   - Cost per qualified seller lead — over $40 trigger investigation
   - Which channel drove the leads (FB / organic / direct / referral)
2. **GA4 → Acquisition → Traffic acquisition** (last 7 days)
   - Top 5 sources by sessions
   - Conversion rate per source (`Key event count` ÷ Sessions)
   - One outlier (either very high or very low conversion) → investigate
3. **Meta Ads Manager** (last 7 days)
   - Total spend
   - Total Lead events (browser + CAPI deduplicated)
   - Cost per Lead per campaign
   - Best-performing ad creative (highest CTR or lowest CPL)
   - Worst-performing ad creative → pause if CPL > $50 for more than 3 days
4. **FUB** (last 7 days)
   - New leads count (should match GA4 + Meta — if it doesn't, attribution is broken)
   - Response-time SLA: are leads being touched within 5 min (hot) / 30 min (warm)?
   - Lead status flow — how many moved to "Working" or beyond?
5. **GSC** (last 7 days)
   - Top organic queries (any new wins?)
   - Pages that dropped in position (any need attention?)
6. **One decision**
   - What's the ONE change for this week? "Pause the underperforming ad set." "Test a new headline on the seller LP." "Write a blog post about the Bend Q1 market report." Pick one, commit to it, move on.

If you do this every Monday for 8 weeks, the brokerage compounds. If you skip it, marketing drifts.

---

## 7. Diagnostic playbook — when something looks off

### Symptom: lead volume dropped suddenly

1. Check Meta Ads Manager — is anything paused, rejected, or out of budget?
2. Check GA4 Realtime — is the LP getting visitors right now?
3. Check FUB inbox — are leads ARRIVING but not being tagged correctly?
4. Check the LP in incognito — does the form submit successfully?
5. Check Vercel deploys — was there a recent deploy that might have broken the form? `vercel ls --prod` shows last 10 production deploys with status.

### Symptom: cost per lead doubled

1. Are you bidding on a new audience? New audiences cost more for the first 1-2 weeks while Meta learns.
2. Did the creative get stale? Meta's frequency cap kicks in around 3-4 impressions per user — refresh creative.
3. Did a competitor enter the same audience? You can't see this directly but a sudden cost spike often means it.
4. Is there an iOS 14+ measurement gap? CAPI should handle this, but verify CAPI events are still firing (see `app/api/meta-capi/route.ts`).

### Symptom: leads coming in but no calls happening

1. Check FUB notifications — are SMS/email alerts firing for new leads?
2. Check FUB SLA report — is the team hitting the 5-min hot / 30-min warm response targets?
3. Check Twilio or your phone carrier — is `541.703.3095` ringing correctly?
4. Audit the lead-source quality: maybe the campaign is bringing in info-gatherers, not actual sellers. Tighten the audience.

### Symptom: GA4 numbers don't match FUB numbers

This is expected. They measure different things:
- GA4 counts `generate_lead` events (form submits)
- FUB counts actual lead records created
- The gap = form submits that failed server-side (rare), duplicate submits (deduped in FUB), or leads that came from non-GA4 sources (phone calls, manual entries)

If the gap is >20%, investigate. Otherwise it's normal.

### Symptom: a specific LP has 0 form submits despite traffic

1. Open the LP in incognito → fill out the form → submit
2. Check DevTools Network tab for the form action POST
3. Check the server log (`vercel logs`) for the action
4. If the action 500s, the form is broken — fix it
5. If the action 200s but no lead in FUB, the FUB push is broken — check `lib/fub.ts`

---

## 8. Annual review — what to ask quarterly

Once a quarter (Jan / Apr / Jul / Oct), spend 60 minutes asking the bigger questions:

1. **What's our cost per CLOSED transaction** (not per lead)? Lead → closed conversion is ~5-10% in good markets, 2-5% in slow markets. If you spent $5K on FB ads and closed 1 transaction at $15K commission, you're profitable. If you spent $5K and closed 0, kill it or restructure.

2. **Which LPs convert best at the CLOSING level** (not just at the form-submit level)? Best-form-converter ≠ best-closed-converter. Use FUB's pipeline data + the brain's seller-lead-attribution cron to trace this.

3. **Is the brokerage SEO position improving?** GSC → Performance → "queries containing 'bend real estate'" position trend. If it's going from 25 → 12 → 8 → 5 over the quarter, SEO is working. If it's flat at 25, content strategy isn't compounding.

4. **What's the FUB tagging hygiene like?** The brain depends on tags matching (`Seller Lead`, `Hot Seller`, etc.). Audit the last 100 leads — are they tagged correctly? If 20% are mistagged, training gap with the brokers.

5. **Are we exporting custom audiences from GA4 to Meta for retargeting?** `Engaged Sellers (no convert 30d)`, `Active Buyers (3+ listings)`, `CMA Downloaders` should each be retargeting audiences in Meta Ads Manager. If they're not connected, leads are being left on the table.

---

## 9. The systems behind this — for the agent / engineer

When something doesn't work and you need to debug:

- **Canonical event taxonomy + GA4 admin config**: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md`
- **Brain ingestor code**: `app/api/cron/marketing-snapshot-ga4/route.ts` (daily at 06:30 UTC)
- **Lead attribution cron**: `app/api/cron/seller-lead-attribution/route.ts`
- **Meta CAPI mirror**: in AgentFire's "Head after opening tag" script + `app/api/meta-capi/route.ts`
- **FUB integration**: `lib/fub.ts` + `lib/fub-snapshot.ts`
- **Brain dashboard**: `app/dashboard/marketing/page.tsx`
- **Memory log of all decisions**: `.auto-memory/memory_marketing_brain_decisions.md`

---

## 10. The 80/20 — if you only do three things

Most weeks, you don't need to read this whole doc. Three habits compound:

1. **Monday morning 10-minute review** of the brain dashboard + GA4 → make one decision per week.
2. **Every FB ad URL uses the full UTM convention** (§4) — this is the single biggest predictor of whether you'll be able to figure out what's working in 6 months.
3. **Every new LP follows the LP convention** (§5) + lives under `app/lp/<variant>/` with `<LandingPageTracker>` + a real `trackEvent('generate_lead')` on submit.

If those three are dialed, the rest of this doc is just diagnostics for when something breaks.

---

**Cross-reference:** the technical contract behind this playbook is `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md`. When the conventions in this playbook conflict with the skill, the skill wins (it's the source of truth for the agent + the codebase).
