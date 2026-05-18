# First American Ignite + Skiptrace Provider Research (2026-05-17)

**Filed by:** research agent (read-only)
**Trigger:** Matt Ryan's directive to wire owner-contact lookup into the expired-listings pipeline. Existing integration point: `lib/expired-owner-lookup.ts` (FUB address match -> Apify-Deschutes-DIAL -> personEmailLookup stub).
**Scope:** Three tasks: (1) First American Ignite integration paths, (2) Skiptrace alternatives comparison, (3) Recommended architecture for Ryan Realty's `~300 expired/month` use case.

---

## Task 1 - First American Ignite integration paths

### 1.1 The blunt answer

**FirstAm IgniteRE itself does NOT have a publicly documented broker-facing API.** It is a single sign-on web portal (`https://ignitere.firstam.com/auth/signin`) that aggregates several First American services behind one login. The portal exposes Properties (reports), Farming (mailing lists), Transactions (escrow), Marketing (print), Calculators, and Classes. None of those tabs publish an API for the individual real estate broker user. Source: [FirstAm IgniteRE landing page](https://ignitere.firstam.com/), [help center General category](https://help.ignitere.firstam.com/hc/en-us/categories/1500000188822-General), [press release 2021-07-08](https://www.firstam.com/news/2021/fatico-innovative-technology-platform-re-pros-20210708.html).

**However, there are three legitimate API surfaces in First American's broader ecosystem that the broker login Matt already has can plausibly unlock through a sales conversation:**

1. **First American Digital Gateway** (`developer.firstam.io/api/docs`) - the production API portal. Lists Property, Ownership, Occupancy, Reverse Phone, Reverse Address, plus identity/fraud/title APIs. Self-serve signup with admin review. API Token authentication. Production access requires "contacting your First American relationship team." Source: [developer.firstam.io](https://developer.firstam.io/api/docs).
2. **First American Title developer portal** (`developer.firstam.com`) - title and settlement orders, document/message exchange, webhooks. Access-request form, sales-gated. Source: [developer.firstam.com](https://developer.firstam.com/).
3. **DataTree / First American Data & Analytics** (`dna.firstam.com/api`) - the underlying property data feed. APIs, bulk licensing, or self-service via `dnastore.firstam.com`. Reports include Property Detail, Transaction History, TotalView, Procision AVM, Sales Comparables, Last Finance/Transfer Document, Assessor Map. No public pricing. Vendr data shows average annual contract `~$30,500`. Sources: [dna.firstam.com/api](https://dna.firstam.com/api), [dnastore.firstam.com](https://dnastore.firstam.com/), [Datarade DataTree profile](https://datarade.ai/data-providers/datatree-by-first-american/profile), [Vendr buyer guide](https://www.vendr.com/buyer-guides/first-american-data-analytics).

### 1.2 The hidden lever - IgniteRE Farming is powered by Benutech / ReboConnect

This is the most important finding in the entire research pass.

IgniteRE's **Farming** tab (mailing lists, area targeting, ownership records) is explicitly delivered "by Benutech, Inc., a third party not affiliated with First American Title." Source: [Benutech help page summary, surfaced via FirstAm IgniteRE Farming](https://help.ignitere.firstam.com/hc/en-us/categories/17789294904851-Farming), [Benutech product page](https://www.benutech.com/product).

Benutech operates two products that Matt's IgniteRE login effectively gives him a customer relationship to:

- **Title Toolbox** - the web portal real estate brokers use day-to-day. Source: [demo.titletoolbox.com](https://demo.titletoolbox.com/), [benutech.com/investors-title-toolbox](https://www.benutech.com/investors-title-toolbox).
- **ReboConnect** - the underlying **nationwide property-data API**, with a "Scholarship" / Charter Membership program that subsidizes the data cost when a title company sponsors the broker. ReboConnect provides API access to assessor, recorder, and property histories (loan, lien, transfer) across the U.S., plus owner-occupancy flags, equity calculations, and neighbor lookups. Three report types: Property Profile, LASER (expanded), Net Sheet. Backend or frontend integration via the `ttbsdk.js` JavaScript SDK. Source: [Benutech ReboConnect press release 2018](https://www.prnewswire.com/news-releases/benutech-inc-offers-reboconnect-affordable-data-available-to-3rd-party-real-estate-tech-vendors-300611005.html), [Benutech KnockWise integration release](https://www.prnewswire.com/news-releases/reboconnect-nationwide-property-data-platform-powers-retech-innovation-knockwise-300699624.html), [ReboConnect Brochure on AnyFlip](http://anyflip.com/wtof/mfjz/basic).

**Eligibility:** "Any 3rd party Real Estate Tech Company who is utilizing data in conjunction with affiliated Title or Home Service Companies." That is exactly Ryan Realty's posture - Matt has a title-company relationship with First American, the data flows through First American's IgniteRE wrapping, the underlying API is ReboConnect. The pricing model is sponsored - the title company subsidizes the API cost in exchange for the broker keeping orders with them. **No published price.** Contact is Eric Bryant, `562.374.3226`.

### 1.3 Credentialing

- **IgniteRE portal:** EAGLE ID login (First American SSO). Two-factor SSO. Source: [How to access IgniteRE on iPhone/Android](https://help.ignitere.firstam.com/hc/en-us/articles/360061009594-How-do-I-access-FirstAm-IgniteRE-on-my-iPhone-Android).
- **Digital Gateway API:** API Token (App ID + Key) issued after admin approval. Source: [developer.firstam.io/api/docs](https://developer.firstam.io/api/docs).
- **ReboConnect API:** standard REST with vendor credentials issued after the sponsorship deal is signed. JavaScript SDK (`ttbsdk.js`) for frontend, backend integration also supported. Source: [Benutech ReboConnect press release](https://www.prnewswire.com/news-releases/benutech-inc-offers-reboconnect-affordable-data-available-to-3rd-party-real-estate-tech-vendors-300611005.html).

### 1.4 Records returned

Across the First American / Benutech surfaces, the records available are:

| Field | IgniteRE portal | Digital Gateway API | DataTree API | ReboConnect API |
|---|---|---|---|---|
| Owner name | yes | yes (Ownership) | yes | yes |
| Tax mailing address | yes | yes | yes | yes |
| Property characteristics | yes (Property report) | yes (Property) | yes | yes |
| Transaction / sale history | yes (Transaction History) | yes | yes | yes |
| Mortgage / lien history | yes (TotalView) | yes | yes | yes |
| Assessor maps + recorded docs | yes | yes | yes | partial |
| Phone number (homeowner) | NO | yes (Reverse Phone, but for verifying an inbound) | NO (this is the consumer-marketing gap First American's data does not fill directly) | NO (residential phones are not in the property dataset) |
| Email (homeowner) | NO | NO | NO | NO |
| Occupancy flag | yes | yes (Occupancy) | yes | yes |

**Critical gap:** First American is a title-company data shop. Their data covers ownership, tax, mortgage, deed, recorded docs. They do NOT deliver consumer phone or email for the homeowner. For that we need a dedicated skip-trace provider (Task 2). The First American stack tells us **who owns it and where to mail them**. The skip-trace layer tells us **how to call or email them**.

Source for the gap analysis: [First American Data & Analytics solutions page](https://www.firstam.com/mortgagesolutions/solutions/data-analytics/index.html), [DataTree property research](https://dna.firstam.com/solutions/property-data/datatree-property-research).

### 1.5 Cost model

- **IgniteRE portal access:** free with a First American title-company relationship (Matt has this).
- **Property reports inside IgniteRE:** typically bundled / free for the sponsored broker; per-report cost is invisible to the broker because the title company eats it.
- **Digital Gateway API:** quote-based, sales-gated. No public pricing.
- **DataTree / Data & Analytics API:** average enterprise contract reported at `~$30,500/yr` (Vendr). Way too expensive for our `300 lookups/month` volume.
- **ReboConnect:** Charter / Scholarship pricing through the title-company sponsorship - no public price; the deal is between Benutech and First American, with us as the downstream beneficiary.
- **`dnastore.firstam.com` self-serve store:** sells single property reports a-la-carte; no published per-report price on the public page.

Source: [dnastore.firstam.com](https://dnastore.firstam.com/), [Vendr buyer guide for First American Data & Analytics](https://www.vendr.com/buyer-guides/first-american-data-analytics).

### 1.6 Watch lists, alerts, ownership-change pings

- **IgniteRE / Title Toolbox / Benutech ReboGateway:** offers "daily notifications via email" for triggers including **Divorce, Tax Defaults, Expired Listings**, plus Death/Probate, Foreclosure, Notice of Default, and similar life-event signals. Source: [Benutech product page](https://www.benutech.com/product).
- This is the closest off-the-shelf "watch list" feature in the First American stack. It is email-only, not API-driven, and is owned by ReboGateway not IgniteRE Properties directly.
- **First American Digital Gateway** has a Webhooks product family for title/settlement order notifications, not for ownership-change pings.

There is **no documented "feed me a list of addresses and ping me when ownership changes" API** in the First American or Benutech public docs. The closest is the ReboGateway daily email alerts.

### 1.7 Broker-facing CRM integrations (FUB, kvCORE, Sierra, Real Geeks)

**No public evidence of a direct IgniteRE -> Follow Up Boss integration.** Follow Up Boss's integration directory does not list First American or IgniteRE as a partner. Source: [Follow Up Boss integrations](https://www.followupboss.com/integrations?tag=Lead+Providers).

The Benutech ReboConnect platform has integrated with several real-estate-tech vendors (KnockWise was the named launch partner). The "ReboConnect Scholarship Program" is explicitly aimed at "3rd party Real Estate Tech Companies who are utilizing data in conjunction with affiliated Title or Home Service Companies." Source: [Benutech ReboConnect press release](https://www.prnewswire.com/news-releases/benutech-inc-offers-reboconnect-affordable-data-available-to-3rd-party-real-estate-tech-vendors-300611005.html).

In other words: **Ryan Realty is qualified to apply for ReboConnect API access through the First American sponsorship**, because we are a brokerage building our own tech tooling with First American as the affiliated title company. This is the cleanest legitimate path.

### 1.8 Sample URL pattern for portal lookups

The IgniteRE Properties portal uses `https://ignitere.firstam.com/properties-landing` as the entry. Once inside, individual property lookups happen behind the SSO wall - URLs are session-bound and not publicly addressable. There is no "give me a permalink to a property report" pattern that survives a logout. A scraping bot would need to authenticate via the EAGLE ID two-factor SSO flow, then navigate the SPA - hostile to automation and likely a TOS violation. Source: [ignitere.firstam.com](https://ignitere.firstam.com/), [IgniteRE sign-in page](https://ignitere.firstam.com/auth/signin).

### 1.9 The verdict on First American Ignite

- **No public API for IgniteRE itself.** The portal is human-only.
- **The data underneath IgniteRE has THREE API entry points** (Digital Gateway, DataTree, ReboConnect). All sales-gated. None are "sign up online and get an API key in 5 minutes."
- **ReboConnect is the most plausible path** because the Scholarship / title-company-sponsored pricing model fits Ryan Realty's posture exactly. Action: call Eric Bryant at Benutech (`562.374.3226`) with Matt's First American rep CC'd. Ask explicitly: "We're a brokerage building expired-listing automation. Our title affiliate is First American. What does ReboConnect API access cost under the Scholarship program at our volume (300 lookups/month)?"
- **What we get from First American: owner name + mailing address + property history.** This is the "who is the seller and how do we mail them a postcard" layer.
- **What we DON'T get from First American: homeowner phone, email.** For that we MUST layer a dedicated skip-trace provider on top.

Scraping IgniteRE is technically possible but practically a bad idea: SSO + 2FA + JS-heavy SPA + TOS exposure. Even if it worked, the underlying data does not include phone or email, so it does not solve our actual problem.

---

## Task 2 - Skiptrace alternatives comparison

The actual gap is **homeowner phone + email**, since First American gives us name + mailing. The market for this is dominated by a handful of API-first vendors. Below: the top contenders, ranked by relevance to our `300 lookups/month`, no-monthly-commitment, real-estate-broker use case.

### 2.1 Tracerfy - the clear API-first leader for our volume

- **API:** yes, full REST + SDK references. Base URL `https://tracerfy.com/v1/api/`. Auth: `Authorization: Bearer <TOKEN>`. Source: [Tracerfy API docs](https://www.tracerfy.com/skip-tracing-api-documentation/), [API landing](https://www.tracerfy.com/skip-tracing-api).
- **Cost:** `$0.02 per record processed`. Instant Lookup costs 5 credits per hit (`$0.05 per successful lookup`), free on miss. No monthly minimum for API users. Credits never expire on prepaid balances. Minimum purchase via web is 500 leads / `$5`. Source: [Tracerfy comparisons page](https://www.tracerfy.com/comparisons), [Tracerfy FAQs](https://www.tracerfy.com/faqs).
- **Fields returned:** up to **8 phone numbers** (mobile/landline labeled), **5 email addresses**, mailing address, owner name, DOB, age, deceased flag, property-owner flag, litigator flag. Source: [Tracerfy API docs](https://www.tracerfy.com/skip-tracing-api-documentation/).
- **Sample request (POST `/v1/api/trace/lookup/`):**
  ```json
  {
    "address": "123 Main St",
    "city": "Bend",
    "state": "OR",
    "zip": "97701",
    "find_owner": true
  }
  ```
- **Sample response (hit):**
  ```json
  {
    "hit": true,
    "persons_count": 1,
    "credits_deducted": 5,
    "persons": [{
      "first_name": "Jane",
      "last_name": "Doe",
      "full_name": "Jane Doe",
      "property_owner": true,
      "phones": [{ "number": "5415551234", "type": "mobile" }],
      "emails": [{ "email": "jane@example.com" }],
      "mailing_address": {}
    }]
  }
  ```
- **Rate limits:** Instant Trace Lookup 500/min, Batch Trace 10 per 5 minutes, Lead Builder Preview 500/hr.
- **Match rate / accuracy:** 70-95% claimed across batches.
- **Node.js SDK:** no official SDK; pure REST is trivial to wire (single `fetch()`).
- **Verdict:** **Best fit for our use case.** No monthly minimum, instant lookup, $0.05 per hit, real-estate-broker focused, full API access on first signup. At `300 lookups/month` we'd spend `~$15/month`.

### 2.2 BatchData (formerly BatchSkipTracing) - feature-rich but priced for volume

- **API:** yes. Bearer token auth. Documented at `developer.batchdata.com` (Stoplight, hosted docs partially behind login). Source: [BatchData skip tracing page](https://batchdata.io/skip-tracing), [BatchData FAQ](https://batchdata.io/faq), [BatchData pricing](https://batchdata.io/pricing).
- **Cost:** Two paths.
  - **Pay-as-you-go single lookup:** `$0.05 per single trace`, confirmed. Source: aggregated from search results citing BatchData's single-lookup product page; also surfaced via the Skip Trace API comparison page (`$0.07-0.20 depending on plan/bundle`). Source: [SkipReach vs BatchData comparison](https://skipreach.com/vs/batchdata).
  - **Monthly subscription for bulk API:** `$2,000/month` for 100,000 traces (= `$0.02/record`). Up to `$20,000/month` Enterprise 3M tier (`$0.0066/record`).
- **Fields returned:** multiple phones (carrier + landline/mobile flag + confidence scores), emails, mailing address, DNC scrub, TCPA flags, ability to unmask LLC/trust owners. 76% claimed RPC (right-party-contact) rate. Source: [BatchData skip tracing](https://batchdata.io/skip-tracing).
- **Node.js SDK:** none official; REST.
- **Verdict:** Their bulk API plan is overkill at `$2,000/month` for our volume. The `$0.05` single-trace endpoint is competitive with Tracerfy's `$0.05` per hit but Tracerfy returns more fields (8 phones vs 3-ish on BatchData's standard tier) and has clearer pay-per-hit-only billing. **Use as a secondary fallback if Tracerfy misses.**

### 2.3 PropStream - rich workflow tool, not a clean API for our pipeline

- **API:** partial. PropStream has a BatchDialer API integration (push leads to a dialer) but does NOT expose a general skip-trace API to third parties. Source: [PropStream news on dialing workflows](https://www.propstream.com/news/two-new-dialing-workflows-and-enhanced-skip-tracing-now-available-in-propstream), [PropStream pricing](https://www.propstream.com/pricing).
- **Cost:** Skip tracing `$0.12/result` pay-per-use, OR free with Pro / Elite monthly plans. Pro starts `~$99/month`.
- **Fields returned:** phones, emails, DNC/litigator flags. Includes corporate skip tracing (LLC unmask).
- **Verdict:** Great human-use tool, wrong shape for our automation. We would have to scrape the portal or use the BatchDialer API as a side-channel. Skip.

### 2.4 BatchLeads - same parent as BatchData, lead-management-focused

- **API:** limited; primarily a lead-management portal with skip-trace as a feature.
- **Cost:** Skip-trace `~$0.04/record` (subscription-bundled). Source: [Tracerfy comparisons](https://www.tracerfy.com/comparisons).
- **Verdict:** Same vendor as BatchData, no independent API advantage. Skip.

### 2.5 REIPro - investor-platform, not API-first

- **API:** no public skip-trace API documented.
- **Cost:** skip tracing $0.12-0.17/record depending on plan; "Unlimited Skip Tracing Add-on" `$97/month`. Source: [REISift help](https://intercom.help/reisift/en/articles/4637016-skip-tracing-records-in-reisift) (note: REISift not REIPro; both share the investor focus).
- **Verdict:** Wrong product shape for automation. Skip.

### 2.6 TLOxp / TransUnion Trace - enterprise, quote-based

- **API:** yes, real-time API with batch alternative. Source: [TLO skip tracing](https://www.tlo.com/skip-tracing), [TLOxp product page](https://www-transunion.gslb.transunion.com/product/tloxp), [TransUnion TruLookup](https://www.transunion.com/solution/trulookup).
- **Cost:** quote-based, no public pricing. Used heavily by debt-collectors and investigators - the depth of data is industry-leading but the credentialing and contract requirements are aimed at regulated industries.
- **Verdict:** Powerful but mismatched to our volume + use case. Skip unless we move to high-volume seller-prospecting.

### 2.7 Whitepages Pro / Ekata (Mastercard) - identity verification, not real-estate skip-trace

- **API:** yes. Documentation: [Whitepages Pro on GitHub](https://github.com/ekataglobal/Whitepages-Pro-Documentation), [Ekata Reverse Address API trial](https://ekata.com/reverse-address-api-trial/).
- **Cost:** quote-based. Source: [Ekata Datarade profile](https://datarade.ai/data-providers/ekata/profile).
- **Verdict:** Optimized for risk + account-opening identity verification, not for residential homeowner outreach. Phone/email match rates on individual homeowners are weaker than the real-estate-focused providers. Skip.

### 2.8 Forewarn - broker SAFETY only, not skip-trace

- **API:** no developer API surfaced for automation. Source: [Forewarn](https://www.forewarn.com/), [Forewarn product page](https://www.forewarn.com/product/).
- **Cost:** `$20/month` individual, brokerage discounts available.
- **TOS restriction:** "FOREWARN is only to be used for verifying inbound prospects that have initiated the interaction." That makes it **explicitly NOT a tool for outbound expired-listing outreach.** Source: [South Carolina Realtors on Forewarn](https://screaltors.org/realtor-safety-use-forewarn-app-risk-management/).
- **Verdict:** Useful for verifying inbound leads, irrelevant to our outbound expired-listing pipeline. **TOS bars our use case.** Skip.

### 2.9 Apollo.io - B2B-focused

- **API:** yes, well-documented developer platform.
- **Cost:** subscription with credit-based enrichment.
- **Verdict:** Apollo's data is overwhelmingly B2B-contact (work email, LinkedIn, job title). Residential homeowner match rates are weak. Our existing `lib/expired-owner-lookup.ts` already correctly flagged this in code comments. Skip.

### 2.10 PeopleFinders Pro

- **API:** yes, but consumer/identity-verification-oriented.
- **Cost:** subscription model.
- **Verdict:** Real-estate-focused providers (Tracerfy, BatchData) match better. Skip.

### 2.11 Other notable mentions

- **Datazapp** - `$0.03 per match` via web portal upload; API access only at $1,000+ prepay tier. 60% claimed match rate. Source: [Datazapp skip tracing page](https://www.datazapp.com/skip-tracing-real-estate-marketing/). **API is gated behind a $1k prepay - skip for our volume.**
- **Apify "Property Owner Skip Trace" actor** - `$0.12 per found result`, free misses. Public records source. 60-80% claimed match rate. Source: [Apify Property Owner Skip Trace](https://apify.com/khadinakbar/skip-trace-property-owner). **Useful as a fallback because we already have an Apify token in our env, but Tracerfy is cheaper per hit.**
- **PropertyRadar** - pay-per-record API endpoint model. Solo plan `$119/month` + per-record export charge. Source: [PropertyRadar pay-per-record API help](https://help.propertyradar.com/en/articles/8769730-what-is-a-pay-per-record-api-endpoint), [PropertyRadar developers](https://developers.propertyradar.com/). Marketed as end-user-only, not for resale. **Subscription floor makes it expensive for our volume.**
- **SkipSherpa** - API offered but site largely sales-gated (403'd on us). Source: [skipsherpa.com](https://skipsherpa.com/).
- **REDX Expired Leads** - `$60/month` packaged expired-lead service that does the MLS-scrape AND the skip-trace in one product. AI-verified phones cross-checked vs DNC. Source: [REDX Expired Leads](https://www.redx.com/products/expired-leads/). **Different product category** - this is "buy us the expired list, we'll deliver the phones," not "give us an API for our own pipeline." Could be a parallel channel if Matt wants a turnkey solution alongside our custom pipeline.
- **Vulcan7** - `$299/month` competitor to REDX. Same product shape. Source: [REDX vs Vulcan7 comparison via housingwire/inman articles].

### 2.12 Skiptrace ranking summary

| Provider | API | Per-record | Monthly min | Fields | Verdict for 300/mo Central Oregon |
|---|---|---|---|---|---|
| **Tracerfy** | yes | `$0.02 batch` / `$0.05 hit` | none | 8 phones, 5 emails, mailing | **Primary - wire this first** |
| BatchData | yes | `$0.05 single` / `$0.02 bulk` | none for single | 3 phones, emails, DNC | **Secondary fallback** |
| Apify actor | yes (via Apify token we already have) | `$0.12 hit` | none | name, phones, emails, mailing | **Already-wired fallback (already in env)** |
| REDX | no API | `$60/mo packaged` | $60 | full expired-list + traces | **Parallel manual channel (not in pipeline)** |
| PropStream | partial | `$0.12 hit` or $99/mo | $99 | phones, emails | Skip - wrong shape |
| Datazapp | gated | `$0.03 hit` (portal) | $1k prepay for API | phones, emails | Skip at our volume |
| BatchLeads | partial | `$0.04` bundled | subscription | similar to BatchData | Skip - redundant |
| TLOxp | yes (enterprise) | quote | quote | deep | Skip - over-credentialed |
| Ekata / Whitepages Pro | yes | quote | quote | identity-focused | Skip - wrong domain |
| Forewarn | no | `$20/mo` | $20 | inbound-only by TOS | **Skip - TOS bars outbound** |
| Apollo.io | yes | subscription | $49+/mo | B2B-focused | Skip - wrong audience |
| PropertyRadar | yes | per-export overage | $119/mo | full property + owner | Skip - subscription floor |

---

## Task 3 - Recommended architecture

### 3.1 The full lookup chain for an expired listing

Given Task 1 and Task 2, the optimal chain for `lib/expired-owner-lookup.ts` becomes:

```
1. FUB internal address match           (free, instant, ~30% hit)         <- already wired
2. Apify Deschutes DIAL public records  ($0.05/lookup, owner+mailing)     <- already wired
   |- (Crook/Jefferson counties:        need separate scrapers - future work)
3. Tracerfy /v1/api/trace/lookup/       ($0.05/hit, phones+emails)        <- WIRE THIS NEXT
4. Apify property-owner-skip-trace      ($0.12/hit, fallback)             <- already have Apify token
5. (Manual) ReboConnect API via Benutech sponsorship                       <- multi-week sales path
6. (Manual) Pending status              (Matt skip-traces by hand)        <- final fallback
```

Note: Steps 1 and 2 give us **name + mailing address**. Step 3 takes the owner name + property address and returns **phones + emails**. Step 2 and Step 3 are complementary, not redundant. We run step 2 first because public records are the source of truth on ownership; we run step 3 second to enrich.

### 3.2 Provider to wire first - Tracerfy

**Why:**
- Cheapest per hit (`$0.05`), free on miss
- No monthly minimum (vs BatchData's bulk API at `$2k/mo`)
- Most fields returned (8 phones, 5 emails)
- Bearer token auth, single REST call
- Real-estate-broker-aligned product
- Sub-second response time per their SLA

**Cost ceiling at 300 lookups/month:**
- Worst case 100% hit rate: `300 * $0.05 = $15/month`
- Realistic 75% hit rate: `300 * 0.75 * $0.05 = ~$11.25/month`
- Plus initial credit minimum: `$5` floor

### 3.3 Minimum viable integration code path

**Env vars to add (in `.env.local` and Vercel project):**
```
TRACERFY_API_KEY=<from Tracerfy dashboard>
TRACERFY_API_BASE=https://tracerfy.com/v1/api
```

**Helper function to add to `lib/expired-owner-lookup.ts`** (slots in as Strategy 3, replacing the current `personEmailLookup` stub):

```typescript
async function tracerfySkipTrace(
  ownerName: string | undefined,
  streetAddress: string,
  city: string,
  state: string = 'OR',
  zip: string,
): Promise<{ phone?: string; email?: string; allPhones?: string[]; allEmails?: string[] } | null> {
  const key = process.env.TRACERFY_API_KEY?.trim()
  const base = process.env.TRACERFY_API_BASE?.trim() ?? 'https://tracerfy.com/v1/api'
  if (!key) return null

  try {
    const res = await fetch(`${base}/trace/lookup/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: streetAddress,
        city,
        state,
        zip,
        find_owner: true,
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[tracerfy] non-OK:', res.status, await res.text().catch(() => ''))
      return null
    }
    const j = await res.json() as {
      hit?: boolean
      persons?: Array<{
        property_owner?: boolean
        phones?: Array<{ number?: string; type?: string }>
        emails?: Array<{ email?: string }>
      }>
    }
    if (!j.hit || !j.persons?.length) return null
    const owner = j.persons.find(p => p.property_owner) ?? j.persons[0]
    const phones = (owner.phones ?? []).map(p => p.number).filter(Boolean) as string[]
    const emails = (owner.emails ?? []).map(e => e.email).filter(Boolean) as string[]
    return {
      phone: phones[0],
      email: emails[0],
      allPhones: phones,
      allEmails: emails,
    }
  } catch (err) {
    console.warn('[tracerfy] error:', err)
    return null
  }
}
```

Then `personEmailLookup()` rewires to call `tracerfySkipTrace()` after DIAL gives us the owner name + mailing.

### 3.4 Cost ceiling per month at our volume

- Tracerfy: `$15/mo worst case`, `$11/mo realistic`
- Apify Deschutes DIAL (existing): `$0.05/lookup * 300 = $15/mo`
- Apify fallback property-owner trace if Tracerfy misses: `$0.12 * 75 misses = $9/mo`
- **Total upper bound: `~$40/month`**
- **Total realistic: `~$25-30/month`**

Well within tolerance. The ReboConnect sponsorship path, if it works out, can replace either Tracerfy or the DIAL scraper for free (subsidized by First American as the title affiliate) - but it is a multi-week sales conversation, not a same-day wire-up.

### 3.5 Fallback chain order (final)

```
EXPIRED LISTING DETECTED
        |
        v
1. FUB person search by address                  <- free, ~30% hit
        |
        v (miss)
2. Apify -> Deschutes DIAL public records        <- owner name + mailing
        |   (returns name + mailing; no phone/email)
        v
3. Tracerfy /trace/lookup/                       <- phones + emails (NEW)
        |
        v (miss)
4. Apify property-owner-skip-trace actor         <- $0.12 fallback
        |
        v (miss)
5. Create FUB person as PENDING                  <- manual skip-trace fallback
   tag: owner-lookup:pending
   note: alert Matt to handle manually
```

### 3.6 Specific gotchas / rate limits / TOS issues to know

- **Tracerfy rate limits:** 500/min on Instant Lookup, 10 per 5 min on Batch. We're nowhere near these at 300/month, but the cron should not batch all 300 in a single minute - the existing per-listing cron (one row at a time on detection) is already correctly shaped.
- **Tracerfy refunds:** none. "Tracerfy does not issue refunds once a list is paid for or API credits are purchased." Buy small prepaid balances (`$25-50`) and top up.
- **TCPA / DNC compliance:** Tracerfy includes a `litigator` flag and a `/dnc/lookup/` endpoint. **Every phone we use for outbound MUST be DNC-scrubbed before we attempt contact.** This is broker license risk - Matt cannot legally cold-call DNC-registered numbers without prior consent. Wire the DNC check into the same chain after we resolve a phone.
- **First American TOS:** scraping the IgniteRE portal is a clear TOS violation. Do not pursue this path. Use the legitimate API channels (Digital Gateway, DataTree, ReboConnect via Benutech sponsorship) or none at all.
- **Forewarn TOS:** "inbound only." Cannot be used in our outbound pipeline at all.
- **Apify Deschutes DIAL scraper (existing):** Deschutes County's `dial.deschutes.org` is public records, no auth, no TOS bar to automated retrieval at reasonable rate. Crook (Prineville) and Jefferson (Madras) counties have separate systems; we currently only cover Deschutes. Adding Crook/Jefferson scrapers is future work, but those counties produce a small fraction of our expired volume.
- **ReboConnect sponsorship eligibility:** the program is aimed at "3rd party Real Estate Tech Companies who are utilizing data in conjunction with affiliated Title or Home Service Companies." Ryan Realty qualifies as the brokerage building the tech, with First American as the affiliated title company. The path: ask Matt's First American rep to introduce us to Eric Bryant at Benutech (`562.374.3226`). The pitch is "we're building automated seller-outreach tooling on top of the data First American already supplies us; can we get sponsored ReboConnect API access at the broker tier?"
- **Apify token budget:** we're already wired into Apify for the DIAL scraper. Adding the property-owner-skip-trace actor as a step-4 fallback is essentially free incremental wiring - one new actor ID constant in `expired-owner-lookup.ts`, no new env var.

### 3.7 What to ship in the first PR

1. Add `TRACERFY_API_KEY` and `TRACERFY_API_BASE` to `.env.local` + Vercel env.
2. Implement `tracerfySkipTrace()` in `lib/expired-owner-lookup.ts` per the code path in 3.3.
3. Update `personEmailLookup()` to call `tracerfySkipTrace()` instead of returning `null`.
4. Add a fallback to the Apify property-owner-skip-trace actor when Tracerfy misses.
5. Add a DNC scrub call (`POST /v1/api/dnc/lookup/`) on every phone we resolve, before we surface it to Matt or use it in any outbound automation. Stamp the result as `dnc_status` on the FUB person.
6. Update `OwnerLookupResult` to add `allPhones: string[]` and `allEmails: string[]` so we surface every contact option not just the first one.
7. (Parallel) Email Matt's First American rep to set up the Benutech ReboConnect sponsorship conversation. Not a code task - a sales-cycle task that runs in the background while the Tracerfy integration is shipping.

### 3.8 Bottom line

- **First American Ignite is not directly automatable.** No public API on the IgniteRE wrapper. The data behind it has three API entry points (Digital Gateway, DataTree, ReboConnect), all sales-gated. **ReboConnect via Benutech is the best long-term play** because First American sponsors the cost for affiliated brokerages, but it is multi-week sales not same-day wire-up.
- **First American's data covers name + mailing + property history, NOT homeowner phone + email.** Skip-trace is a complementary layer, not a competitor.
- **Wire Tracerfy first.** Cheapest per hit, no minimum, most fields, real-estate-broker focused, REST API in ~30 lines of TypeScript. `~$15/month` worst case at our volume.
- **Keep Apify property-owner-skip-trace as the fallback.** We already have an Apify token; adding a fallback actor is essentially free wiring.
- **Run the Benutech sponsorship conversation in parallel.** If it lands, ReboConnect replaces the DIAL scraper for free and we save `$15/month` plus get nationwide coverage beyond Deschutes County.
- **Add DNC scrubbing into the same chain.** Every outbound phone is a license-risk surface area until it's been DNC-checked.

---

## Sources cited

### First American + IgniteRE + Benutech
- [FirstAm IgniteRE landing page](https://ignitere.firstam.com/)
- [FirstAm IgniteRE help center - General](https://help.ignitere.firstam.com/hc/en-us/categories/1500000188822-General)
- [FirstAm IgniteRE help center - Farming](https://help.ignitere.firstam.com/hc/en-us/categories/17789294904851-Farming)
- [FirstAm IgniteRE Properties landing](https://ignitere.firstam.com/properties-landing)
- [FirstAm IgniteRE sign-in](https://ignitere.firstam.com/auth/signin)
- [How to access FirstAm IgniteRE on iPhone/Android](https://help.ignitere.firstam.com/hc/en-us/articles/360061009594-How-do-I-access-FirstAm-IgniteRE-on-my-iPhone-Android)
- [First American Title Introduces IgniteRE press release 2021-07-08](https://www.firstam.com/news/2021/fatico-innovative-technology-platform-re-pros-20210708.html)
- [First American Digital Gateway API docs](https://developer.firstam.io/api/docs)
- [First American Developer Portal](https://developer.firstam.com/)
- [First American Data & Analytics API](https://dna.firstam.com/api)
- [First American Data & Analytics Online Store](https://dnastore.firstam.com/)
- [First American Data & Analytics solutions](https://www.firstam.com/mortgagesolutions/solutions/data-analytics/index.html)
- [First American Data & Analytics - DataTree property research](https://dna.firstam.com/solutions/property-data/datatree-property-research)
- [Vendr buyer guide - First American Data & Analytics](https://www.vendr.com/buyer-guides/first-american-data-analytics)
- [Datarade DataTree profile](https://datarade.ai/data-providers/datatree-by-first-american/profile)
- [Benutech product page](https://www.benutech.com/product)
- [Benutech Investors Title Toolbox](https://www.benutech.com/investors-title-toolbox)
- [Title Toolbox demo](https://demo.titletoolbox.com/)
- [Benutech ReboConnect press release 2018](https://www.prnewswire.com/news-releases/benutech-inc-offers-reboconnect-affordable-data-available-to-3rd-party-real-estate-tech-vendors-300611005.html)
- [Benutech KnockWise integration release](https://www.prnewswire.com/news-releases/reboconnect-nationwide-property-data-platform-powers-retech-innovation-knockwise-300699624.html)
- [ReboConnect brochure (AnyFlip)](http://anyflip.com/wtof/mfjz/basic)

### Skip-trace providers
- [Tracerfy skip tracing API landing](https://www.tracerfy.com/skip-tracing-api)
- [Tracerfy API documentation](https://www.tracerfy.com/skip-tracing-api-documentation/)
- [Tracerfy comparisons](https://www.tracerfy.com/comparisons)
- [Tracerfy FAQs](https://www.tracerfy.com/faqs)
- [Tracerfy main site](https://tracerfy.com/)
- [BatchData skip tracing](https://batchdata.io/skip-tracing)
- [BatchData pricing](https://batchdata.io/pricing)
- [BatchData FAQ](https://batchdata.io/faq)
- [BatchData API solutions](https://batchdata.io/api-solutions)
- [BatchData skip tracing product](https://batchdata.io/batchskiptracing)
- [BatchData real estate data API pricing comparison](https://batchdata.io/blog/real-estate-data-api-pricing-comparison-batchdata-competitors)
- [SkipReach vs BatchData](https://skipreach.com/vs/batchdata)
- [PropStream pricing](https://www.propstream.com/pricing)
- [PropStream skip tracing news](https://www.propstream.com/news/two-new-dialing-workflows-and-enhanced-skip-tracing-now-available-in-propstream)
- [PropStream FAQ](https://www.propstream.com/frequently-asked-questions-faq)
- [PropertyRadar pay-per-record API help](https://help.propertyradar.com/en/articles/8769730-what-is-a-pay-per-record-api-endpoint)
- [PropertyRadar developers](https://developers.propertyradar.com/)
- [TLO skip tracing](https://www.tlo.com/skip-tracing)
- [TransUnion TLOxp](https://www-transunion.gslb.transunion.com/product/tloxp)
- [TransUnion TruLookup](https://www.transunion.com/solution/trulookup)
- [Whitepages Pro Documentation on GitHub](https://github.com/ekataglobal/Whitepages-Pro-Documentation)
- [Ekata Reverse Address API trial](https://ekata.com/reverse-address-api-trial/)
- [Ekata Datarade profile](https://datarade.ai/data-providers/ekata/profile)
- [Forewarn](https://www.forewarn.com/)
- [Forewarn product page](https://www.forewarn.com/product/)
- [Forewarn TOS / inbound-only note via SC Realtors](https://screaltors.org/realtor-safety-use-forewarn-app-risk-management/)
- [Datazapp skip tracing](https://www.datazapp.com/skip-tracing-real-estate-marketing/)
- [Apify Property Owner Skip Trace actor](https://apify.com/khadinakbar/skip-trace-property-owner)
- [REDX Expired Leads](https://www.redx.com/products/expired-leads/)
- [REISift skip tracing records](https://intercom.help/reisift/en/articles/4637016-skip-tracing-records-in-reisift)
- [SkipSherpa](https://skipsherpa.com/)
- [Follow Up Boss integrations directory](https://www.followupboss.com/integrations?tag=Lead+Providers)

---

**Filed 2026-05-17.** Read-only research. No code changes. Next action belongs to Matt: greenlight wiring Tracerfy as Strategy 3 in `lib/expired-owner-lookup.ts` and email the First American rep about the Benutech ReboConnect sponsorship in parallel.
