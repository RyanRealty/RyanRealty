# Third-Party Profile Consistency Audit, Audit Item 19

**Date:** 2026-08-03
**Scope:** Google Business Profile (GBP), Zillow, Yelp. NAP consistency, schema.org markup on
the live site, and review velocity. Closes the "not measured" gap from
`docs/audits/WEBSITE_AUDIT_2026-08-02.md` item 19.
**Method:** Read-only. Live browser fetches of `ryan-realty.com`, Google Maps (the GBP listing
via its canonical `cid` URL), `zillow.com`, and `yelp.com`. No account connected, no OAuth
grant, no profile edited. Per CLAUDE.md §1 class 4, any actual profile change is a per-action
approval only Matt can give.
**Not in scope (not audited here):** Homes.com, realtor.com, LinkedIn, Facebook, Instagram,
TikTok, X, Pinterest, Threads, NAR/NRDS, Apple Business, RealSatisfied. Several of those were
last audited 2026-06-10, see `.auto-memory/reference_agent_portal_profiles.md`, and are stale
relative to today. They are named in section 6 below as candidates for the next audit pass, not
verified here.

---

## 1. Canonical NAP, established from the repo

The single source of truth is **`lib/brand/contact.ts`** (`BRAND`, `CONTACT`, `BROKERS`), gate
locked by G38 (`scripts/check-broker-facts.mjs`), which bans the canonical phone and social
literals from reappearing hand-typed in `app/` and `components/` render code. This is the
reference every row below is measured against.

| Field | Canonical value | Source |
|---|---|---|
| Brand name | **Ryan Realty** | `BRAND.name`, `lib/brand/contact.ts:25` |
| Legal name | **Ryan Realty LLC** | `BRAND.legalName`, `lib/brand/contact.ts:26` |
| Street address | **115 NW Oregon Ave #2** | `BRAND.address.street`, `lib/brand/contact.ts:36` |
| City / State / ZIP | **Bend, OR 97703** | `BRAND.address.{city,region,postalCode}`, `lib/brand/contact.ts:37-40` |
| Public phone | **541.703.3095** / `+15417033095` | `CONTACT.phoneDirect` / `.phoneDirectTel`, `lib/brand/contact.ts:81-82` |
| Email | **matt@ryan-realty.com** | `CONTACT.email.primary`, `lib/brand/contact.ts:89` |
| Website | **https://ryan-realty.com** | `BRAND.url`, `lib/brand/contact.ts:28` |
| Founded | **2023-06-21** (June 2023) | `BRAND.founded`, `lib/brand/contact.ts:30` |
| Principal broker / license | **Matt Ryan, OR license 201206613** | `BROKERS.matt`, `lib/brand/contact.ts:114-124` |
| Social handle | **@ryanrealtybend** on IG, FB, YT, TikTok, X, Pinterest, Threads. `/company/ryan-realty-llc-bend-oregon` on LinkedIn | `BRAND.social`, `lib/brand/contact.ts:49-63` |
| GBP canonical URL | `https://maps.google.com/?cid=11038319841912529644` (placeId `ChIJfVsN4o3IuFQR7KJXpmn9L5k`) | `BRAND.social.googleBusinessProfile`, `lib/brand/contact.ts:59-62` |

### The one phone number to get exactly right

CLAUDE.md §2, as currently written, still describes **two** public-facing numbers: `541.213.6706`
as "brand voice, Matt's direct" and `541.703.3095` as the "bio phone (attribution-tracked)" for
social, ads, and lead-capture. **That framing is stale.** The code comment at
`lib/brand/contact.ts:76-81`, dated to the 2026-06-24 Twilio cutover, states plainly:

> "As of the Twilio cutover (2026-06-24) this is the ported 541.703.3095 line, now living in
> Twilio... Matt's old direct line (541.213.6706) is now a **private forward target only, off
> the public site**."

The live site confirms the code, not the stale prose. Every phone number rendered on
`ryan-realty.com` today, the homepage footer, the `/contact` page, and both the Organization and
broker JSON-LD blocks, is `541.703.3095`. **541.213.6706 does not appear anywhere on the public
marketing site.** Verified live 2026-08-03, see section 2 below.

**Finding P-1** (internal, not a third-party discrepancy, but load-bearing for this audit):
CLAUDE.md §2's phone guidance has drifted from the gate-locked canonical source. Recommend a doc
fix: strike the "two public numbers" framing and state that `541.703.3095` is the sole public
brand phone, with `541.213.6706` retired to a private forward target. Cutting this from the
per-action correction packet below and flagging it here instead, because it is the reason the
"canonical value" column above reads `541.703.3095` rather than the number CLAUDE.md's prose
would suggest at a skim.

**Residual leak inside the site itself:** `541.213.6706` is still hardcoded in four render
surfaces that the broker-facts gate has grandfathered into `scripts/broker-facts-baseline.json`
rather than catching fresh.

- `app/sign/layout.tsx:26`, the footer of the public transaction e-signing shell
  (`/sign/[token]`), seen by every client asked to sign a document. This one is genuinely
  public-facing. A signer sees `Ryan Realty · Bend · Oregon · 541.213.6706 · ryan-realty.com` on
  every page of the signing flow.
- `app/home-valuation/actions.ts:366` and `app/lp/tetherow/heath/actions.ts:225`, server-action
  error-fallback strings ("Could not submit. Try again shortly or call 541.213.6706."), only
  rendered if the form submission fails. Low exposure but still wrong.
- `lib/tc/signing-emails.ts:28`, TC signing email footer.

This is outside the third-party-profile scope of item 19, but it is a real, verified NAP
inconsistency inside the brokerage's own public surfaces, found while establishing the
canonical phone. Flagging for a follow-up fix rather than silently absorbing it into "canonical."

---

## 2. What the live site publishes (verified 2026-08-03)

Fetched with a real browser (Chrome UA via the Claude Browser pane, since the middleware 403s
bare curl, confirmed).

**Homepage (`ryan-realty.com`) Organization JSON-LD**, `@type: ["RealEstateAgent","LocalBusiness"]`,
`@id: https://ryan-realty.com#organization`:

```json
{
  "name": "Ryan Realty",
  "legalName": "Ryan Realty LLC",
  "telephone": "+15417033095",
  "email": "matt@ryan-realty.com",
  "foundingDate": "2023-06-21",
  "address": {
    "streetAddress": "115 NW Oregon Ave #2",
    "addressLocality": "Bend",
    "addressRegion": "OR",
    "postalCode": "97703",
    "addressCountry": "US"
  },
  "sameAs": [
    "https://www.instagram.com/ryanrealtybend",
    "https://www.facebook.com/ryanrealtybend",
    "https://www.youtube.com/@ryanrealtybend",
    "https://www.tiktok.com/@ryanrealtybend",
    "https://x.com/ryanrealtybend",
    "https://www.linkedin.com/company/ryan-realty-llc-bend-oregon",
    "https://www.pinterest.com/ryanrealtybend",
    "https://www.threads.net/@ryanrealtybend",
    "https://maps.google.com/?cid=11038319841912529644"
  ]
}
```

**Result: byte-identical to `lib/brand/contact.ts`.** This is exactly what CLAUDE.md sections 7
and 3 call for: the code is the source of truth and the render matches it. No drift found on
the homepage JSON-LD.

**`/contact` page.** Same Organization JSON-LD, plus page-specific `ContactPage`,
`BreadcrumbList`, and `FAQPage` blocks. Visible body text: "CALL OR TEXT / 541.703.3095",
"EMAIL / matt@ryan-realty.com". No street address printed in the visible contact-page body copy
(by design, the office is not a walk-in storefront). The address only appears in JSON-LD.
Matches canonical.

**Footer (every page).** `541.703.3095`, `matt@ryan-realty.com`, `Bend · Oregon` (no street
address shown), three social icons (Instagram, Facebook, YouTube, not all eight). The footer's
"Bend · Oregon" location text links to
`https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR`, a **generic Maps search
query**, not the canonical pinned `cid` URL from `BRAND.social.googleBusinessProfile`. It
resolves to the same listing today because the business name and city string are unambiguous,
but it is not the stable, disambiguated link the codebase already has on hand.

**Finding P-2** (minor, site-internal): the footer's "Bend · Oregon" GBP link uses a generic
search query instead of `BRAND.social.googleBusinessProfile`. Low risk today (it resolves
correctly), but not future-proof. A same-named competitor or a Maps re-index could break it
silently. Recommend swapping to the canonical `cid` link.

**`/reviews` page.** Headline stat: **"5.0 · 24 Google reviews."** JSON-LD carries 24 individual
`Review` nodes (author, body, rating, `datePublished`), newest `2026-05-18` (E Oster), oldest
`2019-11-01` (Charise Millard). This is a hand-curated, verified set, per the file's own header
comment, "ALL 24 verified Google testimonials," not a live API pull. See section 4 for the
currency gap this creates against the live GBP count.

---

## 3. Third-party profiles, what each currently shows

### 3a. Google Business Profile

Reached via the canonical Maps `cid` URL from the codebase (`BRAND.social.googleBusinessProfile`):
`https://maps.google.com/?cid=11038319841912529644`. Publicly viewable, no login. Verified live
2026-08-03.

| Field | GBP shows | Canonical | Match? |
|---|---|---|---|
| Name | Ryan Realty | Ryan Realty | ✅ |
| Category | Real estate agency | — | — |
| Address | 115 NW Oregon Ave Ste 2, Bend, OR 97703 | 115 NW Oregon Ave #2, Bend, OR 97703 | ✅ (Ste vs # is GBP's own unit-designator convention, not an error) |
| Phone | (541) 703-3095 | 541.703.3095 | ✅ |
| Website | ryan-realty.com | ryan-realty.com | ✅ |
| Plus code | 3M5P+JV Bend, Oregon | — | — |
| Rating / review count | **5.0 (25 reviews)** | site shows 24 | ⚠️ see section 4 |
| Hours | "Opens soon · 5 AM" badge shown on the listing card | — | ⚠️ see below |
| Owner update | Jul 18, 2026 market post (Bend buyer-tilt data) | — | live, current |
| Additional links | calendly.com | not part of canonical NAP | informational only |

**Finding P-3 (hours).** The Maps card's quick-glance status reads **"Opens soon · 5 AM."** A
5 AM opening time for a real-estate brokerage is very unlikely to be the intended configured
hours. It reads like either a default/placeholder value or a data-entry error in the Business
Profile hours field. I could not fully expand the hours table through the automated read in
this session, the side-panel "About" tab did not visibly render the day-by-day hours. **This is
not verifiable further without login**, so I am flagging it plainly rather than guessing at the
correct hours. Recommend Matt open Business Profile Manager directly and confirm or correct the
configured hours. Yelp, audited below, has them correctly as Monday through Friday 9:00 AM to
5:00 PM, closed Saturday and Sunday. That is probably the intended GBP value too, but I did not
verify GBP's stored hours value, only the "Opens soon" badge derived from it.

### 3b. Zillow

Reached via `https://www.zillow.com/profile/Ryan%20Realty%20Bend` (screen name "Ryan Realty
Bend," per `.auto-memory/reference_agent_portal_profiles.md`, audited 2026-06-10). Publicly
viewable, no login. Verified live 2026-08-03.

| Field | Zillow shows | Canonical | Match? |
|---|---|---|---|
| Agent display name | Matthew Ryan | Matt Ryan (display) / Matthew Ryan (legal, JSON-LD) | ✅ (both forms are legitimate, Zillow uses the legal-name register) |
| Brokerage | Ryan Realty LLC | Ryan Realty LLC | ✅ |
| Phone | (541) 703-3095 | 541.703.3095 | ✅ |
| Website | ryan-realty.com | ryan-realty.com | ✅ |
| Email | matt@ryan-realty.com (mailto link) | matt@ryan-realty.com | ✅ |
| Facebook | facebook.com/ryanrealtybend | facebook.com/ryanrealtybend | ✅ |
| Instagram | instagram.com/ryanrealtybend | instagram.com/ryanrealtybend | ✅ |
| TikTok | tiktok.com/@ryanrealtybend | tiktok.com/@ryanrealtybend | ✅ |
| YouTube | youtube.com/@ryanrealtybend | youtube.com/@ryanrealtybend | ✅ |
| Pinterest | pinterest.com/ryanrealtybend | pinterest.com/ryanrealtybend | ✅ |
| X / Twitter | **twitter.com/RyanRealtyBend** | x.com/ryanrealtybend | ⚠️ see below |
| LinkedIn | **linkedin.com/in/mattmryan/** (Matt's personal profile) | linkedin.com/company/ryan-realty-llc-bend-oregon (brokerage page) | ⚠️ see below |
| Rating / review count | **4.9, 10 reviews** shown in the profile header | site: 5.0 / 24 curated. GBP: 5.0 / 25 | ⚠️ see section 4 |
| Street address | not displayed on this page (Zillow's agent-profile template does not surface a street address field) | 115 NW Oregon Ave #2 | not verifiable on this surface |

**Finding P-4 (LinkedIn link).** Zillow's profile links "LinkedIn" to **Matt's personal profile**
(`linkedin.com/in/mattmryan/`), not the brokerage's company page
(`linkedin.com/company/ryan-realty-llc-bend-oregon`) that `BRAND.social.linkedin` and the site's
`sameAs` array both point to. Not necessarily wrong: Zillow's agent-profile template is built
around the individual agent, so a personal LinkedIn is arguably the more correct choice for
that specific field. But it is a genuine inconsistency against the canonical brokerage `sameAs`
set, worth a deliberate decision rather than an accident. Flagging as a decision point, not an
automatic fix.

**Finding P-5 (X/Twitter domain and casing).** Zillow's X link uses the legacy `twitter.com`
domain and mixed casing (`twitter.com/RyanRealtyBend`) versus the canonical `x.com/ryanrealtybend`.
Functionally the same account (`twitter.com` redirects to `x.com`, and X handles are
case-insensitive), so this resolves correctly today, but it is stale relative to the current
canonical form and worth tidying at the next Zillow profile edit.

**Finding P-6 (rating discrepancy, Zillow-internal).** The profile header badge reads **4.9**
average, while every individual review visible in the on-page carousel (10 shown) displays a
5.0 star row. This might be Zillow rounding across reviews not currently in the visible
carousel, or a review with a lower star count elsewhere in the full 10. **Not fully resolvable
without scrolling every review's individual star row.** I did not exhaustively verify each of
the 10 star ratings pixel by pixel. Flagging the surface-level tension between the 4.9 badge and
the visible 5.0 cards rather than asserting a cause.

### 3c. Yelp

Reached via `https://www.yelp.com/biz/ryan-realty-bend` (business ID `lECmqlZ91MzlgEA7QgGUBw` per
the 2026-06-10 audit memory). Publicly viewable, no login. Verified live 2026-08-03.

| Field | Yelp shows | Canonical | Match? |
|---|---|---|---|
| Name | Ryan Realty | Ryan Realty | ✅ |
| Claimed | Yes ("Claimed" badge) | — | ✅ |
| Category | Real Estate Agents | — | ✅ |
| Address | 115 NW Oregon Ave, Ste 2, Bend, OR 97703 | 115 NW Oregon Ave #2, Bend, OR 97703 | ✅ (Ste vs # is Yelp's own convention) |
| Hours | Monday through Friday 9:00 AM to 5:00 PM. Closed Saturday and Sunday | — | plausible correct hours, not independently verified elsewhere |
| Website | ryan-realty.com | ryan-realty.com | ✅ |
| **Phone** | **(541) 213-6706** | **541.703.3095** | ❌ **MISMATCH, see below** |
| Review count | 0 reviews ("Hey there trendsetter! You could be the first review for Ryan Realty") | GBP 25, site 24 | not comparable, Yelp and Google reviews are separate pools by design |
| About text | "Ryan Realty is Bend's principal-broker-owned brokerage. Three licensed brokers, Matt Ryan, Paul Stevenson, and Rebecca Peterson, with 12 years in Central Oregon real estate..." | consistent with brand voice, no banned words found | ✅ |

**Finding P-7 (phone, the one hard NAP mismatch found in this audit).** Yelp's listed phone
number is **541.213.6706**, the number that `lib/brand/contact.ts` explicitly retired to a
"private forward target only, off the public site" as of the 2026-06-24 Twilio cutover. Every
other surface checked in this audit (site JSON-LD, site footer, GBP, Zillow) shows
**541.703.3095**. Yelp is the one outlier.

**Important nuance before this gets "corrected":** the 2026-06-10 audit memory
(`.auto-memory/reference_agent_portal_profiles.md`) records that this was **deliberate**, not an
oversight. Matt's team set Yelp to 541.213.6706 specifically because "Yelp forbids tracked
numbers," and 541.703.3095 is a Twilio business line that records, logs, and forwards every call
(a call-tracking number by definition, see `lib/crm/twilio.ts`). If that Yelp policy is still in
effect, simply swapping in the canonical tracked number could put the listing at risk of a Yelp
compliance flag. **This needs a decision, not a mechanical find-and-replace.** See the
correction packet below.

---

## 4. Review velocity

Source: the 24 dated reviews in the live site's `/reviews` JSON-LD (each carries a verified
`datePublished`, cross-referenced against the GBP listing's visible review dates for the same
authors. For example, E Oster's review reads "2 months ago" on GBP and
`datePublished: 2026-05-18` on the site, consistent with today's date of 2026-08-03).

| Window | Reviews (site's 24 dated set) |
|---|---|
| Trailing 12 months (2025-08-03 to 2026-08-03) | 6: Stephen Graham (2025-08-28), Gary Timms (2025-08-29), Doug Millard (2025-10-03), Douglas Grant (2026-02-18), Audra Hedberg (2026-02-20), E Oster (2026-05-18) |
| Trailing 6 months | 3: Douglas Grant, Audra Hedberg, E Oster |
| Most recent | E Oster, 2026-05-18 (about 2 months ago, matches GBP's "2 months ago" label) |
| Gap since most recent | about 11 weeks with no new review captured on-site |

**GBP live count is 25. The site's curated set covers 24.** One live Google review exists that
is not yet mirrored into the site's hand-maintained review page and JSON-LD. I did not identify
the specific missing reviewer or date with certainty, the GBP side panel truncated before
showing the full 25-review list in this read-only session, and cross-referencing by name against
the 24 known entries was not conclusive from the visible portion. Stating this as a known gap
rather than guessing at the missing review's content.

**Pace read:** roughly one new Google review every 6 to 8 weeks over the trailing 12 months (6
reviews across about 12 months), all 5-star. Healthy but not fast. For context, review velocity
is one of Google's ranking signals for local pack visibility. A same-market competitor benchmark
was outside this audit's read-only, non-invasive scope (fine to do, but not requested here).

---

## 5. Correction packet, exact edits by platform

Every item below is a **recommendation for Matt to execute** (or approve someone executing) in
that platform's own dashboard. Nothing was changed by this audit, no OAuth grant, no login, no
edit, per the hard stop in this task and CLAUDE.md §1 class 4.

### Yelp (biz.yelp.com, business ID `lECmqlZ91MzlgEA7QgGUBw`)
1. **Phone field: `(541) 213-6706`, decide, don't default-swap.**
   - **Option A**: leave as-is if Yelp's call-tracking-number policy is still active and would
     flag `541.703.3095` as a forwarding number. Confirm the policy is still current (Yelp's
     terms on this have changed over time) before assuming it still applies.
   - **Option B**: if the policy no longer applies, or if Yelp accepts the number now that it is
     a ported primary business line and not a marketing-only tracking DID, update to
     `(541) 703-3095` for NAP consistency with every other surface. Name and phone edits on Yelp
     go through Yelp's own moderation review (per the 2026-06-10 note). Have the OREA license
     PDF and Oregon SOS registration ready as justification if asked.
   - This is the one field in the whole audit that is unambiguously inconsistent with the
     canonical NAP today. Everything else checked is either an exact match or a low-severity
     formatting or linking nuance.
2. Address, name, category, hours, website: no changes needed, all match canonical.
3. Consider Yelp's "License Verification" feature (OREA PDF already staged per the prior audit)
   and the still-empty photo/logo upload, both open items from 2026-06-10, unrelated to NAP but
   part of overall profile completeness.

### Zillow (`zillow.com/profile/Ryan%20Realty%20Bend`, Premier Agent dashboard)
1. **LinkedIn link**: decide whether the personal profile (`linkedin.com/in/mattmryan/`) or the
   brokerage company page (`linkedin.com/company/ryan-realty-llc-bend-oregon`) is the intended
   target for this field, then set it deliberately. If Zillow only supports one LinkedIn slot per
   agent, personal is defensible. If the intent is brand consistency with the site's `sameAs`
   set, switch it.
2. **X/Twitter link**: update from `twitter.com/RyanRealtyBend` to `x.com/ryanrealtybend` for
   consistency with the canonical form (cosmetic, both resolve today).
3. **4.9 vs 5.0 rating badge**: verify in the Premier Agent dashboard whether a lower-starred
   review exists outside the visible carousel. If all 10 reviews are genuinely 5.0, this may be
   a Zillow display or rounding artifact worth a support ticket, not something Matt can edit
   directly.
4. Name, brokerage, phone, website, email, and the other five social links: no changes needed.

### Google Business Profile (Business Profile Manager)
1. **Hours**: open the Profile Manager directly and confirm the configured hours. The public
   card currently surfaces "Opens soon · 5 AM," which does not read as an intended real-estate-
   office hour. If the intended hours are Monday through Friday, 9 to 5 (matching Yelp), correct
   them there.
2. Name, address, phone, website, category: no changes needed, all match canonical exactly.
3. **Review count**: no GBP-side action needed. GBP is the source of truth here, the site is the
   one that needs to catch up (next item).

### The site itself (`ryan-realty.com`), not a third-party platform, but the gap runs both ways
1. `/reviews` page: refresh the curated 24-review set to include the 25th live GBP review. Find
   it via a full Business Profile Manager reviews export rather than the truncated public read
   this audit used.
2. `app/sign/layout.tsx:26`, `app/home-valuation/actions.ts:366`,
   `app/lp/tetherow/heath/actions.ts:225`, `lib/tc/signing-emails.ts:28`: swap the hardcoded
   `541.213.6706` literals for `CONTACT.phoneDirect`, already the pattern used everywhere else.
   These four are baseline-grandfathered leftovers in `scripts/broker-facts-baseline.json`, not
   new debt.
3. Footer "Bend · Oregon" link: point at `BRAND.social.googleBusinessProfile` instead of the
   generic Maps search-query URL.
4. CLAUDE.md §2: update the phone-number guidance to reflect the 2026-06-24 Twilio cutover
   (541.703.3095 sole public number, 541.213.6706 private-only), matching what
   `lib/brand/contact.ts` already documents.

---

## 6. What could not be verified, stated plainly, not guessed

- **GBP's full configured hours table.** The public Maps card shows a derived "Opens soon · 5
  AM" status. The underlying day-by-day hours were not readable through the automated
  side-panel read in this session. Not verifiable without opening Business Profile Manager
  directly.
- **The identity of the 25th GBP review** not reflected in the site's 24-review curated set. The
  public Maps reviews panel truncated before the full list rendered in text form. Not guessing
  at its content. It needs a direct pull (Business Profile Manager or a full scroll session) to
  identify.
- **Whether Yelp's call-tracking-number policy still bars `541.703.3095`.** This was true as of
  the 2026-06-10 audit note, but platform policies change. Not re-verified against Yelp's
  current published terms in this session.
- **Homes.com, realtor.com, LinkedIn, and the other socials.** Out of this audit's stated scope
  (GBP, Zillow, Yelp only). The 2026-06-10 memory has partial state for these but is 53+ days
  old and should not be treated as current without a fresh pass.
- **Zillow's exact cause of the 4.9-vs-five-visible-5.0-reviews gap.** Flagged, not resolved. It
  would need every one of the 10 (or more, off-carousel) reviews individually inspected.

---

## Verification traces (§0 format)

- `115 NW Oregon Ave #2, Bend, OR 97703`: canonical NAP, `lib/brand/contact.ts:36-42`
  (BRAND.address). Cross-checked live in the homepage Organization JSON-LD 2026-08-03,
  cross-checked live on GBP (`115 NW Oregon Ave Ste 2, Bend, OR 97703`) and Yelp (`115 NW Oregon
  Ave, Ste 2, Bend, OR 97703`) 2026-08-03. All three match, modulo the Ste/# unit-designator
  convention.
- `541.703.3095`: canonical public phone, `lib/brand/contact.ts:81-82` (CONTACT.phoneDirect).
  Cross-checked live: site JSON-LD `+15417033095` match, site footer `+15417033095` tel link
  match, GBP `(541) 703-3095` match, Zillow `tel:(541) 703-3095` match, **Yelp `(541) 213-6706`
  mismatch**, all captured 2026-08-03.
- `5.0 · 24 Google reviews`: site `/reviews` page live text 2026-08-03, JSON-LD `review` array
  counted at 24 nodes.
- `5.0 (25 reviews)`: GBP listing live via `https://maps.google.com/?cid=11038319841912529644`,
  captured 2026-08-03.
- `4.9, 10 reviews`: Zillow profile header, `https://www.zillow.com/profile/Ryan%20Realty%20Bend`,
  captured 2026-08-03.
- `0 reviews`: Yelp business page, `https://www.yelp.com/biz/ryan-realty-bend`, captured
  2026-08-03.
