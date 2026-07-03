# New-session prompt — NEWSLETTER

Paste this into a fresh Claude Code session to continue the newsletter build exactly where we left off.

---

You are continuing the **Ryan Realty monthly newsletter** build. Do not restart from scratch — the
spec and design are done and approved. Read these first, in order, before doing anything:

1. `docs/NEWSLETTER_SYSTEM_SPEC.md` — the complete, approved spec (v1.1). Covers the full lifecycle,
   the **per-broker "full identity swap"** branding, admin UX (§9), **§6.5 scale/deliverability** (the
   engagement-tiered tranche model), **§6.6/§6.7 mail infrastructure + Postmaster**, **§7 the LOCKED
   design + §8 content sources**, the 30-case edge matrix (§11), the **20 mechanical gates G-NL-1..20 +
   5 runtime gates** (§12), and the **phased build plan (§13)**.
2. `docs/NEWSLETTER_CONVERSION_RESEARCH.md` — the cited evidence base.
3. Memory: `project_newsletter_mail_infra.md` — mail-infra + access notes.
4. The **canonical design** (approved by Matt after many iterations):
   `design_system/ryan-realty/ui_kits/newsletter/email.html` (email-safe, table-based — this is what
   `newsletter-shell.ts` must render to) and `.../index.html` (the interactive design-intent twin).

## State (what is DONE)
- **Spec + design approved.** The design looks like ryan-realty.com (cream/navy editorial: hero,
  eyebrow + rule + faint watermark section headers, big serif, live data woven into sentences).
  Section order (LOCKED): **The Market** (per-city buyer/seller meter → `/cities/[slug]/market-report`)
  → **For Sellers** → **For Buyers** → **Worth Reading** (housing `/blog/*` links) → **Community**
  (`/communities/[slug]`) → **This Month in Central Oregon** (events) → **Broker close** (→ `/contact`)
  → footer. Voice = brand voice (`marketing_brain_skills/brand-voice/VOICE.md`), every number in
  context, every section informs. Georgia stands in for Amboqia in email; production may bake
  hero/section headlines as Amboqia **images**.
- **Mail infrastructure is LIVE:** `news.ryan-realty.com` created + verified + sending; root DMARC
  reporting on; all 3 domains registered in Google Postmaster Tools; Postmaster API enabled + the
  `viewer@ryanrealty` service account granted `postmaster.readonly`. **Newsletter From =
  `newsletter@news.ryan-realty.com`**; transactional stays on `mail.ryan-realty.com`. Resend is on Pro.
- **Test-send tool:** `scripts/_send-newsletter-test.mjs` sends `email.html` to matt@ from the real
  per-broker identity (use a distinct subject each run so Gmail doesn't thread).
- **Locked decisions:** full per-broker identity swap · brain drafts → Matt approves in admin →
  send · **Matt manually enrolls** subscribers · unsubscribe-only (no preference center) · monthly,
  **drafted on the 1st, sent from the ~3rd, delivered in engagement-tiered tranches over ~5–7 days**.

## Content dependency (important)
The newsletter is a **curator** over the content library, it does not author destination pages. It
links only to already-live pages (a pre-send gate verifies 200 + schema). The **one content gap is
events** (`/central-oregon/events/*` doesn't exist yet) — that is owned by the separate **content-engine**
initiative (`docs/plans/HANDOFF-content-engine.md`). Housing/community/school links point at pages that
already exist (`/blog`, `/communities`, `/schools`, `/parks`, `/guides`).

## Build progress log (newest first)

**2026-07-03 — Phase 2 (compliance + format hardening) shipped.**
- Tracking token hardened (`lib/email-tracking.ts`): prod hard-fail `assertTrackingSecret()` (refuses
  the insecure dev-fallback secret in production), optional TTL (`exp`) + nonce (`n` via `randomBytes`)
  on sign + enforced on verify (backward compatible — no-TTL tokens still verify), and a `broker` field
  (Phase 4 prep). 12 unit tests (round-trip, tamper, TTL expiry, broker) — a dropped `SITE_URL` const
  was caught by the test, fixed.
- `crm_timeline` open/click inserts now de-duped (T-4): upsert with a recipient-scoped `dedupe_key` +
  `onConflict` + `ignoreDuplicates` so a pixel firing repeatedly collapses to one timeline row.
- Plain-text multipart guaranteed (G-NL-3): the send derives text via `htmlToPlainText(body_html)` when
  the admin left it blank — no more near-empty text part.
- Gates built + wired + demonstrated red→green: `ci:newsletter-compliance` (G-NL-1/2/3),
  `ci:newsletter-format` (G-NL-7 static), `ci:email-tracking` (G-NL-11 + G-NL-10). Caught + fixed a
  comment-blindness defect where a gate passed on a token that only appeared in a doc comment — added
  `scripts/lib/strip-js-comments.mjs` so gates check CODE, not comments. Verified the tracking gate goes
  red on a realistic dedup-removal.

**2026-07-03 — Phase 0 + Phase 1 shipped.**
- **Phase 0 (verify + adversarial audit) DONE.** Verified spec vs live DB/code/DNS/routes. Ran an
  adversarial "assume everything is broken" pass → spec bumped to **v1.2** with 7 corrections (A1–A7).
  Key finds: (A1) `newsletter_recipients_status_check` excluded `queued` → queue would be DOA;
  (A2) `unique(lower(email))` already existed (spec was stale); (A3) spec's `dedupe_key` formula was
  broken (our pixel has no message_id) → recipient-scoped; (A4) live `NEWSLETTER_FROM` points at
  `mail.` not `news.`; (A5) `recordRecipientSend` onConflict targets raw email not the functional
  index; (A6) broker close is Matt-only, must template per broker; (A7) mockup is 640px + all numbers
  are samples. Brokers use SHORT slug (`matt`), Matt=superuser + Paul/Rebecca=broker (M4 ✓), all
  headshots resolve HTTPS, `/central-oregon/events/*` 404s (content-engine dep = the real send blocker).
- **Phase 1 (schema) DONE + APPLIED + COMMITTED.** 5 migrations applied to hosted Supabase
  (`20260703100000..100400`): `newsletter_recipient_events` ledger (+broker, recipient-scoped
  dedupe_key), `newsletter_send_schedule`, `newsletters` (+send_started/finished_at, lock_token,
  citations, status CHECK widened), `newsletter_recipients` (+broker, tier, status CHECK widened for
  queued/skipped), subscribers (+bounced_at/complained_at). Live schema verified. First gate built:
  **`scripts/check-newsletter-schema.mjs` (G-NL-14)** — proven red on the A1 bug, green on the fix,
  wired into `ci:gates`, catalogued in MECHANICAL_GATES.md. Snapshot refreshed.

## What's next
Execute the remaining **§13 phase plan** (each: build → wire its gates → real-browser/e2e test →
commit): **Phase 2** compliance+format hardening (postal, multipart, shell static lint, tracking-token
TTL + prod hard-fail, dedup timeline) → **Phase 3** send queue (CAS lock, tier drain cron, reconciler,
circuit-breaker, one-click parity, `NEWSLETTER_FROM` `mail.`→`news.` flip gated on a test-send, fix the
onConflict target) → **Phase 4** per-broker identity swap + shell rebuilt to the 640px `email.html`
(mockup-parity, per-broker close) → **Phase 5** event integrity (ledger-derived counts, recipient-scoped
dedupe, `email.unsubscribed`, MPP) → **Phase 5b** scale readiness (hygiene, warm-up ramp, circuit-breaker,
Postmaster gate) → **Phase 6** curation producer + scheduling → **Phase 7** admin UX → **Phase 8**
per-broker analytics. External send-blockers (do NOT gate the build): event pages 404; `news.` verify
test-send. No bulk send to the real list without Matt's per-issue approval + Phase 5b gates green.

## Constraints (non-negotiable)
Draft-first (nothing sends without Matt's per-issue approval) · brand voice (VOICE.md, gate) · §0 data
accuracy (every figure live + traced) · design-system components only · fair housing · direct to `main`,
push after approval. **No production send to the real list until the §6.5 warm-up/hygiene/circuit-breaker
gates (Phase 5b) are green.**
