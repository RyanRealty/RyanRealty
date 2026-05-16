# Handoff — Producer Authoring (autonomous, deep-research)

**Mission:** Author the Producer SKILL.md files that the 2026-05-15 competitive audit identified as missing — but make each producer a genuine expert on its output type AND its target platform. No shallow templates. Each SKILL.md must be deeply researched so the producer it spawns knows exactly which tools to use, how to use them well, and what "winning" looks like on the specific platform it posts to.

Run end-to-end without Matt's manual intervention beyond the final review gate. Surface drafts before any commits per CLAUDE.md §0.5; otherwise grind.

---

## 0. State of the world (as of 2026-05-16)

Before doing anything, internalize this. The brain shipped a LOT in the last 48 hours.

| Component | State |
|---|---|
| `marketing_brain_actions` action queue | Live |
| Audit findings (action_row_id `9062ab1c-9c7d-4053-86ad-a0bb33efd6c5`) | **pending** — this is your work queue |
| `competitor_intel` | 442 rows from audit `2026-05-15-v2` |
| `content_classification` | 220 rows (keyword-heuristic; future audits with `ANTHROPIC_API_KEY` set in Vercel will be richer) |
| `audit_winners` view | 7 topic × format combos with sample size ≥ 5 |
| Brain mapper (`generate-briefs.ts`) | Already consumes audit findings via `pickAuditWinningFormat()` — sample-size-gated at 5 |
| Tools registry | **16 of 33 authored** (apify, anthropic-classifier, supabase, replicate, spark_mls, meta_graph, resend, ga4, gsc, youtube_data, google_business_profile, follow_up_boss, tiktok_api, x_api, linkedin_api, agentfire_wordpress) |
| Producer REGISTRY | All Section A–F producers documented; site-edit/site-page-create/site-performance/ops-meta-ads/ops-fub-crm/ops-email-send/ops-reputation already authored at 400-520 lines each |
| Inbox pipeline | Live; `marketing@ryan-realty.com` receives + parses + replies |
| Daily digest cron | Live at 14:00 UTC |
| `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY` | Both live in Vercel (all 3 envs) + .env.local |

**Your specific work queue lives in the audit-findings row payload.** Query:

```sql
SELECT id, target, payload
FROM public.marketing_brain_actions
WHERE id = '9062ab1c-9c7d-4053-86ad-a0bb33efd6c5';
```

The `payload.missing_producers[]` array is the list. Each entry has `proposed_skill_name`, `proposed_path`, `proposed_action_type`, `topic`, `format`, `evidence` (sample_post_urls, competitors_running_this), `priority`, `data_sources_needed`, `similar_existing_producer`.

---

## 1. Required reading (in order — read fully before doing anything)

1. **`CLAUDE.md`** — especially §0 (data accuracy, absolute), §0.5 (draft-first, absolute), "Marketing Brain Architecture", "Voice + content", "Skill self-binding"
2. **`.auto-memory/memory_marketing_brain_decisions.md`** — every decision and gotcha the brain has accumulated. Required.
3. **`marketing_brain_skills/audit-findings/PROTOCOL.md`** — the contract you read FROM and write back TO
4. **`marketing_brain_skills/producers/REGISTRY.md`** — see existing producer rows; you'll add new ones here
5. **`marketing_brain_skills/producers/TEMPLATE.md`** — the 10-section template every new producer SKILL.md follows
6. **`marketing_brain_skills/brand-voice/voice_guidelines.md`** — every output you reference in a recipe gets voice-validated; bake this into each producer
7. **`social_media_skills/platform-best-practices/SKILL.md`** — the 2026 algorithm + format rule layer for IG, TikTok, YouTube, FB, LinkedIn. Required for any producer that posts to a social platform.
8. **`marketing_brain_skills/tools_registry/REGISTRY.md`** — 16 authored tool SKILL.md files. Read this index first, then DEEPLY read every tool SKILL.md that any producer you're authoring would touch.
9. **Two existing producer skills** as exemplars of depth: `social_media_skills/list-kit/SKILL.md` (compound producer with 5-deliverable fan-out) and `video_production_skills/listing_reveal/SKILL.md` (single-deliverable expert). Match this depth or beat it.

---

## 2. Mission-critical principle — depth over speed

The 2026-05-15 audit surfaced that `agent_brand × reel` wins at 9.8% p75 ER while `listing × reel` (existing producer) hits 0.03% — a 300× gap. The brain's recommendations are only as good as the producers it dispatches to. **A producer that doesn't know its platform's algorithm rules or its tool's actual capabilities will produce 0.03% content even with perfect data.**

**Each producer SKILL.md must answer, with specifics:**

| Question | What "deep" looks like |
|---|---|
| What platform does this post to, and what does that platform reward in 2026? | Algorithm signals, hook timing, format constraints, audio rules, hashtag rules, posting cadence — pulled from the platform's developer docs + recent top-creator analyses. NOT "engagement is good." |
| What tools does this producer use? | Every tool listed by name with the specific feature being used. NOT "Apify for scraping." Yes "apify/instagram-profile-scraper for the last 12 posts, fields X Y Z, costing $0.X per profile." |
| What does winning content look like for THIS topic on THIS platform? | Three exemplars (URLs or specific patterns) from the audit corpus or live web research. NOT "data-driven content." Yes "the Heider Real Estate Vegas market reel format: 8 cuts, single text overlay per cut, no voiceover, original audio." |
| What's the failure mode? | Concrete fix per common error. NOT "if it fails, try again." |
| How is this voice-validated? | Reference voice_guidelines.md sections; show the validation step in the recipe. |
| What's the cost? | $ per output, broken down by tool. |

If a producer SKILL.md you author can't answer any of these specifically, it's not ready to ship. Re-research.

---

## 3. Procedure — per producer

For each entry in `payload.missing_producers[]`, execute steps 1–9 in order.

### Step 1 — Read the entry + neighborhood

- Note the topic, format, proposed_skill_name, proposed_path, proposed_action_type
- Read `similar_existing_producer` (if not null) — that's the closest template
- Read the relevant topic block in `config/marketing-brain/topics.json` (descriptions + examples + data_sources)
- Read every URL in `evidence.sample_post_urls` (use WebFetch tool to see what the winners actually look like)

### Step 2 — Identify the tool stack

For the (topic, format) combo, identify which tools the producer will need. Examples:

| Producer | Likely tools |
|---|---|
| `market-data-carousel` (market_data × carousel for IG) | Spark MLS or Supabase listings (data) + Canva or Remotion (carousel render) + meta_graph (publish) |
| `agent-brand-reel` (agent_brand × reel for TikTok) | None for data (it's about agent voice) + Replicate or Remotion (production) + tiktok_api (publish) |
| `national-housing-news-carousel` | WebSearch (news) + Anthropic (summary) + Canva or Remotion + meta_graph |
| `lifestyle-bend-reel` | Asset library + Remotion + meta_graph + tiktok_api |
| `buyer-education-blog` | Anthropic (drafting) + agentfire_wordpress (publish) |

For EVERY tool you identify, READ ITS SKILL.md from `marketing_brain_skills/tools_registry/`. Note:
- Exact env var names
- Endpoint patterns
- Cost per call
- Gotchas
- Rate limits

This is the "tools knowledge" Matt asked for. The producer SKILL.md will reference these tool SKILL.mds — but it must also distill the specific subset relevant to its workflow.

### Step 3 — Research the platform deeply

For the platform the producer posts to (IG, TikTok, YouTube, FB, LinkedIn, blog), do at minimum:

1. **Read `social_media_skills/platform-best-practices/SKILL.md`** for the canonical decision matrix
2. **WebFetch the platform's developer docs** for the format being authored (e.g. Instagram Reels spec, TikTok Content Posting API)
3. **WebSearch for 2026 algorithm changes** specific to the platform — e.g. "Instagram Reels algorithm 2026"
4. **Study the audit's winning examples** for this combo — open the `evidence.sample_post_urls` in WebFetch, observe the structure, hook timing, text overlay style, audio choice, CTA pattern

Capture findings in the SKILL.md "Platform expertise" section. Be specific. Date your sources.

### Step 4 — Author the SKILL.md

Use `marketing_brain_skills/producers/TEMPLATE.md` as the base. Required sections, with the depth required for each:

1. **Frontmatter** — `name`, `description` with trigger phrases, `action_types: [...]`
2. **Scope (what it does + what it does not)** — including the cross-producer boundary
3. **Action types handled + payload schema** — TypeScript interface
4. **The recipe** — step-by-step. Each step names the exact tool call, the exact data source, the exact transformation. No hand-waving.
5. **Tools used** — table referencing tools_registry SKILL.mds; cost per call; rate-limit notes
6. **Platform expertise** — algorithm rules, format specs, hook/text/audio/CTA conventions, posting cadence. Dated sources.
7. **Output format** — exact asset spec (dimensions, codec, file size, caption length, hashtag count, link rules). Where the draft lands. How to surface it for Matt review.
8. **Approval gate** — matt-review-draft / matt-review-PR / matt-explicit per the action_type's category
9. **Status flow** — pending → in_production → ready → approved → executed → measured
10. **Failure modes** — concrete fix per error
11. **Related skills + playbooks + references** — links to every tool SKILL.md it touches + every reference doc used + the original audit_winners row that justifies this producer

Length target: **500-800 lines.** That's not arbitrary — Matt's existing producer skills are 400-520 lines and we want deeper. If your draft comes in under 500, you didn't research enough.

### Step 5 — Voice-validate the SKILL.md itself

Even though the SKILL.md is internal, every example / hook / CTA / body text snippet in the recipe must pass `applyBrandVoice()` voice_guidelines.md rules: no em dashes, no banned words, no banned phrases, no fake urgency. Run a grep before saving:

```sh
grep -nE "—|stunning|nestled|charming|gorgeous|won't last|act fast|don't miss out" path/to/new/SKILL.md
```

If any matches, rewrite.

### Step 6 — Add the row to `producers/REGISTRY.md`

Add ONE row in the appropriate section (A = Orchestrators, B = Content, C = Site, D = Operational, E = Comms, F = Analysis):

```
| <producer_name> | `<proposed_path>` | <action_types comma-separated> | <approval tier> | <est. run_time> |
```

Make sure `action_types` exactly matches what's in the new SKILL.md's frontmatter.

### Step 7 — Type-check + scan

```sh
node --max-old-space-size=4096 ./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -v ".next/dev/types" | tail -5
```

Should print nothing if clean.

### Step 8 — Commit + push (per producer, NOT per batch)

Per CLAUDE.md "Always push directly to main" + the cross-session collision gotcha documented in `.auto-memory/memory_marketing_brain_decisions.md`:

```sh
git add marketing_brain_skills/producers/<new-producer>/ marketing_brain_skills/producers/REGISTRY.md
# NEVER use git add -A or git add . — staged-file collision is real
git status --short -- marketing_brain_skills/producers/  # verify only your paths
git commit -m "$(cat <<'EOF'
feat(producer): author <producer_name> from audit-2026-05-15-v2 findings

[Concise description of what this producer does + what tools it uses
+ what platform it posts to + why the audit prioritized it]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git fetch origin main --quiet
if [ -n "$(git log HEAD..origin/main --oneline 2>&1)" ]; then
  git stash push -m "auto-stash" 2>&1 | tail -1
  git pull --rebase origin main 2>&1 | tail -2
  git push origin main 2>&1 | tail -2
  git stash pop 2>&1 | tail -1
else
  git push origin main 2>&1 | tail -2
fi
```

### Step 9 — Update the audit-findings executor_response

After every producer you author, append to the action row's `executor_response`:

```sql
UPDATE public.marketing_brain_actions
SET executor_response = jsonb_set(
  COALESCE(executor_response, '{}'::jsonb),
  '{authored_producers}',
  COALESCE(executor_response->'authored_producers', '[]'::jsonb) || jsonb_build_object(
    'skill_name', '<producer_name>',
    'path', '<proposed_path>',
    'authored_at', now()::text,
    'lines', <line_count>,
    'commit_sha', '<short_sha>'
  )::jsonb
)
WHERE id = '9062ab1c-9c7d-4053-86ad-a0bb33efd6c5';
```

This is your handoff back to the brain. When the queue is fully drained, the action row's executor_response carries a complete authoring log.

---

## 4. When all missing_producers are authored

Transition the action row to `executed`:

```sql
UPDATE public.marketing_brain_actions
SET status = 'executed',
    executor_response = jsonb_set(
      executor_response,
      '{completed_at}',
      to_jsonb(now()::text)
    )
WHERE id = '9062ab1c-9c7d-4053-86ad-a0bb33efd6c5'
  AND status = 'approved';
```

Note: this requires Matt to have already approved the row (status='approved'). If status is still 'pending' when you finish, surface to Matt for approval before transitioning to 'executed'. If status is 'killed' (Matt rejected the findings), abort the authoring run entirely and update memory log.

---

## 5. Approval rules + voice gates (non-negotiable)

- **Draft-first per CLAUDE.md §0.5.** Show the SKILL.md to Matt before each commit. He can say "ship", "kill", or "redo with X." Do NOT auto-commit producer SKILL.mds without his explicit approval — even with broad autonomy. The exception per `feedback_skill_authoring_autonomy.md` is the SKILL.md/REGISTRY/content_engine routing layer; producer SKILL.mds for new producers being introduced to the system DO require approval.
- **Voice validation** on every example string in the SKILL.md per `voice_guidelines.md` §6 (banned words/phrases/punctuation).
- **Data accuracy** per §0: every claim about platform algorithm behavior must cite a source (developer docs URL, dated industry analysis, top-creator pattern).
- **No `git add -A`** — see the cross-session collision gotcha. Stage specific files.
- **Pull --rebase before push. Push immediately after commit.**

---

## 6. Parallel execution strategy

If the missing_producers list has more than 4 entries (likely), you can spawn Sonnet sub-agents in parallel to author batches. Each sub-agent:

- Gets a fully self-contained prompt referencing this doc + the specific producers it should author
- Reads the same tool SKILL.mds (cheap; cached)
- Writes its own SKILL.md files
- Returns the list of producers it authored + the commit SHAs

Coordinator (you) reviews each sub-agent's output before commits land. Or — if you trust the sub-agent's depth, dispatch with explicit instructions to commit each producer per Step 8 and return the SHAs.

**Coordination rule:** sub-agents must NEVER touch each other's files. If you batch 4 producers across 4 sub-agents, each gets exactly one producer path. The shared file is `producers/REGISTRY.md` — only the coordinator (you) appends rows there after all sub-agents return, or sub-agents append serially with a lock pattern.

---

## 7. Tools you have access to

- **Bash** — for tsc, git, grep, file operations
- **Read/Write/Edit** — for the SKILL.md files
- **Supabase MCP** (`mcp__5adfee1a-82b2-4661-a931-e7bf6763a9c9__*`) — read audit findings, update action row, query content_classification
- **WebSearch + WebFetch** — for platform research (developer docs, algorithm posts, top creator analyses)
- **Apify MCP** (`mcp__Apify__*`) — if you need to scrape something live for research
- **Chrome MCP** (`mcp__Claude_in_Chrome__*`) — for opening developer docs / creator profiles
- **Anthropic API** — `ANTHROPIC_API_KEY` is in env; use sparingly for any classifier/research helper calls
- **Sub-agent spawn** via the Agent tool — for parallel authoring

---

## 8. Definition of done

- Every entry in `payload.missing_producers[]` has been:
  - Researched (tools + platform + winning examples)
  - Authored as a SKILL.md (500-800 lines, the depth bar)
  - Voice-validated
  - Added to `producers/REGISTRY.md`
  - Committed individually + pushed
  - Recorded in the action row's `executor_response.authored_producers[]`
- The audit-findings action row is at `status='executed'` (after Matt's approval)
- `.auto-memory/memory_marketing_brain_decisions.md` has a new section documenting the producer-authoring run: which producers were authored, how the tool/platform research went, any new gotchas discovered, what's left out of scope
- Final summary surfaced to Matt: producers authored, SHAs, queue empty, runtime, any open questions

When all 8 are true, the brain has graduated from "knows what should exist" to "has the expertise to actually produce it." Surface the summary and stop.

---

## 9. What you do NOT touch in this session

- The brain's mapper code (`lib/marketing-brain/generate-briefs.ts`) — read-only
- The brain's other lib files (audit-run, audit-classifier, audit-findings-builder, measurement-loop, daily-digest, snapshot, etc.) — read-only
- The marketing inbox pipeline (`lib/marketing-brain/inbox-*`, `app/api/cron/marketing-inbox-poll`) — read-only
- The dashboard (`app/dashboard/marketing/page.tsx`) — read-only
- Existing producer SKILL.mds (only ADD new ones)
- The audit-findings payload itself — only the `executor_response` field

If you find a bug in any of the above while reading, document it in `.auto-memory/memory_marketing_brain_decisions.md` "Pending issues" section for the next brain-architecture session to fix.

---

## 10. Specific gotchas to remember

- **`git add -A` is banned** — see the 2026-05-14 collision incident in memory log
- **Vercel CLI `vercel env add KEY preview --value X --yes` is broken** for preview env in agent mode — use REST API PATCH `https://api.vercel.com/v10/projects/{id}/env/{envId}` directly (auth token at `~/Library/Application Support/com.vercel.cli/auth.json`)
- **Apify FB Ads scraper** uses `startUrls` and `maxResults` (NOT `adLibraryUrls` + `maxAds`) — schema changed 2026-05-15
- **content_classification inline upserts cap at 25 rows** — Supabase 8s timeout fires above that
- **`audit_id` uniqueness** — check before insert, use `-v2`/`-v3` suffix on collision
- **TikTok `/v2/video/list` `fields` param goes in QUERY string**, not body
- **FUB tag matching is case-insensitive multi-form** — don't strip
- **LinkedIn Community Management API** is mutually exclusive with Share-on-LinkedIn on the same dev app — flagged pending Matt's decision
- **Resend mail.ryan-realty.com domain is unverified** — outbound email tier is blocked
- **The brain auto-rotates competitor-recon source by day-of-week** Mon-Fri; manual runs without filters trigger full pass (may exceed maxDuration)

---

## 11. Memory log entry template (use at end of run)

Append to `.auto-memory/memory_marketing_brain_decisions.md`:

```markdown
## 2026-05-XX — Producer Authoring autonomous run

Authored N new producer SKILL.md files from audit-2026-05-15-v2
findings (action row 9062ab1c-...). Brain producer coverage went
from 14/21 reachable to <X>/<Y> reachable.

Producers authored (per missing_producer priority):

| # | Skill | Topic × Format | Platform | Tools used | Lines | Commit |
|---|---|---|---|---|---|---|
| 1 | <name> | <topic>/<format> | <platform> | <tools> | <N> | <sha> |
| ... |

Tool/platform research depth notes:
- <Platform>: <key algorithm finding>
- <Tool>: <key capability or limitation discovered>

New gotchas surfaced:
- <gotcha 1>
- <gotcha 2>

Out of scope for this run:
- <anything deferred>

Audit-findings row 9062ab1c-... transitioned pending → approved → executed.
```

---

## 12. Final note

This is the work that turns the brain from "smart at picking" to "smart at making." Every shortcut you take in the authoring becomes a 0.03% engagement rate later. The audit just told us what kinds of content beat ours by 300×. Honor that by authoring producers that actually know what they're doing.

Get to work.
