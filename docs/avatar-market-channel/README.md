# The Market Desk — AI-avatar market-data channel (research + build spec)

Handoff package for a **headless, fully-autonomous, short-form AI-avatar** real-estate market-update channel for Ryan Realty. **Research + build spec complete. Nothing built yet.**

> **Picking this up in a new session? Read [HANDOFF.md](HANDOFF.md) first.** It's the full cold-start context — status, decision history, exact next step, and the open inputs to get from Matt. You don't need the prior conversation.

| File | Read when |
|---|---|
| **[HANDOFF.md](HANDOFF.md)** | **First.** Current state, decisions locked, next action, open inputs. |
| **[RESEARCH.md](RESEARCH.md)** | The cited evidence base: merit tool comparisons, the accuracy core, the beat sheet, publishing + AI-disclosure, failure modes, sources. |
| **[BUILD_PROMPT.md](BUILD_PROMPT.md)** | Paste into a fresh session to build the whole thing as a reusable skill (`market-desk-avatar/`). |

**Mandate (Matt, 2026-06-30):** clean-sheet / merit-based tool picks (no legacy tooling) · **fully autonomous auto-publish** · every market number verifiable/traceable (license-critical).

**Core idea:** a **deterministic data pipeline with a generative skin** — the numbers are data-bound from an authoritative source and re-verified after render; clean videos auto-publish, suspect ones auto-hold.

**Build order:** HANDOFF → RESEARCH → run BUILD_PROMPT in a fresh session → smoke-test one clip (including a forced-failure hold) → let it run.
