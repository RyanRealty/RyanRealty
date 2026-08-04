# Process: site-content-ops — Site content curation

## 0. Meta
- Status: deepened
- Cadence: rare (broker-driven edits) + nightly automated refresh
- Verdict: KEEP thin (proposed; P3 decides) — necessary, low-frequency, should cost near-zero attention
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
The public site's editorial content (blog, guides, help, media, place copy, brokerage settings) stays current without engineering involvement.

## 2. Inception (what starts it)
- Trigger type: broker action | schedule
- Concrete: `/admin/blog` (saveBlogPost/deleteBlogPost — publishes via Supabase `blog_posts` on the live Next site — memory: blog publish path), `/admin/guides` (saveGuide/deleteGuide), `/admin/help` (+[slug]), `/admin/media/*` (banners scan+generate — `listMissingBanners`/`generateAllMissingBanners`; photo curation; stock photos), `/admin/site-pages` (`getBrokerageSettings`), `/admin/content-library` (broker's signed deliverables), `refresh-place-content` cron (nightly Grok About-copy per city/neighborhood — `place-content-pipeline.ts:121,133`).
- Entry evidence: routes + actions per P1 inventory; 3 media redirects (2026-07-07 consolidation done).

## 3. Actors
- Human: Matt mostly (media superuser-gated); brokers for content-library pulls.
- Automated: place-content pipeline, banner generator.

## 4. Systems of record
- `blog_posts`, guides/help tables, `cities`/`neighborhoods` (About copy), media Storage + asset-library manifest (`data/asset-library/manifest.json` — memory: 1,104 vision-graded photos), brokerage settings row.
- NOT SoR: any CMS (there is none — Supabase + repo are it).

## 5. End-to-end path
1. **Edit or generate** · human/system · CRUD action or nightly refresh · desktop · brand voice gated where public-facing (§2 gate scope)
2. **Publish** · system · live site reads the row (ISR-cached — empty-fallback class applies, memory) · failure: stale/empty ISR cache serves quietly
3. **Verify** · human · spot-check the public page · failure: rarely done — no post-publish check exists

## 6. Decision points
- Public-facing copy? → brand-voice vocabulary + §0 for any figure.
- Missing banner? → scan surfaces it; generate fills it.
- AI-generated place copy? → nightly pipeline owns it; manual edits can be overwritten (verify precedence in P4 — potential silent clobber).

## 7. Completion
- Done-when: content live on the public route and correct.
- Terminal states: published · deleted · superseded-by-refresh.

## 8. Time & SLA
- None needed; nightly for automated copy.

## 9. Variants
- Blog · guides · help · media · place copy · settings · content library. One curation process, seven content kinds.

## 10. Current implementation map
- Routes: 12 pages + 3 redirects (P1 inventory).
- Known defects: (a) manual-edit vs nightly-refresh precedence unverified (clobber risk); (b) no post-publish verification loop; (c) content-library is session-scoped per broker but lives beside site-wide tools (grouping accident).
- Duplicate paths: none post-2026-07-07 consolidation.

## 11. Target shape (process-level, not pixels)
- Should exist: YES, thin — one content home; place-copy precedence rule explicit; publish includes an automatic live-URL check.
- UI destination implication: one low-traffic content/settings area; never on the daily path.

## 12. Acceptance checks
- [ ] Save a blog post → live URL renders it (automated check target).
- [ ] Manually edit a neighborhood About → survives the next nightly refresh (fails/undefined today — precedence check).
- [ ] Banner scan → zero missing after generate.
