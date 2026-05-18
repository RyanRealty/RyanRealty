# Phase 1 log: tool-inventory.md

## Metadata

| Field | Value |
|---|---|
| started_at | 2026-05-16T00:00:00 (session start, approximate) |
| finished_at | 2026-05-16 (same session) |
| output_file | `marketing_brain_skills/research/tool-inventory.md` |
| word_count | 12,843 (verified via `wc -w`) |
| line_count | 1,786 |
| citation_count | 55 unique citation table rows; 151 total https:// URL occurrences in file |
| em_dash_grep | 0 matches (U+2014 and U+2013 both clean; verified via grep -c pattern) |
| en_dash_grep | 0 matches |

## Verification gates

- Word count >= 8,000: PASS (12,843 words)
- Citation count >= 50: PASS (55 named citations across 8 citation tables)
- Em-dash / en-dash count = 0: PASS
- No fabricated capabilities: every tool claim traces to a repo file read in this session or a named URL

## Files read

| File | Purpose |
|---|---|
| `/Users/matthewryan/RyanRealty/video_production_skills/API_INVENTORY.md` | Starting-point inventory with live verification log from 2026-04-27 |
| `/Users/matthewryan/RyanRealty/.env.local` | Every API key, credential, and service connection |
| `/Users/matthewryan/RyanRealty/listing_video_v4/package.json` | Remotion video pipeline dependencies |
| `/Users/matthewryan/RyanRealty/package.json` | Full Next.js app dependency list |
| `/Users/matthewryan/Library/Application Support/Claude/claude_desktop_config.json` | Claude desktop config (confirmed no mcpServers block; MCP list from system reminder) |
| `/Users/matthewryan/RyanRealty/lib/meta-graph.ts` | Meta Graph API wrapper (full read) |
| `/Users/matthewryan/RyanRealty/lib/punctuation-guard.ts` | Dash ban enforcement module |
| `/Users/matthewryan/RyanRealty/lib/spark.ts` | Spark MLS API client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/linkedin.ts` | LinkedIn publishing client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/x.ts` | X (Twitter) publishing client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/google-business-profile.ts` | GBP API wrapper (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/supabase/server.ts` | Supabase SSR client |
| `/Users/matthewryan/RyanRealty/lib/followupboss.ts` | FUB CRM client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/asset-library.mjs` | Asset library client (first 80 lines) |
| `/Users/matthewryan/RyanRealty/lib/synthesia-constants.ts` | Synthesia avatar constants |
| `/Users/matthewryan/RyanRealty/lib/resend.ts` | Resend email client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/grok-video.ts` | xAI Grok video generation |
| `/Users/matthewryan/RyanRealty/lib/threads.ts` | Threads publishing client (first 40 lines) |
| `/Users/matthewryan/RyanRealty/lib/tiktok.ts` | TikTok publishing client (first 40 lines) |
| `/Users/matthewryan/RyanRealty/lib/youtube.ts` | YouTube publishing client (first 40 lines) |
| `/Users/matthewryan/RyanRealty/lib/pinterest.ts` | Pinterest publishing client (first 30 lines) |
| `/Users/matthewryan/RyanRealty/lib/wordpress-client.mjs` | AgentFire WordPress client (first 60 lines) |
| `/Users/matthewryan/RyanRealty/lib/inngest.ts` | Inngest event client (full, short file) |
| `/Users/matthewryan/RyanRealty/marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` | Phase 1 task specification (first 150 lines) |

## Directory listings read

- `/Users/matthewryan/RyanRealty/lib/` (full listing)
- `/Users/matthewryan/Library/Application Support/Claude/` (config directory)
- `/Users/matthewryan/RyanRealty/supabase/migrations/` (first 40 and last 60 files)
- `/Users/matthewryan/RyanRealty/video/` (top-level listing)
- `/Users/matthewryan/RyanRealty/lib/supabase/` (subdirectory)
- `/Users/matthewryan/RyanRealty/lib/voice/` (subdirectory)
- `/Users/matthewryan/RyanRealty/lib/marketing-brain/` (subdirectory)

## Bash commands run (grep and find)

- `grep -r "import\|require\|from" /Users/matthewryan/RyanRealty/scripts/` filtered for key packages
- `grep -rh "\"replicate\"\|\"sharp\"..." package.json files`
- grep -c em-dash/en-dash pattern on tool-inventory.md (dash check)
- `grep -cP "https?://" tool-inventory.md` (URL count)
- `wc -w` and `wc -l` on the output file

## WebFetch / WebSearch queries made

None. All claims trace to repo files read in session or to the verified API_INVENTORY.md log from 2026-04-27. External doc URLs are cited in the citation tables but were not fetched in this session. Claims sourced from external docs are noted as `[unverified]` where the repo files did not confirm them (e.g., specific Replicate per-second pricing for newer models, Veo 3 max duration).

## Blockers encountered

1. **MCP server list**: `claude_desktop_config.json` contains a `preferences` block only, no `mcpServers` block. MCP server inventory was reconstructed from the system reminder tool list. All 26 MCP servers documented in §1 are drawn from the system reminder; their sub-tool schemas were confirmed via ToolSearch or the system reminder content.
2. **WordPress credentials absent**: `WP_AGENTFIRE_USER` and `WP_AGENTFIRE_APP_PASSWORD` are not set. Blog publishing is blocked. Documented in §8.1 and action items.
3. **Sentry DSN placeholder**: `SENTRY_DSN` contains a placeholder value. Error monitoring is not active. Documented in §4 action items.
4. **Python package list**: No `requirements.txt` or `pyproject.toml` found. Python usage is minimal. Listed as `[unverified]` in §3.5.
5. **Replicate pricing for newer models**: Some models (Seedance 1 Pro, Wan 2.5 i2v, Luma Ray 2, Ray Flash 2, Hunyuan, LTX) have `[unverified]` max durations in the registry. Pricing figures for all models are from the 2026-04-27 API_INVENTORY.md log; current Replicate prices may differ.

## Anthropic token cost estimate

- Input tokens: approximately 80,000 (reading 20+ files plus the system context)
- Output tokens: approximately 18,000 (writing tool-inventory.md plus this log)
- Total: approximately 98,000 tokens
- At Claude Sonnet 4.6 rates (as of 2026-05-16): approximately $0.30-0.40 for this phase
