# HANDOFF — "The Market Desk" AI-avatar market-data channel

**For the next session (Claude Code or any agent) picking this up cold. Assume no memory of the prior conversation — this doc is your full context. Read it first, then `RESEARCH.md`, then run `BUILD_PROMPT.md`.**

**Phase:** research + spec **complete**; **nothing built yet.** · **Last updated:** 2026-07-01

---

## 1. What this is
A plan to build **"The Market Desk"** — a headless, **fully-autonomous**, short-form **AI-avatar** channel that publishes real-estate **market-update** videos for Ryan Realty (Bend, OR) to **YouTube Shorts + Instagram Reels + TikTok**. A recurring **synthetic** avatar host reads one verified local market stat with context. Vertical 1080×1920, 30–45s, ~3×/week, lights-out (auto-publish), with an **automated accuracy circuit-breaker that auto-holds any video whose numbers don't reconcile to source.**

## 2. Current status
- ✅ **Research complete + cited** → [`RESEARCH.md`](RESEARCH.md)
- ✅ **Build spec complete + runnable** → [`BUILD_PROMPT.md`](BUILD_PROMPT.md)
- ⛔ **Nothing built.** No code, no skill, no avatar, no pipeline, no accounts. This is research + spec only.
- ➡️ **Next action:** run `BUILD_PROMPT.md` in a fresh session (see §6).

## 3. Decision log — how we got here (do NOT relitigate)
Matt made two rounds of decisions:
- **Round 1 (2026-06-30):** avatar engine = HeyGen · format = short-form vertical · autonomy = build-then-approve · persona = recurring synthetic brand anchor.
- **Round 2 (2026-06-30, supersedes on conflict):** *"Ground-up, no legacy — don't let our existing tooling (ElevenLabs, etc.) influence you. Re-open every tool choice, recommend best-in-class."* **and** *"Fully autonomous auto-publish is OK; accuracy stays."*
- **Net locked mandate:** clean-sheet / merit-based tool picks (no reuse of Ryan Realty's stack just because it exists) · **fully autonomous auto-publish** (no human gate) · **the one non-negotiable survivor: every market number must be verifiable/traceable** (Matt is a licensed principal broker; a wrong published figure is a license risk).

## 4. Locked decisions + researched picks
**Locked (do not re-open without Matt):**
- **Autonomy:** full auto-publish **+ automated accuracy/quality circuit-breaker** (auto-hold suspect videos). No human approval gate.
- **Format:** vertical **1080×1920, 30–45s**, Shorts + Reels + TikTok, ~3×/week, rotating geography.
- **Persona:** ONE recurring **synthetic** (AI-generated, non-real) avatar host = "the Market Desk." Not Matt, not any real person. Same trained face forever.
- **The invariant:** numbers are **data-bound** (the LLM never writes a digit); 100% post-render reconcile; **auto-hold on any mismatch.**

**Merit picks (each with a named runner-up in `RESEARCH.md` §8 — confirm at build, swap only if a runner-up is clearly better):**
Avatar **HeyGen v3** (talking-photo group, BYO audio) · Voice **ElevenLabs** (lowest hallucination + best pronunciation, offline) · Composite **managed JSON render API (Shotstack/JSON2Video)** or **Remotion** (max control) · Publish **Blotato** (MCP-native) or Upload-Post/native APIs · Disclosure **C2PA embedded + platform AI flags + caption line**.

## 5. Files in this folder
| File | What it is |
|---|---|
| `HANDOFF.md` | **(this)** cold-start context, status, next step, open inputs |
| `RESEARCH.md` | cited evidence base, the accuracy core, merit comparisons, sources |
| `BUILD_PROMPT.md` | the self-contained build prompt — paste into a fresh session to build |
| `README.md` | short index |

## 6. Exact next step
Paste **[`BUILD_PROMPT.md`](BUILD_PROMPT.md)** into a fresh Claude Code session **in this repo** and execute it. It builds the whole thing as a reusable skill (`market-desk-avatar/`): the data-binding **accuracy core** (build first), the voice/avatar/composite/disclosure/publish modules, the **auto-hold review queue** (circuit breaker), the cron, and the measurement loop — then **smoke-tests ONE clip (including a forced-failure hold) before any batch.**

## 7. Open inputs / decisions the build session needs from Matt (get these at/before build)
1. **Accounts + API keys — none provisioned yet (greenfield):** HeyGen (`HEYGEN_API_KEY`; pay-as-you-go, top up $5+), ElevenLabs, the render API (Shotstack/JSON2Video) if not Remotion, and the publish layer (Blotato / Upload-Post / native platform OAuth for YouTube/TikTok/IG). Surface anything missing to Matt; **do not fabricate keys.**
2. **Data source — IMPORTANT open decision.** The mandate is "no legacy *tooling*," but the market **data** is the firm's own MLS-grade feed. The repo already has authoritative Bend/Deschutes MLS data in **Supabase** (`market_pulse_live` / `market_stats_cache` / `listings`, project `dwvlophlbvvygjfxcrhm`), already verified per the §0 data-accuracy rule. **Confirm with Matt:** bind the numbers to the existing Supabase MLS data (obvious, accuracy-bound, cheapest) OR stand up a separate RESO Web API feed. "No legacy" was about creative/publishing tooling, not about ignoring the firm's own verified data — but confirm.
3. **The synthetic anchor portrait.** Generate the permanent host face (on-brand, clearly non-real), train the HeyGen photo-avatar once → stable `talking_photo_id`, commit the id to config. Offer Matt options to pick, or generate and get sign-off. Done once, reused forever.
4. **Run mode.** Build it as a **standalone lights-out cron/skill.** NOTE: the repo's marketing-brain "producer layer" is **frozen** (`ci:producer-freeze`) and video producers were decommissioned 2026-06-14 — **do NOT add a new REGISTRY producer row without Matt's explicit sign-off** (cite it in the commit if he lifts the freeze).
5. **Spend guardrail.** Smoke-test ONE clip (~$0.02–0.27 HeyGen + a few cents TTS) and prove the full path **and** a forced-failure hold before scheduling any batch.

## 8. Repo context worth knowing
- There is an existing `video/avatar_market_update/` skill — it's a **Synthesia stub, blocked, wrong engine.** The new build **supersedes it**; mark it deprecated, don't extend it.
- **"No legacy tooling"** = don't reflexively reuse the existing Victoria/ElevenLabs voice config, the `SingleWordCaption` component, the publisher, or the Remotion pipeline just because they exist. Pick on merit. (Merit may still land on some of the same tools — that's fine; the point is the choice is *justified*, not inherited.)
- **Draft-first vs auto-publish:** the CHANNEL is full-auto by mandate, but the code/skill still commits to `main` normally. Only the video **output** auto-publishes — and only through the accuracy circuit-breaker (a machine gate, not a human one).

## 9. The core idea (so you don't lose the plot)
A **deterministic data pipeline with a generative skin.** The avatar, voice, and visuals are generative; the **numbers are bound from an authoritative source and re-verified after render.** Clean videos auto-publish to all three platforms with AI disclosure; any number that doesn't reconcile is **auto-held and never posted.** That circuit-breaker is what makes lights-out safe for a licensed broker — it's the whole reason the architecture is shaped this way. Everything in `BUILD_PROMPT.md` serves that idea.
