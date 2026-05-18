---
name: broker-contact-card
description: >
  Produces the locked Ryan Realty broker contact card.  a 1080×1350 IG tile with full
  brand (wordmark, transparent broker portrait, name, role, phone, email). This is the
  MANDATORY FINAL TILE on any IG carousel for a deal where Ryan Realty represented the
  BUYERS, not the listing side. Use whenever Matt says "buyer-side post", "buyer's
  rep deal", "buyer contact card", "broker contact tile", "broker brand tile", or any
  produced content for a transaction where the listing isn't ours but we represented
  the buyer.
when_to_use: |
  Trigger when Matt says any of:
  - "build a buyer-side post for <address>"
  - "[buyer-side closing | under-contract] content for <address>"
  - "Rebecca's buyer post"
  - "Paul's buyer post"
  - "Matt's buyer-side post"
  - "broker contact card"
  - "broker brand tile"
  - automatically whenever building any S2-style sold OR under-contract content where
    Ryan Realty is the BUYER-side agent (not the listing agent)
action_types:
  - content:broker_card
output_type: image
target_platforms: ["ig_feed", "ig_carousel", "fb_feed"]
asset_destination: Supabase asset-library bucket + public/list-kits/<address>/
auto_inputs: ["listing photos from Spark", "brand tokens", "design system v2"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["aspect_ratio_overrides", "color_palette_override"]
estimated_runtime_min: 5
cost_usd_estimate: $0.05-$0.50 per image
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.png
example_outputs: []
    label: "past approved renders"
    surface: "ig_carousel"
---

# Broker Contact Card · Buyer-Side Last Tile

**Status:** Canonical  
**Locked:** 2026-05-17  


## CRITICAL.  Layout is DERIVED FROM S7-Agent-Intro. Do not shuffle.

**The card layout is not invented here.** It is the approved **S7 Agent Intro** layout
from `scripts/build_single_image_posts.py` (function `s7_agent_intro()`), extended by
a compact contact block in the bottom 200 px. Matt approved S7 on 2026-05-12.  the
rendered reference lives at
`public/template-picker/list-kits/19496-tumalo-reservoir/v3/single-image/S7-agent-intro.jpg`.

If S7 changes (portrait height, name size, divider position, eyebrow style), update
**both** `s7_agent_intro()` AND `build_broker_contact_card.py::build_card()` together so
they stay in sync. A drift between them is a bug.

### Locked layout.  DO NOT reshuffle without explicit Matt approval

```
1080 × 1350 cream background

y=60   ─ Eyebrow top-left, Azo Sans 22 tracked 0.20em (S7 spec).
         Varies by moment: buyer → "YOUR BUYER'S AGENT"
                           seller → "YOUR LISTING AGENT"
                           generic → "MEET YOUR BROKER"
y=100  ─ Hairline under eyebrow (1px navy)

y=60-880  ─ Transparent broker portrait, 820 px tall, centered horizontally
            (IDENTICAL to S7 spec)

y=920  ─ Hairline divider centered (180 px from each edge)

y=970  ─ Name centered, Amboqia 86px, navy

y=1080 ─ Role centered, Azo Sans 26: "Broker · Ryan Realty" / "Principal Broker · Ryan Realty"

y=1122 ─ Sub-line centered, Azo Sans 22, slate (80,90,110):
         "Bend · Tumalo · Central Oregon"

──── Contact block (added vs S7; do not move) ────

y=1182 ─ License # centered, tracked uppercase Azo Sans 14, slate
         e.g. "OR LIC. #201254727"
y=1218 ─ Phone centered, Azo Sans 26, navy
         e.g. "415.308.9087"
y=1260 ─ Email centered, Azo Sans 17, slate
         e.g. "rebeccapeterson@ryan-realty.com"
```

**No logo.** S7 doesn't have one. The wordmark is already implied by the "Ryan Realty"
text in the role line. A second wordmark would compete with the name.

**No "side-by-side" two-column contact, no decorative rules below the portrait, no
website URL bottom-right.** Those were inventions from earlier iterations and got
rejected. Stay locked to S7 + the contact block above.

**Approved-state reference:** `out/proof/2026-05-14/rendered/broker-cards/rebecca-buyer.jpg`
locked 2026-05-14.  must match the S7-derived layout above.

**The rule that creates this skill (locked 2026-05-14):**

> "For buyer-side listing stuff, we're going to do the single tiles, and that last tile
> will be the broker photo and the broker branding essentially. We'll remove all of the
> longer property carousels."

For ANY IG sequence where Ryan Realty represented the BUYERS:

1. **No multi-photo Pattern A carousel.** The listing isn't ours to sell.  our SERVICE is.
2. **Single branded tiles only**.  S2 hero (sold / under-contract overlay), optional
   Pattern B editorial variant, broker contact card.
3. **Final tile is ALWAYS the broker contact card.** Cream background, wordmark top,
   transparent broker portrait centered, name in Amboqia, role tracked uppercase, phone
   + email below. No exceptions.

---

## 1. Scope

### In scope
- 1080×1350 IG portrait JPG.
- Cream `#faf8f4` background, navy `#102742` ink.
- Top section: pre-rendered Ryan Realty wordmark (`logo-blue.png`, 420 px wide, centered).
- Hairline divider under logo.
- Tagline (Azo Sans Medium tracked uppercase).  varies by `moment` payload.
- Middle: broker transparent PNG (`design_system/ryan-realty/assets/team/<slug>.png`),
  580 px tall, centered.
- Bottom: broker name (Amboqia 72), role (Azo Sans Medium 20 tracked uppercase),
  phone (Azo Sans Medium 22, dotted format), email (Azo Sans Medium 18).
- Locked typography. Locked colors. Locked positions.

### Out of scope
- Custom backgrounds or photo-as-background variants (those are S2 / Pattern B).
- Hand-edited contact info (single source of truth is the BROKERS registry in the script).
- Multi-broker cards (one broker per card; this is a single-tile spec).

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:broker_card` | `broker_slug` + `moment` | Single 1080×1350 JPG output |

### Payload schema

```typescript
interface BrokerContactCardPayload {
  broker_slug: 'matt-ryan' | 'paul-stevenson' | 'rebecca-peterson'
  moment: 'buyer' | 'seller' | 'generic'  // changes tagline
  output_path: string  // where the JPG lands
}
```

### Moment → tagline mapping (locked in BROKERS registry inside the script)

| moment | tagline |
|---|---|
| `buyer` | "Looking for the right home in Bend?" |
| `seller` | "Considering selling your home in Bend?" |
| `generic` | "Real estate done right.  in Bend, Oregon." |

---

## 3. Broker registry (single source of truth)

Inside `scripts/build_broker_contact_card.py`, the `BROKERS` dict holds the locked
contact info for each broker. Update this dict when contact info changes, not the
contact sheet HTML or any individual card.

```python
BROKERS = {
    "matt-ryan":         {"phone": "541.213.6706", "email": "matt@ryan-realty.com",...},
    "paul-stevenson":    {"phone": "541.213.6706", "email": "paul@ryan-realty.com",...},
    "rebecca-peterson":  {"phone": "415.308.9087", "email": "rebeccapeterson@ryan-realty.com",...},
}
```

Rebecca's contact info is sourced from Spark API `BuyerAgentEmail` /
`BuyerAgentPreferredPhone` fields on her recent buyer-side transactions (verified
2026-05-14 from MLS 220202576).

---

## 4. The recipe

1. Resolve the broker from `broker_slug` against the BROKERS registry.
2. Verify the broker portrait PNG exists at `design_system/ryan-realty/assets/team/<slug>.png`.
3. Build the 1080×1350 canvas (cream background).
4. Paste the Ryan Realty wordmark (`logo-blue.png`, 420 px wide) centered at y=80.
5. Draw the hairline divider under the wordmark.
6. Tracked-uppercase the tagline (per moment) below the divider.
7. Paste the broker's transparent portrait centered, 580 px tall.
8. Draw the broker name (Amboqia 72) below the portrait, centered.
9. Tracked-uppercase the role below the name.
10. Draw the phone (Azo Sans Medium 22, dotted format like `415.308.9087`).
11. Draw the email below.
12. Save as JPEG quality 92.

Layout positions are encoded in the script. Do not adjust without Matt's approval.

---

## 5. Tools used

| tool | purpose | path |
|---|---|---|
| Pillow (PIL) | image compositing | `scripts/build_broker_contact_card.py` |
| Amboqia Boriango font | broker name display | `design_system/ryan-realty/fonts/Amboqia_Boriango.otf` |
| Azo Sans Medium font | tagline / role / contact | `design_system/ryan-realty/fonts/AzoSans-Medium.ttf` |
| Ryan Realty wordmark | brand mark on card | `design_system/ryan-realty/assets/brand/logo-blue.png` |
| Broker portraits | transparent PNGs | `design_system/ryan-realty/assets/team/{matt-ryan,paul-stevenson,rebecca-peterson}.png` |

---

## 6. Output format

```
out/<batch-path>/broker-card.jpg   (single 1080×1350 JPG)
```

Or batch into a sub-directory if rendering multiple brokers for a multi-tile spread:

```
out/<batch-path>/broker-cards/
├── rebecca-buyer.jpg
├── matt-seller.jpg
└── paul-generic.jpg
```

---

## 7. Approval gate

`matt-review-draft`.  same as all content. Matt sees the rendered card in the contact
sheet and says "ship it" / "approved" before publish.

---

## 8. Status flow

Per `marketing_brain_skills/producers/TEMPLATE.md`.  pending → in_production → ready →
approved → executed → measured.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Unknown broker_slug | KeyError on BROKERS lookup | Surface the valid keys; ask Matt which broker |
| Missing broker portrait PNG | FileNotFoundError | Resolve PNG path; check `design_system/ryan-realty/assets/team/`; never substitute a non-transparent JPG |
| Stale contact info | Phone or email doesn't match Spark | Update the BROKERS registry in the script; commit; re-render |

---

## 10. Related skills + references

**Required reading:**
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `~/.claude/.../memory/feedback_use_approved_generators.md`.  use the script, don't re-implement
- `~/.claude/.../memory/feedback_contact_sheet_required.md`.  contact-sheet HTML for review

**Composes with:**
- `social_media_skills/ig-single-post/SKILL.md`.  S2 hero is the first tile of a buyer-side sequence
- `social_media_skills/instagram-carousel/SKILL.md`.  buyer-side variant: NO Pattern A photo carousel; use S2 + optional Pattern B + broker card

**Registry entry:**
- Add to `marketing_brain_skills/producers/REGISTRY.md` Section B (Content Producers)
  on the next session that touches the registry.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
