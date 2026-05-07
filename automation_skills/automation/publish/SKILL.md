---
name: publish
description: Canonical skill for shipping approved content to social platforms. Fires when user says "publish to", "post this", "ship this content", "send to {platform}", "distribute the video", "distribute the reel", "go live with this", "publish the listing video", "drop this on IG", "drop this on TikTok", "drop this on YouTube", "drop this on LinkedIn", "drop this on X", "drop this on Pinterest", "drop this on Threads", "drop this on GBP", "drop this on Buffer", or any phrase requesting content delivery to a social platform. This is THE canonical publish skill — every other skill that produces shippable content hands off here. NOT for rendering, drafting, or scoring (use video production skills for those).
when_to_use: Also fires on "push this live", "schedule this post", "cross-post this", "fan out to all platforms", "send the market report", "put this on socials", "queue this for Buffer", "post the listing reel", "publish the news clip". Always fires AFTER Matt has given explicit approval — this skill never self-approves.
---

# Publish Skill

Executes the final delivery of Matt-approved content to one or more social platforms via `/api/social/publish`. Enforces the gate.json precondition and the per-platform best-practice matrix before any API call is made.

## Hard preconditions — ALL four must pass before calling /api/social/publish

**If any precondition fails: STOP. Report which gate is missing. Do not call the API.**

1. **gate.json exists** at the asset's directory containing all of: `manifestoPath`, `citationsPath`, `scorecardPath`, `qaReportPath`, `postflightPath`, `humanApprovedAt` (ISO timestamp).
2. **`humanApprovedAt` is within 7 days** of the current timestamp. Stale approvals do not carry forward.
3. **Matt has explicitly approved THIS specific asset in THIS session** — a prior session approval or a passing scorecard is not sufficient.
4. **`/api/social/publish` route validates `approved: true` AND `gate.scorecardPath`** — the route itself enforces this; the skill must also pre-validate before calling.

## Per-platform best-practice matrix

| Platform | Best times (MT) | Format | Caption | Hashtags | Key flags / bugs |
|---|---|---|---|---|---|
| **IG Reels** | Tue–Thu 9–11 AM; Mon midnight–6 AM | 9:16, 3–90 s | Hook ≤125 chars above fold; CTA drives DMs | 3–5 caption + first comment | `cover_url` required (native only — Buffer can't); `share_to_feed: true`; live (Meta Page token verified valid 2026-05-06, Graph v25.0) |
| **FB Reels** | Wed 9–11 AM; Tue–Thu 12–8 PM | 9:16 or 1:1, 3–90 s | 200–300 chars; URL OK | URLs OK | Live; chunked upload via `publishFacebookReel` (already correct, Graph v25.0) |
| **TikTok** | Tue–Thu 6–8 AM; RE: 3–5 PM; Sun 9–11 AM | 9:16, 21–45 s ideal | Hook ≤1.5 s; saves/shares CTA | 3–5 niche+broad | privacyLevel enum FIXED (`PUBLIC_TO_EVERYONE`); always set `is_aigc: true` (ElevenLabs VO), `brand_organic_toggle: true`, `video_cover_timestamp_ms`; **`tiktok_auth` row empty — first-time OAuth needed at `/api/tiktok/authorize`**; verify app audit status before first Direct Post (unaudited forces `SELF_ONLY`) |
| **YT Shorts** | Weekdays 12–3 PM; Fri–Sun outperform | 9:16, ≤180 s; add `#shorts` | Title ≤60 chars, front-load keyword | 2–4 in description | `categoryId` FIXED (26 Howto & Style), `containsSyntheticMedia` THREADING ADDED (set true when ElevenLabs VO present); stored token expired but auto-refreshes via stored `refresh_token`; `arrayBuffer()` >50MB OOM still pending fix (P1) |
| **LinkedIn** | Tue–Thu 8–10 AM PT; Wed 9 AM peak | MP4, 9:16 or 1:1, 3 s–30 min | Hook line 1; 1,500–3,000 chars; NO URL in body (−60% reach) | 3–5 niche | Live (token valid until 2026-07-04). **OOM bug pending fix:** `arrayBuffer()` crashes >20 MB — migrate to `/rest/videos?action=initializeUpload` + `/rest/posts` with `Linkedin-Version: 202604` header; personal profile only (`w_member_social`); company page needs Community Management API |
| **X** | Weekdays 8–9 AM, 12–1 PM, 5–6 PM | 9:16 or 1:1, ≤2:20 | ≤280 chars; native video > YT embed | 1–2 max | Tier unknown — check X Developer Console; pay-per-use $0.015/tweet; media via v1.1 `media/upload.json` (v2 has no media endpoint) |
| **Pinterest** | Sat–Sun 8–11 PM | 9:16 or 2:3; 15–30 s ideal | SEO title ≤100 chars; description ≤500 chars; include "Bend Oregon" + neighborhood names | 5–7 keyword | **Critical:** destination URL silently dropped by Buffer (confirmed bug) — **native API only**; `pins:read` scope missing |
| **Threads** | 7–9 AM, 12–2 PM; Wed 12–2 PM peak | Video ≤5 min; text-first | ≤500 chars; casual; end with direct question (reply rate = primary signal) | NONE — omit entirely | Separate API `graph.threads.net/v1.0`; token expires 60 days — refresh via `th_refresh_token`; set day-45 cron |
| **Nextdoor** | Tue–Thu 9–11 AM local; weekend AM for community engagement | Image OR video, 1080×1080 ideal; body 250–500 chars | Lead with neighborhood-specific stat or local context; CTA via separate `call_to_action` field (text + URL) | NONE — Nextdoor has no hashtag system | OAuth 2.0 at `auth.nextdoor.com/v3`; gated API — apply at `developer.nextdoor.com`; once approved set NEXTDOOR_CLIENT_ID/SECRET/REDIRECT_URI in env, /api/nextdoor/authorize, posts via `api.nextdoor.com/v3/profiles/{id}/posts`; business profile id auto-fetched on auth |
| **GBP** | 3–4×/week; business hours | STANDARD/EVENT/OFFER; video 30–90 s | 150–300 words; include "Bend Oregon," neighborhood names | N/A | Use `EVENT` type for open houses (stays live until event vs. 7-day STANDARD expiry); OFFER + video not yet implemented in `lib/google-business-profile.ts` |

## Platform status (verified 2026-05-06)

| Platform | Status | Blocker |
|---|---|---|
| IG / FB | BLOCKED | Meta page token expired; `lib/meta-graph.ts` hardcodes `v22.0` (deprecated Sep 2025 — update to `v25.0`) |
| TikTok | VERIFY FIRST | Run test post to confirm app audit status; unaudited = `SELF_ONLY` regardless of `privacy_level` sent |
| YouTube | ACTIVE | `categoryId` bug + `containsSyntheticMedia` missing — fix before publish |
| LinkedIn | ACTIVE | OOM on video >20 MB; migrate to `/rest/videos` multipart |
| X | ACTIVE | Confirm pricing tier in Developer Console |
| Pinterest | ACTIVE | Use native API only — not Buffer |
| Threads | ACTIVE | Verify 60-day token not expired |
| GBP | ACTIVE | Only STANDARD + single photo implemented |

## Buffer vs native decision

Use **Buffer** (v1 REST, `BUFFER_ACCESS_TOKEN`) when: cross-posting the same video to 5+ platforms with no platform-specific parameters, and Matt wants a human-review queue before posts fire. Buffer fans out in one call and gives a visual approval UI.

Use **native API** when: TikTok needs `privacy_level` / `video_cover_timestamp_ms` / `brand_organic_toggle` / `is_aigc`; IG needs custom `cover_url` or `share_to_feed`; Pinterest needs a destination URL (Buffer silently drops it — confirmed bug); LinkedIn needs document posts; posting volume exceeds 60 req/min (Buffer rate limit). **Always native for TikTok and Pinterest.**

Note: Buffer no longer accepts new OAuth app registrations. The `BUFFER_ACCESS_TOKEN` is a pre-existing v1 personal access token — do not attempt a fresh OAuth flow.

## Procedure

1. **Locate gate.json** at the asset's parent directory. If missing, stop and report.
2. **Validate all four preconditions** (see above). Report any failure clearly: which field is missing, which timestamp is stale, which platform is blocked.
3. **Determine platform set** from caller args. Flag any BLOCKED platform before calling.
4. **For each platform:** apply the matrix above — select correct caption, hashtag count, and required flags. Build the `metadata` payload with platform-specific fields (TikTok: `is_aigc`, `brand_organic_toggle`, `video_cover_timestamp_ms`; YouTube: `categoryId: '26'`, `containsSyntheticMedia: true`; LinkedIn: `Linkedin-Version: 202604` header via lib).
5. **Call `/api/social/publish`** with `approved: true`, `gate.scorecardPath`, per-platform captions via `captionPerPlatform`, and the full `metadata` block.
6. **On success:** write `externalPostId` back to `content_library` row for the asset. Log `published_at` timestamp.
7. **On failure:** capture error, execute fallback chain (see below). Report per-platform status table to Matt.

## Failure handling and fallback chain

1. **Retry** with exponential backoff: 1 s, 4 s, 16 s (3 attempts max).
2. **Platform-specific fallback:** If TikTok rate-limits or Meta is blocked, route that platform through Buffer (v1 REST) if the post has no platform-specific parameters that Buffer cannot pass. If Buffer is also down, write to `dead_letter_queue` Supabase table.
3. **Buffer down (5xx >10 min):** Native `post_scheduler` takes over for IG/FB/TikTok/YouTube/LinkedIn. X/Pinterest/Threads remain queued.
4. **All paths exhausted:** Write to `dead_letter_queue`, alert Matt with: platform, error message, asset path, gate.json path.

## Final report format

Return a per-platform status table to Matt:

```
| Platform  | Status    | Post ID / URL              | Error |
|-----------|-----------|----------------------------|-------|
| TikTok    | submitted | pub_abc123                 | —     |
| YouTube   | published | https://youtu.be/xyzXYZ    | —     |
| LinkedIn  | failed    | —                          | OOM   |
```

Then stop. Do not re-attempt failed platforms without Matt's instruction.

## Reference docs (load on-demand — do not pre-load all)

- TikTok (bugs, audit, all flags): `docs/research/tiktok-content-posting.md`
- Meta IG/FB/Threads (token refresh, v25, chunked): `docs/research/meta-graph.md`
- YouTube (categoryId, containsSyntheticMedia, streaming upload): `docs/research/youtube-data-v3.md`
- LinkedIn (OOM fix, /rest/videos, Linkedin-Version header): `docs/research/linkedin-scope-reality.md`
- X/Pinterest/Threads/GBP (gaps, post types): `docs/research/supporting-platforms.md`
- Buffer (decision tree, v1 REST, known bugs): `docs/research/buffer-api.md`
- Publish route (payload shape, `PublishRequest` interface): `app/api/social/publish/route.ts`

## See also

- `automation_skills/automation/post_scheduler/SKILL.md` — queue management before publish
- `automation_skills/automation/buffer_poster/SKILL.md` — Buffer-specific cross-post flow
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — render pipeline that produces the asset handed to this skill
