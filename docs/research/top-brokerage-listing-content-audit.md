# Top-Brokerage Listing Content Audit

Researched 2026-05-13. Goal: document the aesthetic top brokerages use for single-property promotion on their websites and collateral, so Ryan Realty's listing kit can compete at the Christie's/Sotheby's tier instead of looking like a Canva template.

## Methodology

Visited ten brokerage websites, pulled real current listing detail URLs, and inspected each for hero treatment, typography, color register, information density, and downloadable collateral. Sites that bot-blocked WebFetch (Sotheby's listing detail pages, Christie's listing detail, Cascade Hasson Bend listings) are noted explicitly — design conclusions for those were drawn from index pages, search-result cards, and editorial features.

## Brokerage-by-brokerage findings

### 1. Sotheby's International Realty — sothebysrealty.com
- **Sample listing URLs pulled** (Aspen, CO market — $10M+ tier):
  - `https://www.sothebysrealty.com/eng/sales/detail/180-l-963-25rxyh/` (64 Pitkin Way)
  - `https://www.sothebysrealty.com/eng/sales/detail/180-l-963-9kxe7q/574-johnson-drive-mclain-flats-aspen-co-81611`
  - `https://www.sothebysrealty.com/eng/sales/detail/180-l-963-zgstq3/41-popcorn-lane-100-and-102-difficult-lane-aspen-co-81611`
- **Detail pages bot-block** non-JS clients (403/empty body). The index page reveals: title-case headline ("64 Pitkin Way Aspen, Colorado, United States — Luxury Home For Sale"), narrative-led description, no hard price-and-spec slab in the card.
- **Aesthetic register**: editorial-first. The card and detail page treat the address like a magazine headline, not a real-estate listing.

### 2. The Agency — theagencyre.com
- **Sample listing URLs**:
  - `https://www.theagencyre.com/single-family/clr/24-413783/2571-wallingford-dr-beverly-hills-ca-90210` ($59.95M)
  - `https://www.theagencyre.com/single-family/clr/24-449959/1261-angelo-dr-beverly-hills-ca-90210` ($135M)
  - `https://www.theagencyre.com/single-family/clr/25521911/610-n-canon-dr-beverly-hills-ca-90210` ($21.5M)
- **Card layout**: horizontal scrolling gallery, address bold, city/state in lighter weight underneath, price in large numerals below location. Minimalist, high contrast.
- **Detail pages also bot-blocked** (429 Too Many Requests). The Agency's aesthetic is "fashion magazine for the home" — black/white/charcoal palette, sans-serif throughout, large negative space.

### 3. Compass — compass.com / luxuryatcompass.com
- The main compass.com homepage no longer features individual properties on the hero — it routes through search.
- **The relevant Compass surface is luxuryatcompass.com**, which is structured as a magazine, not a listing site:
  - Sections labeled "Lifestyle," "Spotlight," "Video"
  - **Dark background** (black/charcoal) with white serif headlines like "Living in Color" and "From Rendering to Reality"
  - Listings appear as gallery tiles inside curated stories, not as a flat search result
  - Featured copy is editorial: "Step inside a collection of extraordinary homes where daring design choices and vibrant palettes transform every space..." (verified)
- **This is the strongest editorial-tier listing presentation in the audit.** Compass Luxury reads as a destination publication, not a transaction tool.

### 4. Christie's International Real Estate — christiesrealestate.com
- City landing pages exist (Charlotte, LA, San Francisco, Austin, etc.) but the listing detail pages are JS-rendered and bot-blocked. Cannot confirm visual register at the detail level without a real browser.
- Brand register is known from the parent (Christie's auction house): cream/ivory backgrounds, Didone-style serif display, narrow modernist sans for body. Catalog-grade typography.

### 5. Douglas Elliman — elliman.com
- **Sample listing URLs**:
  - `https://www.elliman.com/new-york-city/1175-york-avenue-pha8-manhattan-hnjiqes` (PHA8, blocked)
  - `https://www.elliman.com/new-york-city/295-lafayette-street-manhattan` (Puck Penthouses)
- Their editorial layer (`/insider/`) is the magazine surface. Featured posts like "5 NYC Penthouses" describe properties hierarchically by price ($82M → $33.75M), with named architects (Rafael Viñoly, Charles Gwathmey) and phrases like "creme de la creme of real estate distinction" used to confer pedigree.
- **The differentiator**: every property gets an architect attribution and a 100–150 word narrative, vs the 1–2 sentence factsheet on Zillow.

### 6. Hilton & Hyland — hiltonhyland.com
- **Sample listing URL** (fetched successfully):
  - `https://hiltonhyland.com/property/610-arkell-dr-beverly-hills-ca-90210/` — $28.5M, 5 BD / 6 BA / 23,515 sqft
- **Detail page layout**: address as header, price + specs in pipe-delimited line below ("$28,500,000 | 5 BD | 6 BA | 23,515 SQFT"), ~150 word narrative description ("Set on a tranquil cul-de-sac in the prestigious Trousdale Estates..."), three named agents with direct contact, no PDF brochure link visible.
- **Color**: white background, dark text, minimal accent — letting the photography carry the brand.
- **Differentiator from Zillow**: narrative storytelling + agent personalization. Hilton & Hyland names the estate ("Casa Alta Tierra") — Zillow would just call it "the property."

### 7. Coldwell Banker Global Luxury — coldwellbankerluxury.com
- Full-width image carousel hero, sans-serif headlines, white background, dark text. Property image occupies ~70% of card space; address/price/specs compress into footer.
- Blue accent on interactive elements ("Virtual Tour," "New Listing"). The least magazine-like of the major luxury sites — closer to a polished MLS interface than to Compass Luxury.

### 8. Cascade Hasson Sotheby's — cascadehasson.com (LOCAL Bend competitor)
- **Sample listing URLs**:
  - `https://www.cascadehasson.com/realestate/details/140173804/61058-tuscany-drive-bend-or-97702`
  - `https://www.cascadehasson.com/realestate/details/19859483/154-ne-franklin-avenue-bend-or-97701`
- Detail pages and homepage **bot-block WebFetch (403)**. From the Issuu marketing collateral and the search-results page descriptions, Cascade Hasson rides the parent Sotheby's identity directly — same serif headlines, same cream/ivory, same narrative voice.
- **Their luxury collateral lives on Issuu** ("Cascade Hasson Sotheby's Luxury Lookbook," "Our Complete Guide to Marketing Your Luxury Property") — flipbook publications, not PDF brochures inline on the listing page. The lookbook is the editorial product, not the website.

### 9. Bend Premier Real Estate — bendpremierrealestate.com (LOCAL)
- Premier Collection page (`/premier-collection.php`) feels **generic**. Clean grid, sans-serif, white background, blue links, 600×450 photos with bold price + address + bed/bath line. MLS-compliance look. No editorial layer, no narrative voice, no brochure surface.
- **This is the gap.** Bend Premier — the local "luxury" competitor — looks like a polished MLS, not like Sotheby's or Compass Luxury.

### 10. Williams & Williams Estates / The Beverly Hills Estates
- `thewilliamsestates.com` and `thebeverlyhillsestates.com` use a slideshow hero with curated stats ($17.1B in total sales), only six properties displayed at once for exclusivity, and "press" logos (WSJ, Architectural Digest, Mansion Global) treated as editorial credibility marks. Sans-serif, dark, restrained.
- **Critical move**: they limit the count of visible listings. Six. Not 200. The exclusivity is the design.

## Five visual moves that show up across multiple top brokerages

1. **Full-bleed hero photo, no chrome competing with the photo.** Every top brokerage lets the photograph fill the viewport. No agent headshot in the corner, no MLS badge, no "Just Listed!" sticker. The photo is the whole frame.
2. **Named property + estate-tier narrative description.** Hilton & Hyland calls a property "Casa Alta Tierra." Elliman names architects. Sotheby's writes a 100+ word narrative. Zillow says "Beautiful 5BR home."
3. **Single typographic hierarchy: large address (often serif), small specs, no price scream.** Price is present but doesn't fight the photo. On Sotheby's, the price often lives BELOW the fold.
4. **Restraint in count.** Beverly Hills Estates shows six properties. Compass Luxury curates a "collection." None of them display 200 listings on the homepage.
5. **An editorial layer ABOVE the listing layer.** Compass has `luxuryatcompass.com`. Elliman has `/insider/`. Cascade Hasson has Issuu lookbooks. The story sits one level above the listing — and it's what the brand actually pushes.

## Strongest editorial design

**Compass Luxury (luxuryatcompass.com).** Dark register, magazine-style sections (Lifestyle / Spotlight / Video), curated collections with editorial headlines ("Living in Color," "From Rendering to Reality"). Property cards live inside stories, not in a flat grid. Reads as a destination, not a transaction tool. This is the highest editorial bar of any brokerage surface I inspected.

## Closest to Ryan Realty's brand register

**Cascade Hasson Sotheby's** (parent: Sotheby's International Realty). Mountain/regional luxury market in the $800K–$3M+ band, cream/ivory editorial palette, serif headlines, narrative-led property descriptions, Issuu flipbook collateral as the long-form surface. The Sotheby's parent system gives them a magazine-grade visual register and they pull it through to the Bend market intact. **This is the direct competitor and the right comparison target.** Ryan Realty's heritage cream + navy register is already in the same family; the gap is the editorial polish on the listing detail page and the existence of a flipbook-style long-form lookbook.

## Pointer URLs ("this look" references)

- **Editorial register reference**: `https://www.luxuryatcompass.com/lifestyle/bold-luxury-homes` — show this to Matt as the bar for editorial-tier listing presentation.
- **Per-listing narrative + minimalism reference**: `https://hiltonhyland.com/property/610-arkell-dr-beverly-hills-ca-90210/` — the cleanest single-property detail page in the audit (named estate, narrative description, agent personalization, no clutter).
- **Local-tier brand register reference**: search Issuu for "Cascade Hasson Sotheby's Luxury Lookbook" — the long-form flipbook our local Sotheby's competitor uses as their listing collateral. Ryan Realty needs a publication-grade equivalent, not a Canva flyer.

## What this means for the Ryan Realty listing kit

The two pipelines Matt has already rejected — Playwright HTML at 1080×1350 and Canva templates — were both built at the wrong register. Top brokerages don't ship square Instagram tiles as their primary listing collateral. They ship:

1. A full-bleed editorial detail page on the brokerage site (Hilton & Hyland model).
2. A long-form Issuu/flipbook lookbook (Cascade Hasson model) as the property book.
3. A magazine-style editorial spotlight above the listing layer (Compass Luxury model).

A square Canva tile is collateral for the social channel — not the listing's primary presence. The next pipeline should target the Issuu/flipbook + editorial detail page surfaces first; the Instagram tile is the export, not the source of truth.
