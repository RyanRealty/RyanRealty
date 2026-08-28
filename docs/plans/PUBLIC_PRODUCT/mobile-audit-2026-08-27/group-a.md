# Mobile audit — Group A — 2026-08-27

Routes: `/` (homepage), `/homes-for-sale` (map+list app frame, default + `?view=list`),
`/compare?ids=220214825,220221148`, `/price-drops`, `/open-houses`.

MLS ids for compare were pulled from `/price-drops` card slugs (220214825 = 17376 Lively Lane
Bend, 220221148 = 20735 Mini Lane Bend). `/compare` resolves `ids` against `listNumbers` AND
`listingKeys` (`app/compare/page.tsx:97-101`), so either works.

## Capture-pipeline notes (read before trusting a finding below)

1. **`sips --cropToHeightWidth ... --cropOffset Y 0` does not crop from the top-left origin.**
   Confirmed empirically: offset 0 on a 6000px-tall capture returned a band centered mid-page,
   not row 0. This matches Group C's independent finding — same bug, same session date. I
   dropped sips slicing entirely after catching it (one early finding, "compare page opens on
   the footer," was a crop-tool artifact, not real — corrected below) and read full-page PNGs
   directly with the Read tool, or drove the interactive Browser pane with `window.scrollTo` +
   `computer{action:"screenshot"}` for anything I needed to inspect precisely.
2. **Raw headless Chrome CLI (`--headless=new --screenshot`) produced a solid blank white PNG
   for `/` (homepage) at every virtual-time-budget from 25s to 45s, with and without
   `--disable-gpu`.** Every other route in this group captured fine headless (real content,
   100KB+ files). Root cause found and confirmed in the interactive Browser pane (see the
   FIX-NOW item below): the homepage embeds `SellValueForm`, which hard-codes `autoFocus` on
   its address input. On load, the browser scrolls the viewport to that input — 75%+ down a
   ~12,000px page. A headless one-shot `--screenshot` of the top viewport, taken while the page
   is mid-scroll-jack to a moving target (body height still growing as sections stream in),
   renders nothing. All homepage bands below were captured through the interactive Browser pane
   instead (`window.scrollTo` to a fixed offset, then `computer{action:"screenshot"}`), after
   `document.activeElement.blur(); window.scrollTo(0,0)` to defeat the scroll-jack for capture
   purposes. These are inline-viewed screenshots, not saved PNG paths — noted per finding.
3. **Both addenda were already wired into price-drops and open-houses before this pass touched
   them.** `photoSrc` was already present in `app/price-drops/_v3/drops-field-items.ts:65` and
   `app/open-houses/_v3/oh-field-items.ts:38` (confirmed visually — every card on both pages
   renders a real photo, see bands below). Only the city-in-title half of the second addendum
   was missing on those two routes, and on the shared homepage field-item builder. Fixed on my
   two routes, reverted on the shared one — see "What I fixed" below.

---

## THE BIG ONE — FIX-NOW — homepage auto-scrolls to the footer on every mobile load

**This is likely the single highest-impact fix in the whole audit.** On a fresh mobile load of
`/`, before any user interaction, the page lands scrolled ~75% down a ~12,000px document —
past the hero, the Field (home cards + map), the market Instrument, and the communities Ledger.
The first thing a phone visitor sees is the broker Call/Text list, an address input, and the
"Value my home" button, immediately followed by the footer. Confirmed reproducible on 3
independent fresh tabs/navigations; `document.activeElement` on load is
`<input id="home-get-value-address">` inside `<form id="home-get-value">` inside
`<section id="sell">`; `window.scrollY` on load was 8951, then 32164, then 9264 across repeated
fresh loads (moving target because the page is still streaming in) — always deep in the "sell"
section, never 0.

**Root cause:** `app/sell/_v3/SellValueForm.tsx:254` —
```tsx
<AddressAutocomplete
  id={addressFieldId}
  value={address}
  onChange={setAddress}
  autoFocus
  ...
```
`autoFocus` is unconditional. Every mount of `SellValueForm` autofocuses the address field,
and a focused off-screen element drags the mobile viewport to it. This is almost certainly
fine on `/sell` (the form is likely the page's primary content, near the top there), but the
homepage embeds the same form deep inside its own "sell" section
(`app/page.tsx:462-463`, `<SellValueForm pagePath="/" formId="home-get-value" />`), so the same
autoFocus wrecks the homepage's landing experience.

**SHARED-file finding — I did not fix this.** `SellValueForm.tsx` lives in `app/sell/_v3/`, not
under any directory my fix authority covers (`app/page.tsx` itself, `app/compare/*`,
`app/price-drops/*`, `app/open-houses/*`, `app/homes-for-sale/*`), and it's imported by both
`app/sell/page.tsx` and `app/page.tsx` — a shared component, not mine alone to change.

**The fix I'd make:** add an `autoFocusAddress?: boolean` prop to `SellValueForm` (default
`true`, preserving current `/sell` behavior), pass it through to `AddressAutocomplete`'s
`autoFocus` at line 254 instead of the bare boolean, and call
`<SellValueForm pagePath="/" formId="home-get-value" autoFocusAddress={false} />` from
`app/page.tsx:463`. Same treatment probably worth checking on `app/zip/[zip]/_v3/ZipSellSheet.client.tsx`
and `app/team/[slug]/_v3/BrokerValuationSheet.client.tsx` if those also embed this form
mid-page rather than as the page's primary ask.

Screenshots (interactive Browser pane, inline-viewed, not saved to disk — see pipeline note 2):
fresh load showing broker list + address input + Value my home + footer stacked with nothing
above; `document.activeElement` / `scrollY` JS confirmation. Reproduced 3x.

---

## Homepage (`/`)

Captured via the interactive Browser pane after defeating the scroll-jack (see pipeline note
2). All bands below are inline-viewed screenshots from the same session driving `tabId tab-8`.

| Section | What I saw | Severity | Fix lives in |
|---|---|---|---|
| Load scroll position | See "THE BIG ONE" above | **FIX-NOW** | Shared (`app/sell/_v3/SellValueForm.tsx:254`) |
| Hero (Stage) | Old Mill drone still, H1, "See homes" CTA, town chips below — clean, no overlap, good contrast, tap targets fine | FINE | — |
| Field (home cards + map) | Map loads correctly (no gray-clip regression), 12 curated homes with real photos, price, address. **Title lacks city** ("19100 Macalpine Loop"), city sits alone in the meta line instead ("Bend · 5 bd · 8 ba · 9,971 sqft") | FIX-NOW (content rule, not visual) | Shared — `app/_v3/home-field-items.ts:43,60` (used by `/buy` too — outside my authority, see "What I fixed / reverted" below) |
| Market Instrument (median/count/MoS + chart) | 5 stat tiles + a median-by-month line chart, legend readable, source line present. Y-axis is a narrow $602K–$697K band so the lines look more volatile than the real spread — a data-viz nit, not mobile-specific | FINE (minor IMPROVE noted) | — |
| Communities Ledger ("Resorts and planned communities") | 4 rows (Tetherow, Caldera Springs, Broken Top, NorthWest Crossing), each with a thumbnail, name, active count. On first paint after scroll, **all 4 thumbnails render as flat gray placeholder boxes** (`img.complete === true`, `naturalWidth: 1700` — images ARE loaded, just not painted). 3 of 4 self-resolve after ~2s; NorthWest Crossing was still gray after that wait | IMPROVE | Shared — the community image/thumb renderer (likely `components/site/v3`); homepage only supplies `img` paths via `COMM_FEATURED`/`communityItems` in `app/page.tsx:216-229` |
| Newsletter signup | Clean single-column form, "Get alerts" button full-width and clearly tappable | FINE | — |
| Testimonials ("What clients say") | 8 full-length testimonials stacked with no truncation, carousel, or avatar — a long uniform wall of gray body text between short bold name labels. Not broken, just a lot of scroll-distance for low information density on a phone | IMPROVE — suggest truncating to 2-3 lines with "read more," or capping the homepage to 3-4 testimonials (`TESTIMONIALS.slice(0, 8)` at `app/page.tsx:192` is mine to change, but this is a content-depth call, flagging for Matt rather than unilaterally cutting testimonials) | Mine (`app/page.tsx:192`) if Matt wants it cut |
| "The brokers" (AboutFaces) | One **full-viewport-width, full-bleed** headshot (Matt Ryan) renders first, then all three broker names stack below as plain Call/Text rows with no photo next to Rebecca or Paul. A single giant Matt portrait opening this section reads Matt-first, which runs against the standing brand rule that Matt is never the face of brand-led content | IMPROVE / worth a call — flag for Matt | Shared — `app/about/_v3/AboutFaces.tsx` (also used by `/about`, `/team` per the file's own comment) — outside my authority |
| Footer | Standard V3Footer, contact info, socials, link columns — clean | FINE | — |

### What I fixed

- **`app/price-drops/_v3/drops-field-items.ts`**: title now uses `publishCardAddress(drop)`
  (street + ", City") instead of a bare street join; also switched the street computation to
  `listingMlsStreetLine()` so a placeholder `"0"` house number is stripped the same way the
  homepage builder already does it. Verified visually: "16395 Dawn Road, La Pine",
  "2297 Rolla Road, Prineville" (see `price-drops-vp-after.png` in the scratchpad — before/after
  same file, `price-drops-vp.png` for the pre-edit state).
- **`app/open-houses/_v3/oh-field-items.ts`**: title now appends `, {city}` when a city is
  present, keeping the existing `unparsedAddress` fallback chain intact (added
  `listingMlsStreetLine` as a second-choice source ahead of the raw manual join, so placeholder
  house numbers get stripped there too). Verified visually: "505 Pine, Sisters",
  "20909 Sotra, Bend" (see `open-houses-vp-after.png`, vs. pre-edit `open-houses-vp.png` which
  had no city).
- Both changes: `npx vitest run` on their test files — 4/4 passing (unit + int), no assertions
  on title text existed to break. `npx tsc --noEmit` — no errors surfaced against either file.
  `npm run` gates: `node scripts/check-page-purpose.mjs` → OK (20 routes, 202 sections, all in
  planned order). `node scripts/check-brand-voice.mjs` → 2 violations, unchanged baseline.

### What I reverted (SHARED file, recorded instead)

- **`app/_v3/home-field-items.ts`** — I initially applied the identical `publishCardAddress`
  title fix + dropped the now-duplicate `tile.city` from the meta line here too, then caught
  that this file is imported by `app/buy/page.tsx` as well as `app/page.tsx`
  (`grep -rl home-field-items app` → both). That makes it a file shared across routes, outside
  my fix authority. **Reverted with `git checkout -- app/_v3/home-field-items.ts`** before
  finishing. Recording the fix here instead:
  - `app/_v3/home-field-items.ts:60` — `title: street,` → `title: publishCardAddress(tile),`
    (needs `import { publishCardAddress } from '@/lib/listing/publish-street-line'` added
    alongside the existing `publishStreetLine` import at line 18).
  - `app/_v3/home-field-items.ts:43` — drop `tile.city?.trim() || null,` from the `meta` array
    (it becomes a duplicate of the new title once the title carries the city).
  - This is the fix underlying the homepage Field row finding in the table above.

---

## `/price-drops`

Captured headless (worked fine — no scroll-jack, no font issue). Full page + viewport
screenshots at `price-drops-vp-after.png`, `price-drops-full.png` (6000px), reviewed via direct
Read (sips slicing abandoned per pipeline note 1).

| Section | What I saw | Severity | Fix lives in |
|---|---|---|---|
| Header (breadcrumb, H1, count) | "Price drops in Central Oregon", "60 price cuts this week · 48 shown below" — clear, no truncation | FINE | — |
| Card list | 48 cards, each: real photo, drop-% badge on the photo, price, **street + city** (post-fix), "was $X, -Y%, beds, baths, sqft, subdivision". Consistent, scannable, photos load reliably all the way down the list (spot-checked ~15 of 48) | FINE | — |
| Newsletter / alerts CTA and footer | Standard, matches other routes | FINE | — |

No FIX-NOW or IMPROVE items beyond the title fix already applied.

---

## `/open-houses`

Captured headless (worked fine). Full page + viewport at `open-houses-vp-after.png`,
`open-houses-full.png` (6000px). Also cross-checked page order with `get_page_text` in the
interactive browser, since the sips-slice mis-order made me doubt the visual read at first
(pipeline note 1) — the DOM order below is the real, verified order.

| Section | What I saw | Severity | Fix lives in |
|---|---|---|---|
| Breadcrumb + "162 homes on this list" | Bare count line, no page H1 yet at this point | — | — |
| Field (7 curated cards) | Full-bleed photo cards, price/specs/**street, city** overlaid on a bottom scrim — post-fix this reads "505 Pine, Sisters", "20909 Sotra, Bend". Legible over photos, no collision | FINE | — |
| Instrument ("Open houses in Central Oregon" H1 + 162 / $757,000 stats + "Value my home") | **This is the page's actual H1 and framing content, and it renders AFTER the 7 photo cards, not before.** A phone visitor scrolls through 7 unlabeled listing cards before learning what page they're on or seeing the median-price context. This is a deliberate, documented pattern per the page's own header comment (`app/open-houses/page.tsx:5-7`: "Order is Breadcrumb, Field..., Instrument..."), matching the same Field-before-Instrument rhythm used on the homepage — not a bug, a site-wide IA choice | IMPROVE — flag for Matt: is Field-before-H1 the right call on a page literally named by its H1, on mobile specifically, where the H1 is 3-4 screens down? | Mine (`app/open-houses/page.tsx`) if Matt wants it reordered — but this is a product/IA call, not a defect, so I did not reorder it unilaterally |
| Newsletter + "Keep looking" + footer | Clean, standard | FINE | — |

---

## `/compare?ids=220214825,220221148`

Captured headless for the top viewport (fine); full page + interactive Browser pane for the map
section specifically, since the sips-slice mis-order initially made the map section look like
it was rendering at the very top of the page (false — pipeline note 1; the map is correctly
positioned after the comparison table, confirmed with `getBoundingClientRect` — `top: 1134px`
in a 4214px document).

| Section | What I saw | Severity | Fix lives in |
|---|---|---|---|
| Header, action row (Copy Link / Download PDF), photo cards | "2 properties selected", both cards show photo + address + price, Copy Link and Download PDF buttons both comfortably tappable side by side | FINE | — |
| Comparison table | Price/Beds/Baths/SqFt/Price-per-SqFt/Lot/Year/Garage/HOA/Taxes/DOM/Status/Type/Community rows, best-in-class values marked with a green check. Readable, no column collision at 390px (the table scrolls horizontally within its own container, not the page) | FINE | — |
| **"Locations" map** | Google Map box below the table. On one load, rendered a **fully zoomed-out world map** (visible continents, tiny/no visible pins) instead of a Central-Oregon view of the two properties. On a second, fresh load, the map box was **completely blank** (no tiles at all). Console showed a run of `400 Bad Request` and `429 Too Many Requests` against what is almost certainly the Google Maps/Places API | FIX-NOW to verify, not necessarily FIX-NOW to fix — **caveat per §0**: the 429s are very plausibly this audit session exhausting a dev-key rate limit from my own repeated navigations across 4+ pages using Maps (homepage hero map, homepage communities, /compare, /homes-for-sale), not a defect real traffic would hit. Recommend Matt (or a fresh session, later) reload `/compare?ids=...` once and confirm the map zooms to the two pins normally. If it reproduces outside a hammered test session, the API key's quota/billing needs a look | Not a route-code fix either way — flagging for verification, not editing anything |
| Footer | Standard | FINE | — |

---

## `/homes-for-sale` (map+list app frame) and `?view=list`

This route has **no `app/homes-for-sale/page.tsx`** — `next.config.ts` rewrites
`/homes-for-sale` → `/search` internally (confirmed: `{ source: '/homes-for-sale', destination: '/search' }`
and the `:path*` variant). The actual page lives at `app/search/page.tsx` and renders through
`components/search/*`, which is explicitly off-limits per my fix authority (and `app/homes-for-sale/`
itself contains only a `loading.tsx`, not a real route directory). **Everything below is
recorded, not fixed.**

| Section | What I saw | Severity | Fix lives in |
|---|---|---|---|
| Top bar: location search + saved-search email capture | "City, co[unty]" search input and an "Email / you@email.com / Save" mini-form are crammed onto the same row at 390px — both fields and the button read as compressed/small, and the row visually competes with itself (two unrelated jobs — search vs. save-this-search — sharing one line with no visual separation) | IMPROVE — stack these on separate rows at mobile widths, or move the save-search capture into a sheet/modal triggered by a button rather than an always-visible inline form | Shared (`components/search/*`) |
| Filter chip row (For sale / Price / Beds / Baths / +more) | Chips appear to run past the 390px edge — the row's right edge is cut off in the capture with a partial chip visible, suggesting horizontal scroll or overflow rather than wrap | IMPROVE — confirm whether this is an intentional horizontally-scrolling chip row (common, fine, but should have a visible affordance/fade to signal more chips) or an unintended overflow | Shared (`components/search/*`) |
| List/Map/Market tabs + count | Default `/homes-for-sale` shows List/Map/Market tabs with "3,386 homes"; `?view=list` shows "3,387 homes found" as plain text with **no visible tab switcher** — a real (if small) inconsistency between the default view and the `?view=list` variant's chrome | IMPROVE | Shared (`components/search/*`) |
| Listing cards (both views) | Photo, street + city already combined ("2547 Purcell Boulevard / Bend, OR 97701 · Purcell Landing"), price, beds/baths/sqft — clean, consistent, this route already does the city-in-title thing correctly | FINE | — |
| Floating "1 Issue" red pill (bottom-left, default view only) | A red pill reading "1 Issue" with an × sits fixed bottom-left, overlapping the last visible listing card. Unclear if this is a dev-only diagnostic overlay (e.g., a React/build warning badge) or a real user-facing widget — worth Matt confirming it doesn't ship to production if it's a debug artifact | Flagging, not fixing — position noted, cause unconfirmed | Unknown — recommend a quick grep for "1 Issue" / a debug-overlay component before assuming it's the known "N button / Cookies / coach bar" trio from the task brief, which it does not visually match |

**Known-pending items** (per the task brief, not re-investigated by me): the floating N button,
the Cookies button, and the "Next step" coach bar were all visible in my homes-for-sale/homepage
captures in their previously-reported positions — bottom-left "N" bubble, no coach bar
overlap observed in this session's captures, consistent with "known, not mine to fix."

---

## Summary

- **1 major FIX-NOW, shared-file, high confidence, high impact**: homepage `autoFocus` scroll-jack
  in `SellValueForm.tsx:254` — sends every mobile visitor to the footer on load. This is almost
  certainly worth fixing before anything else in this report.
- **2 fixes shipped** (mine to make, made, verified): city-in-title on `/price-drops` and
  `/open-houses` card titles.
- **1 fix identified, reverted, and handed off**: same city-in-title treatment for the homepage
  Field rows — code lives in `app/_v3/home-field-items.ts`, shared with `/buy`, outside my
  authority.
- **Thumbnails (first addendum)**: already fully wired on `/price-drops` and `/open-houses`
  before I touched them — verified visually, no action needed on my routes.
- **Everything else**: a handful of IMPROVE-level UX notes (testimonial wall length, Matt's
  headshot opening "The brokers," Field-before-H1 ordering on `/open-houses`, the search-bar
  crowding and possible chip overflow on `/homes-for-sale`) plus one map-rendering issue on
  `/compare` that needs a clean-session re-check before it's trusted as a real defect.
