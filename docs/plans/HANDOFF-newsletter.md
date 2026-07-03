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

## Where we left off / what's next
The **newsletter system itself is not built** — only the spec, the approved design, and the mail infra.
Everything above is in the working tree, likely **uncommitted** (check `git status`). Next:
1. Confirm with Matt: commit the spec + mockup first, or start building.
2. Execute the **§13 phase plan** — Phase 0 (verify current code vs spec) → Phase 1 (schema:
   `newsletter_recipient_events` ledger, `newsletter_send_schedule`, `recipients.broker`+`tier`,
   `unique(lower(email))`) → Phase 3 (send queue) → Phase 4 (per-broker identity swap + webhook broker
   stamping) → … → Phase 7 (admin UX) → Phase 8 (per-broker analytics). Each phase wires its gates,
   verifies in a real browser, ships draft-first.
- Make `lib/email-templates/newsletter-shell.ts` render the approved `email.html` design, gated by
  mockup-parity.

## Constraints (non-negotiable)
Draft-first (nothing sends without Matt's per-issue approval) · brand voice (VOICE.md, gate) · §0 data
accuracy (every figure live + traced) · design-system components only · fair housing · direct to `main`,
push after approval. **No production send to the real list until the §6.5 warm-up/hygiene/circuit-breaker
gates (Phase 5b) are green.**
