# 2026-10-14 (Cursor, listing OG hero photo)

Branch `cursor/listing-og-hero-ab34`. Nothing sent.

**Bug after #576.** `/listing/22054302` (not in `listings`) leaked layout default OG. `/api/og?type=listing&id=<MLS>` also painted the Tetherow aerial because tiles were keyed only on ListingKey.

**This branch.** `getListingLookup` (ListNumber or ListingKey). `og:title` address · price · beds/baths. Card uses the hero photo + price; default only when there is no photo. CI in `lib/og/listing-share.test.ts` and `app/api/og/listing-og.test.ts`.

**Next:** PR, watch checks, squash-merge, verify three Bend actives with facebookexternalhit.

Skills read: `.cursor/skills/site-queue/SKILL.md`, `.cursor/rules/git-commit.mdc`, `docs/plans/handoffs/README.md`.
