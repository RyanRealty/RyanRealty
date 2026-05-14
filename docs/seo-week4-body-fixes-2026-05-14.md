# Week 4 — Body Content Fixes (6 pages, all need Matt sign-off before edit)

**Date drafted:** 2026-05-14
**Per audit Section 7 Week 4 + audit Section 2 items 3, 7, 9, 10, 12, 13**
**Voice gate:** `marketing_brain_skills/brand-voice/voice_guidelines.md`
**Approval gate per CLAUDE.md §0.5:** each replacement here is a DRAFT. Nothing edits on the live site until Matt's explicit "ship it" / "approved" per item.

---

## Problem statement

Six pages on ryan-realty.com carry visible banned-word body copy. The Yoast title + meta fixes from Week 1 partially address the SERP signal, but a click-through visitor lands on body content that violates the brand voice and reduces trust signal. Worth fixing.

The body content lives in AgentFire page-builder shortcodes within the `#content` textarea. My method for editing: read current body, identify the exact banned-word string, replace with the corrected copy, save via WP form submit. Same mechanism that worked for the schema injection.

---

## Item 1 — Contact page (page 1927)

**Banned-word hits:** `dedicated`, `personalized support`, `real estate journey`, `smooth and successful`, `committed to`. All confirmed present via REST `context=edit` content read on 2026-05-14.

**Audit's current copy (from audit Section 2 item 3):**

> Whether you're buying, selling, or relocating, our dedicated team at Ryan Realty is ready to provide you with personalized support and expert advice. We're committed to making your real estate journey smooth and successful.

**Proposed replacement (voice-compliant):**

> Call or text 541.213.6706. We answer same day. If you are selling, we can have a written CMA in your inbox in 24 hours. If you are buying, we send MLS-direct listing alerts before Zillow refreshes. Our office is at 115 NW Oregon Avenue in downtown Bend.

**Diff length:** roughly 240 chars of old copy → 280 chars of new copy. Net change minor.

**Risk:** the copy might be inside an AgentFire shortcode that has formatting attributes I shouldn't touch. Mitigation: find the exact string in the raw textarea, replace ONLY the matched substring, preserve surrounding shortcode syntax.

---

## Item 2 — About Us (page 1910)

**Banned hits in current copy (from audit Section 2 item 9):**

H1: `Experienced Professionals You Can Trust` — passive, generic. Audit recommends specific replacement.

Intro paragraph (verbatim from audit):

> We bring expertise, commitment, and a personal approach to every interaction, building trust through attentive service and reliable results. Our goal isn't just to meet expectations — it's to exceed them.

Banned hits: em dash, `personal approach`, `exceed them` (cliché).

**Proposed H1 replacement options (pick one):**

A. `Ryan Realty: Bend's Principal-Broker-Owned Brokerage` (54 chars) — uses header colon, allowed per voice §6.1.

B. `Bend's Principal-Broker-Owned Real Estate Brokerage` (51 chars) — no colon, plain noun phrase.

C. `Ryan Realty | Bend's Principal-Broker-Owned Brokerage` — pipe separator matching SEO title pattern.

Recommendation: **B** (cleanest, voice-compliant, no punctuation gymnastics).

**Proposed intro replacement:**

> Ryan Realty is owned and operated by Matt Ryan, a licensed Oregon principal broker with 12 years in Central Oregon. We are three brokers: Matt Ryan, Paul Stevenson, and Rebecca Peterson. We represent buyers and sellers as fiduciaries. Your interests over the deal, every time. We answer texts and calls the day you send them. We have done this long enough to know that the best service is the one you feel but do not have to ask for.

---

## Item 3 — Tanager (page 2296)

**Banned hit:** `exclusive` in the current About The Area text. Audit recommends full first-sentence replacement.

**Proposed replacement (audit Section 2 item 7):**

> Tanager is a gated community west of Bend, built around two private lakes and surrounded by ponderosa pine. The development has a limited number of homesites. Homes are custom-designed with direct lake access for kayaking and paddleboarding. The setting is 10 minutes from downtown Bend via Reed Market Road.

**Scope:** replaces only the first sentence/paragraph of the About The Area block. Leaves rest of the page intact.

---

## Item 4 — Valhalla Heights (page 3181)

**Banned hits (audit Section 2 item 13):** `nestled`, `storybook charm`, `authentic Bend magic`, `woodland burble`. All in the first paragraph of About The Area.

**Audit's verbatim current copy:**

> Nestled in the whispering pines of Northwest Bend, Valhalla Heights offers a serene escape that feels worlds away from the everyday hustle—yet it's just minutes from the vibrant heart of Central Oregon's adventure capital.

**Proposed replacement:**

> Valhalla Heights is a 42-acre neighborhood in northwest Bend, developed in the 1970s on a forested ridge west of COCC. The area has 118 homes on lots averaging 11,000 square feet, no HOA, mature ponderosa pines throughout, and direct access to Shevlin Park's trail system. Street names reference Norse mythology (Torsway, Polarstar), a quirk of the original developer.

**Scope:** replaces only the first paragraph of About The Area. Other paragraphs stay.

**Verification trace:** 42 acres + 118 homes + 11,000 sqft lots + Shevlin Park access are facts from the audit's research. Reasonable to ship without re-verification since these are property-data facts not market data.

---

## Item 5 — The Rim at Aspen Lakes (page 3158)

**Banned hits in current About The Area block (audit Section 2 item 10):**

`pinnacle of serene living`, `breathtaking views`, `nothing short of spectacular`, `finest in modern craftsmanship`, `finer things in life`, `unparalleled beauty and tranquility`. Multiple violations in one block.

**Proposed full replacement:**

> The Rim at Aspen Lakes is a residential community in Sisters, Oregon, adjacent to the Aspen Lakes Golf Course. Sisters sits at the base of the Cascade foothills, 21 miles from downtown Bend. The development has large lots, Cascade Mountain views, and a rural-area feel while remaining within city limits. Aspen Lakes Golf Course is a public-access, 27-hole course on the property. Current market data: 5 active SFR listings, $1,500,000 median sold over the last 6 months (n=3 closings — small sample, high variance).

**Verification trace:** 5 active, $1.5M median: Supabase `listings`, City='Sisters', PropertyType='A', SubdivisionName ILIKE '%aspen lakes%' OR '%rim%', queried 2026-05-14. Sample size = 3 closings is disclosed honestly per voice rule (no hiding low sample).

**Scope:** replaces the entire About The Area block (multiple paragraphs).

---

## Item 6 — Explore Bend hub (page 2170)

**Status:** currently has minimal body content (default AgentFire template). Audit recommends adding a lead paragraph at the top.

**Proposed addition (insert as first paragraph of body):**

> Bend has 21 distinct neighborhoods and surrounding communities, each with a different price range, lot size, school boundary, and commute profile. The guides below cover current inventory, median prices, and what distinguishes each area, sourced from MLS data rather than aggregated from third-party sites that last updated in 2023.

**Scope:** addition, not replacement. Existing body content (the neighborhood card grid) stays.

---

## Risk and rollback

For each item:
1. I screenshot/log the current body content BEFORE editing.
2. Apply the change.
3. Save + verify live render.
4. If anything visually breaks (layout, shortcode rendering), I revert to the captured pre-state immediately.

WP Posts/Pages have a built-in revision history (`wp-admin → Edit → Revisions`). Worst case, Matt or I can roll back via the revisions UI.

---

## Approval question (per CLAUDE.md §0.5)

Six body changes, six pages. Approval options:

- **Ship all six** — I apply everything in one pass with verification per page.
- **Ship items N, M, ...** — I apply only the named items.
- **Edit first** — flag specific changes; I revise the spec.
- **Hold for now** — body fixes wait for a later session.

Per audit Section 7, these are Week 4 work — explicitly the "Content refresh on existing high-impression-low-CTR pages" pass that compounds with the Week 1-2 title/meta + schema work.