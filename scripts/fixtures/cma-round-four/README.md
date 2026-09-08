# Round-four class A–D render fixtures

`render_args` overlays for `scripts/cma-lookpass.ts --overlay`. Each one is
deep-merged into a stored `cmas.render_args` **in memory** and rendered through
the production letter and immersive functions. Nothing is written back.

They exist because the four fields the round-four audit's classes A–D turn on —
`pricing.sellerNet` (itemised), `expiredAudit.askExposure`, `pricing.review`
and `subjectStatus` — land on the pricing side in the same cycle as the
document work, so no stored row carries them yet. Reasoning about how those
chapters "would" render is the habit that shipped the defects; these render
them.

**These are SHAPES, not measurements.** Every dollar figure here is arithmetic
built to satisfy the reader contract (`readSellerNetSheet` refuses a column
that does not add up), and the exposure day counts on 2465 are the audit's own
(`$475,000 for 152 of its 187 days`). Nothing in this directory may be quoted
as a figure about a real home — that is what the live row is for (CLAUDE.md §0).

Usage:

    npx tsx scripts/cma-lookpass.ts --check --interact \
      --overlay scripts/fixtures/cma-round-four/2465-class-abd.json \
      cma-2465-7th-redmond-97756

Shots land in `out/cma-look/<slug>@<fixture-name>/`.
