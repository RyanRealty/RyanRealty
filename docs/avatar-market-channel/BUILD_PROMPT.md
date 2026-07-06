# BUILD PROMPT — "The Market Desk" · fully autonomous AI-avatar market-data channel

> Cold pickup? Read [`HANDOFF.md`](HANDOFF.md) first (status, locked decisions, open inputs from Matt). Then run this.

**Paste this entire prompt into a fresh agent session to build the whole system from scratch as a reusable skill.** It is self-contained and built on clean-sheet research ([`RESEARCH.md`](RESEARCH.md)). **This is a ground-up build — carry no legacy tooling assumptions.** Evaluate every tool on its own merits at build time; the picks below are the researched defaults, each with a named runner-up.

---

## ROLE & MISSION

Build **"The Market Desk"** — a reusable skill that, on a schedule and with **no human in the loop**, produces a 30–45s vertical AI-avatar real-estate **market-update** short, then auto-publishes it to YouTube Shorts + Instagram Reels + TikTok with AI disclosure, and measures it. A recurring **synthetic** avatar host reads a single hero market stat with full context.

**Definition of done:** a cron fires → a finished, accuracy-verified, disclosed short is published to all three platforms with zero human touch — OR, if any number fails to reconcile to source, the video is **automatically held** in a review queue and **not published**. Every dimension at 100%, production-grade. Stop at "the architecture and result meet the bar," not "it runs."

## THE ONE INVARIANT (compliance survivor — outranks everything)

Matt is a licensed principal broker. **Every market number must be verifiable and traceable, and the model must never write a number.** A wrong figure on a published video is a license risk. This is the only requirement carried from the old system; honor it absolutely. Full auto-publish is authorized **only** because the accuracy gate below makes a wrong published number structurally impossible.

## LOCKED CONSTRAINTS

- **Autonomy:** fully autonomous **auto-publish**, no human approval gate — *except* the automatic accuracy/quality circuit breaker that holds suspect videos.
- **Format:** vertical **1080×1920**, **30–45s** (never >60s) → YouTube Shorts + IG Reels + TikTok.
- **Persona:** ONE recurring **synthetic** (AI-generated, non-real) avatar host = "the Market Desk." Same face every episode via a stable, trained avatar id. Never a real person.
- **Numbers are data-bound, never generated.** (See Accuracy Core.)

## RECOMMENDED STACK (researched defaults — confirm on merit at build, swap if a runner-up is clearly better)

| Layer | Default | Runner-up | Why default |
|---|---|---|---|
| Data | authoritative MLS-grade API (RESO Web API / direct MLS), live per render | — | only source that makes the number defensible |
| Numbers | deterministic data-binding | — | the invariant |
| Voice | **ElevenLabs** (v3 / Multilingual v2) | Cartesia / OpenAI | lowest hallucination + best pronunciation offline |
| Avatar | **HeyGen** v3 (talking-photo group, BYO audio) | Synthesia / Argil | stable reusable host id + BYO audio + 9:16 + webhook API |
| Composite | **managed JSON render API** (Shotstack / JSON2Video) | Remotion (max control) | no render infra; template field ← fact token enforces accuracy |
| Captions | single-word, forced-alignment synced | — | retention on muted feeds |
| Publish | **Blotato** (MCP-native for Claude Code) | Upload-Post / native APIs | one call to all 3 platforms |
| Disclosure | C2PA embedded + platform flags + caption line | — | lights-out compliance |

---

## ARCHITECTURE TO BUILD (lights-out)

```
[cron 3×/week, rotating geo]
 → 1. DATA PULL        authoritative MLS-grade API → structured facts{} (every value + provenance + fetched_at) → citations.json
 → 2. SCRIPT           LLM writes prose to the beat sheet using BOUND TOKENS only ({{median_price}}…);
                       banned-number validator FAILS the build on any numeric literal not in facts{}
 → 3. VOICE            TTS renders script → audio.mp3 + word-timestamp alignment JSON
 → 4. AVATAR           upload audio → asset_id → HeyGen /v3/videos (talking_photo_id, BYO audio, 9:16) → webhook → avatar.mp4
 → 5. COMPOSITE        JSON render template: B-roll + kinetic hero stat + single-word captions OVER avatar PIP/stinger;
                       EVERY overlay value binds to a facts{} token → render market-desk.mp4
 → 6. ACCURACY GATE    re-extract every on-screen + spoken number, assert == facts{}; recompute MoS + verdict;
                       freshness SLA check  → ANY mismatch = AUTO-HOLD (route to review queue, do NOT publish)
 → 7. QUALITY GATE     first-frame, blackdetect, duration, hook-by-2s, captions non-overlap, banned-words,
                       viral scorecard ≥ floor  → fail = auto-reject (expect ~1 in 15)
 → 8. DISCLOSURE       embed C2PA Content Credentials in mp4; resolve per-platform AI flags; caption disclosure line
 → 9. PUBLISH          one call → YouTube Shorts + IG Reels + TikTok (with AI flags)
 → 10. MEASURE         pull per-platform analytics → learning loop (shift geo/hook mix toward winners)
```

The human gate is replaced by **steps 6–7 as the automated circuit breaker.** Clean → publish. Suspect → hold. This is how a licensed broker runs lights-out.

---

## DELIVERABLES (build all)

### A. The skill
`market-desk-avatar/SKILL.md` — Scope · the 10-step recipe · the Accuracy Core (verbatim) · QA gate · citations.json spec · failure modes · the one-time anchor setup · the AI-disclosure matrix · env/creds. Written so a fresh operator can run it cold.

### B. Accuracy core (build FIRST — everything depends on it)
- `facts` builder: calls the data API, returns a typed object where **every field carries `{ value, source, filter, rowCount, query, fetchedAt }`**. Writes `citations.json`.
- `bindScript()`: takes the LLM prose + `facts`, resolves `{{token}}`s, and **rejects any numeric literal in the prose not backed by a token** (regex for digits/`$`/`%` → must map to a fact). Build fails on violation.
- `accuracyGate(renderManifest, facts)`: asserts every overlay value and every spoken token equals `facts`; recomputes MoS = active ÷ (closed_6mo ÷ 6) and asserts verdict pill ∈ {≤4 seller, 4–6 balanced, ≥6 buyer} matches; checks `fetchedAt` within SLA. Returns `{ pass, holdReason }`. **Fail → hold, never publish.**

### C. Voice module
`voice/` — text → audio.mp3 + word-level alignment JSON (for caption sync). Pronunciation overrides for local place names. Provider behind an interface so it's swappable (default ElevenLabs; confirm on merit).

### D. Avatar module
`avatar/heygen.ts` (or chosen engine behind an interface): `uploadAsset(file,mime)`, `generate({talkingPhotoId, audioAssetId, aspectRatio:'9:16', resolution:'1080p', callbackUrl})`, webhook handler + `getStatus`, `download`. Plus one-time `createAnchor(portrait)` → trained, reusable `talking_photo_id` persisted to config (run once, behind `--setup-anchor`). Re-confirm v3 fields against live docs.

### E. Synthetic anchor portrait
Generate an on-brand AI portrait for the permanent "Market Desk" host — professional, clearly not a real identifiable person. Train the avatar once; commit the resulting reusable id to config. This is the persona — done once, reused forever.

### F. Composite/render module
Default: a managed JSON render template (Shotstack/JSON2Video) where **overlay fields bind to `facts` tokens** (this enforces the accuracy invariant in the render layer). Avatar as stinger/PIP, never full-frame. First frame = real photo. Single-word captions from the alignment JSON, suppressed during the stat reveal. If max brand control is required instead, build a Remotion comp + own the render infra — same binding rule.

### G. Disclosure module
Embed **C2PA Content Credentials** into the exported MP4 (set-once auto-detect path). Resolve per-platform AI flags (TikTok Content Posting API AI-content toggle; YouTube altered/synthetic; Meta AI-info) and the in-caption disclosure line. Where an API doesn't expose a flag, rely on the embedded C2PA + caption line. Verify each platform at build.

### H. Publish module
One-call multi-platform publish (default Blotato — MCP-native; or Upload-Post / native APIs) to Shorts + Reels + TikTok, passing the AI flags. Idempotent; logs platform post ids.

### I. Review-queue (the circuit breaker)
A durable queue/table for **held** videos (accuracy- or quality-gate failures) with the hold reason and the failing assertion, plus a notification to Matt. Held videos never auto-publish. (This is the safety valve that makes full auto-publish acceptable for a licensed broker.)

### J. Orchestrator + cron
A scheduler firing 3×/week on a rotating geo plan, running steps 1–10, emitting structured logs per stage and a cost ledger (HeyGen + TTS + render + publish per video).

### K. Measurement loop
Pull per-platform analytics post-publish into a store; a weekly job shifts the geo/hook mix toward winners.

---

## ACCURACY CORE — STATE IT IN THE SKILL VERBATIM

1. The LLM writes prose only. **It never writes a number.** Every figure is a bound token from `facts`.
2. `facts` comes from a live, authoritative MLS-grade API call per render, logged to `citations.json`.
3. A validator rejects any numeric literal in the script not backed by a token.
4. After render, 100% of on-screen + spoken numbers are re-checked against `facts`; verdict recomputed; freshness checked.
5. Any mismatch or stale data → **auto-hold, do not publish.**
6. Clean → auto-publish. Suspect/low-confidence → human review queue.

## PER-VIDEO SHIP BAR (all automated; fail any → auto-hold/reject)

```
[ ] every on-screen + spoken number == facts{}; MoS + verdict reconcile; citations.json complete (ACCURACY — hard hold)
[ ] data fetchedAt within freshness SLA
[ ] first frame = real photo, contrast OK, no brand card, no avatar-on-flat-bg
[ ] hook on screen + spoken by ~2.0s; motion by frame 12
[ ] avatar composited (stinger/PIP), NOT full-frame
[ ] ffprobe duration ∈ [30,60]s; h264+aac; <100MB; zero blackdetect
[ ] single-word captions synced to alignment, non-overlapping with graphics
[ ] chosen voice only; banned-words grep clean
[ ] viral scorecard ≥ market-data floor (write scorecard.json)
[ ] C2PA embedded + platform AI flags resolved + caption disclosure line present
```

## SMOKE TEST BEFORE ANY BATCH (mandatory)

Produce ONE clip end-to-end on real data (a few cents of HeyGen + TTS). Open the MP4. Verify: lip-sync tracks the voice, the on-screen hero stat equals the `facts` value equals the source row, captions don't overlap, first frame is real photo, C2PA reads back, the accuracy gate passes — and separately, force a wrong number and confirm the gate **holds** it. Validate the full path on $1 before scheduling.

## VERIFY-THE-REAL-THING (don't claim done until observed)

Actually run the orchestrator for a real geo. Open the rendered MP4 and the published links (or the held-queue entry). Confirm the published number traces to a live source row pulled this session (one-line provenance per figure). Confirm disclosure is live on each platform. Confirm a deliberately-corrupted fact triggers a hold, not a publish.

## ACCEPTANCE CRITERIA (every box = 100%)

1. Cron → finished, accuracy-verified, disclosed 30–45s vertical short auto-published to all 3 platforms, zero human touch.
2. The LLM never emitted a number; every figure is data-bound and reconciles to source; citations complete.
3. A wrong/stale number auto-holds the video instead of publishing it (circuit breaker proven).
4. Recurring synthetic anchor is created once and reused; persona consistent across episodes.
5. Avatar composited (not full-frame); first frame real photo; hook by 2s; single-word captions synced.
6. C2PA + platform AI disclosure set automatically on every publish.
7. Smoke-tested on one real clip (incl. a forced-failure hold) before any batch; the real MP4 was opened and verified.
8. Cost ledger + per-stage logs + measurement loop in place; the whole thing runs lights-out and is auditable.
