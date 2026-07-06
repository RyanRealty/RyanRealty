# Headless AI-Avatar Market-Data Channel — Clean-Sheet Research

**Status:** Research complete. Engineer-ready. **Ground-up, no-legacy rebuild** (2026-06-30).
**Mandate (Matt, 2026-06-30):** design the best-in-class solution **from zero** — re-open every tool choice (avatar engine, voice, format, persona, render, publishing), recommend on merit, carry **no** Ryan Realty legacy tooling. **Autonomy = fully autonomous auto-publish** (no human gate). **The one survivor:** every market number must be verifiable and traceable (Matt is a licensed principal broker — publishing a wrong figure is a license risk).

> **New session picking this up? Start with [`HANDOFF.md`](HANDOFF.md)** (status, decision log, next step, open inputs). This is the evidence base. The companion [`BUILD_PROMPT.md`](BUILD_PROMPT.md) turns it into the reusable skill. Nothing here is chosen because Ryan Realty already uses it; each pick is justified on its own merits, with the runner-up named.

---

## 0. The one-paragraph answer

A lights-out AI-avatar market channel is a **deterministic data pipeline with a generative skin**. The non-negotiable architecture: **the numbers are bound from an authoritative data source and never written by the LLM** — the model writes only the prose *between* the numbers; every on-screen and spoken figure is injected from the same structured `facts` object; and a **100% post-render accuracy gate** re-checks every number against source and **auto-holds** any video that doesn't reconcile. On top of that deterministic core sits the generative layer: a recurring **synthetic avatar host** (HeyGen, on merit), an **AI voice** (ElevenLabs, on merit for lowest hallucination + best pronunciation in an offline render), a **data-bound composite** (managed JSON render API or Remotion), **C2PA + platform AI-disclosure** baked into the export, and **one-call multi-platform publishing** to Shorts/Reels/TikTok. Full auto-publish is fine for clean videos; the accuracy gate is the circuit breaker that protects the license. What kills these channels is the inverse: letting the model invent numbers, shipping a full-frame uncanny talking head, and posting editorial-free template spam (which YouTube demonetizes).

---

## 1. Avatar engine — chosen on merit (open comparison)

I re-opened the engine completely. The 2026 landscape, ranked for *this* job (a recurring, consistent, data-reading anchor with a clean automation API):

| Engine | Best at | Fit for a recurring market-desk anchor | Verdict |
|---|---|---|---|
| **HeyGen** | Overall avatar quality + automation API + BYO-audio lip-sync; Avatar IV/V realism | **Strong** — stable reusable photo-avatar id, BYO audio, 9:16, async API + webhooks | **Primary pick** |
| **Synthesia** | Enterprise L&D, governance, 160+ langs | Studio-but-stiff ("authority over relatability"); heavier, less API-flexible | Runner-up (authority tone) |
| **Argil** | Expressive influencer/UGC clones, body language | Great realism, but API gated to Enterprise; tuned for UGC ads not a news desk | Alt if UGC tone wanted |
| **Creatify** | URL→ad at volume, 900+ actors | Ad-automation focus, not a single recurring host | No (wrong shape) |
| **D-ID** | Cheap talking-photo | Budget lip-sync, lower realism | Budget fallback |

Sources: [synthesia.io HeyGen alternatives](https://www.synthesia.io/post/heygen-alternatives-competitors), [heygen.com 12-tools tested](https://www.heygen.com/blog/best-ai-video-generators-tested-and-reviewed), [creatify.ai avatar tools](https://creatify.ai/blog/best-ai-avatar-generators-and-tools), [argil.ai pricing](https://www.argil.ai/pricing), [traksource Argil review](https://traksource.com/argil-ai-review/), [d-id.com alternatives](https://www.d-id.com/blog/best-7-heygen-alternatives/).

**Why HeyGen wins on merit here:** it's the only one combining (a) a *stable reusable avatar id* for a consistent recurring host, (b) **bring-your-own-audio** so the voice is a *separate* merit choice and HeyGen only lip-syncs, (c) native **9:16/1080p**, and (d) a real async **API + webhooks** built for headless volume. The UGC tools (Argil/Creatify) are optimized for ad variety, not a recognizable anchor; Synthesia trades flexibility for enterprise governance we don't need.

### HeyGen v3 mechanics (verified)
- Host `https://api.heygen.com`; auth `x-api-key`. **v3 is current; v1/v2 sunset Oct 31 2026** — build v3.
- Generate: `POST /v3/videos`, character `type:"talking_photo"` (`talking_photo_id`) for the synthetic anchor; `aspect_ratio:"9:16"`, `resolution:"1080p"`; `callback_url`+`callback_id` for webhooks (or poll status).
- **BYO audio:** voice `audio_url` or `audio_asset_id` (exactly one; mutually exclusive with `script`). This is the seam that keeps the voice an independent merit choice.
- **Recurring synthetic anchor:** upload one AI portrait → create a **photo-avatar group** → add looks → **train** → reuse the stable `talking_photo_id` forever. ([Photo Avatars API](https://docs.heygen.com/docs/photo-avatars-api), [Create & Train Groups](https://docs.heygen.com/docs/create-and-train-photo-avatar-groups))
- Upload assets: `POST https://upload.heygen.com/v1/asset` (mp3/jpeg, ≤32MB) → `asset_id`. ([Upload Asset](https://docs.heygen.com/reference/upload-asset))
- **Captions OFF** — we composite our own (§5). Pricing: pay-as-you-go from $5, ~$1/min standard, Avatar IV ~$4/min → ~$0.02–0.27 per 30–45s clip. ([API Pricing](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained))

> Re-confirm exact v3 request fields against the live reference at build time — HeyGen ships fast; treat any JSON example as a starting shape.

---

## 2. The accuracy core — the compliance survivor (the most important section)

Full auto-publish for a licensed broker is only safe if the numbers **cannot** be wrong. The proven pattern for autonomous, regulated, fact-bearing output ([deterministic AI / Chata.ai](https://chata.ai/resources/blog/deterministic-ai-in-analytics-when-accuracy-matters-most), [Lorikeet regulated-industry hallucination](https://www.lorikeetcx.ai/articles/how-ai-support-prevents-hallucinations-regulated-2026), [AWS stop-hallucinations](https://dev.to/aws/stop-ai-agent-hallucinations-4-essential-techniques-2i94)):

1. **Split reasoning from execution.** The LLM does *only* prose. Every number comes from an **API-backed system call**, never from model text. "Numbers, balances, rates… should come from API-backed system calls, not from text the model wrote."
2. **Data-bind everything.** Build one structured `facts` object from the authoritative source. The script uses **bound tokens** (`{{median_price}}`, `{{yoy_pct}}`, `{{months_supply}}`); the render template binds the *same* tokens. The number on screen, the number spoken, and the number in source are **one value with one provenance**, not three copies that can drift.
3. **Reject free numbers.** A validator scans the generated script for any numeric literal not present as a bound token and **fails the build** — the model is never allowed to type a digit.
4. **100% post-facto accuracy gate.** After render, re-extract every on-screen number (the template knows them) and every spoken number (from the bound tokens) and **assert equality with `facts`**. Recompute derived stats (months of supply = active ÷ (closed_6mo ÷ 6); verdict ≤4 seller / 4–6 balanced / ≥6 buyer) and check the verdict pill matches. Any mismatch → **auto-hold, do not publish.**
5. **Freshness SLA.** Stamp `fetched_at` on every fact; if data is older than the SLA, hold. "Expired knowledge is one of the fastest routes to hallucination."
6. **Confidence-based escalation.** Clean video → auto-publish. Gate failure or low confidence → route to a human review queue instead of the feed. This satisfies "full auto-publish OK" while keeping the license safe — **auto-publish the clean ones, auto-hold the suspect ones.**

**The data source is open but accuracy-bound.** It must be an authoritative, MLS-grade feed (a RESO Web API / direct MLS pull / equivalent), queried live per render, with the raw result logged beside the video (`citations.json`: source, filter, row count, query, `fetched_at`). No "remembered" numbers, no numbers from a prior render, no LLM estimates. This is the moat — anyone can make an avatar talk; only a licensed data operation can guarantee the number.

---

## 3. Voice — chosen on merit (open comparison)

For an **offline render** (not realtime), the metrics that matter are pronunciation accuracy, hallucination rate, and consistency — *not* latency. ([SurePrompts 2026 TTS](https://sureprompts.com/blog/voice-generation-models-compared-2026), [futureagi TTS](https://futureagi.com/blog/best-text-to-speech-providers-2026/), [assemblyai TTS APIs](https://www.assemblyai.com/blog/top-text-to-speech-apis))

| Provider | Edge | Fit (host reading numbers + place names) |
|---|---|---|
| **ElevenLabs** (v3 / Multilingual v2) | Best quality + cloning; **lowest hallucination (~5%)**, best pronunciation (WER ~2.83%) | **Primary** — a market host mispronouncing "Deschutes" or fumbling a number is the failure mode this minimizes |
| Cartesia (Sonic) | Lowest latency (~40ms) | Irrelevant offline; quality close but pronunciation edge to ElevenLabs |
| OpenAI TTS | Instructable character | Higher hallucination (~10%); good but riskier for numerics |
| Hume | Emotion | Overkill; not a numerics strength |
| PlayHT/PlayAI | Long-form | **Deprecation risk** — wound down after Meta's 2025 acquisition; avoid |

**Why ElevenLabs wins on merit here** (independent of any prior Ryan Realty use): the single biggest risk in a data-reading avatar is a mangled number or place name, and ElevenLabs posts the lowest hallucination + best pronunciation of the field, with phoneme/pronunciation controls for tricky local names. Latency, where competitors win, doesn't exist in a batch render. A consistent named voice profile gives channel recognition.

---

## 4. Composite / render — chosen on merit (open)

The avatar is a talking head; we still composite avatar + B-roll + **data-bound** overlays + captions. ([Shotstack vs Remotion](https://shotstack.io/vs/remotion-alternatives/), [JSON2Video](https://json2video.com/how-to/remotion-alternative/), [Rendervid/MCP](https://www.flowhunt.io/blog/rendervid-free-remotion-alternative-ai-video-generation/), [autoae alternatives matrix](https://autoae.online/blog/remotion-alternatives-compared-2026))

| Option | Model | Fit for lights-out + data-binding |
|---|---|---|
| **Shotstack** / **JSON2Video** | Managed JSON-timeline render API | **Primary** — fully managed (no render infra to run), and the **JSON template binds fields to the `facts` object structurally**, which *enforces* the accuracy pattern in §2. Scales as a line item, not an ops project. |
| **Remotion** | Code-first React, self-hosted render (Lambda) | Max design control + pixel-perfect brand, but **you own the render infra** (concurrency, cost, scaling) — heavier for autonomous volume |
| Rendervid | Open-source, **built-in MCP server** for AI agents | Agent-native (Claude Code can drive it via MCP); youngest/least proven |

**Recommendation:** lead with a **managed JSON render API (Shotstack/JSON2Video)** for an autonomy-first build — it removes render-infra ops *and* structurally enforces data-binding (template field ← fact token), which is the §2 accuracy guarantee made physical. Choose **Remotion** instead only if pixel-exact brand control outweighs running the render infra. Either way, the rule holds: **every overlay value binds to a `facts` token, never to free text.**

---

## 5. Format + script — the proven 30–45s beat sheet

(Hook/retention evidence: [opus.pro hooks](https://www.opus.pro/blog/youtube-shorts-hook-formulas), [virvid first-3-seconds](https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026), [terramarketgroup](https://www.terramarketgroup.com/digital-marketing-2/short-form-video-hooks-7-formulas-for-70-retention/); RE-specific: [luxurypresence hooks](https://www.luxurypresence.com/blogs/real-estate-video-hooks/), [milehightitleguy](https://www.milehightitleguy.com/post/how-denver-real-estate-agents-can-use-short-form-video-to-win-more-listings-in-2026), [realestateu](https://realestateu.com/short-form-video-strategy-real-estate-agents/).)

- **50–60% of drop-off is in the first 3s.** A hook delivered by ~2.0s retains ~19% more. Layered hook (visual + audio + text) triples the 3-second hold.
- **One hero stat carries the video.** Proven RE format: *"one local stat + what it means for buyers and sellers this month."* Hyperlocal beats regional.
- **Avatar is composited, never full-frame** — intro/outro stinger + lower-third PIP over B-roll and kinetic data. A full-screen talking head on a flat background is the #1 reason these channels read as slop and lose retention ([ventureharbour](https://ventureharbour.com/best-ai-avatar-software/), [creativeainews Avatar V](https://www.creativeainews.com/articles/heygen-avatar-v-identity-benchmark-analysis/)).

**Beat sheet (30–45s, 8–10 beats):** Hook 0–2s (hero stat, on screen + spoken, motion by frame 12, real photo first frame) · Context 2–8s (YoY arrow, vs last month) · So-what 8–20s (≤2 supporting stats + verdict pill) · Local color 20–32s (neighborhood specificity, anchor read) · CTA 32–42s (soft, brand-first, no fake urgency). Captions: **single word at a time**, large, centered, synced to the voice's word timestamps, suppressed during the stat reveal so they never overlap graphics.

**Cadence:** 3–5/week is the proven monetization-threshold pace; start at **3/week** on a rotating geo plan.

---

## 6. Publishing — one call, three platforms, disclosure baked in

(Auto-publish layer: [Blotato](https://www.blotato.com/) — *MCP-ready for Claude/Claude Code*, [Upload-Post](https://www.upload-post.com/how-to/auto-post-youtube-shorts/), [PostPeer](https://www.postpeer.dev/blog/best-tiktok-posting-api), [TikTok Content Posting API guide](https://zernio.com/blog/tiktok-developer-api), [Phyllo upload APIs](https://www.getphyllo.com/post/using-apis-to-automate-content-upload-on-youtube-instagram-tiktok).)

- **One-call multi-platform:** Blotato / Upload-Post / PostPeer each publish a single video URL to **YouTube Shorts + IG Reels + TikTok** in one request. Blotato being **MCP-native for Claude Code** makes it the natural pick for an agent-driven autonomous pipeline; Upload-Post is the simplest REST option (free tier 10/mo). Native APIs (YouTube Data API, TikTok Content Posting API — official, no per-call fee, Instagram Graph API) are the no-middleman alternative.
- **AI disclosure is mandatory and must be automated** (synthetic face + AI voice triggers it everywhere — [influencermarketinghub](https://influencermarketinghub.com/ai-disclosure-rules/), [TikTok newsroom](https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content), [auditsocials TikTok](https://www.auditsocials.com/blog/tiktok-ai-content-disclosure-rules-2026)):
  - **Embed C2PA Content Credentials in the exported MP4** — TikTok (and increasingly others) auto-detect and label from metadata. This is the robust, set-once, lights-out path.
  - **Set the explicit flag where the API allows it** — TikTok Content Posting API exposes an AI-generated-content toggle; YouTube's altered/synthetic disclosure is set at upload; Meta's AI-info label. (Programmatic coverage is uneven — embed C2PA as the backstop and set flags where supported; verify per-platform at build.)
  - Add a short in-caption line: *"AI-generated host · data is live and verified."*
- **EU AI Act** (realistic AI media, label required, effective Aug 2 2026) — C2PA + the caption line cover it.

---

## 7. Why most AI-avatar channels fail (and the bar to clear)

1. **The model invents numbers.** Fatal for a broker. Fixed by §2 data-binding + accuracy gate.
2. **Full-frame uncanny talking head on a flat background.** Low retention. Fixed by composite-only avatar.
3. **Editorial-free template spam.** YouTube's **July-2025 inauthentic-content policy demonetizes it.** Even proven auto-operators **reject ~1 in 15–20 videos at QA** — so an automated quality gate with an auto-reject path is mandatory, not optional. ([virvid stack](https://virvid.ai/blog/ai-faceless-youtube-automation-stack-2026), [autoadify](https://autoadify.com/blog/faceless-youtube-ai-automation-channel-2026))
4. **Slow intros / logos up front.** Hook by 2s or die.

**Per-video ship bar (all automated, all ship-blockers):** first frame is real photo w/ contrast (no brand card, no avatar-on-flat-bg) · hook on screen + spoken by ~2.0s · avatar composited not full-frame · zero blackdetect · single-word captions synced + non-overlapping · chosen voice only · **every number reconciles to `facts` + verdict matches MoS + citations complete** · viral scorecard ≥ market-data floor · C2PA + disclosure set. Fail any → **auto-hold, never publish.**

---

## 8. Clean-sheet recommended stack (one line each, merit pick → runner-up)

| Layer | Pick (on merit) | Runner-up |
|---|---|---|
| Data | Authoritative MLS-grade API, live per render, logged | — (accuracy-bound, not optional) |
| Numbers | **Deterministic data-binding** (LLM never writes a digit) | — (the core invariant) |
| Script | LLM prose to beat sheet, bound tokens, banned-number validator | — |
| Voice | **ElevenLabs** (lowest hallucination + best pronunciation, offline) | Cartesia / OpenAI |
| Avatar | **HeyGen** v3 photo-avatar group, BYO audio, 9:16 | Synthesia / Argil |
| Composite | **Managed JSON render API** (Shotstack/JSON2Video) | Remotion (max control) |
| Captions | Single-word, forced-alignment synced | — |
| Accuracy gate | 100% post-facto reconcile + verdict + freshness → auto-hold | confidence escalation |
| Quality gate | first-frame, blackdetect, hook timing, scorecard, ~1/15 auto-reject | — |
| Disclosure | **C2PA embedded** + platform AI flags + caption line | — |
| Publish | **Blotato (MCP-native)** one-call to Shorts/Reels/TikTok | Upload-Post / native APIs |
| Measure | per-platform analytics → learning loop | — |

---

## 9. Sources

**Avatar engines:** [synthesia.io](https://www.synthesia.io/post/heygen-alternatives-competitors) · [heygen.com tested](https://www.heygen.com/blog/best-ai-video-generators-tested-and-reviewed) · [creatify.ai](https://creatify.ai/blog/best-ai-avatar-generators-and-tools) · [argil.ai pricing](https://www.argil.ai/pricing) · [traksource Argil](https://traksource.com/argil-ai-review/) · [d-id.com](https://www.d-id.com/blog/best-7-heygen-alternatives/) · [techsy](https://techsy.io/en/blog/best-ai-avatar-generators-2026)
**HeyGen API:** [developers.heygen.com](https://developers.heygen.com/) · [Photo Avatars API](https://docs.heygen.com/docs/photo-avatars-api) · [Create & Train Groups](https://docs.heygen.com/docs/create-and-train-photo-avatar-groups) · [Using Audio as Voice](https://docs.heygen.com/docs/using-audio-source-as-voice) · [Upload Asset](https://docs.heygen.com/reference/upload-asset) · [API Pricing](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained)
**Voice/TTS:** [SurePrompts](https://sureprompts.com/blog/voice-generation-models-compared-2026) · [futureagi](https://futureagi.com/blog/best-text-to-speech-providers-2026/) · [assemblyai](https://www.assemblyai.com/blog/top-text-to-speech-apis) · [teamday](https://www.teamday.ai/blog/best-ai-voice-models-2026)
**Accuracy / anti-hallucination:** [Chata.ai deterministic](https://chata.ai/resources/blog/deterministic-ai-in-analytics-when-accuracy-matters-most) · [Lorikeet regulated](https://www.lorikeetcx.ai/articles/how-ai-support-prevents-hallucinations-regulated-2026) · [AWS techniques](https://dev.to/aws/stop-ai-agent-hallucinations-4-essential-techniques-2i94)
**Render/composite:** [Shotstack vs Remotion](https://shotstack.io/vs/remotion-alternatives/) · [JSON2Video](https://json2video.com/how-to/remotion-alternative/) · [Rendervid](https://www.flowhunt.io/blog/rendervid-free-remotion-alternative-ai-video-generation/) · [autoae matrix](https://autoae.online/blog/remotion-alternatives-compared-2026)
**Hooks / RE video:** [opus.pro](https://www.opus.pro/blog/youtube-shorts-hook-formulas) · [virvid first-3s](https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026) · [terramarketgroup](https://www.terramarketgroup.com/digital-marketing-2/short-form-video-hooks-7-formulas-for-70-retention/) · [luxurypresence](https://www.luxurypresence.com/blogs/real-estate-video-hooks/) · [milehightitleguy](https://www.milehightitleguy.com/post/how-denver-real-estate-agents-can-use-short-form-video-to-win-more-listings-in-2026) · [realestateu](https://realestateu.com/short-form-video-strategy-real-estate-agents/) · [amplifiles RE stats](https://www.amplifiles.ai/blog/8-real-estate-video-statistics-every-realtor-should-know)
**Auto-publish + disclosure:** [Blotato](https://www.blotato.com/) · [Upload-Post](https://www.upload-post.com/how-to/auto-post-youtube-shorts/) · [PostPeer](https://www.postpeer.dev/blog/best-tiktok-posting-api) · [TikTok API guide](https://zernio.com/blog/tiktok-developer-api) · [influencermarketinghub disclosure](https://influencermarketinghub.com/ai-disclosure-rules/) · [TikTok newsroom labels](https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content) · [weventure EU AI Act](https://weventure.de/en/blog/ai-labeling)
**Autonomy / failure modes:** [virvid stack](https://virvid.ai/blog/ai-faceless-youtube-automation-stack-2026) · [autoadify](https://autoadify.com/blog/faceless-youtube-ai-automation-channel-2026) · [clipwise YT policy](https://www.clipwise.ai/blogs/50-profitable-faceless-youtube-channel-ideas-that-actually-work)

> Methodology: clean-sheet pass — every tool re-evaluated on merit with no carry-over from Ryan Realty's existing stack. The earlier deep-research workflow was re-run manually after a transient fetch rate-limit. Vendor API specifics cross-checked across official docs + comparison sources; re-confirm exact request schemas against live references at build time.
