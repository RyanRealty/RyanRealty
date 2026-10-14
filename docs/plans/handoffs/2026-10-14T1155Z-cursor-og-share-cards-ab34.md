# 2026-10-14 (Cursor, on-brand OG share cards)

Branch `cursor/og-share-cards-ab34`. Nobody pushes main. Nothing sent.

**Done**
- `/api/og` paints a 1200x630 photo card: real wordmark (`public/brand/logo-horizontal-white.png`), navy `#102742` / cream `#faf8f4`, page title. Fallback aerial is `/images/kb/tetherow-golf-aerial.jpg` (same photo as the homepage Tetherow file, web-sized).
- Place pages (community, city, buyer-answer living/cost/hoa/vs/second-home/from-out-of-state/buying/presets) pass `shareOgImagePath` / `ogImageForPlace`. Listing and blog stay `/api/og?type=listing|blog`. `pageMetadata()` emits absolute `https` og:image plus width/height/alt and `twitter:card=summary_large_image`.
- Social UAs stay on `GOOD_BOT_RE`. `GEO_BYPASS_UAS` now includes facebookexternalhit, Twitterbot, Slackbot, Applebot, WhatsApp, LinkedInBot, Discordbot. `/api/og` skips the general rate limiter.
- Search / housing OG routes use the same card (they no longer publish leftover MOS).
- CI: `lib/og/share-image.test.ts` asserts key routes emit an absolute og:image and `/api/og` returns 200 `image/png`.

**Next:** merge this PR, confirm Vercel READY, fetch production og:image for `/communities/sunriver/second-home`, `/cities/bend/living`, a listing, and `/` with facebookexternalhit.

Skills read: `.cursor/rules/git-commit.mdc`, `docs/plans/handoffs/README.md`.
