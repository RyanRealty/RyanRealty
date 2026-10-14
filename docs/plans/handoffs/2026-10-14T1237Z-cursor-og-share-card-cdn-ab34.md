# 2026-10-14 (Cursor, OG place cards 500 on Vercel)

Branch `cursor/og-share-card-cdn-ab34`. Follow-up to #576. Nothing sent.

**Done on #576.** Merged `7eec0a9bd`. Production READY. facebookexternalhit reads pages (200) with absolute og:image, width/height/alt, twitter summary_large_image. Listing card `/api/og?type=listing` returned 200 PNG (1230 Bryanwood). Default / community / city `/api/og` returned 500 because place photos were `readFileSync` of files not in the serverless trace.

**This branch.** Place photos load from `https://ryan-realty.com/...` (same as listing heroes). Logo still prefers the 17 KB data URL, with a public URL fallback.

**Next:** merge, confirm READY, re-download the four production cards.

Skills read: `.cursor/rules/git-commit.mdc`, `docs/plans/handoffs/README.md`.
