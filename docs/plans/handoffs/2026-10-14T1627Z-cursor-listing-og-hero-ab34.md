# 2026-10-14 (Cursor, listing OG hero live)

Surface: Cursor cloud. Time: 2026-10-14T1627Z.
`main` @ `e234ad558` after #586 squash-merge. Branch `cursor/og-preview-images-a259` deleted. #585 closed as superseded.

## Done
Listing pages emit the MLS hero as `og:image` (`/api/og?type=listing&id=` ListNumber or ListingKey via `getListingLookup`). `og:title` is address · price · beds/baths. Card is photo + wordmark. `facebookexternalhit` is in `GOOD_BOT_RE` (no bot-screen shell). CI: `lib/og/listing-share.test.ts`, `app/api/og/listing-og.test.ts`.

Production READY after a same-SHA redeploy (first build ERROR on `/communities/mountain-high` LISTINGS_UNAVAILABLE timeout). Verified three Active Bend homes from `/homes-for-sale/bend`: 220229975 Diablo, 220229082 Jacksonville, 220229860 Yellow Ribbon. Each 308s from `/listing/<mls>` to the slugged URL and serves type=listing. PNGs in `/opt/cursor/artifacts/og-1882-diablo.png` etc.

`/listing/22054302` is not in `listings`. facebookexternalhit still gets the layout default card there.

## Next
`/sitemaps/listings.xml` returned 500 during `deploy:verify` after READY. Not this change.

## Skills read
`.cursor/skills/site-queue/SKILL.md` (Node: none). `docs/SEO.md` OG bullet already on #586.
