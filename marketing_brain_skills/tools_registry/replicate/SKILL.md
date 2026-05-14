---
name: tools_registry-replicate
description: Use this skill when a task involves "AI video generation", "image to video", "Kling", "Veo", "Hailuo", "Seedance", "Wan", "Luma Ray", "FLUX image generation", "rembg background removal", "Real-ESRGAN upscale", "Replicate API", "when do I use Replicate", or any task that needs AI-generated b-roll, hero video clips, or AI images. Replicate is the canonical AI generation gateway for Ryan Realty. fal.ai balance is exhausted — Replicate is the only active AI generation path. Covers authentication, the validated model registry, cost model, invocation patterns, polling, failure modes, output handling, and where assets land.
---

# Replicate Tool Skill

## Canonical references

This is a capability skill used by every video and image producer in the marketing brain. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `video_production_skills/ai_platforms/SKILL.md` — the model-selection decision tree (which model for which content)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate; no AI clip ships without clearing it

---

## Scope

**Use Replicate for:**

| Use case | Why Replicate |
|---|---|
| AI video generation (image-to-video, text-to-video) | fal.ai balance is exhausted; Replicate holds billing for all active SOTA models |
| AI image generation (hero images, flyer graphics, social cards) | FLUX 1.1 Pro and FLUX Dev are on Replicate; no direct FLUX API key provisioned |
| Background removal (broker headshots, product cutouts) | `cjwbw/rembg` on Replicate; same key, no separate credential |
| Upscaling (540p Ray Flash drafts → 1080p) | `nightmareai/real-esrgan` on Replicate; ~$0.001/sec |
| Draft iteration (quick motion scouts before committing to Kling) | Luma Ray Flash 2 at ~$0.18/sec, 3× faster than premium tier |

**Do NOT use Replicate for:**

| Task | Use instead |
|---|---|
| Static kinetic text, countup numbers, chart animations | Remotion (renders instantly, no cost, pixel-precise) |
| Listing interior photos converted to video | Hard banned — see `video_production_skills/ai_platforms/SKILL.md` "The hard rule" |
| VO audio generation | ElevenLabs — `ELEVENLABS_API_KEY` in `.env.local` |
| Runway Gen-4 | Requires fal.ai (balance exhausted) or direct Runway billing — not currently connected |
| Ambient music | Hand-curated royalty-free libraries; no music API is provisioned |

The rule: Replicate runs when the deliverable needs AI-generated motion or imagery that neither Remotion nor stock photography can produce.

---

## Authentication

| Variable | Where to get it | Scope required |
|---|---|---|
| `REPLICATE_API_TOKEN` | replicate.com/account/api-tokens → "Create token" | "Read and write" (default) |

```ts
// lib/video/replicate.ts — canonical getter
export function getReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'REPLICATE_API_TOKEN is not set. Add it from replicate.com/account/api-tokens to .env.local.',
    )
  }
  return token
}
```

Token is stored in:
- `.env.local` (local dev — gitignored)
- Vercel → Project Settings → Environment Variables → Production + Preview + Development

Account: `ryanrealty` (GitHub OAuth — billing rolls up to Matt's GitHub account). One token covers every model on the platform.

---

## Model registry

These models are confirmed reachable from the `ryanrealty` account (verified 2026-04-27 via `GET /v1/models/<slug>`). Version pins are not specified here — Replicate resolves the latest version by default when `version` is omitted and a `model` slug is passed to the deployments or predictions API. **Verify the exact version hash on replicate.com before pinning one in production code** — pinned versions become stale when a model updates.

### Video — image-to-video and text-to-video

| Slug | Duration | Output res | Approx cost | Best for |
|---|---|---|---|---|
| `kwaivgi/kling-v2.1-master` | 5s or 10s | 1080p | ~$1.40/5s, ~$2.80/10s | Listing hero shots, luxury b-roll, any clip where camera movement must feel like a real cinematographer. Best-in-class motion realism. |
| `google/veo-3` | 8s default | 1080p | ~$2.50/5s | Hero shots where ambient sound matters — Veo 3 generates native diegetic audio (creek, fireplace) and saves a separate audio pass. Most expensive tier. |
| `google/veo-3-fast` | 8s default | 1080p | ~$1.25/5s | Bulk hero generation for evergreen and market-report b-roll. ~80% of Veo 3 quality at half cost. |
| `minimax/hailuo-02` | 6s | 1080p | ~$0.27/sec | Lifestyle b-roll with people in frame. Best face consistency and human-motion fidelity of any model on the stack. |
| `bytedance/seedance-1-pro` | flexible | 1080p | ~$0.10/sec | Volume work — market report filler, evergreen b-roll. Cheapest cinematic-tier option; fast. |
| `wan-video/wan-2.5-i2v` | flexible | 720p | ~$0.20/sec | When the start image MUST stay recognizable (listing hero photo → cinematic move). Best image-to-video prompt adherence. |
| `luma/ray-2-720p` | flexible | 720p | ~$0.40/sec | Hero pushes and drone-style sweeps that need professional camera language. Smooth tracking shots. |
| `luma/ray-flash-2-540p` | flexible | 540p | ~$0.18/sec | Drafting and scouting camera moves before committing to a premium render. Upscale afterward with `nightmareai/real-esrgan`. |

### Image generation

| Slug | Output | Approx cost | Best for |
|---|---|---|---|
| `black-forest-labs/flux-1.1-pro` | up to 1440px | ~$0.04/image | Photoreal listing graphics, social card hero images, flyer backgrounds. Highest-quality FLUX tier. |
| `black-forest-labs/flux-dev` | up to 1440px | ~$0.025/image | Iteration and layout scouting before committing to flux-1.1-pro. |
| `stability-ai/sdxl` | 1024×1024 | ~$0.005/image | High-volume image generation where cost matters more than top-end quality. |

### Utility models

| Slug | What it does | Approx cost |
|---|---|---|
| `nightmareai/real-esrgan` | 4× upscale — use to bring Ray Flash 2 540p clips to 1080p | ~$0.001/sec |
| `cjwbw/rembg` | Background removal — same model that powers the broker headshot flow | ~$0.01/image |

All cost estimates are approximate. GPU billing rates change without notice. Verify current pricing at replicate.com/pricing before committing to a high-volume batch.

---

## Cost model

Replicate bills per second of GPU time. Costs are deducted from the account balance automatically.

| Scenario | Estimate |
|---|---|
| 1 Kling 10s hero clip | ~$2.80 |
| 1 Veo 3 8s ambient clip | ~$2.50 |
| 1 Hailuo 6s lifestyle clip | ~$1.62 |
| 1 Seedance 10s b-roll clip | ~$1.00 |
| 5 FLUX 1.1 Pro images (flyer assets) | ~$0.20 |
| 10 FLUX Dev images (layout iteration) | ~$0.25 |
| 1 listing video (4 hero clips × Kling) | ~$11.20 |
| 1 market-report video (6 b-roll clips × Seedance) | ~$6.00 |
| 1 Ray Flash 540p draft + Real-ESRGAN upscale | ~$0.20 |

**Before any batch:** check the account balance at replicate.com/account/billing. A mid-batch balance failure leaves predictions in a `starting` state that never completes. Set up a billing alert so a batch run does not exhaust the account silently.

---

## Invocation pattern

Replicate predictions are async. The standard pattern: POST to start → poll the returned URL until `succeeded` or `failed` → fetch `output`.

### Standard (polling)

```ts
const REPLICATE_BASE = 'https://api.replicate.com/v1'
const POLL_INTERVAL_MS = 3_000
const MAX_POLL_ATTEMPTS = 120 // 6 minutes max

export async function runReplicatePrediction(
  model: string,                       // e.g. 'kwaivgi/kling-v2.1-master'
  input: Record<string, unknown>,
  version?: string,                    // omit to use latest; pin for production reproducibility
): Promise<{ id: string; output: unknown }> {
  const token = getReplicateToken()

  // 1. Start the prediction
  const body: Record<string, unknown> = { input }
  if (version) {
    body.version = version
  } else {
    body.model = model
  }

  const startRes = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',                  // Replicate short-polls up to 60s before returning — reduces poll round-trips
    },
    body: JSON.stringify(body),
  })
  if (!startRes.ok) {
    const text = await startRes.text()
    throw new Error(`Replicate start failed (${startRes.status}): ${text}`)
  }
  const prediction = await startRes.json() as {
    id: string
    status: string
    output: unknown
    error: string | null
    urls: { get: string }
  }

  // If Prefer:wait resolved it already, return immediately
  if (prediction.status === 'succeeded') return { id: prediction.id, output: prediction.output }
  if (prediction.status === 'failed') throw new Error(`Replicate prediction failed: ${prediction.error}`)

  // 2. Poll
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!pollRes.ok) continue  // transient — keep polling
    const polled = await pollRes.json() as typeof prediction
    if (polled.status === 'succeeded') return { id: polled.id, output: polled.output }
    if (polled.status === 'failed') throw new Error(`Replicate prediction failed: ${polled.error}`)
    // status === 'starting' | 'processing' — keep polling
  }

  throw new Error(`Replicate prediction ${prediction.id} timed out after ${MAX_POLL_ATTEMPTS} attempts`)
}
```

### Webhook (preferred for long-running batch work)

For generation jobs that run 3–5 minutes, polling on Vercel burns wall-time against the function timeout. Use a webhook instead:

```ts
const body = {
  model: 'kwaivgi/kling-v2.1-master',
  input: { ... },
  webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`,
  webhook_events_filter: ['completed'],
}
```

The route at `app/api/webhooks/replicate/route.ts` receives the completed prediction and writes the output URL to the `marketing_brain_actions` row via `executor_response`. Verify the webhook route exists before routing a batch through it — check `app/api/webhooks/`.

### Usage example — Kling image-to-video

```ts
const { id, output } = await runReplicatePrediction('kwaivgi/kling-v2.1-master', {
  image: 'https://...publicly-accessible-url-to-source-photo...',
  prompt: buildBlockPrompt({ scene, camera, lighting, filmStock, palette, duration: 5 }),
  duration: 5,
  aspect_ratio: '9:16',
})
// output is a URL string (or array) — download immediately; Replicate URLs expire
const videoUrl = Array.isArray(output) ? output[0] : output as string
```

### Usage example — FLUX image generation

```ts
const { output } = await runReplicatePrediction('black-forest-labs/flux-1.1-pro', {
  prompt: 'Aerial view of Bend, Oregon at golden hour, Old Mill District waterfront, Cascade Range in background',
  width: 1080,
  height: 1920,   // portrait for IG/TikTok
  output_format: 'webp',
  output_quality: 92,
})
```

---

## Prompt architecture

Every AI video prompt uses block format. Narrative prose and adjective stacks produce slop. See full vocabulary lists and pass/fail examples in `video_production_skills/ai_platforms/SKILL.md` §"Mandatory prompt architecture".

```
[SCENE: subject + specific action + location — 1 sentence]
Camera: [focal length] + [movement] + [angle]
Lighting: [technique] + [time of day] + [color temp]
Film Stock / DP Reference: [named stock or DP — NEVER "cinematic"]
Color Palette: [3 named colors]
Speed: [f-stop for DOF or fps for slow-mo]
Duration: [N seconds]
Negative prompt: [artifacts to avoid]
```

**Banned prompt vocabulary (delete before firing):** cinematic, epic, breathtaking, stunning, beautiful, amazing, gorgeous, premium, 4K, ultra HD, 8K, high quality, masterpiece, professional, award-winning, dramatic, magical, ethereal, photorealistic.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `REPLICATE_API_TOKEN` not set | `Error: REPLICATE_API_TOKEN is not set` on cold start | Add token to `.env.local` and Vercel env; redeploy |
| Insufficient balance | 402 on start, or `starting` status that never progresses | Top up at replicate.com/account/billing; set a billing alert |
| Model slug changed or superseded | 404 on start, or model page says "Archived" | Visit replicate.com/model/<slug>; update slug in code and this registry |
| Pinned version hash is stale | Prediction fails with version-not-found error | Remove the pinned `version` and let Replicate use the latest, or update the hash to the current one on the model page |
| Prompt rejected by content filter | 422 with "NSFW" or policy-violation message | Revise the prompt; avoid any language that could be read as architectural interiority with human subjects — the filter is aggressive |
| GPU queue backed up | `status === 'starting'` persists beyond 2 minutes | Expected during peak hours; extend `MAX_POLL_ATTEMPTS` or switch to webhook pattern. Do not re-submit — duplicate predictions burn double cost |
| Image input URL not publicly accessible | Prediction completes with distorted or blank output | Serve the source image from Supabase public storage (see `broker-headshot.ts` — it uploads to the `brokers` bucket before passing the URL) |
| Output URL expires | `fetch(outputUrl)` returns 403 after ~1 hour | Download the output immediately after `status === 'succeeded'`. Never store a Replicate output URL as a long-term reference — save the file to local disk or Supabase storage |
| Vercel function timeout on long-running poll | 504 after 300s | Switch to the webhook pattern for Kling and Veo predictions; polling works for FLUX and rembg which complete in under 30s |

---

## Where outputs land

**Rule: download the Replicate output URL immediately.** Replicate-hosted URLs expire in approximately one hour. Never reference them in database rows, `citations.json`, or any long-lived record.

**Video outputs:**
- Download to `listing_video_v4/public/v5_library/<deliverable>/` for clips that have Matt's approval.
- Download to `listing_video_v4/out/<deliverable>/` for draft clips awaiting review (gitignored; never commit without approval per CLAUDE.md §0.5).
- Register every approved clip in the asset library: `video_production_skills/asset-library/SKILL.md`.

**Image outputs:**
- Download to the appropriate producer working directory (e.g. `listing_video_v4/public/generated/` for listing imagery).
- Broker headshots: download and upload to Supabase `brokers` bucket (see existing pattern in `app/actions/broker-headshot.ts` lines 217–230).

**Utility outputs (rembg, real-esrgan):**
- Download to the same directory as the source file, with a `_nobg` or `_4x` suffix.

Always write the Replicate prediction ID to `citations.json` alongside any figure or asset that came from an AI generation run — this provides the audit trail back to the source call.

---

## Existing usage

`app/actions/broker-headshot.ts` is the canonical live implementation. It demonstrates:
- Token validation (`process.env.REPLICATE_API_TOKEN?.trim()`)
- Uploading source image to Supabase public storage before passing the URL to Replicate
- Creating a prediction with a pinned `version` string
- Polling every 2 seconds up to 60 attempts (120s max)
- Downloading the output and re-uploading to Supabase storage immediately

Read this file before writing any new Replicate integration — the pattern is already production-validated.

The model used there (`fofr/face-to-many`) is for broker headshot generation only and is separate from the video pipeline models listed above.

---

## Pre-flight checklist (before any new Replicate call)

```
[ ] REPLICATE_API_TOKEN confirmed in .env.local
[ ] Account balance confirmed at replicate.com/account/billing — sufficient for the planned batch
[ ] Model slug verified at replicate.com — exists, not archived, last updated < 6 months ago
[ ] Input image URL is publicly accessible (Supabase public storage, not a local path or localhost URL)
[ ] Prompt passes block-format check — no banned adjectives, no narrative prose
[ ] Hard rule confirmed: no listing interiors in the prompt or source image
[ ] Output download triggered immediately after succeeded — not stored as a Replicate-hosted URL
[ ] Prediction ID written to citations.json for audit trail
[ ] Draft clips land in out/ (gitignored) until Matt approves — never commit directly to public/v5_library/
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `app/actions/broker-headshot.ts` | Existing production implementation — token validation, polling pattern, output download |
| `video_production_skills/ai_platforms/SKILL.md` | Model-selection decision tree, prompt architecture, banned vocabulary, photo-to-video pre-flight |
| `video_production_skills/API_INVENTORY.md` §1 | Full model cost table verified 2026-04-27; fal.ai balance status; untapped capabilities |
| `video_production_skills/asset-library/SKILL.md` | Register generated clips in the asset library after approval |
| `video_production_skills/quality_gate/SKILL.md` | Every AI clip must clear the 6-phase gate before stitching into a render |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate — no AI clip ships without clearing this |
| https://replicate.com/pricing | Current per-second GPU rates — verify before any batch commitment |
| https://replicate.com/account/billing | Account balance and usage |
| https://replicate.com/account/api-tokens | Token management |
| https://replicate.com/docs/reference/http | REST API reference (predictions, webhooks, file uploads) |
