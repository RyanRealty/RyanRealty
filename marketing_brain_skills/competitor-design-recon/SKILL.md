---
name: competitor-design-recon
description: Use this skill before rebuilding any flat-design producer (FB lead-gen ad / 8.5×11 flyer / LinkedIn document carousel / IG carousel / map static card / Google Ads SERP card). Pulls 30-50 high-performing real-world examples via Apify, downloads imagery, and documents the top 5 layout patterns in a format-keyed recon.md so producers adapt proven patterns instead of inventing layouts. Runs ONCE per format, then monthly to catch trend drift. Companion to marketing_brain_skills/competitor-recon which tracks WHO is posting WHAT; this skill documents HOW high-performers LAY OUT their designs.
---

# competitor-design-recon — Apify-Driven Design Pattern Library (locked 2026-05-20)

## Canonical references

Every design recon run loads:

1. [`CLAUDE.md`](../../CLAUDE.md) — brand voice + draft-first + design system rules
2. [`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md) — what we're adapting INTO
3. [`marketing_brain_skills/brand-voice/voice_guidelines.md`](../brand-voice/voice_guidelines.md) — copy rules for any text in the recon
4. [`marketing_brain_skills/competitor-recon/SKILL.md`](../competitor-recon/SKILL.md) — sibling skill (WHO + WHEN); this skill is the HOW

---

## The rule

**Before any flat-design producer is rebuilt, run this skill to pull 30-50 high-performing real-world examples of that format, document the top 5 layout patterns, and store the pattern library at `out/design-recon/<format>/`.** Producers read the recon.md at build time and adapt one of the documented patterns to Ryan Realty's brand register — they do NOT invent layouts from scratch.

Matt's directive (2026-05-19 handoff):

> "Instead of trying to recreate the wheel, use Apify to find some [X] that are good and then just use our branding."

This skill enforces that across every design format we ship.

---

## Five seed formats (each producer maps to one)

| Format key | Producer(s) consuming it | Apify actor | Search target |
|---|---|---|---|
| `fb-lead-gen-ad` | `facebook-lead-gen-ad` | `apify/facebook-ads-library` | High-performing real estate FB lead-gen ads (Bend or comparable secondary-home markets) |
| `print-flyer` | `flyer-design` | `apify/google-search-scraper` | "real estate listing flyer" 8.5×11 image results filtered to top-tier brokers |
| `linkedin-doc-carousel` | `linkedin-document-carousel` | `apify/instagram-scraper` (LinkedIn doc carousels also surface) or `apify/website-content-crawler` on `site:linkedin.com/posts` | LinkedIn native PDF carousels by top real-estate creators |
| `ig-carousel` | `single_image_posts`, listing IG carousels | `apify/instagram-scraper` | Top-engagement IG real estate carousels (carousel-type posts only) |
| `map-static-card` | `map_static_card` | `apify/google-search-scraper` | Real estate listing location-cards on Zillow / Compass / Sotheby's (image SERP) |
| `google-ads-serp` | `google-ads-copy` | `apify/google-search-scraper` (organic + ads) | Real estate Google Ads SERP cards — headlines, sitelinks, ad formats |

New formats are added to this table when a producer needs recon. Never skip the recon step — adding a producer-specific design without recon is the failure mode this skill exists to prevent.

---

## Workflow

### 1. Run the recon

```bash
node scripts/recon-design.mjs --format <format-key> [--count 40] [--query "<custom search query>"]
```

What happens:

1. Resolves the format key to an Apify actor + default query (see table above).
2. Calls Apify's run-actor API with `APIFY_API_TOKEN`.
3. Polls until the actor finishes (or times out at 10 min).
4. Pulls the dataset items.
5. Downloads up to `--count` example images (default 40) to `out/design-recon/<format>/examples/`.
6. Writes the raw scrape to `out/design-recon/<format>/raw.json`.
7. Writes a manifest at `out/design-recon/<format>/manifest.json` (timestamp, count, source URLs).

Cost: each run is 1 Apify actor invocation. Bronze tier ($29/mo) covers ~5-10 runs per format. Bandwidth for 40 image downloads is negligible.

### 2. Pattern-analysis pass

The runner produces raw imagery; the human-or-AI-agent reviewer documents the top 5 patterns in `out/design-recon/<format>/recon.md`. This pass is creative work — it cannot be fully automated. Use these criteria:

- **Heading position** — where does the primary headline anchor? (top-left? top-center? bottom-left? overlaid on hero?)
- **Hero image crop ratio** — what aspect ratio dominates? (3:2? 4:5? full-bleed?)
- **CTA placement** — where does the call-to-action live? (bottom-center button? top-right pill? embedded inline?)
- **Color contrast** — high-contrast (dark overlay on light) or low-contrast (cream-on-cream with thin rule)?
- **Typographic hierarchy** — how many type sizes? Display + body + label, or just two tiers?
- **Asymmetry vs. grid** — strict grid, off-axis composition, or full-bleed photo with minimal overlay?

Score each example 1-5 on visible engagement signals where available (FB Ads Library impressions estimate, IG likes/comments, LinkedIn reactions). Rank by score. Document the top 5 layout archetypes.

### 3. Producer integration

Each design producer reads `out/design-recon/<format>/recon.md` at build time. The pattern is:

```python
# scripts/build_<producer>.py
def load_recon_patterns(format_key: str) -> list[dict]:
    """Load the top-5 layout patterns from competitor-design-recon."""
    recon_path = REPO_ROOT / "out" / "design-recon" / format_key / "recon.md"
    if not recon_path.exists():
        # Surface to Matt — recon hasn't been run for this format yet
        sys.stderr.write(
            f"WARNING: no recon.md for format '{format_key}'. Run:\n"
            f"  node scripts/recon-design.mjs --format {format_key}\n"
            f"Then document the top 5 patterns in {recon_path}.\n"
        )
        return []
    # ... parse the recon.md, return patterns ...
```

The producer's payload should include a `pattern_id` field (from the recon.md). At build time the producer adapts the chosen pattern's layout numbers (heading position, crop ratio, CTA placement) to Ryan Realty's brand register — fonts (Amboqia + AzoSans), colors (navy + cream), wordmark + tagline + canonical contact line.

A producer that builds without consulting recon.md is non-compliant. The pre-build check warns; future passes should hard-fail if recon is missing for a format that has it specified.

---

## Output specification

```
out/design-recon/<format>/
├── manifest.json              # { format, source_query, run_at, item_count, apify_run_id }
├── raw.json                   # full Apify dataset items
├── examples/                  # downloaded imagery (up to --count files, e.g. 40)
│   ├── 001-<source-id>.jpg
│   ├── 002-<source-id>.jpg
│   └── ...
└── recon.md                   # the top-5 layout patterns doc (human/AI-authored)
```

`recon.md` template:

```markdown
# Design Recon — <format>

**Run date:** <YYYY-MM-DD>
**Sample size:** <N>
**Source:** Apify <actor> with query "<query>"

## Top 5 patterns

### Pattern 1: <name>

**Engagement signal:** <metric + value>
**Examples:** examples/001-*.jpg, examples/005-*.jpg, ...

**Layout:**
- Heading position: <description>
- Hero image: <aspect + treatment>
- CTA: <placement + visual treatment>
- Color contrast: <high / low / specific palette>
- Typographic hierarchy: <tiers + sizes>
- Asymmetry: <grid / off-axis / full-bleed>

**Adaptation notes for Ryan Realty:**
- <where Amboqia goes>
- <which navy/cream contrast applies>
- <where the canonical contact line goes>
- <what to avoid carrying over>

### Pattern 2: ...
```

---

## Rerun cadence

| Trigger | Action |
|---|---|
| First time a producer is built | Run recon for that format key. Document patterns. Then build. |
| 30 days since last recon for a format | Rerun. Trends drift. Compare new top-5 to prior top-5. |
| A producer's published designs underperform expectations | Rerun recon. May need a new pattern. |
| Matt requests a new format | Add the format to the seed table above. Run recon. Document patterns. Wire the producer. |

Recon results are stored in `out/design-recon/<format>/`. The directory is gitignored from large `examples/` imagery but the `recon.md` + `manifest.json` are committed (single source of truth for the producer pattern library).

---

## Cost ledger

| Item | Cost | Notes |
|---|---|---|
| Apify Bronze plan | $29/mo | Already active. Covers ~5-10 recons per format. |
| Per-recon Apify run | ~$0.10-$0.50 | Varies by actor + dataset size |
| Image download bandwidth | Negligible | ≤40 images per recon |
| Pattern-analysis human/AI time | 30-60 min | The expensive step. The recon.md is the durable output. |

---

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Build a flat-design producer without running recon for its format | Producer invents a layout from scratch, fails Matt's "your designs aren't as good as what's out there" bar |
| Skip the pattern-analysis pass after the recon script runs | Raw scrape JSON ≠ usable patterns; the recon.md is the deliverable, not the dataset |
| Carry the source's color / type system directly into the Ryan Realty design | Must adapt to brand register (Amboqia + AzoSans, navy + cream). Recon documents LAYOUT, not branding. |
| Use a recon older than 30 days for a fresh build | Trends drift; rerun is cheap |
| Run recon on a national-luxury source for a Central-Oregon mid-market deliverable | Pick the source whose audience matches Ryan Realty's. National-luxury patterns over-index display polish; mid-market patterns over-index information density. Match the audience. |

---

## Change log

| Date | Change |
|---|---|
| 2026-05-20 | **Locked.** Initial skill. Five seed formats wired (FB lead-gen ad / print flyer / LinkedIn doc carousel / IG carousel / map static card / Google Ads SERP). Runner script at `scripts/recon-design.mjs`. Producer-consumption pattern documented. |
