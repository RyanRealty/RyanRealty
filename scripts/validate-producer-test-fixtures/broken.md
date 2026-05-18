---
name: broken-producer
description: A deliberately broken producer fixture for testing validate-producer.mjs.
action_types:
  - content:broken_test
output_type: video
target_platforms:
  - ig_reel
  - not_a_real_platform
---

# Broken Producer

This fixture intentionally fails multiple validator gates.

Intentional failure list (do not fix, this is a test fixture):

A. Missing frontmatter fields: asset_destination, auto_inputs, required_inputs,
   optional_inputs, estimated_runtime_min, cost_usd_estimate, thumbnail_uri,
   example_outputs are all absent from the frontmatter block.

B. Banned dash characters appear below:
   Homes sold in an average of 38 days on market — a sign of strong demand.
   Price growth ran from $475,000 to $510,000, a spread of roughly 7.4%.
   Inventory remained tight: just 1.2 months of supply.
   The seasonal pattern here runs May through September, which drives 60-70%
   of annual transaction volume. The buyers are motivated — the sellers are too.

C. Only two of the eleven required section headings are present (1 and 2 only).
   Sections 3 through 11 are missing.

D. Recipe section has only two steps and references only one tool.

E. No mandatory reference citations. All eight base references and all four
   content-specific references are omitted from this document.

F. No Status field.

G. target_platforms includes "not_a_real_platform" which is not in the enum.

---

## 1. What it makes

A broken video that should never ship from this fixture.

---

## 2. Input contract

Needs a city slug from the action row target field.

---

The recipe here is deliberately thin:

Step 1. Pull data.

Step 2. Render with a tool.

Only two steps, only one vague tool mention. This fails gate 7.

No cross-references to other producers or SKILL.md paths are included,
so gate 8 (dependency check) has nothing to flag there.

This document deliberately omits every required reference string so that
gates 4 and 5 register as failures, not as passes.
