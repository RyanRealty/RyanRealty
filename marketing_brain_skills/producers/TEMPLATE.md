---
name: <producer-name>
description: >
  One sentence: what this producer makes, for which surface, and what triggers it.
  Keep it tight — this is the text the brain uses for routing decisions.
action_types:
  - content:<action_slug>
  # List every action_type string this producer handles.
  # These must exactly match what is in marketing_brain_skills/producers/REGISTRY.md.
  # The brain looks up assigned_producer from the action row — this frontmatter
  # is documentation and self-validation, not runtime routing.
---

# <Producer Name>

**Scope:** One paragraph. What this producer makes, what surface it targets,
what it does NOT do (be specific — prevents scope creep when the brain
dispatches an action row and the agent must decide whether to proceed).

**Status:** [Draft | Canonical | Deprecated]  
**Locked:** YYYY-MM-DD  
**Exemplar output:** `out/<format>/<slug>/` or equivalent path pattern.

---

## 1. Scope

### In scope
- Specific deliverable(s) this producer outputs (file type, format, dimensions if applicable)
- The surface(s) it targets (IG Reels, GBP, website, print, etc.)
- The action_types it handles (list each)

### Out of scope
- What closely related thing this producer does NOT do
- Which other producer handles that instead

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:<action_slug>` | `mls_id` or `city` or other key field | Brief description |

### Payload schema

```typescript
interface <ProducerName>Payload {
  // Required fields the action row's `payload` jsonb must contain
  // for this producer to execute without asking Matt for more info.
  field_name: string        // description
  optional_field?: string   // description (include if commonly omitted)
}
```

The brain populates `payload` when it writes the action row. For manual
invocations via `marketing_brain_skills/produce/SKILL.md`, Matt provides
these fields in natural language and the produce skill parses them.

---

## 3. Brief payload schema

Full TypeScript interface for what this producer expects to receive
via the `marketing_brain_actions` row:

```typescript
interface <ProducerName>ActionRow {
  id: string                 // uuid from marketing_brain_actions
  action_type: string        // e.g. 'content:listing_reel'
  target: string             // e.g. 'mls:220189422'
  assigned_producer: string  // path to this SKILL.md's directory
  payload: <ProducerName>Payload
  data_evidence: {
    // Raw signals from audits that triggered this action (optional — may be {})
    audit_source?: string
    opportunity_area?: string
    signal_evidence?: string
  }
  generation_reason: string
  status: 'pending'          // always pending when producer first reads the row
}
```

---

## 4. The recipe

Step-by-step production procedure. This is the expertise section —
be specific enough that a cold agent can follow it without loading
other skill files (except mandatory refs in §5).

**Step 1 — Read the action row**
Query `marketing_brain_actions` by `id`. Confirm `status='pending'`.
Immediately UPDATE `status='in_production'` and `executed_at=now()`.

**Step 2 — Load mandatory references**
Before touching any deliverable, read:
- `CLAUDE.md` §0 — Data Accuracy mandate
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md` — brand register
- [any format-specific skill files this producer delegates to]

**Step 3 — Pull and verify source data**
[Describe the Supabase query or API call. Per CLAUDE.md §0, every
figure must trace to a live query in this session. Never inherit
numbers from the action row's payload without re-verifying.]

**Step 4 — Build the draft**
[Describe the build process. Be specific about tools, file paths,
render commands. Reference sub-skills by path.]

**Step 5 — Run the QA gate**
[List the specific checks. For video: ffprobe duration, blackdetect,
banned-word grep, citations.json. For static: design_review_checklist,
fonts_used.json, provenance.json.]

**Step 6 — Write citations.json**
One entry per figure shown in the deliverable:
```json
{
  "figure": "$849,000",
  "source": "Supabase listings",
  "filter": "MlsId='220189422'",
  "column": "ListPrice",
  "value": 849000,
  "fetched_at": "2026-05-13T14:00:00Z"
}
```

**Step 7 — UPDATE the action row**
```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "...", "scorecard": {...}}'::jsonb
WHERE id = '<action_id>';
```

**Step 8 — Surface draft to Matt**
See §6 for the required surface format.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | data pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| ElevenLabs API | VO synthesis (if applicable) | `ELEVENLABS_API_KEY` |
| Remotion | video render (if applicable) | `cd listing_video_v4 && npx remotion render` |
| [other tools] | [purpose] | [env var or path] |

---

## 6. Output format

**Draft lands at:** `out/<format-slug>/<target-slug>/`
**Files produced:**
```
out/<format-slug>/<target-slug>/
├── <main-deliverable>.<ext>
├── citations.json
├── [scorecard.json if video]
└── contact-sheet.html    ← MANDATORY per "Contact sheet required" rule (2026-05-14)
```

**Contact sheet (mandatory).** Every producer that outputs a visual or video deliverable must
emit an HTML contact sheet that lets Matt review the draft in a browser. The contact sheet:

- Embeds images inline (`<img>` at native or scaled-to-viewport).
- Plays videos with HTML5 `<video controls>`.
- Shows carousels as a slide grid with slide numerals.
- Renders captions in a readable `<pre>` block.
- Lists the verification trace (one row per figure: source · filter · value · fetched_at).
- Shows file paths alongside each deliverable.
- Carries a status pill per deliverable (DRAFT / APPROVED / REVISIONS NEEDED / BLOCKED).
- Includes an approval prompt at the bottom listing the structured chat replies Matt should send.

Brand: v2 (navy `#102742` on cream `#faf8f4`, Geist body, Amboqia headlines). Mirror the
[2026-05-14 reference contact sheet](../../out/proof/2026-05-14/contact-sheet.html) for layout
and styling.

**Localhost serving.** Symlink `public/proof` → `../out/proof` so the local static server serves
the sheet at `http://localhost:<port>/proof/<YYYY-MM-DD>/<batch>/contact-sheet.html`. `public/proof/`
is gitignored. If the local server isn't running on port `<port>`, spin up a one-liner:

```bash
nohup python3 -m http.server <port> --directory public >/tmp/proof-server.log 2>&1 &
```

**Surface format (present to Matt exactly like this):**

```
Draft ready: <producer-name> — <target>

Contact sheet:
  → http://localhost:<port>/proof/<YYYY-MM-DD>/<batch>/contact-sheet.html
  → file:///Users/matthewryan/RyanRealty/out/<format-slug>/<target-slug>/contact-sheet.html

  DELIVERABLE
    Path: out/<format-slug>/<target-slug>/<file>
    [format-specific stats: duration, size, scorecard, etc.]

  VERIFICATION TRACE
    - <figure> — <source>, <filter>, fetched <iso>
    [one line per figure]

  citations.json: out/<format-slug>/<target-slug>/citations.json

Reply with one of:
  • approve <slug>          — commits + pushes that deliverable to public/
  • approve all             — commits + pushes everything in the batch
  • revise <slug>: <note>   — feedback I'll act on
  • kill <slug>             — drop that deliverable from the batch
```

Then stop. Do not commit. Do not push. Wait for Matt's explicit approval.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the draft and says "ship it" / "approved" / "go" | Matt only |
| `matt-review-PR` | Matt merges the PR in GitHub | Matt only |
| `matt-explicit` | Matt explicitly names the action in the conversation | Matt only |
| `none` | No approval needed (alerts and analysis only — never for published content) | N/A |

**This producer uses:** `matt-review-draft`

---

## 8. Status flow

The producer transitions the `marketing_brain_actions` row through these statuses:

```
pending           ← producer reads row here
  │
  ▼ (producer starts work)
in_production     ← producer sets immediately on pickup; executed_at=now()
  │
  ▼ (draft complete, QA passed)
ready             ← producer sets after surfacing draft; executor_response populated
  │
  ▼ (Matt says "ship it")
approved          ← run/SKILL.md or produce/SKILL.md sets after Matt's explicit approval
  │
  ▼ (publish step completes)
executed          ← set after git commit + push (or site PR merge, or API call completes)
  │
  ▼ (48h post-publish analytics check)
measured          ← set by performance_loop after metrics are captured

killed            ← terminal; set if Matt cancels or QA fails after 2 auto-iterations
```

SQL to transition:
```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"...","scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Source data unavailable | Supabase query returns 0 rows or API 4xx | Report to Matt with the exact query and error. Set `status='killed'` with `executor_response` containing the error. |
| QA gate fails (fixable) | blackdetect hits, banned word, duration out of range | Auto-fix and re-render. Max 2 auto-iterations. After 2 failures, surface to Matt with specific failure reason. |
| QA gate fails (unfixable) | Source data error, missing asset, Remotion OOM | Surface to Matt immediately. Do NOT present a broken draft. |
| Voice validation fails | Brand voice checker returns violations | Do not present draft. Fix violations and re-validate. If violation is ambiguous, surface to Matt with the specific rule cited. |
| Render timeout | Remotion/ffmpeg process hangs >10 min | Kill the process. Report to Matt with the last successful frame and the error log. |
| Missing env var | API key not in .env.local | Report to Matt: which var, which tool, what to set. Do not guess or hard-code. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `design_system/ryan-realty/SKILL.md` — brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement

**Format skills delegated to (if any):**
- [`video_production_skills/<format>/SKILL.md`] — [what it provides]

**Capabilities used inside this producer:**
- [`video_production_skills/elevenlabs_voice/SKILL.md`] — Victoria voice settings
- [`video_production_skills/quality_gate/SKILL.md`] — QA pass procedure

**Playbooks and pipeline docs:**
- [`automation_skills/content_engine/SKILL.md`] — content routing; all content actions go through here
- [`social_media_skills/platform-best-practices/SKILL.md`] — 2026 platform rule layer
- [`video_production_skills/ANTI_SLOP_MANIFESTO.md`] — banned content gate
- [`video_production_skills/VIRAL_GUARDRAILS.md`] — scorecard + format minimums

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section [A/B/C/D/E/F], row `<producer_name>`
