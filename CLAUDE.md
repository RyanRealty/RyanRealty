# Data Accuracy — ABSOLUTE, NON-NEGOTIABLE (READ FIRST)

**Every number that leaves this shop must be verified against the source of truth before it goes in front of a human, a social feed, an email, an MLS, a website, a video, a chart, a report, or a listing document.** No exceptions. Matt is a licensed principal broker. Publishing inaccurate data — price, inventory, DOM, YoY, sale-to-list, absorption, neighborhood stats, anything — is a compliance risk to Ryan Realty's license. This rule outranks speed, style, cost, and every other instruction in this file.

## What "verified" means (mandatory checklist before publish, send, or render)

1. **Name the source.** Every stat must trace to one of: live Supabase (`ryan-realty-platform`, table + filter documented), MLS direct pull, official agency data (ORMLS, NAR, Case-Shiller, OHCS, Census, BLS, FRED), or a linked primary-source URL. "I remember" is not a source. LLM-recall numbers are not a source.
2. **Pull the query fresh.** Re-run the SQL/API call in this session. Never reuse a hard-coded value from a prior script without re-confirming.
3. **Print the raw result.** Show the row counts, the date window, the filter (`PropertyType='A'` for SFR, geography, status, close-date range). The number in the deliverable must equal the number in the printout.
4. **Cross-check math.** Derived stats (months of supply, YoY %, absorption, median, price/sqft) get recomputed and the computation is shown. Market classification (seller/balanced/buyer) must match the actual months-of-supply number against the ≤4 / 4–6 / ≥6 thresholds.
5. **Reconcile narrative to data.** Every sentence, subhead, verdict, and pill has to be consistent with the number it sits next to. A "seller's market" verdict next to 4.3 months of supply is a fail.
6. **QA the rendered output.** For video or image deliverables, capture stills of every scene and visually confirm the displayed number matches the verified number. For text, grep the draft for every figure and map each to the source row.
7. **If a stat can't be verified, it doesn't ship.** Cut it. Don't estimate. Don't round-fill. Don't "approximate." The deliverable goes out with fewer numbers rather than one wrong one.

## What triggers this rule

Any deliverable containing market statistics, listing data, financial figures, neighborhood claims, competitive comparisons, or historical comparisons — including market reports, social video, email newsletters, blog posts, landing pages, listing descriptions, IG/TikTok/FB captions, printed flyers, video thumbnails, open-house signage, CMAs, seller net sheets, and anything else that goes to a consumer, client, lead, or public audience.

## What's forbidden

- Hard-coding numbers from a previous version of a deliverable into a new version without re-verifying.
- Trusting CountUp targets, chart values, or pill text that came from memory, prior chats, or another AI system.
- Using "about," "roughly," or "approximately" as a substitute for pulling the actual data.
- Shipping a deliverable when any stat has a question mark next to it in the source trace.
- Letting narrative voice override data — if the data contradicts the pre-written story, the story changes, not the data.

## Enforcement

Before any market-data deliverable is sent, rendered, posted, or committed: produce a one-line verification trace per figure ("$475K median — Supabase listings, PropertyType='A', City='Redmond', CloseDate 2026-01-01..2026-04-19, median(ClosePrice) = $475,000 over 188 rows"). Matt or a reviewer can audit the trace. No trace, no ship.

---

# Design System Rules — MANDATORY

## shadcn/ui is the ONLY styling authority

Every UI element on this site MUST use shadcn/ui components from `@/components/ui/`. No exceptions.

### Component Mapping (use these, not raw HTML):
| Need | Use This | NOT This |
|------|----------|----------|
| Button | `<Button>` from `@/components/ui/button` | `<button>`, `<a className="btn-...">` |
| Card container | `<Card>` from `@/components/ui/card` | `<div className="rounded-... border...">` |
| Form select | `<Select>` from `@/components/ui/select` | `<select>` |
| Text input | `<Input>` from `@/components/ui/input` | `<input>` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox` | `<input type="checkbox">` |
| Badge/tag | `<Badge>` from `@/components/ui/badge` | `<span className="rounded-full...">` |
| Dialog/modal | `<Dialog>` from `@/components/ui/dialog` | custom modal divs |
| Dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | custom dropdown divs |
| Tabs | `<Tabs>` from `@/components/ui/tabs` | custom tab implementations |
| Tooltip | `<Tooltip>` from `@/components/ui/tooltip` | `title` attribute |
| Separator | `<Separator>` from `@/components/ui/separator` | `<hr>`, `<div className="border-t...">` |
| Label | `<Label>` from `@/components/ui/label` | `<label>` |
| Textarea | `<Textarea>` from `@/components/ui/textarea` | `<textarea>` |
| Switch/toggle | `<Switch>` from `@/components/ui/switch` | `<input type="checkbox">` styled as toggle |
| Avatar | `<Avatar>` from `@/components/ui/avatar` | `<img className="rounded-full...">` |
| Table | `<Table>` from `@/components/ui/table` | `<table>` |
| Accordion | `<Accordion>` from `@/components/ui/accordion` | custom expand/collapse |
| Alert | `<Alert>` from `@/components/ui/alert` | `<div className="bg-yellow...">` |
| Progress | `<Progress>` from `@/components/ui/progress` | custom progress bars |
| Skeleton | `<Skeleton>` from `@/components/ui/skeleton` | custom loading placeholders |
| Sheet (mobile menu) | `<Sheet>` from `@/components/ui/sheet` | custom slide-out panels |

### Color Tokens (use these, not hex/named colors):
| Need | Use | NOT |
|------|-----|-----|
| Primary action | `bg-primary text-primary-foreground` | `bg-blue-600`, `bg-[#102742]` |
| Secondary | `bg-secondary text-secondary-foreground` | `bg-gray-100` |
| Accent/CTA | `bg-accent text-accent-foreground` | `bg-gold`, `bg-amber-500` |
| Destructive | `bg-destructive text-destructive-foreground` | `bg-red-500 text-white` |
| Success | `bg-success text-success-foreground` | `bg-green-500 text-white` |
| Warning | `bg-warning text-warning-foreground` | `bg-yellow-500` |
| Muted text | `text-muted-foreground` | `text-gray-500` |
| Borders | `border-border` | `border-gray-200` |
| Card background | `bg-card` | `bg-white` |
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |

### Utility Function:
Always use `cn()` from `@/lib/utils` for conditional/merged classes. Never string concatenate class names.

### Custom CSS Classes:
DO NOT use `card-base`, `btn-cta`, or any custom CSS class from globals.css. Use shadcn components directly.

### Legacy backup (removed — no-op rule):
The `_style_backup/` directory was removed from the repo. Never recreate it. Use only `@/components/ui/` and `app/globals.css`. (The entry remains in `tsconfig.json`'s `exclude` array for historical reasons — harmless.)

---

## Opus Orchestrator Policy (MANDATORY)

This agent runs on Opus. Opus is ~15× the per-token cost of Haiku. **Do not burn Opus context on mechanical/bulk work.** Delegate to subagents via the `Agent` tool (`model: "sonnet"` or `"haiku"`).

**Always delegate:**
- Codebase enumeration and grep sweeps across many files (`Explore` subagent)
- Bulk refactors / rename-across-repo tasks
- Reading/parsing >10 files to understand a module
- Running long test suites, builds, or deployments
- Data extraction from Supabase / large CSVs / logs

**Opus keeps:**
- Architecture decisions (ADRs), system design
- The final code review before ship
- User-facing product decisions and trade-offs
- Complex debugging where context across multiple systems matters

Launch parallel subagents in a single message when work is independent. **Never use `git worktree` or a non-`main` branch for this repo** — all code changes land in the single checked-out `main` working tree. See memory: `feedback_orchestrator_pattern.md`.

---

## Work Standards

- **No shortcuts, no assumptions.** When coding, implement the full solution from start to finish. Never stop halfway and present partial work as complete. When answering questions about the codebase, trace the logic all the way through to a confirmed answer — no surface-level glances, no guesses.
- **Always verify your own work.** Before saying something is done or something is true, confirm it. Run the code, check the output, read the actual files. Never assume. Every claim about code behavior must be verified by actually reading the relevant code. Every fix must be tested to confirm it works before reporting it's done.
- **Truthful and accurate, always.** If you're not sure, say so. Never state something as fact unless you've confirmed it. If you got something wrong, own it immediately.
- **No partial answers.** When asked about status, where things stand, or how something works, go all the way through to the end to figure out the exact answer. There are never any assumptions being made — always confirm.
- **Always push directly to main.** No **`git worktree`**, no extra local or remote branches, no feature branches unless explicitly asked — one checkout, **`main` only**.
- **Same pipeline as Cursor.** Matt switches between Claude Code and Cursor on one repo. Before work: `git pull --rebase origin main`. After every commit on `main`: **push to `origin` immediately** — no “saved locally” commits. **Migrations:** apply to hosted Supabase in the same delivery as code that depends on them (see `AGENTS.md` *Claude Code ↔ Cursor*, `.cursor/rules/production-parity.mdc`, `.cursor/rules/supabase-migrations-auto.mdc`). Optional continuity: `~/.claude/plans/HANDOFF-*.md` + `docs/plans/task-registry.json`.
- **Never ask Matt to run anything manually.** You handle ALL git operations, ALL terminal commands, ALL deployments, everything. Matt never touches the terminal. If something needs to be done, you do it.
- **Proactively clear git locks.** Before ANY git operation (commit, merge, rebase, pull, push), check for .git/index.lock and remove it if it's stale. Never let a lock file block progress. Never report a lock file to Matt as a blocker — just fix it.
- **No blocked builds or commits.** Builds must never back up. Commits must never be blocked. If something is in the way, fix it yourself. Exhaust every option before reporting an issue.

---

## Persistent memory (repo)

Durable cross-session notes live in **`.auto-memory/`** (same pattern as Cowork `feedback_*.md` references in video skills). **Cascade Peaks video (in flight):** append status to `.auto-memory/memory_cascade_peaks_video_handoff.md` — do not let handoff notes live only in chat. **Local Remotion env (Mac / Cursor, parity with Cowork `work/cascade_peaks`):** `npm run video:cascade-peaks:setup` then `video/cascade-peaks/README.md`.

**Hand off to Cursor / the other Claude agent:** Before Matt switches tools, update **`docs/plans/CROSS_AGENT_HANDOFF.md`** (Current block: what shipped, what is next, commit SHA, skills you read). The other side pulls `main` and reads that file first. See **`AGENTS.md`** (*Cross-agent handoff* + *Skills*).

---

## Skill Routing

**Global index:** Before loading skills ad hoc, open **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** (or the git mirror **`docs/plans/GLOBAL_SKILLS_REGISTRY.md`**) for the full inventory: repo skills, Cursor plugins (Vercel, Supabase, Figma, Superpowers, etc.), `skills-cursor`, TRANSACTION COORDINATOR skills, and Cowork-mounted skills (section E). **`~/.cursor/GLOBAL_SKILLS_REGISTRY.md`** is a stub that points at the canonical file.

**Load skills first:** If a task might match any **`SKILL.md`** in this repo (`.cursor/skills/`, `video_production_skills/`) or in Cursor’s bundled skill paths, **read that skill file before doing the work**—same bar as Cursor agents (`AGENTS.md` *Skills*).

**Mandatory:** `engineering:code-review` on every meaningful change before ship. `engineering:deploy-checklist` before any production deploy. `design:design-system` audits whenever shadcn/ui compliance is in question.

**Data work:** `data:*` skills fire automatically on any Supabase / SQL / analytics task.

Everything else (debugging, architecture, testing-strategy, documentation, incident-response, tech-debt, accessibility-review, ux-copy, web-artifacts-builder) fires on trigger match — no table needed.

---

## Video Production — REQUIRED

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` before writing any video code or Remotion composition. This is non-negotiable.**

The master skill file codifies the hard constraints (length, hook, cuts, retention, branding rules), creative direction (formula, pacing, shot sequence by price tier), AI video pipeline (when warranted, when banned), brand rules, the pre-render asset audit, and the post-render quality gate. Every Schoolhouse v5 round (v1 through v5.9) is logged with the specific failure that produced each rule.

For quick reference during work, also keep `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md` open — it's the 30-second checklist version of the master skill.

Every video build opens both files before scaffolding the BEATS array. Every render runs the quality gate (ffmpeg blackdetect strict + frame extraction + visual scrub) before push. Self-enforce — don't wait for Matt to find an obvious bug.
