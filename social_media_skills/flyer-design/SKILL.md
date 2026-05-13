---
name: flyer-design
description: >
  Canonical static design skill for listing flyers and print/digital collateral. Use when Matt
  asks for "flyer", "just listed flyer", "open house flyer", "property sheet", "single-page
  listing PDF", "print handout", "marketing one-sheet", or similar static asset requests.
  Enforces brand-system layout, typography hierarchy, data accuracy, and anti-slop rules before
  any draft is surfaced.
when_to_use: >
  Triggered by phrases: "make a flyer", "design this listing sheet", "build a printable handout",
  "create a just-listed one pager", "open house collateral", "social + print flyer". This is a
  support skill: content production still routes through content_engine first.
---

# Flyer Design

## Purpose

Create high-quality static collateral that feels premium, readable, and brand-correct on both
mobile and print. This skill is the hard standard for flyer composition quality so low-quality
"auto-template" outputs do not ship.

## Required references (load before design)

1. `design_system/ryan-realty/SKILL.md` — **authoritative** colors + typography (flyers count as print/postcard-class collateral; v2 palette: navy `#102742`, cream `#faf8f4`, sand `#e8e2d4` — no gold)
2. `video_production_skills/brand_assets/SKILL.md` — light editorial register, hierarchy, negative space
3. `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §5 — brand colors, banned words (video forbids Butcher; flyers follow static rules below)
4. `video_production_skills/ANTI_SLOP_MANIFESTO.md` (authenticity + no fake claims)
5. `CLAUDE.md` §0 (data accuracy / verification trace)
6. **[`social_media_skills/platform-best-practices/SKILL.md`](../platform-best-practices/SKILL.md)** — 2026 platform rule layer. Cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + Ryan Realty application matrix. Per CLAUDE.md "Skill self-binding (2026-05-13)", mandatory for every Ryan Realty content piece.

## Broker headshots

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.jpg` — Matt Ryan (owner / principal broker)
- `paul-stevenson.jpg` — Paul Stevenson
- `rebecca-peterson.jpg` — Rebecca Peterson

All 800×1200 px, pure white bg, identical head height, natural color. Specs in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Listing-agent rule:** Every listing flyer includes the LISTING AGENT'S headshot in the broker footer. Resolve `ListAgentEmail` / `ListAgentFullName` from the Supabase `listings` row to one of the three brokers above. For brand-led collateral with no specific listing agent (open-house generic, farming mail), omit the headshot and use the Jax mascot from `assets/brand/blue-dog.png` instead.

## Inputs (mandatory)

- Verified listing payload from source of truth (MLS/Spark/Supabase): address, price, beds, baths,
  sqft, lot, year built, MLS number, status, brokerage/legal text.
- Approved photo set (source-traced, no watermark, no AI fake property visuals).
- Deliverable intent: print (`8.5x11`, postcard, etc.), digital feed (`1080x1350` / `1080x1080`),
  or both.
- **Listing agent headshot** — resolved from `ListAgentFullName` to one of the three broker headshots at `design_system/ryan-realty/assets/team/`. Required for any listing flyer. Missing headshot = stop and resolve before building.
- CTA + compliance copy (phone, email, URL, legal footer if required).

If any input is missing, stop and request it. Do not fabricate.

## Photography and layout (NON-NEGOTIABLE for Just Listed / Open House)

**Single full-width exteriors that read “tiny house, giant lawn/sky” are a hard fail** for feed flyers.
Agent templates are not the bar; MLS marketing collateral is.

1. **Minimum photo count — digital / social flyer**
   - **≥ 4 usable angles** in hand before composition (hero + three alternates), unless Matt explicitly approves a hero-only print exception.
   - Hero: best **twilight or daytime money shot** of the structure (not ambiguous lot/sky dominance).
   - Filmstrip / secondary row: **different registers** (e.g. kitchen, living, rear exterior, primary suite). **Never** three copies of the same file to fake variety.

2. **Hero crop and scale (“zoom”)**
   - Default: **tighter center-weighted crop** so the **structure fills** the hero frame. Empty foreground grass, idle sky wedges, or distant house silhouettes = revise crop or pick a tighter source frame.
   - Treat `heroZoom` (or equivalent) as a first-class control: typical range **1.25–1.45** for wide shots; verify by eye at phone width.
   - Thumbnails: same discipline — each thumb is **cover + slight zoom**, not letterboxed mini-postcards.

3. **Trained eye before any send**
   - The producing agent **stops** after layout and runs **`design_review_checklist`** (below) as a literal self-audit. If any item is “no,” fix or **do not surface** the draft.
   - **No flyer is “ready,” “final,” or “for distribution” in chat** — only “draft for Matt review.” Matt is the approval authority. This matches draft-first / publish rules in `CLAUDE.md`.

### `design_review_checklist` (write to `out/flyers/<slug>/design_review_checklist.json`)

Score each item `pass` / `fail` with one sentence of evidence:

| # | Check |
|---|--------|
| 1 | Hero makes the **property** the subject (not sky, not empty yard). |
| 2 | **≥3 distinct** supporting photos (or documented exception). |
| 3 | Cropping feels **intentional** (no accidental “too far away”). |
| 4 | Typography matches § Typography (Amboqia display / Geist body / Azo ribbon — no silent fallback). |
| 5 | Readable on **phone width** (critical text, price pill, MLS). |
| 6 | Contrast / overlays follow brand (no navy-on-navy, no busy text on busy focal point). |

If any item is `fail`, the package is **not** shown as client-ready.

## Compositor (repo)

For repeatable **1080×1350** just-listed layouts (minimal chrome): **Amboqia** **Just Listed** when font on disk else **Geist SemiBold**; logo **hero top-right**; **specs** lower-right **soft navy** panel only (no label, no decorative frame — warm stone border 1px if border needed); **MLS**, **price**, **address**, **city** on gradient (**no** frosted card); optional **3-up filmstrip**; footer **⅔** plain MLS body copy **| ⅓** centered **headshot**, then name, phone, email, **Ryan Realty** (no URL/CTA).

- Run: `npm run flyer:just-listed -- --config out/flyers/<slug>/config.json --out out/flyers/<slug>/render.png` (compositor uses v2 palette: navy/cream/sand — no gold frame)
- **Amboqia** paths: `FLYER_FONT_AMBOQIA`, `video/market-report/public/Amboqia.otf`, `listing_video_v4/public/fonts/Amboqia.otf`.
- **Photos:** `npm run flyer:fetch-photos -- --mls <ListNumber> --out-dir out/flyers/<slug>` pulls **deduped**
  URLs from `listing_photos`, or from `details.Photos` + `PhotoURL` when the photos table is empty,
  then rewrites `config.json` `photos` with local filenames. Never hand-duplicate the same path.
  Also refreshes **`acres`**, **`description`** (public remarks), **price**, **beds/baths/sqft**,
  **address/city**, and **status** from the same listing row when present.
- Source: `scripts/render-just-listed-flyer.mjs` (hard-fails if any `config.photos` path repeats)
- Source: `scripts/fetch-listing-photos-for-flyer.mjs`

## Typography — NON-NEGOTIABLE (brand fonts only)

Flyers are **static collateral**. They must use the licensed brand faces from the authoritative
design system, not system or generic web fallbacks.

**Canonical pairing (per `design_system/ryan-realty/SKILL.md`):**

| Role | Font | Use on flyer |
|------|------|----------------|
| Hero headline, "Just Listed" stamp, address line as display, pull-style title | **Amboqia Boriango** | Short lines only (2–4 words per line where possible). Never for body paragraphs. |
| Body, specs, price block, MLS#, agent name, legal footer, all data | **Geist** | All multi-line copy and numbers. **`font-variant-numeric: tabular-nums`** on every numeric surface. |
| Ribbon / sub-label under wordmark or hero (e.g. small uppercase kicker) | **Azo Sans Medium** | Uppercase only, rare — one line max in the hero zone. |

**Forbidden:**

- Defaulting to Arial, Helvetica, Times, Roboto, or "whatever the canvas picked"
- Using **Butcher** on a flyer unless Matt explicitly requests that legacy print track (Butcher is called out in `brand_assets` for some static contexts; it is **not** in the canonical `brand-system` tree — when in doubt, use **Amboqia + Geist + Azo** as above)
- Using **Amboqia** for body copy, long MLS disclaimers, or dense spec blocks
- Using **Geist** for the main hero display headline when Amboqia is available (hero must read as heritage display)

**Technical requirement:**

Before export, the build MUST load real font files (e.g. `FontFace` / embed in PDF / canvas registerFont). If a brand file is missing, **stop** and obtain it — do not ship a flyer that silently falls back to Playfair/Georgia/system sans.

The output package must include **`fonts_used.json`** listing exact files embedded or referenced:

```json
{
  "display": { "family": "Amboqia Boriango", "files": ["<path or note>"] },
  "body": { "family": "Geist", "files": ["<path or note>"] },
  "ribbon": { "family": "Azo Sans Medium", "files": ["<path or note>"] },
  "fallbacks_suppressed": true
}
```

If any family resolved to a fallback at render time, the flyer **fails** the quality gate.

## Build procedure

1. **Frame spec + purpose**
   - Lock canvas size(s), bleed/safe margins, and where this flyer will be used.
   - Define one primary message (the hook) and one supporting story.

2. **Information architecture (before styling)**
   - Layout hierarchy is fixed:
     1) Hero hook (price, key promise, or address)
     2) Core facts (beds/baths/sqft/lot + status)
     3) CTA/contact + compliance footer
   - Max 3 visual tiers per panel. If more, simplify.

3. **Composition + typography**
   - Use brand-safe palette and high contrast (light editorial register: cream `#faf8f4` or white ground, navy `#102742` type, sand `#e8e2d4` accent — see `design_system/ryan-realty/SKILL.md`). No gold.
   - Enforce **exactly** the trio in the typography table above: one display face (Amboqia), one body face (Geist), optional ribbon (Azo). No extra display fonts.
   - Keep mobile readability: no critical text below practical feed readability.

4. **Photo and overlay treatment**
   - Hero photo must be on-topic and geographically relevant when location matters.
   - No watermarks, no distorted stretching, no heavy filter gimmicks.
   - Overlay text never obscures focal property details.

5. **Render drafts**
   - Produce 2-3 variants with intentional differences (layout emphasis, not random styling).
   - Export deterministic file names under `out/flyers/<slug>/`.

## Static design quality gate (hard fail rules)

A flyer is NON-SHIP if any check fails:

1. Any listing number/callout does not trace to verified source data.
2. Watermarked/unknown-provenance photo is present.
3. Contrast/readability failure on mobile view.
4. Typography drift (more than one competing display style or inconsistent body scale system),
   **or any brand font missing / fallback used** (see `fonts_used.json` and typography section).
5. **Photography / layout failures**: single distant hero with no secondary photos; duplicate photos
   posing as a filmstrip; hero subject reads as sky/lot instead of structure; unchecked
   `design_review_checklist` (any `fail`).
6. Cluttered layout: more than 3 hierarchy levels competing in the same panel.
7. Missing legal/compliance footer when required for listing status/type.
8. Banned/cliche copy from brand rules or filler claims unsupported by listing facts.

## Output package

For each approved draft, write:

- `out/flyers/<slug>/<name>.png` (or `.pdf` for print handoff)
- `out/flyers/<slug>/design_scorecard.json`
- `out/flyers/<slug>/citations.json` (for every numeric/property claim)
- `out/flyers/<slug>/provenance.json` (photo source + creator/license/source id)
- `out/flyers/<slug>/fonts_used.json` (mandatory — exact Amboqia / Geist / Azo files used)
- `out/flyers/<slug>/design_review_checklist.json` (mandatory — all checks `pass` before surfacing)

The draft is surfaced to Matt only after this package exists and passes.

No flyer is posted/printed/distributed until Matt explicitly approves the specific file in the
current session.

## See also

- `automation_skills/content_engine/SKILL.md`
- `automation_skills/automation/publish/SKILL.md`
- `video_production_skills/brand_assets/SKILL.md`
- `skills/youtube-market-reports/brand-system.md`
