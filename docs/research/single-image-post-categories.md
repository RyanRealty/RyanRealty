# Single-Image Instagram Post Categories — Top Luxury Real Estate Accounts

**Research date:** 2026-05-14
**Method:** Apify `apify/instagram-post-scraper` against 10 luxury real estate accounts (hiltonhyland, theagencyre, douglaselliman, aaronkirman, coldwellbankerluxury, sothebysrealty, theoppenheimgroup, nestseekers, compass, serhant), pulling the latest 24 posts each (round 1) + a top-up scrape of 60 posts each on the 5 accounts that yielded zero singles in round 1.
**Total posts scraped:** 516 across the two scrapes.
**Single-image posts isolated:** 10 (1.9% of all scraped posts).

---

## HEADLINE FINDING — read this first

**Top luxury real estate accounts have essentially abandoned the single-image post.** Across 516 recent posts from 10 of the most-followed luxury / brokerage accounts in the country, only **10 were single-image** posts — under 2%. The rest split **70% carousels (Sidecar)** and **30% reels (Video)**.

Of the accounts queried, **5 of 10 did not publish a single single-image post in their last 24 (or 60) posts at all**: theagencyre, sothebysrealty, nestseekers, serhant, and aaronkirman beyond a single LA500 cover. Compass alone produced 40% of the single-image sample (4 of 10).

**Implication for Ryan Realty:** the strategic question isn't "what 10 single-image templates do we need?" — it's "which 2–3 post categories actually NEED to be single-image (because a carousel or reel would be overkill or off-tone)?" The data below answers that.

---

## What single-image posts ARE used for (the 10 actual posts)

Here's every single-image post that came back, with categorization:

| # | Account | Shortcode | Category | Date |
|---|---|---|---|---|
| 1 | aaronkirman | DYP3t6KhoPm | **Press feature** (LA500 cover, 9th year) | 2026-05-12 |
| 2 | douglaselliman | DYM8ntRD5b2 | **Quote card** (CEO Liebowitz "Monday Mindset") | 2026-05-11 |
| 3 | compass | DUj2CsojOkK | **Executive announcement** (Neda Navab named President) | 2026-02-10 |
| 4 | compass | DYUdPDoygYV | **Branded ad / drive-to-site** (Search Compass.com vs Zillow) | 2026-05-14 |
| 5 | coldwellbanker | DX7G4BmjlNo | **Brag stat / accomplishment** ($260M/day luxury sales) | 2026-05-04 |
| 6 | hiltonhyland | DT4FMmuDM-d | **Agent intro / new hire** (Payton Bahk welcome) | 2026-01-24 |
| 7 | compass | DXwn6bDnMw0 | **Branded ad / partnership** (Compass × Rocket Mortgage offer) | 2026-04-30 |
| 8 | compass | DXuLSZMHKEw | **Agent intro / team-join + press** (Lupe Kemper, SF Biz Times) | 2026-04-29 |
| 9 | douglaselliman | DXrmOfzDhSm | **Executive announcement** (Lena Johnson new President) | 2026-04-28 |
| 10 | theoppenheimgroup | DUJgKbbEgGH | **Recruiting / "we're hiring"** | 2026-01-30 |

---

## Categories that appeared (frequency-ranked)

### 1. Agent intro / new hire / executive announcement — **5 of 10 (50%)**
The single largest use of the single-image format. Examples:
- **compass DUj2CsojOkK** — Neda Navab named President. Polished headshot + serif italic-style name in white "Neda Navab" + sans subtitle "President of Compass Brokerage" + tiny vertical "COMPASS" logo top-right. Background gently blurred greenery.
- **douglaselliman DXrmOfzDhSm** — Lena Johnson new President. Editorial headshot of subject in snakeskin blazer against a gallery wall. Caption carries the title (no overlay text on the image itself — pure portrait).
- **hiltonhyland DT4FMmuDM-d** — Welcome Payton Bahk. Subject cut-out on full navy `#102742` background w/ subtle line-pattern; brokerage wordmark "HILTON & HYLAND," large sans + ALL-CAPS rules. Phone, email, license # in lower-right block.
- **compass DXuLSZMHKEw** — Lupe Kemper team joining + SF Business Times press badge. Portrait + branded pill ("SAN FRANCISCO BUSINESS TIMES") top-center + italic-serif "Compass Welcomes East Bay Team" + "COMPASS In the Press" footer.
- **theoppenheimgroup DUJgKbbEgGH** — Recruiting ("Now Expanding Our Team"). Editorial-magazine layout: drone landscape top, then black panel w/ red brush-stroke OG logo, italic-serif headline, all-caps subhead, hairline divider, paragraph body, email CTA. Reads like a print ad.

**Treatment notes:** Centered around a high-quality portrait. Italic-serif display type ("Neda Navab," "Compass Welcomes…") is the dominant typographic convention. Brand logo small + bottom (Compass, Douglas Elliman) or large + top-right (Hilton & Hyland). Photo + overlay are integrated — never just a portrait with no design layer.

### 2. Quote card — **1 of 10 (10%)**
- **douglaselliman DYM8ntRD5b2** — Michael S. Liebowitz "Monday Mindset" quote. Subject in seated portrait against ocean window. White italic-serif pull quote with `"` `"` smart quotes, attribution block in sans uppercase + role line, Douglas Elliman wordmark with diamond mark bottom-right.

**Treatment notes:** Quote sits on the photo at ~50% Y, italic serif, white text, soft text-shadow for legibility. Speaker portrait functions as the canvas. Wordmark always lower-right, low contrast.

### 3. Press feature — **1 of 10 (10%)**
- **aaronkirman DYP3t6KhoPm** — LA Business Journal cover ("LA500, 9 YEARS"). This is literally a magazine cover that the agent reposted. Massive serif "LA500" wordmark, "Los Angeles Business Journal" masthead, italic-serif "9 YEARS ON THE LA500" pull line, full-bleed portrait of subject.

**Treatment notes:** Mimics a real magazine cover layout. Editorial-serif typography (Caslon / Didone weight). High personal-vanity / credibility post.

### 4. Brag stat / accomplishment / hard data — **1 of 10 (10%)**
- **coldwellbanker DX7G4BmjlNo** — "$260 million in daily luxury sales." Ultra-thin sans display "$260 million" stretched across a dim cinematic interior shot (a freestanding tub in a wood-paneled bath). Tiny "Global Luxury" circle mark bottom-right. Disclaimer footnote at the very bottom in 8pt sans.

**Treatment notes:** ONE huge number is the post. Photo is moody background (low-light interior, never bright real-estate-listing-photo lighting). Thin sans typography (looks like Helvetica Now Display Thin or similar). Tiny logo. **No CTA. The number IS the message.**

### 5. Branded ad / drive-to-site / partnership — **2 of 10 (20%)**
- **compass DYUdPDoygYV** — "SEARCH COMPASS.COM FOR THOUSANDS OF HOMES NOT ON ZILLOW." All-caps serif over a daylight residential exterior photo. Bottom band white w/ Compass wordmark + URL. Tiny rotated footnote on the left edge ("Based on National Data…").
- **compass DXwn6bDnMw0** — Compass × Rocket Mortgage offer. Serif italic "Thinking About Buying A Home?" headline, frosted-glass panel with "1% lower rate | $6,000 maximum closing cost credits" stacked stat, dual-logo lockup bottom. Full-bleed home photo as background.

**Treatment notes:** This is paid-feeling creative — competitive comparison (anti-Zillow), or partnership (Compass + Rocket). Heavy serif headline, photo as wallpaper, frosted-panel for the message block, brand lockup at the bottom.

---

## Categories I expected but did NOT see in top-account single-image posts

The brief mentioned 16 candidate categories. Across this sample, the following **did not appear as single-image posts** (they're all carousels or reels in the data):

- **JUST LISTED** — 0 singles. Always a carousel (cover + interior tour).
- **JUST SOLD / Under Contract** — 0 singles. Usually carousel + caption "SOLD" stamp.
- **Coming Soon** — 0 singles. Carousel teaser.
- **Price Improvement / New Price** — 0 singles. The luxury accounts essentially do not announce price drops publicly; this is a mid-market template.
- **Open House** — 0 singles. Carousel or Reel.
- **Featured Listing / Listing of the Week** — 0 singles. Always a carousel.
- **Magazine cover / editorial overlay** — only 1 (the Aaron Kirman press feature). Not a self-produced format, just a real magazine cover.
- **Architectural detail / close-up** — 0 standalone singles. These appear ONLY as carousel slides 2–10, never as the cover.
- **Area / lifestyle photo** — 0 standalone singles. Luxury accounts use these as carousel slides, never as solo posts.
- **Market data card (chart-driven)** — 0 as singles. Coldwell's $260M post is **one number, no chart**. Multi-stat market reports are always carousels.
- **Testimonial card** — 0 singles in this sample.
- **Holiday / seasonal greeting** — 0 singles in the date window scraped.
- **Annual sales recap** — 0 singles. Recap content is always carousel (slide 1 = headline number, slides 2–10 = trophy listings).

**New category that emerged** that wasn't in the brief:
- **"Now Hiring" / Recruiting** — theoppenheimgroup DUJgKbbEgGH. Editorial layout aimed at attracting agents to the brokerage. Worth keeping in mind given Ryan Realty's local-market recruiting interest.

---

## Visual treatment patterns (across all 10)

Treatments that repeat:

1. **Portrait-as-canvas.** 6 of 10 posts are built on a single portrait (subject occupies 50%+ of frame). The design layer sits on or beside the portrait.
2. **Italic-serif display type.** Compass, Douglas Elliman, the Oppenheim Group, and the LA Business Journal cover all use a serif italic for the dominant display word ("Neda Navab," "Now Expanding Our Team," "Compass Welcomes…," "LA500"). This is the single most-shared aesthetic.
3. **Tiny logo, always bottom.** Compass `COMPASS` mark, Douglas Elliman wordmark with diamond, Coldwell `Global Luxury` circle — all sit bottom-right at <8% of frame height. Hilton & Hyland is the only exception (logo top-right, larger).
4. **No CTA buttons, no link calls.** Even the "Search Compass.com" ad just states the URL — no "Click here," no swipe-up styling, no arrow icon. Caption carries any soft CTA.
5. **One job per post.** Each post has exactly one message. No "and also our market report" sidebar. The single-image format is reserved for content that does not need elaboration.
6. **Photo functions as wallpaper or as content.** Two distinct modes:
   - *Wallpaper mode* (Compass Rocket, Compass Zillow, Coldwell stat): photo is dim, muted, or partially obscured by a panel. The number/headline is the post.
   - *Content mode* (Compass Neda, Douglas Elliman portraits, Hilton & Hyland welcome): photo IS the post. The design layer is light — a name, a title, a logo.

Treatments that **do not appear**:
- Bright colorful gradient backgrounds (no IG-marketing-template look).
- Stickers, emoji, hand-drawn elements.
- Off-white "card" frames floating inside the 1080×1080 (these are a low-end real-estate template). Every post uses the full frame.
- Drop-shadows or 3D effects on text.
- Multiple competing focal points.

---

## The strongest 3 categories Ryan Realty should DEFINITELY template

Based on what the top accounts actually use the single-image format for, the highest-value templates for Ryan Realty are:

### 1. Agent intro / new hire / role announcement (the #1 use case in the data)
**Why:** 50% of single-image posts from this peer set are some flavor of "meet a person." If Ryan Realty adds Paul or Rebecca to a deal, opens a new sub-team, or formalizes a role — this is the format that signals "polished brokerage" rather than "indie agent." Maps to design_system §"Broker headshots" — the three transparent PNGs at `design_system/ryan-realty/assets/team/` are already built for this.

**Treatment:** Portrait (transparent PNG on warm-stone background OR full-bleed photo with name overlay), italic-serif display name (Amboqia Boriango), Geist sans subtitle (role), Ryan Realty wordmark bottom. No phone number on the image — the caption carries that.

### 2. Brag stat / accomplishment / single-number card
**Why:** Coldwell's $260M post is the cleanest single-image card in the sample. Ryan Realty's local equivalents: "$X million sold YTD," "X homes closed in Tumalo," "Top 1% of Bend brokers." ONE number per card, photographic wallpaper underneath, tiny logo.

**Treatment:** Moody photographic background (interior detail, Cascade silhouette at dusk — never a bright daylight house). Massive thin display number in white. Tiny `RR` mark or wordmark bottom-right. Disclaimer footnote in 9pt sans bottom (data source, period). Maps to CLAUDE.md §0 — every number ships with a verification trace.

### 3. Press feature / "as seen in" credibility card
**Why:** Aaron Kirman's LA500 cover and Compass's SF Business Times badge are the same pattern — borrow an external publication's authority. Ryan Realty's local equivalents: a Source Weekly mention, a Bend Bulletin column, a Cascade Business News profile, an MLS award. The template treats the publication's masthead/logo as the design hero, with the broker as the subject of the article.

**Treatment:** Editorial magazine-cover layout. Real publication's logo prominently. Subject portrait full-bleed. Italic-serif pull-line ("9 YEARS ON THE LA500" / "Featured in Cascade Business News"). No Ryan Realty logo competing — the press source is the credibility, the broker is the subject. Wordmark only in the lower corner or inside a small "In the Press" footer block (Compass's exact convention).

---

## Honorable mentions (worth a template but lower priority)

- **Executive quote card** (Douglas Elliman "Monday Mindset"). Portrait + italic-serif pull-quote with smart quotes. Useful 1–2× per year for Matt's principal-broker voice when he says something publishable.
- **Drive-to-site comparison ad** (Compass anti-Zillow). Worth replicating IF Ryan Realty ever wants to position against Zillow/Realtor.com directly — but this is paid-creative territory, not organic.
- **Recruiting / "we're growing"** (Oppenheim). Only worth building when Ryan Realty actively wants to recruit a Bend agent.

What is NOT worth building as a single-image template (because every top account uses carousels for these): just-listed, just-sold, coming-soon, open house, featured listing, market data with multiple stats, monthly recap. The photo-first single-listing post that Matt is already building maps to a 5–10 slide carousel, not a single image.

---

## Raw file references

Downloaded reference images: `/tmp/single-image-refs/*.jpg` (10 files, ~1.6 MB total). Each named `{account}_{shortcode}.jpg` for easy lookup.
