# Local citations checklist (manual execution)

Off-page authority is the dominant page-1 lever once on-page is strong (it is).
This is the **code-amenable** half: keep the brokerage NAP identical everywhere a
human claims a profile. Earned links / digital PR / outreach stay a strategy
decision, not a repo task — do NOT automate outreach (it produces spam-signal
links that hurt rankings).

## Canonical NAP — copy this EXACTLY on every profile
Source of truth: `lib/brand/contact.ts` (gate G38). If any of these change, change
them there first, then update every profile below.

- **Name:** Ryan Realty
- **Address:** 115 NW Oregon Ave #2, Bend, OR 97703
- **Phone (display / GBP / profiles):** 541.703.3095  *(the FUB-tracked bio number, so calls attribute)*
- **Website:** https://ryan-realty.com
- **Email:** the primary address in `CONTACT.email`

Same-as profile URLs (link these in every "social/website" field):
Instagram, Facebook, YouTube, TikTok, X, LinkedIn, Pinterest, Threads — all
`@ryanrealtybend` / `/ryanrealtybend` (see `lib/brand/contact.ts` SOCIAL_PROFILES).

## Claim / verify / NAP-check these (highest value first)
| Directory | Why | Status |
|---|---|---|
| Google Business Profile | The local-pack channel; highest-intent free seller lead source | claim + post weekly |
| Bing Places | Powers Bing + some AI answers | claim |
| Apple Business Connect | Apple Maps / Siri local results | claim |
| Zillow agent profile | Buyer + seller discovery, strong domain link | claim + complete |
| Realtor.com agent profile | Same | claim + complete |
| Homes.com agent profile | Same | claim + complete |
| Bend Chamber of Commerce | Local relevance + a real .org backlink | join + listing |
| Better Business Bureau | Trust signal + citation | claim |
| Yelp | Citation + reviews | claim |
| Nextdoor Business | Hyperlocal Bend reach | claim |

Rule: every profile must show the **identical** Name / Address / Phone above.
Inconsistent NAP across citations is the single most common thing that suppresses
local-pack ranking. The sitewide canonical Organization JSON-LD now carries the
full street NAP (`components/JsonLd.tsx`) so the site half is consistent.

## What is NOT in this checklist (strategy, Matt's call)
Earned backlinks, guest posts, local PR, sponsorships, association memberships,
link outreach. These move domain authority the most but are relationship work, not
a repo feature. Decide the few worth pursuing; do not scaffold automation for them.
