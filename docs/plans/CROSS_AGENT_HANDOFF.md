# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Claude Code (this session)** — Schoolhouse v5 listing video build, Gate 1 complete, waiting on Matt's photo picks. |
| **Stopped at (UTC)** | 2026-04-24 — Gate 1 photo audit + contact sheet shipped; Matt has the email and the Vercel URL on his phone for picking. |
| **`main` @ commit** | `033c9e5` (verify with `git rev-parse --short HEAD`) |
| **Task focus** | Schoolhouse v5 cinematic short film (NOT a listing tour). Brokerage-credibility piece for the off-market $3,025,000 Vandevert Ranch sale. Read `listing_video_v4/HANDOFF_TO_CLAUDE_CODE.md` Section 7 for the gate plan + `~/.auto-memory/memory_schoolhouse_v5_video_handoff.md` for the in-flight state. |

### Done this session (Claude Code)

- Pulled full 89-photo Schoolhouse listing library from Drive `images-for-web-or-mls` via viewer@ service account + DWD impersonation of matt@ (`.env.local` now has `viewer@ryanrealty.iam.gserviceaccount.com` as the consolidated SA — GA4, Drive, Search Console, Sheets all use this single SA)
- Pulled 2 Snowdrift Visuals area-guide stills + indexed 16 historic Vandevert/Locati portraits already on disk → 107 total photos
- Generated 480px JPEG thumbnails for all 107 + emitted manifest at `listing_video_v4/public/v5_library/manifest.json`
- Probed all 5 prior Schoolhouse MP4s (v1, v2, Pending Reel, VirtualTour Short/Full) — all 1080×1920
- Built mobile-responsive HTML contact sheet with checkbox + copy-picks UI at `public/photo-review-v5.html` and `listing_video_v4/photo_contact_sheet_v5.html`
- Pushed commit `033c9e5` to origin/main, Vercel auto-deploys to https://ryanrealty.vercel.app/photo-review-v5.html
- Sent Resend email `b94cc0dd-a080-453c-9f90-cc77bda1d98e` to matt@ryan-realty.com with the link

### Next agent should (Claude Code or Cursor — picks up after Matt's photo selections)

1. `git pull --rebase origin main` — confirm at or past `033c9e5`.
2. Read `listing_video_v4/HANDOFF_TO_CLAUDE_CODE.md` Section 7 (the gate plan) and `~/.auto-memory/memory_schoolhouse_v5_video_handoff.md`.
3. Wait for Matt's photo picks (he'll paste the "Copy picks" output from the contact sheet).
4. **Gate 2:** Write `listing_video_v4/STORYBOARD_v5.md` — one row per VO sentence with photo file, aspect ratio, motion choice, justification. Email Matt for approval.
5. **Gate 3:** Voice padding test (15s sample with real inter-sentence silence via ffmpeg `apad`/concat OR ElevenLabs SSML `<break>`) + boundary draw test (6s standalone clip of Vandevert Ranch parcel boundary draw over satellite tile, gold #C8A864 SVG dasharray stroke). Email both for approval.
6. **Gate 4:** Full render with Remotion. NO AI photo-to-video (Round 4 ban). Use existing `cameraMoves.ts` push/pan primitives. Run `design:design-critique` subagent on rendered MP4 before email.
7. **Gate 5:** Resend with thumbnail grid + change log. Pattern from `listing_video_v4/send_v3.py`.

### Blockers / env / secrets

- `.env.local` has `GOOGLE_SERVICE_ACCOUNT_*` pointing at `viewer@ryanrealty.iam.gserviceaccount.com` (consolidated SA with DWD — covers GA4, Drive, Search Console, Sheets). The old `ga4-data-api@` SA is retired. `lib/ga4-data-api.ts` deleted (was a dead stub). `build_v5_library.py` now reads creds from env vars instead of a hardcoded gcloud file path.
- Resend `From:` is currently `onboarding@resend.dev` (Resend's default test sender). Verifying `matt@ryan-realty.com` as a Resend sender domain would unblock proper From branding on future client-facing email.
- $3,025,000 Schoolhouse price needs SkySlope/MLS verification before Gate 4 burns it into the closing reveal frame.

### Skills actually read (paths)

- `listing_video_v4/HANDOFF_TO_CLAUDE_CODE.md` (full v5 build state)
- Cowork memory: `feedback_luxury_listing_v3_critique.md` (the bar — all 4 critique rounds), `feedback_photo_to_cinema_motion.md` (camera moves), `feedback_video_qa_gate.md` (mandatory pre-ship checklist), `MEMORY.md` (full Cowork index) — all at `/Users/matthewryan/Library/Application Support/Claude/local-agent-mode-sessions/.../memory/`
- `~/.auto-memory/memory_schoolhouse_v5_video_handoff.md` (this session's in-flight state, written + linter-updated with Gate 1 status)

---

## History (optional; newest first)

_(Paste prior "Current" blocks here when you rotate, or leave empty.)_
