# Ads Go-Live Runbook (Matt's launch checklist)

**Status 2026-06-23:** the build is done. Strategy in `PAID_ADS_PLAN.md`. This is the operational checklist to actually launch. Everything below the line is built and on `main`; the steps are *your* actions in Meta/Vercel/FUB.

## What's already built (the spine — no action needed)
- **Audience:** "Ryan Realty CRM Leads" Custom Audience live on Meta (13,883, consent-gated, realtor-excluded) + daily auto-refresh.
- **Tracking:** Meta Pixel + CAPI at 100% across every LP, shared `event_id` dedup → ad→LP→lead is fully measurable.
- **Capture:** every public form + the FB lead webhook writes to the native CRM even if FollowUpBoss fails — no lead is lost at cutover.
- **Per-broker:** `?agent=<slug>` routes traffic-ad leads to the broker; the FB webhook routes lead-form leads by hidden field → campaign name → Matt.
- **Quality loop:** CRM→CAPI "Qualified" event fires when a lead reaches a qualifying stage (dry-run until you enable it).

## Launch steps (in order)

**1. Stop the FUB "archived" emails** *(do first — it's still happening)*
   In FollowUpBoss, disconnect the connected sending email (`matt@ryan-realty.com`) or pause the automation firing the archived template. Our CRM is already hardened against repeating it.

**2. Confirm the audience under Housing** *(2 min, Ads Manager)*
   New campaign → Special Ad Category = **Housing** → open the audience selector → check whether **"Ryan Realty CRM Leads"** is selectable for inclusion. Lookalikes are NOT usable under Housing (confirmed) — don't try to use the 1% lookalike for targeting.

**3. Launch ONE campaign** *(the $20/day prove-it phase)*
   - **Campaign:** Seller — Home Value. Objective **Lead-Conversion**. Special Ad Category **Housing**. Central Oregon, 15-mi+ radius, no ZIP.
   - **Audience:** broad geo + **Advantage+** (+ the Custom Audience if step 2 says it's allowed). Optional home-improvement/Zillow interest.
   - **Form:** Meta instant form with 2-3 **qualifier questions** — A/B against traffic → `/lp/seller-home-value`. (Traffic also builds a Housing-legal retargeting audience.)
   - **Creative:** "What would your home bring today?" + a real recent local comp. No hype words.

**4. Per-broker ads** *(if Rebecca/Paul run their own)*
   - **Traffic ads:** each broker grabs their links from **`/admin/broker-links`** (`?agent=rebecca`, etc.) → leads route to them automatically.
   - **FB lead-form ads:** name the campaign or ad set with the broker's first name (e.g. *"Seller Leads — Rebecca"*) → the webhook routes it. (Meta forms have no reliable hidden field, so the campaign name is the lever.)

**5. Google test** *(small, parallel)*
   $5-10/day Google Search on *"sell my house Bend"*, *"home value Bend"* — the high-intent demand Meta's Housing rules forbid targeting. Point ads at `/lp/seller-home-value?agent=<broker>`.

## Flags (Vercel env — flip when ready)
- `META_AUDIENCE_PUSH_ENABLED=true` — already set (audience auto-refreshes daily).
- `META_CAPI_QUALIFIED_ENABLED` — leave OFF for now. Turn on once lead volume is high enough for Meta's Conversion-Leads learning (~50 qualified events/ad-set/week). Latent below that.

## What to watch (not vanity metrics)
- **Cost-per-QUALIFIED-lead** (trust `qualified_*` in the CRM, not `new_leads`).
- **Speed-to-first-touch** — the #1 conversion lever (5-min response = 21× the odds). The email-first sequence handles this; watch it fires fast.
- **Ignore in-window ROAS.** At 2.5% commission (~$17.5k/close), break-even is ~1 deal per ~29 months of $20/day — economics are safe; the goal is proving lead quality + the funnel.

## Scale trigger
Once cost-per-qualified-lead is known and ≥1 deal is attributable: add the Expired/FSBO + Buyer campaigns, lift budget, and turn on the CAPI qualified loop.
