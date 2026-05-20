---
name: meme-research
description: Apify-driven real-estate-meme research library. Use before building any meme content (meme_lord, meme_content producers). Scrapes top-performing real-estate memes from IG, X, TikTok, Reddit. Catalogs each with image + caption + context + humor mechanism. Stores in data/meme-library.jsonl so producers pick a working template and adapt it instead of inventing humor from scratch.
---

# meme-research — Real-Estate Humor Library (locked 2026-05-20)

## Canonical references

This skill complements the meme producers (`meme_lord`, `meme_content`). Per CLAUDE.md "Producer expertise model" Tier 2-3, every content producer additionally loads:

1. `CLAUDE.md` §0 + §0.5 — data accuracy + draft-first
2. `design_system/ryan-realty/SKILL.md` — brand register
3. `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice rules
4. `social_media_skills/platform-best-practices/SKILL.md` — platform rule layer
5. `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content
6. This skill — humor pattern library

Without a researched humor library, meme producers either invent jokes that don't land (per Matt 2026-05-19: "There needs to be a thorough understanding of real estate memes... dedicated agent that researches this and understands the humor, scrapes every meme, understands why it's funny") or recycle generic AI-template humor that signals slop.

---

## The rule

**Before any meme-format content ships, the meme producer reads `data/meme-library.jsonl` and adapts a documented working pattern.** The library catalogs real high-engagement real-estate memes scraped from IG / X / TikTok / Reddit, each tagged with its humor mechanism (irony, exaggeration, pun, contradiction, recognition, etc.). Producers pick a pattern that matches their intent and swap in Ryan Realty / Bend / market-data context.

Inventing memes from scratch without consulting the library is the failure mode this skill exists to prevent.

---

## The 7 humor mechanisms (taxonomy)

Every entry in the meme library is tagged with one or more of these mechanisms. The taxonomy is intentionally short — most working memes use one mechanism cleanly, not seven layered.

| mechanism | what it does | real-estate examples |
|---|---|---|
| `recognition` | "I've lived this exact moment" — the meme names a universal experience | "buyers checking the listing every 30 seconds after submitting an offer"; "the moment your appraisal comes in low" |
| `exaggeration` | Real situation pushed to absurd scale | "asking $50K over for the privilege of a 1972 kitchen"; "every house in Bend has an Adirondack chair photo" |
| `contradiction` | What people say vs what they mean | "they said 'cozy' (it's 700 sqft)"; "'priced to sell' (sat 90 days)" |
| `pun` | Wordplay on real-estate / Bend vocabulary | "Deschutes / Dis-shoots"; "Old Mill District / Old-Mill-illennial" |
| `irony` | Outcome opposite to expectation | "all-cash buyer loses to an FHA offer because the listing agent answered the phone"; "the cheapest house in Tetherow has a mountain view" |
| `subversion` | Defies the genre's expected punchline | "broker doesn't say 'great investment opportunity' for once" |
| `inside-joke` | Specific to a community (Bend / Central Oregon) | "trying to find parking at the Old Mill in July"; "any Crook County reference" |

A meme that doesn't cleanly map to one of these is probably not funny — the library skips it.

---

## Catalog schema (data/meme-library.jsonl)

JSONL — one meme per line. Each line:

```json
{
  "id": "ig-2026-04-realestatememe-...",
  "source_platform": "instagram",
  "source_url": "https://instagram.com/p/...",
  "scraped_at": "2026-05-20T...",
  "format": "image-with-caption" | "tweet" | "tiktok-text-overlay" | "reddit-post" | "comic-strip",
  "creator_handle": "@some_real_estate_account",
  "engagement": { "likes": 14200, "comments": 312, "shares": 540 },
  "image_url": "https://...",
  "caption": "...",
  "context_sentence": "What's happening in the meme, plain English",
  "humor_mechanism": ["recognition"],
  "humor_explanation": "1-paragraph why-it-works — what the punchline is, why it lands, what the setup vs payoff is",
  "ryan_realty_adaptation_idea": "How this template could be adapted for Bend / Tumalo / Central Oregon",
  "ryan_realty_voice_check": "PASS" | "REVIEW" | "REJECT",
  "ryan_realty_voice_notes": "Why pass / review / reject under Ryan Realty's brand voice (e.g. 'subverts the broker-as-hero arc — fits §4.7 authentic-not-salesy')"
}
```

`ryan_realty_voice_check`:
- **PASS**: pattern is on-brand. Use as-is, swap context.
- **REVIEW**: pattern works but adaptation needs care (e.g. relies on a banned word in the original).
- **REJECT**: pattern relies on hype / pandering / market-doom or other banned-territory tropes. Catalog the pattern but never ship it under Ryan Realty.

---

## Scraping workflow

Scraper script: `scripts/scrape-real-estate-memes.mjs` (Apify-driven). Runs against a fixed set of sources monthly.

### Sources (locked 2026-05-20)

| platform | actor | target |
|---|---|---|
| Instagram | `apify/instagram-scraper` | Top posts from `#realestatememes`, `#realtorlife`, `#realestateagent` + the 20 highest-engagement IG accounts in real-estate humor (RealEstateBees, BrokeMillennialBlog, ItsRealEstateBae, etc.) |
| TikTok | `clockworks/free-tiktok-scraper` | `#realestatehumor` + the 10 top creators by engagement |
| X (Twitter) | `apidojo/twitter-scraper` | Search for "real estate" + "funny" + filter by engagement threshold |
| Reddit | `trudax/reddit-scraper` | Top posts from r/RealEstate, r/Realtors, r/HousingCrisis, r/FirstTimeHomeBuyer (last 90 days, sort=top) |

### Workflow (`scripts/scrape-real-estate-memes.mjs`)

```bash
node scripts/scrape-real-estate-memes.mjs --platform instagram [--count 50]
node scripts/scrape-real-estate-memes.mjs --platform tiktok [--count 50]
node scripts/scrape-real-estate-memes.mjs --platform x [--count 100]
node scripts/scrape-real-estate-memes.mjs --platform reddit [--count 50]
node scripts/scrape-real-estate-memes.mjs --all  # runs all 4 platforms
```

What it does:
1. Loads Apify token from `APIFY_API_TOKEN` env var.
2. Runs the platform actor with the locked search params.
3. Pulls items, filters to high engagement (above the per-platform threshold).
4. For each item: download the image, summarize the context + humor mechanism via an AI prompt (or leave empty for manual cataloging).
5. Append to `data/meme-library.jsonl` (newline-delimited; one row per meme).

Cost: ~$2-5 per platform run on Apify Bronze. Run monthly to keep the library fresh.

---

## Cataloging pass (human + AI review)

Raw scrape produces uncategorized memes. A human (or LLM with this skill loaded) reads each and fills in:
- `context_sentence`
- `humor_mechanism` (pick from the 7)
- `humor_explanation`
- `ryan_realty_adaptation_idea`
- `ryan_realty_voice_check`

This step is creative + judgment-driven. It cannot be fully automated. The catalog grows by ~50 memes per monthly review.

---

## Producer consumption

Both `meme_lord` and `meme_content` producers pre-load `data/meme-library.jsonl` and:

1. Filter to `ryan_realty_voice_check === "PASS"`
2. Pick a mechanism (random or directed by payload)
3. Pick a meme of that mechanism (random within the filter)
4. Render the meme using Ryan Realty's brand visual register (navy + cream, Amboqia for headlines, AzoSans for body):
   - Image-with-caption format: brand the caption typography, keep the source image's compositional pattern
   - Text-only format: same brand register
   - Add a tiny Ryan Realty attribution in the corner (per the platform rules — usually none in-frame for IG/TikTok)

The producer's `citations.json` records the source meme's `id` so Matt can trace any rendered meme back to its inspiration.

---

## Anti-patterns

| anti-pattern | why it fails |
|---|---|
| Inventing a meme without consulting the library | High failure rate — humor that doesn't land reads as slop |
| Using a `REJECT`-flagged pattern under Ryan Realty | Voice violation |
| Punching down at first-time buyers, working families, or any client cohort | Off-brand per §4.7 authentic-not-salesy |
| Market-doom or market-hype humor ("crashing!" "on fire!") | Banned per CLAUDE.md video rules |
| Broker-as-hero arc memes ("most agents do X, we do Y") | Banned trope per voice_guidelines.md |
| Generic AI-template humor ("Me: a tree. Person who didn't put a contingency on the offer: ...") | Reads as AI; banned per ANTI_SLOP_MANIFESTO |

---

## Library status (2026-05-20)

| Platform | Memes catalogued | Last scrape |
|---|---|---|
| Instagram | 0 | not yet run |
| TikTok | 0 | not yet run |
| X | 0 | not yet run |
| Reddit | 0 | not yet run |

First scrape pass: schedule when Apify budget allows. Estimated cost for full first-pass population (~150 memes catalogued): $20-30 on Apify Bronze + ~3 hours of human/AI cataloging time.

---

## Change log

| Date | Change |
|---|---|
| 2026-05-20 | **Locked.** Initial skill. 7-mechanism humor taxonomy + JSONL catalog schema + Apify scraper script + producer consumption contract. Library starts empty; first scrape pass scheduled when Apify budget allows. |
