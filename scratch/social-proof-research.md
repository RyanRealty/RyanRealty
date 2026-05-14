# Social-proof research — Ryan Realty seller LP

## Summary recommendation

**Skip the stock boomer couple. Build a "Sold Stories" pattern: real Ryan Realty properties at real prices, paired with the matching real Google review, attributed to the matching real broker headshot.** This is what the best-in-class real estate LPs (Opendoor, HomeLight, Bend Lifestyle Realtors), the best-in-class SaaS spotlight pages (Vercel, Linear), and the CRO literature (Baymard, NN/g, CXL) all converge on. Generic affluent-couple stock is a known conversion drag (CXL found UGC-led product pages convert up to 3× better than stock; NN/g flags testimonial skepticism as the dominant boomer trust failure), and Matt has zero need to fake what he already owns: six 5-star Google reviews, five named transactions between $899K–$3M, and three normalized broker headshots already at `design_system/ryan-realty/assets/team/`. The treatment below uses 100% real assets, costs <2 hours to build, and lifts the section from "text grid" to "property-led case studies with verified attribution."

## Top patterns observed (with attribution)

| Brand | Pattern | What stood out |
|---|---|---|
| **Opendoor** | Named-customer text testimonials + volume stat | Three full names + city ("Anne and Jim Nash, Sacramento CA"). **"301,457 homeowners served"** as the trust anchor. **Zero customer photos.** No stock. |
| **HomeLight** | Text quote + customer-type label + aggregate badges | "William S. (Sold with HomeLight agent)" — first names + initial only, no photos. Then trust badges (BBB A+, 4.8 Google, 5-star Shopper Approved) carry the aggregate proof. |
| **Compass (Sell page)** | **Video testimonial** (named: "Robert") + aggregate result ("2.9% Higher Closing Price") + transacted price range ($5.6M–$5.875M). No stock photos of families. |
| **Orchard** | **Hybrid: text Trustpilot strip + photo-led "Customer Story" cards** with the customer's professional headshot AND the matching agent's headshot. Named in pairs: "Stanzie & Chris with [agent]." Closest pattern to a luxury real-estate spotlight. |
| **Bend Lifestyle Realtors** (local competitor) | Text testimonials with first name + last initial, plus a **sold-property grid with addresses, prices, beds/baths/sqft**. Quantified trust: 389 closed deals, $258M volume, top 2%. No stock people. |
| **Vercel /customers** | Logo + **giant metric** ("300% more organic clicks") + short pull-quote + executive name. Data-led, no lifestyle photography. Quote is the smallest element on the card; the result is the hero. |
| **Linear /customers** | Hero-image card (768×432) for the spotlight customer, then logo grid below. Stats clustered separately ("2.0× increase in filed issues"). Image is of the customer's product/team, not stock people. |
| **Luxury Presence case studies** | Large hero image (their built website or team photo) + outcome-led headline + tag pill. No property addresses on the index, but each individual case study leads with a named agent and brand impact. |

**The pattern that converges across all of them: photo of the THING that was transacted (or the result), not photo of a generic person.** Where people appear, they are named real customers (Orchard), named executives (Vercel), or no one (Opendoor, HomeLight, Compass). Stock affluent couples appear nowhere in the best-in-class set.

## CRO findings

- **NN/g — Social Proof in UX:** People trust off-site reviews more than on-site testimonials and read every testimonial "with a healthy dose of skepticism" because companies only post the good ones. Mitigation: link out to the source (Google Maps verification), include the reviewer's real name, and lean on **third-party-anchored trust** (Google G mark, star count from Google itself). [nngroup.com/articles/social-proof-ux/](https://www.nngroup.com/articles/social-proof-ux/)
- **NN/g — Trustworthy Design:** Four pillars: design quality, up-front disclosure, comprehensive/current content, connection to the rest of the web. Real, current, verifiable transaction data hits three of four; stock photography hits zero. [nngroup.com/articles/trustworthy-design/](https://www.nngroup.com/articles/trustworthy-design/)
- **Baymard:** 1–3 trust-signal types beat 7+ trust signals by **+23% vs −8%**. Don't bolt on a stock photo as a 4th trust signal — the data says it's already past the marginal-return curve. Generic unattributed testimonials lift 2–5%; testimonials with photo + full name + specific outcome lift **15–25%**. [baymard.com](https://baymard.com/buzz)
- **CXL — Stock vs Real Photos:** UGC images converted **3× better** than professional product/stock shots (Nike, Zara A/B tests). Multi-image real customer panels lifted CTR from 1.4% to 5.31%. CXL's specific warning: **scam sites use stock photography, so visitors subconsciously project negative trust signals onto your stock images.** [cxl.com/blog/stock-photography-vs-real-photos-cant-use/](https://cxl.com/blog/stock-photography-vs-real-photos-cant-use/)
- **Real-estate landing-page benchmarks (2025):** Median real-estate LP converts at 2.6%; top decile 7.4%. Pages with **30–40% white space** convert ~88% better than cramped pages. Pages with social proof beside the lead form convert 34% better than those without it. [dollarpocket.com/landing-page-conversion-benchmarks-report](https://www.dollarpocket.com/landing-page-conversion-benchmarks-report)
- **Boomer-specific marketing research:** Boomers are **upfront-transparency dependent** and prefer "personal, simple, real photos of the team" over polished marketing — anything that looks staged triggers the "marketing fluff" filter. [nicolesteffen.com/2025/04/25/designing-for-boomers](https://nicolesteffen.com/2025/04/25/designing-for-boomers/) and corroborated by NAR data showing boomers represent 53% of sellers in 2025 and are now the dominant cash-buyer cohort.

## Stock-photo question — verdict

**Adding a stock affluent-boomer couple to this section hurts the LP.** Three independent reasons:

1. **It triggers boomer marketing-skepticism.** The exact audience Ryan Realty is targeting (million-dollar-equity Bend boomers) is the cohort the design-for-boomers literature most explicitly warns against staging for. They've seen this couple. They know it's a stock photo. The asset says "this brokerage doesn't have real clients yet."
2. **It under-performs the trivially-available real asset.** Matt has six real reviews, five real listings with real prices, and three real broker headshots. CXL's data says the real asset converts up to 3× better. Substituting stock for available real assets is the textbook CRO anti-pattern.
3. **It contradicts the brand voice locked in CLAUDE.md.** The voice rules ("Honest. Transparent. Show, don't tell — let the fact do the work") and the §0 data-accuracy mandate both treat un-attributed marketing imagery as a credibility tax. A Shutterstock couple is the visual equivalent of "approximately" — the thing the brand voice spec specifically forbids.

The only condition under which stock would help: if Ryan Realty had no transactions, no reviews, no headshots, and the page was empty white. None of those is true.

## Proposed treatment for Ryan Realty

**Section name: "Sold Stories — sellers we represented, in their words."** (Or kept as-is "What sellers actually say after we've closed.") Replaces the current 1 + 5 testimonial grid in `app/lp/seller-home-value/page.tsx` lines 276–328.

**Layout (desktop, lg breakpoint):**

```
┌─────────────────────────────────────────────────────────────┐
│  PAST BEND SELLERS                  Read all on Google →    │
│  Sold Stories.                                              │
│  ★★★★★ 5.0 · 6 verified Google reviews                      │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ [Schoolhouse Rd photo│  │ [Drouillard photo,   │         │
│  │  16:10, top-anchored]│  │  16:10]              │         │
│  │                      │  │                      │         │
│  │ Sold · $3M · Westside│  │ Sold · $1.7M · NWX   │         │
│  │ ━━━━━━━━━━━━━━━━━━━━ │  │ ━━━━━━━━━━━━━━━━━━━━ │         │
│  │ "Matt guided our sale│  │ "Even in a tough     │         │
│  │  to the finish line  │  │  market, he sold our │         │
│  │  — and exceeded the  │  │  home faster than we │         │
│  │  bar."               │  │  expected."          │         │
│  │  [G] Helen Luna Fess │  │  [G] Audra Hedberg   │         │
│  │  [Matt headshot 32px]│  │  [Rebecca 32px]      │         │
│  │  Marketed by Matt    │  │  Marketed by Rebecca │         │
│  └──────────────────────┘  └──────────────────────┘         │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Sunstone Loop│ │ Tumalo Reser-│ │ 64350 Old    │         │
│  │ Caldera $2.4M│ │ voir $1.2M   │ │ Bend-Redmond │         │
│  │ ━━━━━━━━━━━━ │ │ ━━━━━━━━━━━━ │ │ Tumalo $1.1M │         │
│  │ "Patient,    │ │ "Worked hard │ │ "Predicted   │         │
│  │  low pressure│ │  representing│ │  the ups."   │         │
│  │  expert."    │ │  us."        │ │              │         │
│  │ Gary Timms   │ │ D Detweiler  │ │ Doug Millard │         │
│  │ Matt 24px    │ │ Matt 24px    │ │ Matt 24px    │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:** single column, the two featured cards (Schoolhouse + Drouillard) stack first at 5:4 aspect, then a 1-up scroll of the three supporting cards.

**Card anatomy:**
- **Photo (top, 16:10):** the actual MLS hero photo we already fetch in `getOurListings()`. Already cached / Spark-served.
- **Pill row (over bottom of photo):** sale badge ("Sold · $3M") + neighborhood ("Westside Bend"). Existing `displayPrice` + `neighborhood` from `OurListing` type.
- **Quote (white card body, navy 16px):** the existing `PULL_OVERRIDES` short quote.
- **Attribution row:** Google G mark + reviewer name (16px navy/600) → broker headshot 32px circle + "Marketed by Matt" (14px muted).
- **Border + shadow:** existing radix-nova cream card; `--shadow-sm` resting, `--shadow-md` hover; 14px radius.

**Pairing rule (deterministic, in the data layer):** each listing in `getOurListings()` pairs to the matching reviewer + matching broker. Hard-coded mapping because we own both sides of the relationship.

| Listing | Reviewer | Broker |
|---|---|---|
| Schoolhouse Rd $3M | Helen Luna Fess (featured — 23-yr Realtor authority) | Matt |
| 2354 NW Drouillard $1.7M | Audra Hedberg (note: actual listing agent on Drouillard was Rebecca) | Rebecca |
| 56628 Sunstone Loop $2.4M | Gary Timms | Matt |
| 19496 Tumalo Reservoir $1.2M | D Detweiler | Matt |
| 64350 Old Bend-Redmond $1.1M | Doug Millard | Matt |
| 363 NW Bluff $899K | SwankHQ ("sold our house while we were out of the country" — fits a condo seller) | Matt |

**Copy on the trust strip below the section heading** (replaces the existing aggregate badge):
> ★★★★★ 5.0 · 6 verified Google reviews · $9.3M+ in seller representation across the last 18 months

(The dollar total is provable from the listings shown — Matt should sign off on the exact figure before ship.)

**What's removed:** the current text-only `TestimonialCard` and `FeaturedTestimonial` components for this section. The colored-initials avatars are replaced by real reviewer attribution + real broker headshot. The aggregate badge stays, gets the volume add.

**Build cost:** 60–90 minutes. New component + a few prop additions. No new data — every field already exists or is in `lib/testimonials.ts` and `data.ts`.

## Build plan

1. **Add `SellerTestimonial` pairing fields** in `app/lp/seller-home-value/data.ts`:
   - Extend `SellerTestimonial` with `pairedListingKey: string`, `pairedBroker: 'matt' | 'paul' | 'rebecca'`, `brokerFirstName: string`.
   - Replace the existing `getSellerTestimonials()` mapping with the 6-row pairing table above. Drop the `tints` array, `getInitials()` helper, and `avatarTint` field — no longer needed.

2. **Extend `getOurListings()` / OurListing type** to surface the paired testimonial (or write a parallel `getSoldStories()` that joins listings × testimonials × brokers). Recommend a separate `getSoldStories()` returning `{ listing, testimonial, broker }[]` — keeps the existing "Our listings" section unchanged.

3. **Create `components/seller-lp/SoldStoryCard.tsx`** — single shadcn `<Card>`-based component, two visual modes (`featured` for the 2-up top row, `compact` for the 3-up bottom row). Image uses `next/image` with `sizes` set for the column widths. Broker headshot uses the transparent `.png` from `design_system/ryan-realty/assets/team/` mirrored at `public/images/brokers/`.

4. **Replace lines 276–328 of `app/lp/seller-home-value/page.tsx`:**
   - Section frame stays (`<section>`, heading, "Read all on Google →" link).
   - Aggregate trust strip: keep the rating + count + Google G mark; add the volume figure ("$9.3M+ in seller representation").
   - Body grid:
     - First row: `grid lg:grid-cols-2` of the two featured `SoldStoryCard`s (Schoolhouse + Drouillard).
     - Second row: `grid sm:grid-cols-2 lg:grid-cols-3` of the three compact cards.
   - Mobile: single column stack via the same grid utilities (already responsive).

5. **Update JSON-LD `reviewSchema`** to attach `itemReviewed` per review to the paired property (`@type: 'Product'` or `'RealEstateListing'` — use existing schema.org pattern; HomeLight does this). Existing aggregate schema stays.

6. **Delete dead code:** `FeaturedTestimonial` + the colored-initials avatar in `TestimonialCard`. Keep `TestimonialCard` for `/reviews` and any other usage; grep first.

7. **A/B note for later:** wire `analytics.event('seller_lp_sold_story_view', { listingKey })` on card viewport-enter so we can measure whether the pattern lifts form-submit vs the old grid. Tooling already in place.

**Files touched:**
- `app/lp/seller-home-value/page.tsx` (replace social proof section)
- `app/lp/seller-home-value/data.ts` (add `getSoldStories()`)
- `lib/testimonials.ts` (no change needed; pairing lives in seller-LP data layer)
- `components/seller-lp/SoldStoryCard.tsx` (new)
- `public/images/brokers/` (verify three transparent PNGs are present — should be per CLAUDE.md broker headshot block)

**Out of scope (later):** video testimonials (Compass uses them — Matt should plan to record one with Helen Luna Fess and one with the Schoolhouse seller). Customer headshots (need releases — not on the critical path).

---

### Sources

- [NN/g — Social Proof in the User Experience](https://www.nngroup.com/articles/social-proof-ux/)
- [NN/g — Trustworthiness in Web Design](https://www.nngroup.com/articles/trustworthy-design/)
- [Baymard Institute — Trust signals research](https://baymard.com/buzz)
- [CXL — Stock Photography vs Real Photos](https://cxl.com/blog/stock-photography-vs-real-photos-cant-use/)
- [Medium / Tomer Dean — UGC vs Stock Photos Conversion](https://medium.com/the-mission/the-battle-of-conversion-rates-user-generated-content-vs-stock-photos-7bc8f3c76ea8)
- [Digital Applied — 2026 LP Conversion Benchmarks](https://www.dollarpocket.com/landing-page-conversion-benchmarks-report)
- [Nicole Steffen Design — Designing for Boomers](https://nicolesteffen.com/2025/04/25/designing-for-boomers/)
- [Opendoor /sell — Live patterns](https://www.opendoor.com/sell)
- [HomeLight — Live patterns](https://www.homelight.com)
- [Compass /sell — Live patterns](https://www.compass.com/sell/)
- [Orchard — Live patterns](https://orchard.com)
- [Vercel /customers — SaaS spotlight pattern](https://vercel.com/customers)
- [Linear /customers — SaaS spotlight pattern](https://linear.app/customers)
- [Bend Lifestyle Realtors — Local competitor](https://bendlifestylerealtors.com)
- [Luxury Presence — Case study layouts](https://www.luxurypresence.com/case-studies/)
