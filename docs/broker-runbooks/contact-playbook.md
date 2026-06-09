# Contact Playbook — Ryan Realty FUB

**For: Matt Ryan, Rebecca Peterson, Paul Stevenson**
**Last updated: 2026-05-26**

Every contact in FUB carries tags + a Background brief that tell you exactly what to do. This playbook is the decoder ring.

---

## 1. When you open a FUB contact

**Look at three things in order:**

1. **Background brief** (top of the right sidebar) — the cheat sheet specific to that contact. Tells you who they are, what they own, and what to do.
2. **Tags** (below name) — drives all smart-list inclusion and compliance gating.
3. **Stage** — current lifecycle position. Don't change unless they engage.

**Then take action based on what the Background says under NEXT STEPS.** Don't free-style.

---

## 2. Tag glossary — what every tag means

### Source + batch

| Tag | What it means |
|---|---|
| `import:westside-2026-05` | Came in via the May 2026 westside Bend homeowner import |
| `import:expired-backfill-2026` | Came in via the YTD 2026 expired-listing backfill |
| `source:county-assessor` | Data originated from Deschutes County assessor records |
| `source:expired-listing-mls` | Data originated from MLS (Spark API or textexport) |
| `area:bend-westside` | Property is on the west side of Bend (NWX, Awbrey, River West, etc.) |

### Geography

| Tag prefix | Examples |
|---|---|
| `city:*` | `city:bend`, `city:redmond`, `city:sunriver`, `city:sisters`, `city:la-pine`, `city:tumalo` |
| `neighborhood:*` | `neighborhood:northwest-crossing`, `neighborhood:awbrey-glen`, `neighborhood:bend-river-west`, `neighborhood:tetherow`, `neighborhood:widgi-creek`, `neighborhood:broken-top` |
| `subdivision:*` | `subdivision:orokla`, `subdivision:highland-addition`, etc. (~385 unique subdivisions) |

### Owner type + geography of owner

| Tag | What it means |
|---|---|
| `owner:occupied` | Owner lives in the property (mailing = property area) |
| `owner:absentee` | Owner does not live in the property |
| `owner:absentee-local` | Absentee but mails to Oregon |
| `owner:absentee-outofstate` | Out-of-state absentee — primary OOS pool |
| `owner:entity` | LLC / trust / estate (deeded to a non-human) |
| `geo:local` | Owner mails to Deschutes County |
| `geo:out-of-area` | Owner mails to Oregon but outside Deschutes |
| `geo:out-of-state` | Owner mails outside Oregon |
| `state:in-state` | Mailing state = OR (legacy alias for `geo:local`/`geo:out-of-area`) |
| `state:out-of-state` | Mailing state ≠ OR (legacy alias for `geo:out-of-state`) |

### Tenure (how long they've owned)

| Tag | Years owned |
|---|---|
| `tenure:0-2yr` | Just bought |
| `tenure:3-5yr` | Early |
| `tenure:6-8yr` | Approaching seller-window |
| `tenure:9-12yr` | **Peak seller window per NAR data** |
| `tenure:13-17yr` | Long-held |
| `tenure:18-24yr` | Very long-held |
| `tenure:25plus` | Legacy holders |
| `tenure:long-term` | Convenience tag (≥8 yrs owned) |
| `tenure:recent` | Convenience tag (≤3 yrs owned) |

### Equity

| Tag | Equity % (market value ÷ purchase price) |
|---|---|
| `equity:low` | < 20% appreciation since purchase |
| `equity:medium` | 20–49% |
| `equity:high` | 50–99% |
| `equity:very-high` | 100%+ |

### Seller score (0–100, derived from tenure × equity × signals)

| Tag | Band | What it means | Expected listing rate |
|---|---|---|---|
| `seller-score:hot` | 75–100 | High-probability seller in the next 12 months | 10–18% |
| `seller-score:warm` | 50–74 | Worth quarterly touches | 5–10% |
| `seller-score:cool` | 25–49 | Annual touch, low-pressure | 3–5% |
| `seller-score:cold` | 0–24 | Baseline only (annual mailer) | 2–3% |

### Lifecycle flags

| Tag | What it means |
|---|---|
| `lifecycle:rate-locked` | Bought 2020–2021 at sub-3% — less likely to sell |
| `lifecycle:likely-retirement-age` | Property age + tenure suggest owner is 55+ retiring |

### Expired-listing tags

| Tag | What it means |
|---|---|
| `intent:expired-listing` | This person's listing expired/canceled/withdrew in 2025–2026 |
| `expired-status:expired` / `canceled` / `withdrawn` | Specific status at expiry |
| `expired-mls:*` | The original MLS number for cross-reference |
| `expired-detected:YYYY-MM-DD` | When the cron caught it |
| `owner-lookup:resolved-westside` | Owner is in our westside import (full data) |
| `owner-lookup:resolved-textexport-owner` | Owner came from MLS owner field |
| `owner-lookup:pending-fub-or-paid` | Owner unknown — needs DIAL skip-trace before outreach |

### Contact channels

| Tag | What it means |
|---|---|
| `contact:has-email` | We have an email on file |
| `contact:has-phone` | We have any phone on file |
| `contact:mobile-phone` | Phone is a mobile/cell (texting OK if no DNC flags) |
| `contact:landline-phone` | Phone is a landline (no text) |
| `contact:needs-enrichment` | No phone, no email — direct mail only |
| `contact:direct-mail-only` | Entity contact, no skip-trace possible |
| `contact:do-not-call` | Phone outreach blocked (DNC, multiple DNC flags, or manual) |
| `contact:do-not-text` | SMS blocked (litigator, DNC, or manual) |
| `contact:do-not-email` | Email blocked (canonical) |

### Compliance / hard-stop (auto-excluded from every smart list)

| Tag | What it means | Auto-excludes? |
|---|---|---|
| `tcpa:litigator` | Active TCPA lawsuit history — never text or auto-dial ($1,500/violation risk) | **YES** |
| `compliance:hard-stop` | Cumulative stop tag — auto-applied to litigators + deceased + realtors + manual hard-stops | **YES** |
| `compliance:deceased` | Person is deceased — skip all outreach | **YES** |
| `compliance:dnc-registry` | On federal Do Not Call registry | YES on auto-dial |
| `do_not_email` (FUB legacy) | Email blocked, FUB-managed | YES |
| `Unsubscribed` (FUB system) | They opted out | YES |
| `Bounced` (FUB system) | Email bounced | YES |

### Industry / realtor

| Tag | What it means |
|---|---|
| `industry:realtor` | This person is a licensed Oregon real estate agent — recruit / listing share only |
| `audience:broker-recruit` | Candidate for joining Ryan Realty |
| `brokerage:*` | Their current brokerage (e.g. `brokerage:re-max-key-properties`) |
| `realtor-source:orea`, `realtor-source:fub`, `realtor-source:flexmls` | Where we matched the realtor identity |

### Exclusion flags

| Tag | What it excludes from |
|---|---|
| `exclude:fb-cas` | Facebook Custom Audience upload |
| `exclude:seller-automation` | All seller drip plans |
| `exclude:buyer-automation` | All buyer drip plans |

### Enrichment / FB audience

| Tag | What it means |
|---|---|
| `enrich:batchdata-matched` | BatchData skip-trace returned a match |
| `fb-audience:westside-all` | Eligible for FB Custom Audience uploads |
| `enrichment_provider` (custom field, not tag) | `batchdata` if enriched |

---

## 3. Decision tree — what to do per contact

```
1. Open the contact, read Background → NEXT STEPS section.
2. Check for COMPLIANCE flags. If any tcpa:litigator or compliance:deceased → STOP. No outreach.
3. Find the score band tag (seller-score:hot/warm/cool/cold).
4. Match the table below.
```

| Score | Has phone? | Has email? | First touch |
|---|---|---|---|
| `hot` + owner-occupied local | ✓ phone | — | **Call today.** Tenure + equity hook → free CMA offer |
| `hot` + owner-occupied local | — | ✓ email | **Email today.** Short CMA offer |
| `hot` + owner-occupied local | — | — | **Hold.** Wait for enrichment to fill a channel |
| `hot` + OOS owner | any | any | **Call/email today.** Lead with remote-seller logistics |
| `warm` | ✓ phone | — | Quarterly check-in call (low pressure) |
| `warm` | — | ✓ email | Send neighborhood market update email this week |
| `cool` | any | any | Annual mailer only until score promotes |
| `cold` | any | any | Annual mailer only |
| `intent:expired-listing` | any | any | **Plan 71 auto-enrolled.** First touch: Touch 0 call within 24h. Empathy-first. |
| `industry:realtor` | any | any | Recruit / listing share only. **No** seller plans. |
| `owner:entity` | n/a | n/a | Direct mail only. Research decision-maker first. |

### After they engage (respond to a call/email)

| If… | Then |
|---|---|
| Hot owner-occupied local responds | Stage → Warm. **Apply Plan 74 (Neighborhood Resident Nurture).** |
| Hot OOS owner responds | Stage → Warm. **Apply Plan 73 (Out-of-State Owner Nurture).** |
| Expired listing person responds | Add tag `seller:in-conversation` (pauses Plan 71 on next pause-on-reply cron). |
| Any contact requests CMA | Manually generate CMA via [`marketing_brain_skills/producers/cma`](../../marketing_brain_skills/producers/cma) |
| Any contact unsubscribes / requests stop | Add `Unsubscribed` (system) AND `compliance:hard-stop` → out of every blast forever |

---

## 4. Action Plan reference

| Plan ID | Name | When it fires | Auto vs manual |
|---|---|---|---|
| **Plan 69** | Seller Master Workflow | **Only** when someone submits the seller LP at ryan-realty.com | Auto on LP submission |
| **Plan 71** | Expired Recovery (auto) | Auto on `intent:expired-listing` tag (when cron creates expired contact) | Auto |
| **Plan 73** | Out-of-State Owner Nurture | After your **first live conversation** with an OOS owner | **Manual** |
| **Plan 74** | Neighborhood Resident Nurture | After your **first live conversation** with a local hot/warm owner | **Manual** |

**Hard rules:**

- **Never apply Plan 69** unless they submitted the website seller LP. It assumes prior consent.
- **Never apply Plan 71** unless they were detected as an expired listing via the cron. It assumes the empathy-first framing.
- **Plans 73 + 74 are manual** — only after a live conversation. They're meant to nurture an already-engaged lead, not cold blast.
- **No plan ever applies on import.** The westside batch import auto-enrolls zero plans.

---

## 5. Smart lists — what each one shows

(IDs are FUB internal — find them under People → Smart Lists.)

### Tier 1 — populated now

| ID | Name | What it shows |
|---|---|---|
| 130 | Homeowner DB — West Side All | Every westside contact (7,675) |
| 131 | Likely Sellers — Hot | seller-score:hot, ~352 contacts |
| 132 | Likely Sellers — Warm | seller-score:warm, ~3,000 contacts |
| 145 | Likely Sellers — Cool | seller-score:cool |
| 133 | Out-of-State Owners | geo:out-of-state, ~1,157 contacts |
| 134 | High Equity Owners | equity:high or equity:very-high |
| 137 | Needs Enrichment — West Side | contact:needs-enrichment |
| 142 | Rate Locked Owners | lifecycle:rate-locked, ~996 contacts |

### Tier 2 — industry

| ID | Name | What it shows |
|---|---|---|
| 135 | Industry Realtors — West Side | industry:realtor, westside |
| 136 | Broker Recruit Pool | audience:broker-recruit |

### Tier 3 — life events (populates when BatchData runs OR manually)

| ID | Name | What it shows |
|---|---|---|
| 138 | Empty Nest Owners | demo:empty-nest (BatchData tier upgrade needed) |
| 139 | Life Event — Recently Divorced | life:recently-divorced |
| 140 | Life Event — Recently Moved | life:recently-moved |
| 141 | Retirement Age Long-Term | demo:age-55-plus + tenure:long-term |
| 143 | Has Mobile Phone | contact:mobile-phone |
| 144 | BatchData Enriched | enrich:batchdata-matched, ~5,771 contacts |

### Neighborhood shells (104–122)

12 westside Bend neighborhood lists + 6 resort communities. Filter on the matching `neighborhood:*` tag.

**Every smart list automatically excludes:**
- `industry:realtor` (no marketing to fellow agents)
- `compliance:hard-stop` (litigators, deceased, manual hard-stops)
- `do_not_email`, `Unsubscribed`, `Bounced` (FUB system gates)
- `Realtor`, `Real Estate` (legacy realtor tags)
- Stage `Real Estate Agent`

---

## 6. Compliance — what to never do

| Flag | Hard rule |
|---|---|
| `tcpa:litigator` | **NEVER** auto-text or auto-dial. Manual one-to-one email only. $1,500/violation if you slip. |
| `compliance:deceased` | **NEVER** send any outreach. If a family member responds, treat as new lead. |
| `compliance:hard-stop` | Already auto-excluded from every smart list — don't override. |
| `do_not_email` / `Unsubscribed` | Email blocked permanently. Other channels still open. |
| `contact:do-not-call` | Phone blocked. Email or mail only. |
| `contact:do-not-text` | SMS blocked. Voice call still OK if not also `do-not-call`. |

---

## 7. Stages — what each one means

| Stage | When to use |
|---|---|
| `Seller Prospect` | Imported homeowner who hasn't engaged. Don't promote. |
| `Lead` | Inbound — they reached out first (website, IDX, referral). |
| `Warm` | They've engaged at least once (call, email reply). |
| `Hot` | Active CMA / showing request / pre-listing conversation. |
| `Active Client` | Listing agreement signed OR buyer-rep signed. |
| `Pending` | Under contract. |
| `Closed` | Transaction closed. Move to `Past Clients`. |
| `Past Clients` | Closed last 7 years. Stay-in-touch cadence. |
| `Sphere` | Personal sphere — family, friends, repeat referrers. |
| `Real Estate Agent` | Industry contact — don't move this stage even if they buy/sell personally. |
| `Trash` | Bad data / unreachable / wrong number / full DNC. Never bring back. |

---

## 8. Common patterns

### "I want to find every hot seller in NWX with a phone"

→ Open smart list `Likely Sellers — Hot` (131), then filter by tag `neighborhood:northwest-crossing` AND `contact:has-phone`.

### "I just got off a great call with an OOS owner — what's next?"

1. Stage → `Warm`.
2. Add note with their timeline + motivation.
3. Apply Action Plan → **Plan 73 (Out-of-State Owner Nurture)**.
4. Schedule next touch task per their timeline.

### "Someone called me back from an expired listing — they want to relist"

1. Stage → `Hot`.
2. Add tag `seller:in-conversation` (this pauses Plan 71 on next pause-on-reply cron).
3. Schedule CMA or in-person meeting.
4. Once they sign listing agreement → Stage → `Active Client`.

### "I want to export a list for a Facebook Custom Audience"

1. Open the smart list (e.g. `Likely Sellers — Hot`).
2. Top-right → Export → CSV (include email + phone columns).
3. Facebook Ads Manager → Audiences → Create Audience → Customer List.
4. Tag `exclude:fb-cas` and `compliance:hard-stop` are auto-excluded — no manual scrubbing needed.

---

## 9. References + source-of-truth docs

- **Tag taxonomy + build logic**: [`scripts/westside-bend-build-fub-import.mjs`](../../scripts/westside-bend-build-fub-import.mjs) (`deriveTags` function)
- **Background brief generator**: [`scripts/lib/westside-broker-brief.mjs`](../../scripts/lib/westside-broker-brief.mjs)
- **Action plan canonical spec**: [`docs/FUB_SELLER_WORKFLOW_2026-05-17.md`](../FUB_SELLER_WORKFLOW_2026-05-17.md)
- **Compliance exclude group**: [`docs/FUB_SMART_LISTS_STARTER_PACK.md`](../FUB_SMART_LISTS_STARTER_PACK.md) §Mandatory excludes
- **TCPA litigator handling**: [`.claude/projects/.../memory/reference_tcpa_litigator_handling.md`](../../.claude/projects/-Users-matthewryan-RyanRealty/memory/reference_tcpa_litigator_handling.md)
- **Smart list UI setup**: [`docs/broker-runbooks/westside-fub-smart-lists-setup.md`](westside-fub-smart-lists-setup.md)
