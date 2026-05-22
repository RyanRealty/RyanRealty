---
name: pulse-feed
description: >
  Canonical product spec for /pulse — the social-feed-style discovery
  surface (a Browse-the-feed button on the new ryan-realty.com homepage
  that opens a vertical 9:16 card feed of listings, blog content,
  market data, and brand utilities, optimized for paid-ad landings).
  Defines the 5 card types, the safe-rect overlay rules, the
  outline-only CTA pattern that routes to ryan-realty.com via
  BRAND_BASE_URL, the conversational hooks per event type, the
  TikTok-tight Like/Share placement, the video provider cascade, the
  interleave pattern, the brain integration model, and the cutover
  plan. Trigger any time the user mentions /pulse, the pulse feed,
  pulse-demo.html, adds a new card type, changes a CTA, asks how the
  feed is wired, or wants the feed to pick up new brain-produced
  content. MANDATORY READ before touching anything under
  app/pulse/, public/pulse-demo.html, components/pulse/, or any
  producer that publishes pulse-eligible output.
status: Canonical
locked: 2026-05-22
---

# Pulse Feed — Canonical Product Spec

## 1. Scope

### What pulse IS

A vertical scrollable feed of 9:16 cards at `/pulse`. The destination
for a "Browse the feed" button on the new ryan-realty.com homepage,
and the landing page for paid ads on Instagram, TikTok, Facebook, and
YouTube Shorts. Designed to feel like a social feed (TikTok / IG
Reels register), not a real estate search results page.

Five card types interleaved into one feed:

1. **Listing tile** — per-listing card with autoplay video tour
2. **Lifestyle / blog tile** — community spotlight, market news, or
   "Living in Central Oregon" content (sourced from `blog_posts`)
3. **Market report video tile** — brain-rendered short market video
4. **Market snapshot tile** — live stats from `market_pulse_live`
5. **Brand utility tile** — home valuation, newsletter signup, etc.

### What pulse is NOT

- Not a search results page (the city LP grid at
  `components/lp/ListingCard.tsx` handles that, with a different
  navy-fill CTA pattern)
- Not a property detail page (those live at
  `/listing/odsmls/<MLS#>/<City>/<Address>/` on ryan-realty.com)
- Not the marketing brain (the brain produces content; pulse is one
  of several destinations the brain feeds into)
- Not a chat interface — likes and shares are the only direct
  interactions; deeper engagement goes through the CTAs

## 2. The "Browse the feed" entry point

The homepage CTA that opens this experience. Spec for when the
homepage redesign lands:

- Button label: **"Browse the feed →"**
- Style: matches the rest of the homepage's primary CTA pattern (when
  homepage redesign is locked, swap this in)
- Destination: `/pulse` on the Next.js app (today: `/pulse-demo.html`
  is the canonical demo surface during development)
- Tracking: `pulse_feed_entry` event with referrer + utm_source

## 3. Card types — visual + data sources

All cards share the same 9:16 chassis (aspect-ratio, scrims, safe
zones, double-tap-to-like). What changes between types is the overlay
layout and the data source.

### 3.1 Listing tile

| | |
|---|---|
| **CSS class** | `.card` (default) |
| **Source** | `public.listings` row joined with `activity_events` |
| **Video source** | `details.Videos[]` jsonb path on the listing row |
| **Hook** | Italic serif headline from `HOOKS` pool, rotated by listing-ID hash |
| **Bottom block** | Price (serif) + address + city + bd/ba/sqft + agent line + CTA |
| **CTA** | "Schedule a showing →" → `https://ryan-realty.com/listing/odsmls/<MLS#>/<City>/<Address>/` |
| **Right rail** | Like + Share (TikTok-tight bottom-right) |
| **Sold variant** | Bottom block shows "SOLD FOR $X". CTA flips to "See similar homes →" (cta-secondary class) → `/featured-listings/` |
| **Price drop variant** | Bottom block shows "NOW $X" + "Was $Y" strike-through. Hook may inject dynamic delta via `${delta}` |

### 3.2 Lifestyle / blog tile

| | |
|---|---|
| **CSS class** | `.card.lifestyle` |
| **Source** | `public.blog_posts` WHERE `status='published'` |
| **Background** | `hero_image_url` with 22s Ken Burns animation |
| **Eyebrow** | `category` field, uppercase tracked (e.g. "COMMUNITY SPOTLIGHTS") |
| **Bottom block** | Italic serif title + 3-line excerpt clamp + CTA |
| **CTA** | "Read the story →" → `https://ryan-realty.com/<slug>/` (WordPress posts live at root, not under `/blog/<slug>/`) |
| **Right rail** | Like + Share |

### 3.3 Market report video tile

| | |
|---|---|
| **CSS class** | `.card.report` |
| **Source** | `marketing_brain_actions` WHERE `action_type='content:market_data_video'` AND `status='executed'`. `executor_response.draft_path` → MP4 URL |
| **Background** | Autoplay muted loop of the rendered MP4 |
| **Eyebrow** | "May 2026 · The Bend market" |
| **Bottom block** | Serif headline + 1-paragraph deck + CTA |
| **CTA** | "Watch the full report →" → `https://ryan-realty.com/sellers/` (until `/housing-market` exists on the Next.js app) |
| **Right rail** | None (market content doesn't get "liked") |

### 3.4 Market snapshot tile

| | |
|---|---|
| **CSS class** | `.card.snapshot` |
| **Source** | `public.market_pulse_live` WHERE `geo_type='city'` AND `geo_slug=<viewer city>` AND `property_type='A'`. Live (10–15 min cache) |
| **Background** | Solid navy gradient (no photo, no video) |
| **Eyebrow** | "Bend · live · May 20" |
| **Body** | 4-stat grid: new this week / median days to pending / median list price / months of supply |
| **Verdict** | One-line line matching the MoS thresholds in `CLAUDE.md` §0 (≤4 seller's, 4–6 balanced, ≥6 buyer's). VERDICT MUST MATCH MoS NUMBER — non-negotiable |
| **CTA** | "See the full dashboard →" → `https://ryan-realty.com/sellers/` |
| **Right rail** | None |

### 3.5 Brand utility tile

| | |
|---|---|
| **CSS class** | `.card.brand` |
| **Source** | Static brand spec (today inline in `BRAND_FIXTURES`; production at `lib/pulse-brand-cards.ts`) |
| **Background** | Solid navy with subtle radial-gradient texture, no photo |
| **Layout** | Brand mark (small tracked uppercase) + serif headline + sub-copy + CTA, all vertically centered in safe zone |
| **CTA examples** | "Get my valuation" → `/free-home-valuation/`<br>"Meet the team" → `/about-us/`<br>"Subscribe" → newsletter signup |
| **Right rail** | None |

## 4. CTA pattern — outline-only (locked 2026-05-20)

Every CTA on every pulse card uses the **outline-only** style:

```css
.cta {
  background: transparent;
  color: #ffffff;
  border: 1.5px solid rgba(255, 255, 255, 0.92);
  padding: 11px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
  text-shadow: 0 1px 3px rgba(0,0,0,0.45);
  width: 100%;
}
.cta:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: #ffffff;
  transform: translateY(-1px);
}
.cta-secondary {
  /* sold listings */
  border-color: rgba(255, 255, 255, 0.55);
}
```

Why outline-only and not navy-filled:
- Pulse cards always have a photo or video background. Navy chip
  fights the imagery and feels heavy.
- The white outline reads cleanly against any background — drone
  shots, interior photos, luxury exteriors.
- The hover wash gives an "activated" feel without committing to a
  fill color.

The navy-fill CTA pattern at `components/lp/ListingCard.tsx` stays
canonical for the **city LP grid tiles** (white card background). Do
NOT propagate one style into the other surface — they target different
visual contexts.

### CTA routing — BRAND_BASE_URL

All outbound URLs route through a single constant:

```js
const BRAND_BASE_URL = 'https://ryan-realty.com';
```

This makes the cutover from Vercel app → ryan-realty.com a one-line
change. When the Next.js app moves to the brand domain:

```js
const BRAND_BASE_URL = '';  // ← flip this
```

Every CTA href then resolves as a relative path against the page's
own host. `#schedule` and `#similar` anchors light up against the
Next.js routes.

**Verified live destinations on ryan-realty.com** (Cloudflare /
AgentFire WordPress, curl-probed 2026-05-20):

| Path | HTTP | Use case |
|---|---|---|
| `/listing/odsmls/<MLS#>/<City>/<Address>/` | 200 | Listing detail (Schedule-a-showing landing) |
| `/featured-listings/` | 200 | All-listings index (See similar homes) |
| `/free-home-valuation/` | 200 | Brand valuation CTA |
| `/<blog-slug>/` | 200 | Blog post (slug at root, NOT under /blog/) |
| `/sellers/` | 200 | Closest match for market context |
| `/buyers/`, `/contact/`, `/explore/`, `/vip-home-search/` | 200 | Available secondary destinations |

### URL construction helper

```js
function listingDetailUrl(f) {
  if (!f.listNumber) return BRAND_BASE_URL + '/featured-listings/';
  const citySlug = (f.city || '').replace(/\s+/g, '-');
  return BRAND_BASE_URL + '/listing/odsmls/' + f.listNumber + '/' + citySlug + '/' + f.addressUrlSlug + '/';
}
```

Every listing fixture carries `listNumber` (short MLS#, NOT
`ListingKey`) and `addressUrlSlug` (hyphenated street address).

## 5. Hook system — conversational headlines

Replaces the stale "JUST LISTED" / "PRICE DROP" / "PENDING" / "SOLD"
uppercase pills. One italic-serif headline per card, rotated from a
pool by listing-ID hash so the same listing always shows the same
hook but the feed has variety.

```js
const HOOKS = {
  new_listing: [
    "you saw it first",
    "fresh on the market",
    "before the photos hit Zillow",
    "the early-bird version",
    "still warm",
    "just hit the MLS",
  ],
  // Price drops favor lines with a dynamic ${delta} placeholder.
  // ${delta} resolves to the dollar difference in K.
  price_drop: [
    "down ${delta}K today",
    "${delta}K cheaper than yesterday",
    "same house, ${delta}K less",
    "the seller just blinked ${delta}K",
    "now ${delta}K closer to yes",
    "the price moved, the view didn't",
  ],
  status_pending: [
    "an offer landed",
    "off the market for now",
    "a buyer moved faster than you",
    "spoken for",
    "someone said yes",
  ],
  status_closed: [
    "and… scene",
    "keys handed over",
    "another one in the books",
    "the new owners moved in",
    "champagne moment",
  ],
};
```

### Voice rules — binding (extends `CLAUDE.md` §3)

- Lower case feels conversational; upper case feels corporate
- No real-estate clichés (stunning, must-see, dream home, gorgeous)
- No AI filler (delve, leverage, robust, seamless, comprehensive)
- No exclamation marks. No "act fast"
- One emoji MAX across the entire pool, and only where it earns the spot
- The video carries the visual energy; the hook gives it voice

### Selection function

```js
function pickHook(fixture) {
  const pool = HOOKS[fixture.eventType] || HOOKS.new_listing;
  const idx = hashId(fixture.id) % pool.length;
  let line = pool[idx];
  if (line.includes('${delta}') && fixture.previousPrice && fixture.price) {
    const deltaK = Math.round((fixture.previousPrice - fixture.price) / 1000);
    line = line.replace('${delta}', deltaK.toString());
  }
  return line;
}
```

## 6. Video provider cascade

Lists in `listings.details.Videos[]` may carry `Uri` (string) or
`ObjectHtml` (HTML iframe block). The resolver picks the best one:

```
1. /\.(mp4|webm|mov|m4v)/i             → <video> native HTML5 player
2. youtube.com/watch?v= | youtu.be/    → <iframe> embed, autoplay=1&mute=1
3. vimeo.com/video/                    → <iframe> player, background=1
4. iframe.videodelivery.net/           → Cloudflare Stream iframe
5. *.aryeo.com/videos|sites/           → Aryeo iframe
6. (any other https:// iframe src)     → Generic iframe — embed as-is
7. (none of the above)                 → Photo with 22s Ken Burns animation
```

The generic-iframe fallback (step 6) catches Riley Visuals, local
photographer studio iframes, and any future provider without code
changes. Add specific provider entries when there's a custom autoplay
param pattern worth handling.

## 7. Safe zones — `pulse-feed-safe-zone/SKILL.md` is canonical

Every text overlay on a 1080×1920 frame sits inside:

- Top: 15% (≈288 px)
- Bottom: 14% (≈269 px)
- Left + right: 5.5% (≈59 px)
- Right action column: 72 px below the top safe edge

For frames repurposed as 1080×1920 SOCIAL videos (vs the in-app
browser scenario), use the tighter producer-grade rect: top 18%,
bottom 26%, right 14%, left 5.5%.

The demo at `/pulse-demo.html` has four toolbar modes:

1. **Clean** — default
2. **Show safe zones** — red diagonal hatching marks unsafe strips
3. **IG in-app browser** — overlays IG webview chrome
4. **TikTok video feed** — worst case with right action column

Full spec + per-platform chrome table: see
[`video_production_skills/pulse-feed-safe-zone/SKILL.md`](../../video_production_skills/pulse-feed-safe-zone/SKILL.md).

## 8. Like + Share — TikTok-tight pattern (locked 2026-05-20)

```css
.actions {
  position: absolute;
  right: var(--pulse-safe-side);
  bottom: calc(var(--pulse-safe-bottom) + 200px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.actions button {
  width: 36px; height: 36px;
  background: transparent;     /* no chip */
  border: 0;
  color: #fff;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.55));
}
.actions svg { width: 30px; height: 30px; stroke-width: 2; }
.actions button.liked { color: #ef4444; }
.actions button.liked svg { fill: currentColor; }
.actions .lbl { display: none; }   /* word labels hidden */
.actions .count {
  font-size: 11px; font-weight: 600;
  color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.7);
  margin-top: -8px;
}
```

Matches TikTok / IG Reels / YT Shorts placement: bottom-right rail,
icon-only, count below the icon. When the production tracking layer
in `lib/pulse-signals.ts` lights up, the `.count` slot gets a real
number ("12.4K" / "1,802"). Until then it stays empty.

Heart turns red on like (single tap on button OR double-tap on card
triggers heart burst animation).

Only listing + lifestyle cards include the right-rail actions. Brand,
snapshot, and report cards do not.

## 9. Interleave pattern — `buildFeed()`

The order producers see (today) in the demo:

```
Listing × 2  →  market report video  →  Listing × 2  →  lifestyle
  →  Listing × 2  →  market snapshot  →  Listing × 2  →  brand utility
  →  lifestyle
```

Translates to ~38% brain-produced cards, 62% listings in the demo's
13-card sample. Production should land closer to 20–25% brain content
(more listings between brain interruptions).

The interleave lives in:

- Demo: `buildFeed()` inside `public/pulse-demo.html`
- Production: `app/actions/pulse-feed.ts`

When new brain-card types come online (sold-deal-summary,
news-video, neighborhood guide), add them to the interleave config
AND add the matching matrix row in `pulse-feed-integration/SKILL.md`.

## 10. Brain integration — `pulse-feed-integration/SKILL.md` is canonical

Every brain producer whose output is meant to surface on `/pulse`
writes to a specific column per the integration matrix. Full spec at
[`marketing_brain_skills/pulse-feed-integration/SKILL.md`](../pulse-feed-integration/SKILL.md).

Short version:

| Card type | Producer writes to |
|---|---|
| Listing tile | `listings.details.Videos[]` |
| Lifestyle tile | `blog_posts` row with `status='published'` |
| Market report / news / neighborhood / sold-summary | `marketing_brain_actions.executor_response.draft_path` with `status='executed'` |
| Market snapshot | (no producer — cache writer handles it) |
| Brand utility | (not brain-produced — static config) |

## 11. Cutover plan — when Next.js owns ryan-realty.com

Today's state:
- `ryan-realty.com` = legacy AgentFire WordPress, Cloudflare-fronted
- `ryanrealty.vercel.app` = Next.js app (the future production property)

When the Next.js app cuts over to ryan-realty.com:

1. Flip `BRAND_BASE_URL = ''` in pulse-demo.html and in the
   production `lib/` equivalent. All CTAs become relative paths
   against the new host.
2. Light up the `#schedule` and `#similar` anchor jumps against the
   Next.js listing detail pages (the anchors already exist on
   `components/listing/showcase/ShowcaseSimilar.tsx` and the
   per-listing schedule form).
3. Route the market snapshot / report CTAs from `/sellers/` →
   `/housing-market` (the dedicated Next.js market hub).
4. Migrate the homepage "Browse the feed" button from any temporary
   surface to the canonical homepage hero.
5. Verify every blog-post slug resolves on the Next.js app (the
   WordPress URL pattern is `/<slug>/` at root, which the Next.js
   blog route at `app/blog/[slug]/page.tsx` already handles).

## 12. Verification checklist

Before declaring any pulse change shipped:

1. **Render check** — load `/pulse-demo.html`, confirm card count
   matches `buildFeed()` length, no broken iframes, no missing
   photos.
2. **CTA destinations** — every `<a class="cta">` href starts with
   `https://ryan-realty.com` (or empty after cutover). No relative
   paths against the dev server.
3. **Hook variety** — no two consecutive listing cards show the same
   hook (sample issue with small hook pools; expand the pool if
   collisions get common).
4. **Price-drop deltas** — a card with `previousPrice` set shows a
   delta-injected hook OR a generic delta-aware fallback. Never shows
   the literal `${delta}` token.
5. **Safe zones** — toolbar mode "Show safe zones" shows zero overlap
   between content and red hatching. Toolbar mode "TikTok video feed"
   shows price + address + CTA outside TT's chrome.
6. **Outline CTA** — confirm `background: transparent`,
   `border: 1.5px solid rgba(255, 255, 255, 0.92)`, hover gives a
   subtle white wash, no navy fill.
7. **TikTok actions** — Like + Share are at bottom-right, 36px
   buttons, no chip background, label text hidden. Heart turns red on
   tap.
8. **Brain content** — the market report MP4 plays, the lifestyle
   cards pull from real blog_posts hero images, the snapshot shows
   live numbers.
9. **MoS verdict** — snapshot verdict matches MoS number per
   `CLAUDE.md` §0 thresholds. NEVER let the cache's "Hot" label
   override the MoS reading.

## 13. What NOT to do

- ❌ Bring back the uppercase event-type pills ("JUST LISTED",
  "PRICE DROP", etc.). The conversational hook system replaced them
  on purpose 2026-05-20.
- ❌ Re-add the "▶ VIDEO TOUR" or "Luxury · video tour" badge. The
  playing video and the price tell those stories.
- ❌ Switch the CTA to the navy-fill style from
  `components/lp/ListingCard.tsx`. Pulse cards always have a photo
  background; navy fights it. The outline pattern is locked.
- ❌ Hardcode a URL into the demo without going through
  BRAND_BASE_URL. Cutover becomes a hunt.
- ❌ Add a new card type without specifying its source column. See
  `pulse-feed-integration/SKILL.md` matrix.
- ❌ Ship a frame whose text overflows the safe rect (15/14/5.5%).
  Verified by the demo's toolbar.
- ❌ Add right-rail Like/Share to brand / snapshot / report cards.
  Those are passive content, not engagement candidates.
- ❌ Use the cache's `market_health_label` as the snapshot verdict.
  The verdict must match the MoS thresholds in `CLAUDE.md` §0.
- ❌ Pull a video URL from a hard-coded JSON. Production reads from
  `listings.details.Videos[]`.
- ❌ Treat a deleted `/pulse-demo.html` as gone forever. It's tracked
  in git at HEAD; `git checkout -- public/pulse-demo.html` restores
  it.

## 14. File inventory

The pulse feed code base, as of 2026-05-22:

| Path | What |
|---|---|
| `public/pulse-demo.html` | Canonical static demo (1500+ lines, self-contained) |
| `app/pulse/page.tsx` | Production Next.js entry (work-in-progress) |
| `app/pulse/loading.tsx` | Suspense fallback |
| `app/actions/pulse-feed.ts` | Server action: `getPulseFeed()` |
| `lib/pulse-video-resolver.ts` | Provider cascade (production version of the demo's inline resolver) |
| `lib/pulse-brain-content.ts` | Joins `marketing_brain_actions` to `blog_posts` |
| `lib/pulse-brand-cards.ts` | Static brand utility config |
| `lib/pulse-signals.ts` | Anonymous like + dwell tracking, ε-greedy reranker |
| `lib/pulse-asset-library.ts` | Asset manifest reader |
| `lib/pulse-config.ts` | Default cities + freshness windows |
| `lib/pulse-saves.ts` | Anonymous like store (localStorage) |
| `components/pulse/PulseCard.tsx` | Listing card React component |
| `components/pulse/LifestyleCard.tsx` | Lifestyle card React component |
| `components/pulse/BrandCard.tsx` | Brand card React component |
| `components/pulse/HeartBurst.tsx` | Like animation |
| `components/pulse/SignupCard.tsx` | In-feed soft signup |
| `components/pulse/PulseFeed.tsx` | Feed orchestrator |
| `marketing_brain_skills/pulse-feed/SKILL.md` | **This file** — product spec |
| `marketing_brain_skills/pulse-feed-integration/SKILL.md` | Producer column-write contract |
| `video_production_skills/pulse-feed-safe-zone/SKILL.md` | Visual safe-rect spec |

## 15. Cross-references

- `CLAUDE.md` §0 — Data Accuracy (every number on pulse must trace
  to a verified source)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `CLAUDE.md` §3 — Brand Voice rules (the hook system inherits these)
- `marketing_brain_skills/pulse-feed-integration/SKILL.md` — column writes
- `video_production_skills/pulse-feed-safe-zone/SKILL.md` — safe rects
- `components/lp/ListingCard.tsx` — the city-LP grid tile, navy-fill
  CTA, locked 2026-05-19 (DIFFERENT surface, DIFFERENT pattern)
- `out/pulse-video-first-demo/contact-sheet.html` — draft review surface
