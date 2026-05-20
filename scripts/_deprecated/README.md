# Deprecated producer scripts

Scripts in this directory are NOT in the active producer inventory and are NOT invoked by the marketing brain or content engine. Kept as-is for historical reference + in case we want to revisit a decision.

To revive one: move it back to `scripts/`, re-add an entry to `scripts/producer-inventory.mjs`, and document the rationale for un-deprecating it in this README.

---

## build_floor_plan_render.py (deprecated 2026-05-20)

**Why deprecated:** Per Matt's 2026-05-19 review — real floor plans come from the listing photographer, not from a generated SVG. The PIL-drawn rectangles this producer rendered were not usable as a deliverable. We don't need this artifact in the producer set; the listing flyer + IG single image + IG carousel already carry the property info that would otherwise live on a floor-plan card.

**If we want to bring it back:** the right approach is NOT a generated drawing. It's:
1. Pull a real floor plan image from the listing's photographer / Aryeo / Matterport asset bundle, OR
2. Embed a Matterport dollhouse view, OR
3. Crop and brand-stamp a high-quality photographer-provided PDF floor plan.

None of those need this Python script — they need a fetcher + brand-stamp pass instead.

**Last inventory entry (removed from `scripts/producer-inventory.mjs` 2026-05-20):**

```js
'floor_plan_render': { runner: 'python3', script: 'scripts/build_floor_plan_render.py', section: 'B' },
```
