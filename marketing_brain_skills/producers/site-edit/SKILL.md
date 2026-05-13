---
name: site-edit
description: >
  Edits existing copy, meta tags, or CTAs on a live ryan-realty.com Next.js page.
  Given a page path and a set of targeted text changes, opens a GitHub PR for Matt
  to review before any change reaches production.
action_types:
  - site:copy_update
  - site:meta_update
  - site:cta_update
---

# Site Edit Producer

**Scope:** Targeted edits to existing Next.js page files in the `app/` directory —
hero subheads, paragraph text, button labels, SEO metadata, OG tags, and CTA
placement or color. This producer does NOT create new pages (that is
`site-page-create`) and does NOT touch performance/redirect infrastructure (that is
`site-performance`). It operates only on text, metadata, and CTA attributes inside
files that already exist. Every change lands in a git branch and a GitHub PR — never
directly on `main`.

**Status:** Canonical  
**Locked:** 2026-05-13  
**Exemplar output:** GitHub PR URL in `executor_response.pr_url`

---

## 1. Scope

### In scope
- `site:copy_update` — change hero subheads, paragraph body text, button labels, or any
  string inside an existing `.tsx` or `.ts` page file
- `site:meta_update` — change the `export const metadata` block: `title`, `description`,
  `openGraph.title`, `openGraph.description`, `twitter.title`, `twitter.description`
- `site:cta_update` — change CTA button text, destination `href`, or shadcn color token
  (e.g. `variant="default"` to `variant="secondary"`) on an existing `<Button>` element

### Out of scope
- Creating new routes or page files → `site-page-create`
- Adding `loading="lazy"` attributes, redirects, or JSON-LD → `site-performance`
- Any change to shared components (`components/ui/`, `components/home/`, etc.) that
  affects more than the single target page — escalate to Matt
- Changes to `app/layout.tsx` — escalate; any layout change is site-wide

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:copy_update` | `page_path`, `edit_type='copy'`, `changes[]` | Locate exact string; halt if ambiguous |
| `site:meta_update` | `page_path`, `edit_type='meta'`, `changes[]` | Only edits the `metadata` export object |
| `site:cta_update` | `page_path`, `edit_type='cta'`, `changes[]` | Must stay within shadcn token system |

### Payload schema

```typescript
interface SiteEditPayload {
  page_path: string           // e.g. "/sell" or "/sellers/home-valuation"
  edit_type: 'copy' | 'meta' | 'cta'
  changes: Array<{
    target_selector?: string  // component name or JSX attribute (e.g. "ContentPageHero subtitle")
    target_label?: string     // human description e.g. "hero subheadline"
    before_text: string       // current copy exactly as it appears in the file — for confirmation
    after_text: string        // new copy
    rationale: string         // why this change moves the needle (stored in commit message)
  }>
}
```

---

## 3. Full action row schema

```typescript
interface SiteEditActionRow {
  id: string                   // uuid from marketing_brain_actions
  action_type: string          // one of: 'site:copy_update' | 'site:meta_update' | 'site:cta_update'
  target: string               // e.g. 'page:/sell'
  assigned_producer: string    // 'marketing_brain_skills/producers/site-edit'
  payload: SiteEditPayload
  data_evidence: {
    audit_source?: string      // e.g. 'audit-website' or 'generate-briefs'
    opportunity_area?: string  // e.g. 'hero conversion rate below 1.2%'
    signal_evidence?: string   // e.g. 'GA4: bounce rate 78% on /sell, avg session 12s'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 — Read the action row and claim it**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately
set `status='in_production'` and `executed_at=now()`.

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

If status is not 'pending', stop: report the current status to Matt and do nothing.

**Step 2 — Load mandatory references**

Before touching any file:
- `CLAUDE.md` §0 — Data Accuracy mandate (any market figures in copy must be verified)
- `CLAUDE.md` "Draft-First, Commit-Last" — the PR is the draft; Matt merges; never push to main
- `design_system/ryan-realty/SKILL.md` — brand register; shadcn token system
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice validation

**Step 3 — Resolve the file path**

Map `payload.page_path` to a filesystem path:
- `/sell` → `app/sell/page.tsx`
- `/` → `app/page.tsx`
- `/sellers/home-valuation` → `app/sellers/home-valuation/page.tsx`
- If the resolved path does not exist, halt with:
  `status='killed'`, `executor_response = {error: "File not found: app/<page_path>/page.tsx"}`

Read the resolved file in full before making any edit.

**Step 4 — Validate brand voice on all `after_text` values**

For each change in `payload.changes`, check `after_text` against
`marketing_brain_skills/brand-voice/voice_guidelines.md`. Specifically verify:

- No banned words: stunning, nestled, boasts, charming, pristine, gorgeous,
  breathtaking, must-see, dream home, meticulously maintained, entertainer's dream,
  tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout
- No banned punctuation: em-dashes as punctuation, semicolons, exclamation marks in body
- No banned AI filler: delve, leverage, tapestry, navigate, robust, seamless,
  comprehensive, elevate, unlock, passionate, dedicated, premier, boutique
- No pressure/scarcity framing: "Don't miss out!", "Act now!", "Limited time"
- No emoji anywhere
- No hedging: may, could, potentially (as substitutes for facts)
- Voice is direct, specific, kind, honest

If any `after_text` fails voice validation:
- Do NOT edit the file
- Set `status='pending'` (returns to queue for revision)
- Set `executor_response = {voice_fail: true, violations: [{change_index, rule_violated, after_text}]}`
- Set `generation_reason` prefixed with `VOICE_FAIL: <rule>` so generate-briefs can revise
- Stop. Do not proceed to Step 5.

**Step 5 — Validate `before_text` exists in the file**

For each change, confirm `before_text` appears in the file exactly as written. If
`before_text` is not found:

- Do NOT edit the file
- Halt with `status='killed'`, `executor_response = {error: "before_text not found in file", change_index: N, before_text: "..."}`
- Report to Matt: "Could not locate the target text. The page may have changed since
  the action row was written. Please update `before_text` to match the current file."

If `target_selector` or `target_label` is provided, use it for context only — the
canonical match is `before_text`. Never do fuzzy matching; exact string match only.

**Step 6 — Apply the edits**

For each change in `payload.changes` (in order):

**`copy` edits:** Replace the exact `before_text` string with `after_text` using a
precise string replacement. Preserve all surrounding JSX, indentation, className
attributes, and component structure. Do not reformat lines you did not target.

**`meta` edits:** The target is always the `export const metadata` object at the top
of the file. Only edit the specific key named in `target_label` or inferred from
`before_text`. Preserve all other metadata keys verbatim.

**`cta` edits:** Locate the `<Button>` element whose text matches `before_text`. Change
only the attributes specified in `changes` (text content, `href`, or `variant`). The
`variant` value must be a valid shadcn/ui variant token (`default`, `secondary`,
`destructive`, `outline`, `ghost`, `link`). Never change a Button to a raw `<a>` tag.
Never add hex colors or inline styles.

Apply all changes atomically (all changes in the array apply to one file save, not
one save per change).

**Step 7 — Design token compliance check**

After editing, scan the modified file for:
- Any hex color (`#[0-9a-fA-F]{3,6}`) that is NOT inside a comment — flag it; shadcn
  tokens only in JSX
- Any raw `<button>`, `<select>`, `<input>` tags not wrapped by a shadcn component
  (these should not appear in a copy-only edit, but check)
- Any `className` containing `bg-[#...]` or `text-[#...]` literal hex overrides

If violations found: revert the edit, halt with `status='killed'`, explain the
violation. This producer does not introduce design token violations even if the file
already had them — report but do not add new ones.

**Step 8 — Run TypeScript type check**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

If TypeScript errors exist:
- Revert the edit to the file's prior state
- Set `status='killed'`
- `executor_response = {error: "TypeScript compile failed", tsc_output: "<first 20 lines of error>"}`
- Do not open a PR

**Step 9 — Create a git branch and commit**

Branch naming: `site-edit/<action_id>` where `<action_id>` is the first 8 chars of
the `id` UUID (e.g. `site-edit/a1b2c3d4`).

```bash
git checkout -b site-edit/<action_id>
git add app/<page_path>/page.tsx
git commit -m "site-edit(<page_path>): <one-line summary of change>

Action row: <id>
Rationale: <payload.changes[0].rationale>
Edit type: <payload.edit_type>
Changes: <N> target(s)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin site-edit/<action_id>
```

**Step 10 — Open the GitHub PR**

```bash
gh pr create \
  --title "site-edit(<page_path>): <one-line summary>" \
  --body "$(cat <<'EOF'
## Summary
- Page: `<page_path>`
- Edit type: `<payload.edit_type>`
- Action row: `<id>`

## Changes
<one bullet per change: target_label — before_text → after_text>

## Rationale
<payload.changes[0].rationale>

## Voice validation
All after_text values passed brand voice check against
`marketing_brain_skills/brand-voice/voice_guidelines.md`.

## TypeScript
`npx tsc --noEmit` returned zero errors.

## Design tokens
No hex color violations. All edits use shadcn/ui token system.

## Approval gate
Matt merges this PR in GitHub. Do NOT approve via the action row in the brain.

🤖 Generated with Claude Code / marketing brain — site-edit producer
EOF
)"
```

**Step 11 — Update the action row to 'ready'**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "branch_name": "site-edit/<action_id>",
      "pr_url": "<pr_url>",
      "files_changed": ["app/<page_path>/page.tsx"],
      "changes_applied": <N>,
      "voice_validated": true,
      "tsc_clean": true
    }'::jsonb
WHERE id = '<id>';
```

**Step 12 — Surface to Matt**

```
Draft ready: site-edit — <page_path>

  PR
    URL: <pr_url>
    Branch: site-edit/<action_id>
    File: app/<page_path>/page.tsx
    Changes: <N> edit(s)

  CHANGES
    <for each change: "target_label: '<before_text>' → '<after_text>'">

  VALIDATION
    Voice: PASS
    TypeScript: PASS (zero errors)
    Design tokens: PASS

Matt merges the PR in GitHub to ship. No additional approval step in the brain.
```

Then stop. Wait for Matt to merge the PR.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Read (file) | Read existing page.tsx before editing | — |
| Edit (file) | Apply exact string replacement | — |
| Bash: `npx tsc --noEmit` | TypeScript compile check | runs in `/Users/matthewryan/RyanRealty` |
| Bash: `git checkout -b` | Create branch | — |
| Bash: `git add`, `git commit`, `git push` | Stage, commit, push branch | — |
| Bash: `gh pr create` | Open GitHub PR | `GH_TOKEN` or active gh session |
| Supabase MCP | Read + update `marketing_brain_actions` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Output format

**Draft lands at:** GitHub PR (not a local file path)  
**Files produced:**
```
app/<page_path>/page.tsx   (edited on branch site-edit/<action_id>)
```

**Surface format:** See Step 12 above. The PR URL is the deliverable.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the PR in GitHub | Matt only — via GitHub UI |

This producer does NOT use `matt-review-draft`. The PR is the draft. Matt
evaluates the diff in GitHub and merges to ship. The action row advances from
`ready` to `approved` when the PR is merged (tracked separately via GitHub webhook
or manual status update).

---

## 8. Status flow

```
pending           ← producer reads row here
  │
  ▼ (producer claims the row)
in_production     ← set immediately; executed_at=now()
  │
  ├── VOICE FAIL → pending (back to queue with VOICE_FAIL: prefix in generation_reason)
  ├── before_text not found → killed
  ├── TypeScript fail → killed (edit reverted)
  │
  ▼ (branch + PR created)
ready             ← executor_response = {branch_name, pr_url, files_changed}
  │
  ▼ (Matt merges PR in GitHub)
approved
  │
  ▼ (Vercel build completes — detected via Vercel MCP or manual update)
executed
  │
  ▼ (48h post-deploy: audit-website captures conversion delta)
measured
```

SQL transitions:
```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On PR open (ready):
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"branch_name":"...","pr_url":"...","files_changed":["..."]}'::jsonb
WHERE id='<id>';

-- On Matt merge (approved):
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| File not found | Resolved path does not exist in `app/` | Set `status='killed'`; report exact path tried; ask Matt to confirm the route |
| `before_text` not found | Exact string missing from file | Halt without edit; set `status='killed'`; surface the mismatch to Matt with a line count of the file so he can locate the actual current text |
| Voice validation fail | `after_text` contains banned word, emoji, or pressure framing | Do NOT edit; set `status='pending'` with `VOICE_FAIL:` prefix; return to generate-briefs queue for revision |
| TypeScript error after edit | `npx tsc --noEmit` returns non-zero | Revert edit; set `status='killed'`; surface first 20 lines of tsc output |
| Design token violation in edit | Hex color or raw HTML element introduced | Revert edit; set `status='killed'`; explain violation |
| Git branch already exists | `site-edit/<action_id>` branch exists on remote | Delete and recreate: `git push origin --delete site-edit/<action_id>` then re-push |
| GH CLI not authenticated | `gh pr create` fails with auth error | Report to Matt: "gh CLI needs authentication. Run `gh auth login` in terminal." |
| Multiple `before_text` occurrences | String appears more than once in the file | Halt; set `status='killed'`; surface to Matt with line numbers of each occurrence and ask for a more specific `target_selector` |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (any market stat in copy must be verified against Supabase)
- `CLAUDE.md` "Draft-First, Commit-Last" — PR = draft; never commit to main
- `CLAUDE.md` "Design System Rules — MANDATORY" — shadcn/ui only; no raw HTML; no hex colors
- `CLAUDE.md` "Design System v2 — Heritage + Web Registers" — navy `#102742` primary; Geist body
- `design_system/ryan-realty/SKILL.md` — brand visual system (color tokens, type, registers)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement (mandatory before every edit)

**Playbooks and pipeline docs:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section C, row `site-edit`
- `marketing_brain_skills/producers/TEMPLATE.md` — producer structural template
- `automation_skills/content_engine/SKILL.md` — content routing reference

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section C, row `site-edit`
