# FUB Agent Link + Expired Listings LP — Research

**Date:** 2026-05-17
**Status:** Research findings. Implementation not yet executed.

---

## TASK 1 — FUB Agent Link: what it is + how we wire it

### Bottom line up front

There is **no single FUB feature called "Agent Link" with a personal vanity URL**. What Matt is describing is implemented across three FUB primitives, all of which we already partially use:

1. **`assignedTo` field on `/v1/events`** — the API-level "this lead belongs to this agent" knob. ([FUB Lead Provider Integration Guide](https://docs.followupboss.com/docs/lead-provider-integration-guide))
2. **Real Estate Lead Metadata `<meta>` spec** — HTML meta tags including `lead_assigned_agent` that FUB parses from inbound emails. ([leadmetadata.org](https://www.leadmetadata.org/), [FUB Using Lead Metadata](https://help.followupboss.com/hc/en-us/articles/4402378498071-Using-Lead-Metadata))
3. **FUB Lead Flow source-based routing** — UI rules that match on `source` / `sourceUrl` and auto-assign to a specific user. ([FUB Lead Flow Overview](https://help.followupboss.com/hc/en-us/articles/360014570494-Lead-Flow-Overview), [Advanced Lead Flow Rules](https://help.followupboss.com/hc/en-us/articles/360014656033-Lead-Flow-Advanced-Lead-Flow-Rules))

The mechanism Matt described ("tracked with a hashtag and then their user name") closely matches the **`?agent=rebecca` query-param** + **`assignedTo` API field** pattern. Below: the exact wiring.

### What our existing code already supports

`lib/followupboss.ts` already implements broker-attribution end-to-end via `sendEvent({ brokerAttribution: { brokerSlug, brokerEmail } })`:

- `resolveAssignedUserIdWithSource(slug)` — slug → FUB userId via env map (`FOLLOWUPBOSS_BROKER_USER_MAP`) or live email lookup (`/v1/users?email=`)
- `applyBrokerAttribution(...)` — after `POST /v1/events`, runs a `PUT /v1/people/{id}` that sets `assignedUserId` and merges a `broker:<slug>` tag
- `FOLLOWUPBOSS_REQUIRE_BROKER_ASSIGNMENT=1` enforces a hard fail if attribution can't resolve

This is the same mechanism a "personal URL" would use. The only thing missing is **wiring it to a URL convention** so a broker's ad can carry their slug all the way from ad click → landing page → form submit → FUB lead.

### The URL pattern to standardize on

Two equivalent options. **Pick the query-param form** — it's the convention every real-estate site uses (`?agent=rebecca`) and it survives every redirect, social share, and analytics tool.

```
https://ryan-realty.com/lp/seller-home-value?agent=rebecca
https://ryan-realty.com/lp/seller-home-value?agent=paul
https://ryan-realty.com/?agent=rebecca
```

A path-based form (`/r/rebecca/...`) is cleaner-looking but requires a separate Next.js route group and breaks deep-linking from ads. Query-param is the right call.

The existing `/team/[slug]` route ALREADY identifies the broker by path. Form submissions from `/team/rebecca-peterson` should auto-attribute. The new pattern adds the same capability to non-broker pages (`/lp/seller-home-value`, `/`, `/cma-request`, etc.) via `?agent=<slug>`.

### How the agent gets assigned (the data flow)

```
1. Ad creative URL → ryan-realty.com/lp/seller-home-value?agent=rebecca
2. Landing page reads ?agent= → stores in `rr_attrib_agent` cookie (30-day TTL) + hidden form field
3. Form submit → POST /api/lead-landing with { agent: "rebecca", ... }
4. Server action calls sendEvent({
     ...,
     brokerAttribution: { brokerSlug: "rebecca", brokerEmail: <looked up from Supabase brokers> }
   })
5. FUB receives /v1/events → person created → PUT /v1/people/{id} { assignedUserId, tags: ["broker:rebecca"] }
6. Person now sits in Rebecca's "My Leads" smart list in FUB UI
```

The `applyBrokerAttribution()` path in `lib/followupboss.ts` already does steps 4–6. The new work is steps 1–3.

### What needs to change in code

**1. URL-param capture** (new file `lib/agent-attribution.ts`):

```typescript
// Reads ?agent= from URL on first page hit, persists to cookie + sessionStorage.
// Used by every form submit handler to pass brokerSlug through to sendEvent.

const VALID_AGENTS = new Set(["matt-ryan", "rebecca-peterson", "paul-stevenson"])
const COOKIE = "rr_attrib_agent"
const TTL_DAYS = 30

export function captureAgentFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const param = new URLSearchParams(window.location.search).get("agent")
  if (!param) return null
  const slug = param.trim().toLowerCase()
  if (!VALID_AGENTS.has(slug)) return null
  document.cookie = `${COOKIE}=${slug}; path=/; max-age=${TTL_DAYS * 86400}; samesite=lax`
  try { window.sessionStorage.setItem(COOKIE, slug) } catch {}
  return slug
}

export function readAttributedAgent(): string | null {
  if (typeof window === "undefined") return null
  try {
    const ss = window.sessionStorage.getItem(COOKIE)
    if (ss) return ss
  } catch {}
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}
```

**2. Server-side read** (extend `app/actions/lead-landing.ts` and `app/lp/seller-home-value/actions.ts`):

```typescript
import { cookies } from "next/headers"

const COOKIE = "rr_attrib_agent"
const BROKER_EMAILS: Record<string, string> = {
  "matt-ryan": "matt@ryan-realty.com",
  "rebecca-peterson": "rebecca@ryan-realty.com",
  "paul-stevenson": "paul@ryan-realty.com",
}

async function readAttributedAgentServer(): Promise<{ slug: string; email: string } | null> {
  const slug = (await cookies()).get(COOKIE)?.value?.trim().toLowerCase()
  if (!slug || !BROKER_EMAILS[slug]) return null
  return { slug, email: BROKER_EMAILS[slug] }
}

// In submitLeadLandingForm():
const attributedAgent = await readAttributedAgentServer()
await sendEvent({
  type: "Seller Inquiry",
  source: websiteSource(),
  // ... existing fields ...
  brokerAttribution: attributedAgent
    ? { brokerSlug: attributedAgent.slug, brokerEmail: attributedAgent.email }
    : undefined,
})
```

**3. Trigger capture** (one-line addition to a top-level client component in `app/layout.tsx` or wherever `FollowUpBossPixel` mounts):

```typescript
"use client"
import { useEffect } from "react"
import { captureAgentFromUrl } from "@/lib/agent-attribution"

export function AgentAttributionCapture() {
  useEffect(() => { captureAgentFromUrl() }, [])
  return null
}
```

**4. `/team/[slug]` page already attributes by route** — extend `BrokerContactForm` to pass `brokerSlug={slug}` through to its server action so a submit from Rebecca's profile page auto-routes to Rebecca even without `?agent=`.

### FUB UI setup required

**None.** This is API-driven. The brokers (Matt, Rebecca, Paul) already exist as FUB users. The `FOLLOWUPBOSS_BROKER_USER_MAP` env var is already wired in `lib/followupboss.ts` (lines 114–126). Optionally, set up a single Lead Flow rule in FUB UI with default = "round-robin (Matt, Rebecca, Paul)" so any lead that arrives WITHOUT `brokerAttribution` still gets distributed — this is the failsafe.

### Where this overlaps with `lead_assigned_agent`

The `lead_assigned_agent` HTML meta-tag spec ([leadmetadata.org](https://www.leadmetadata.org/)) is for **emails** that FUB parses from connected inboxes — Zillow / Realtor.com / Trulia send leads as emails with `<meta name="lead_assigned_agent" content="Rebecca Peterson" />` tags in the head. FUB reads the meta, creates the person, assigns to that user. This is NOT how website forms reach FUB — those go through `/v1/events` and use `assignedTo` / `assignedUserId`. The meta-tag spec only matters if we ever want to forward a parsed inbound seller email TO our FUB inbox.

### Source URLs

- [FUB Lead Provider Integration Guide](https://docs.followupboss.com/docs/lead-provider-integration-guide) — `assignedTo` field documentation
- [FUB Lead Flow Overview](https://help.followupboss.com/hc/en-us/articles/360014570494-Lead-Flow-Overview)
- [FUB Advanced Lead Flow Rules](https://help.followupboss.com/hc/en-us/articles/360014656033-Lead-Flow-Advanced-Lead-Flow-Rules)
- [FUB Direct Team Lead Routing](https://help.followupboss.com/hc/en-us/articles/360015220474-Direct-Team-Lead-Routing-by-Lead-Providers)
- [FUB Using Lead Metadata](https://help.followupboss.com/hc/en-us/articles/4402378498071-Using-Lead-Metadata)
- [leadmetadata.org spec](https://www.leadmetadata.org/)
- [FUB Pixel Overview](https://help.followupboss.com/hc/en-us/articles/360037775174-Follow-Up-Boss-Pixel-Overview)
- [FUB Pixel Setup AgentFire](https://help.followupboss.com/hc/en-us/articles/360047562793-Pixel-Setup-AgentFire)

---

## TASK 2 — Expired Listings Landing Page: content + voice spec

### Sentiments to address (and how to address them without finger-pointing)

| What the owner is feeling | The empathetic response that lands |
|---|---|
| **Frustration the home didn't sell.** They put in months of effort, decluttering, showings, weekends out of the house. | Name the feeling without dwelling. "Your home was on the market for X months. It didn't sell. That's a real outcome to sit with, not a small thing." Then pivot to what's actually fixable. |
| **Embarrassment toward neighbors, family, the buyer pool.** A "WITHDRAWN" sign feels like a public-facing failure. | Reframe as data. Withdrawn means the property + market + strategy didn't line up — not that anything is wrong with the home. Show that most expired listings re-list and sell within 90 days under the right plan. |
| **Distrust of agents.** The previous agent said it would sell. It didn't. They went quiet for weeks. | Don't position against the prior agent. Don't say "most agents do X, we do Y." Just describe what an honest re-list looks like: weekly updates with no chasing, a specific price thesis, a contractor plan if needed, the seller seeing every offer. |
| **Anger at price drops they were pushed into.** They may have dropped twice and still didn't get an offer. | Acknowledge that price isn't the only lever. Bend has homes that sat at $895K for 90 days and sold at $890K under different photography, staging, and timing. Price is one of five variables; sometimes it's not the broken one. |
| **Confusion about what marketing actually got done.** They have no visibility into what their previous agent did or didn't do. | Offer a free marketing audit of the prior listing — a one-page review covering photo quality, MLS description, Zillow / Realtor.com syndication, days-since-last-update, social posts run, open houses, agent showings. Just facts, no editorial. |
| **Fatigue.** They may be at the point of pulling off the market entirely or renting it out. | Name that as a legitimate option. The honest answer is that re-listing isn't always right. A 20-minute conversation can tell you whether re-list, rent, or hold is the move. We don't push one direction. |
| **The market may have changed under them.** A listing that went up in January 2026 hit a different inventory level than one that goes up in June. | Show the actual MoS data for their neighborhood at the time of original list vs now. Specific number, specific source. Lets them see the market context without anyone editorializing. |

### Reference URLs — what good looks like

**Solid empathetic examples (use as structural reference, NOT voice reference):**

1. **[Team Coyle — Why Listings Expire and What Homeowners Can Do Next](https://theteamcoyle.com/expired-listings/)** — Best structural example found. Diagnostic-not-judgmental opening ("An expired listing is frustrating, but it's also actionable"), six clean failure causes, four-step relaunch framework, FAQ section, and ends with "Team Coyle is here to offer a confidential consultation." The word "confidential" earns trust. No urgency language.

2. **[Jeffrey Halpern — Yikes... Your Home Didn't Sell?](https://jeffreyhalpern.randrealty.com/2025/09/02/yikes-your-home-didnt-sell-how-to-turn-an-expired-listing-into-sold)** — Opens with "You're not alone." Personal CTA (phone + email), not a form. The headline tone is a touch casual ("Yikes") which won't fit Ryan Realty voice, but the validation pattern is right.

3. **[Robert DeFalco Realty — Why Your Home Didn't Sell](https://www.defalcorealty.com/blog/why-your-home-didnt-sell/)** — Good data integration (specific stats per cause), partnership framing ("show exactly why" not "we'll fix it"). Slips into slop at the end ("aggressive digital marketing") — that part we ignore.

4. **[Prestige Team — Expired Listing: Why didn't my house sell?](https://prestigeteamhomes.com/expired-listing-why-didnt-my-house-sell/)** — Opens "We're often left with a bitter feeling when we try to do something and it doesn't work out." That's the right register: name the feeling, then move on. Five clean failure causes. Slips into self-promotion at the end ("sold more homes faster than 95% of agents") — we ignore that.

5. **[Keeping Current Matters — What To Do When Your House Didn't Sell](https://www.keepingcurrentmatters.com/2024/07/01/what-to-do-when-your-house-didnt-sell)** — Industry-standard but voice-y. Useful structurally: five reasons, each with a quotable line. We can copy the structure of five-discrete-causes-with-data without copying the tone.

### Bad patterns to avoid (and where we saw them)

- **Opendoor's "[Can't Sell My House](https://www.opendoor.com/articles/cant-sell-my-house-why-its-happening-and-how-to-fix-it)"** delegitimizes the seller's emotions ("Your home holds memories, but letting emotions dictate decisions can hurt negotiation outcomes") and then sells cash offers. That's a manipulation pattern, not empathy. We don't do that.
- **The "stunning solution" CTA pattern** seen across multiple competitor pages — "Discover the value of our award-winning marketing approach." Editorializing without information. Banned by voice §4.7.
- **The "most agents do X, we do Y" comparison frame** ([NowBAM](https://nowbam.com/how-to-land-expired-listings-without-sounding-salesy/) actively warns against this). Banned by voice §6.4 "Dramatic before-and-after."

### Recommended page structure (in order)

1. **Hero block** — 80–120 words. Name the situation without judgment. Set up the page as a free diagnostic, not a pitch. CTA: book a 20-minute consultation.
2. **What we know about expired listings in Bend** — 3 specific stats from our Supabase data (e.g., "of the 47 SFR listings that expired in Bend / Redmond / Sisters in 2025, 31 re-listed within 90 days. Of those, 22 sold within 60 days of re-list.") Sourced. Verified. No estimates.
3. **The five things that usually broke** — Price, photos / staging, MLS description quality, syndication and exposure, agent responsiveness. One paragraph each. Specific. No editorializing.
4. **What an honest re-list looks like at Ryan Realty** — Not a sales pitch. A description: free marketing audit of the prior listing, written price thesis with comps, photography and staging plan if needed, weekly written progress reports, every offer reviewed with the seller.
5. **What re-list ISN'T always the right move** — Sometimes the answer is hold, rent, or wait. We tell you which.
6. **CTA block** — Three paths: 20-minute phone call, written audit of the prior listing (no commitment), or in-person walkthrough. Real options, real timelines.
7. **FAQ** — 4 questions: how long does this take, what does it cost (free), do you need exclusivity to do the audit (no), what if I'm not ready to re-list yet (we're not the right partner if you don't actually need one).

### First-draft hero block — 200-300 words

(Self-checked against voice §4.7. No em-dashes. No banned words. No exclamation marks. The reader is the subject. Specifics over flattery. No "we are passionate." Tested against the §4.7 "Practical patterns that fail" list — zero matches.)

---

> ## Your listing expired. Here's an honest read on what to do next.
>
> Your home was on the market. It didn't sell. The listing came down, the sign is gone, and the offers you were expecting never came in. That's a real outcome to sit with.
>
> Most of the time, an expired listing is not about the home. It's about one or two specific things that broke in the way it was priced, presented, or marketed. Sometimes it's three. The good news is that those are knowable, and they're fixable.
>
> We do a free diagnostic on every expired listing in Bend, Redmond, Sisters, and the surrounding area. It's a written one-page audit of your prior listing covering pricing against the comparable sales in your neighborhood at the time, photo and staging quality, the MLS description, where it was syndicated and how often it was updated, and how the agent actually engaged with the buyer pool. You get the audit either way, whether or not you re-list with us.
>
> If the audit says the right move is to wait, rent, or hold, we'll tell you that. If it says re-list, we'll walk you through what would change, what it would cost, and what the realistic timeline looks like.
>
> No pressure. No long pitch. A 20-minute conversation, on the phone or in person.
>
> **Talk to us about your expired listing**
> 541.213.6706 · ryan-realty.com

---

### Recommended CTA copy (three forms — pick one or rotate)

- **Primary (low-friction):** "Get a free written audit of your prior listing. No commitment."
- **Phone-first:** "Call us at 541.213.6706. A 20-minute conversation, no pitch."
- **Calendly / form (if used):** "Pick a time that works. We'll come prepared with comps for your block."

### What we explicitly do NOT do on this page

- No "expired? Most agents would..." comparison framing
- No "act fast — your home value is dropping every week" urgency
- No countdown timer, no scarcity copy
- No video pop-up or chat-bubble interruption
- No "limited consultations available" language
- No "we are a small business that cares about you" overt characterization (per §4.7 rule 4)
- No "let us guide you through your real estate journey" (per §6.3 banned phrases)
- No "we have a proven track record" (per §6.3 marketing slop)
- No exclamation marks anywhere on the page

### Source URLs

- [Team Coyle — Why Listings Expire](https://theteamcoyle.com/expired-listings/) — structural reference
- [Jeffrey Halpern — Your Home Didn't Sell](https://jeffreyhalpern.randrealty.com/2025/09/02/yikes-your-home-didnt-sell-how-to-turn-an-expired-listing-into-sold) — validation pattern
- [Robert DeFalco Realty — Why Your Home Didn't Sell](https://www.defalcorealty.com/blog/why-your-home-didnt-sell/) — data integration
- [Prestige Team — Why didn't my house sell?](https://prestigeteamhomes.com/expired-listing-why-didnt-my-house-sell/) — emotional opener
- [Keeping Current Matters — What To Do When Your House Didn't Sell](https://www.keepingcurrentmatters.com/2024/07/01/what-to-do-when-your-house-didnt-sell) — five-reason structure
- [Opendoor — Can't Sell My House](https://www.opendoor.com/articles/cant-sell-my-house-why-its-happening-and-how-to-fix-it) — example of pattern to avoid
- [NowBAM — How to Land Expired Listings Without Sounding Salesy](https://nowbam.com/how-to-land-expired-listings-without-sounding-salesy/) — anti-salesy guidance
- [Homelight — Why Isn't My Home Selling?](https://www.homelight.com/blog/why-isnt-my-home-selling/) — buyer-side research patterns
- [The Close — Expired Listing Letters](https://theclose.com/expired-listing-letter/) — outreach voice (for comparison)
- [Voice §4.7 Authentic, not salesy](../marketing_brain_skills/brand-voice/voice_guidelines.md) — internal voice rule the hero block was checked against

---

## Implementation order (recommendation)

1. **Wire `?agent=<slug>` capture** (1–2 hours) — net-new module + 4 server actions touched. No FUB UI work. Existing `lib/followupboss.ts` `brokerAttribution` does the heavy lift.
2. **Stand up `/lp/expired-listing` route** with the hero block above. Use the existing lead-landing infrastructure (`app/actions/lead-landing.ts`) so it carries broker attribution automatically.
3. **Pull live Bend / Redmond / Sisters expired-listing stats** from Supabase for the "what we know" section. Verification trace required per CLAUDE.md §0.
4. **Draft-first per CLAUDE.md §0.5** — copy goes in front of Matt before commit. No auto-push of the LP.
