# KB sections — the reusable design system (single source of truth)

These are the **kinetic-brutalist** sections. They are the **one canonical
implementation** of each homepage/site block. Every migrated page (homepage,
city, community, neighborhood, …) **reuses these via props** — it does **not**
re-implement or copy them. An adjustment made here propagates to every page that
uses the section, so we never go through the build process twice.

**Rules (enforced by `ci:kb-single-source`, G50):**
1. A `Kb*` section component is **defined only in this folder** (`components/site/kb/`). Never fork/duplicate it elsewhere — that would cause drift where a fix reaches one page but not another.
2. Reuse a section by **importing it and passing props** for the page's data/copy. If a page needs different copy, add an optional prop (with the current value as the default) — do not copy the component.
3. Pages render KB sections inside a `.kb-root` wrapper and `import '@/components/site/kb/kb.css'` (the styles are scoped to `.kb-root`).
4. Chrome (`KbNav`, `KbFooter`) is shared across pages; when a page uses them, hide the default `SiteHeader`/`SiteFooter` for that route via `HideChrome` in the layout.

## Section catalog

| Section | Props | Renders | Reuse notes |
|---|---|---|---|
| `KbNav` | — | Transparent-over-hero top bar + full-screen menu (real site routes) | Same nav everywhere. Wrap in `.kb-root`. |
| `KbHero` | `data`, `eyebrow?`, `titleTop?`, `titleBottom?`, `lead?`, `videoSrc?`, `posterSrc?` | Full-bleed video/photo hero, Amboqia H1, voice + plain-language search, live stat row | **Fully parameterized** — pass a city's name/photo/stats to reuse. Defaults = homepage. `videoSrc=null` → poster image only. |
| `KbExploreTowns` | `towns: KbTownItem[]` | Stat-ledger town rows | Pass any geo set. |
| `KbCommunities` | `communities: KbCommunityItem[]` | Featured community cards, photo → silent Area Guide clip on focus | Pass per-item `video` (hosted by `sync-city-videos.mjs`). Viewport-autoplay + hover. |
| `KbFeatured` | `items: KbFeaturedItem[]` | Poster grid, silent video tours play on focus (video homes first) | Pass any listing set + per-item `video`. Viewport-autoplay + hover. |
| `KbListingMap` | `geojson`, `totalActive` | Google Maps listing map (clustered pins + optional boundary polygon); loaded via a dynamic `ssr:false` wrapper | Pass any GeoJSON + count. |
| `KbTicker` | `items: KbTickerItem[]` | Scrolling price/address ticker | |
| `KbTestimonials` | `reviews: KbReview[]` | Review wall | |
| `KbTeam` | — | The three brokers | Same everywhere. |
| `KbMarketHud` | `data: KbMarketData` | Market HUD (trend chart + by-town) | Pass any geo's market data. |
| `KbSell` | `data: KbSellData` | Sell CTA band | |
| `KbFooter` | `towns: KbTownItem[]` | Dual-audience close + sitemap | `towns=[]` drops the per-town fine print (use for non-region scopes). |

Data shapes live in [`types.ts`](./types.ts). The scoped styles live in
[`kb.css`](./kb.css) (every rule under `.kb-root`).

## Shared primitives (reuse, don't re-implement)

- **`useInViewAutoplay()`** ([`use-in-view-autoplay.ts`](./use-in-view-autoplay.ts)) — feed-style "the video plays when it scrolls into focus" (IG/TikTok/FB). Tracks every registered card's intersection ratio and returns the single most-in-view card's key. Consumers pair it with hover/focus state: `const active = hovered ?? inViewKey`, so pointer devices get hover and touch devices (no hover) get scroll-into-view autoplay. One video plays at a time. SSR-safe; disabled under `prefers-reduced-motion`. Used by `KbFeatured` + `KbCommunities` — change behavior here, it changes everywhere.

## City / community video pipeline

Section cards (and city/community heroes) play **silent, graded Area Guide clips** pulled from Drive. Curate in [`data/city-hero-videos.json`](../../../data/city-hero-videos.json) — one entry per slug with `driveFileId`, `geo_tags` (carry **both** the community **and** its parent city, e.g. `caldera-springs` → `["sunriver","caldera-springs"]`), `scope`, optional `startSec`/`durationSec`. Run `node --env-file=.env.local scripts/sync-city-videos.mjs` to download → grade (same look as the homepage hero) → encode (web h.264, ~3MB) → poster, writing `public/videos/<scope>/<slug>.mp4` + the resolved manifest [`data/city-hero-videos.resolved.json`](../../../data/city-hero-videos.resolved.json) that the page reads. Use the `1080p - h.265.mov` Drive variant (landscape 16:9); the service account reads the copies in Matt's own folder, not the snowdrift-owned originals.

## Reusing on a new page (the city-rebuild recipe)

```tsx
import '@/components/site/kb/kb.css'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'

export default async function CityPage() {
  // ...fetch city data via @/lib/data...
  return (
    <main className="kb-root">
      <KbNav />
      <KbHero data={cityStats} eyebrow="Bend · Oregon" titleTop="Homes in" titleBottom="Bend" videoSrc={null} posterSrc={cityPhoto} />
      <KbFeatured items={cityListings} />
      {/* ...other sections with city data... */}
      <KbFooter towns={[]} />
    </main>
  )
}
```

Then add the route to `HideChrome` in `app/layout.tsx` so the default chrome
doesn't double up. That's it — no section is rebuilt.
