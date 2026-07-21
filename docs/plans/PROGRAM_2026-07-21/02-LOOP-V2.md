# THE LOOP v2.0.0 — Fleet Specification

Implementable spec. Everything below is either an edit to an existing file, a new file, or a new table. Nothing here replaces machinery that works.

---

## 0. Disposition of existing machinery

| Verdict | Asset | Note |
|---|---|---|
| **KEEP unchanged** | `ci:gates` (125 steps), `scripts/push-with-gates.sh` + `rr-gates-marker` + `.husky/pre-push`, `.github/workflows/ci.yml`, `smoke-test.yml` | The deterministic substrate. This is Tier 0 verification and needs no change. |
| **KEEP unchanged** | 49 Vercel crons | The substrate row of the topology. Add 1, delete 1 (below). |
| **KEEP unchanged** | `marketing_brain_actions` + `/admin/approval-queue` + `publisher-sweep` | Already the approval-gate + audit-trail protocol. The loop **reuses** it for draft-first review. Do not build a second review queue. |
| **KEEP unchanged** | G12 draft-first commit-msg hook, G44 process-canon, G45 producer-freeze | G12 gets one new trailer (§6.3). |
| **KEEP as template** | `lib/cma/audit.ts` + `computeAuditVerdict` + the bounded self-repair at `lib/cma/build.ts:246-270` | Generalized in §5, not rewritten. It is the only working adversarial pattern in the repo. |
| **KEEP as template** | `scripts/crm-e2e-verify.mjs` | The probe-battery shape (id/status/detail + JSON artifact + exit code). Every domain gets one built to this shape. |
| **KEEP** | The 5 loop skills (`growth-loop`, `facebook-seller-growth`, `crm-e2e`, `tc-builder`, `experience-rollout`) | They stay as the execution sessions. Their §3 "Prioritize" step is replaced by a ledger read (§8.4). |
| **EXTEND** | `docs/DEVELOPMENT_PROCESS.md` → **v2.0.0** | Adds: domain registry, scoring function with weights, adversarial stage, DONE contracts, heartbeat. G44 forces the 3 pointer bumps in the same commit. |
| **EXTEND** | `site_improvement_ledger`, `process_escape_ledger` | Both exist with **zero code readers or writers**. They get a DAL, writers, and a cron that closes windows. |
| **EXTEND** | `app/api/cron/loop-health-check` | Currently marketing-channel-only. Add domain-loop staleness checks. |
| **RETIRE** | `out/audits/` as canon-designated state ledger | Directory has never existed. Replaced by `loop_audit_findings`. Canon row updated. |
| **RETIRE** | `tmp/crm-e2e-latest.json`, `.auto-memory/fb-ads-loop-state.json`, `docs/EXPERIENCE_SYSTEM.md §Rollout status` **as sources of truth** | Demoted to artifacts referenced by a `loop_runs.artifact_path`. Files on one Mac cannot be fleet state. This is why crm-e2e sat 13 days stale invisibly. |
| **DELETE** | `app/api/cron/optimization-loop/route.ts`, `lib/data/sync/syncWrites.ts:insertOptimizationRun`, `app/actions/optimization-runs.ts`, its admin page, table `optimization_runs` | Complete dead chain, unregistered since it shipped. `loop_runs` supersedes it. Deleting is cheaper than wiring a duplicate. |
| **RETIRE** | Per-loop hand-rolled prioritization prose in the 5 skill files | Replaced by one scorer so 5 sessions cannot rank the same fleet differently. |

---

## 1. Architecture: domains are contracts, loops are workers

The locked topology (5 loops, one session each, "a sixth standing session is a smell") is preserved. 19 domains do **not** become 19 sessions.

```
19 DOMAIN CONTRACTS  ──(what DONE means)──►  loop_domains + data/loop/domains/*.contract.json
        │
        │ each unmet requirement becomes a row
        ▼
   loop_candidates  ──(scored by one function)──►  ONE fleet-wide ranked queue
        │
        │ routed by change_class, not by domain
        ▼
5 EXECUTION LOOPS (existing sessions) ── Growth · Demand · Nurture · Transaction · Experience
        │
        ▼
  Tier 0 mechanical → Tier 1 adversarial → Tier 2 adjudication → ship or draft-queue
        │
        ▼
  site_improvement_ledger (predicted) ──► loop-tick cron closes window ──► actual_delta ──► confidence
                                                                                  │
                                                                                  └──► feeds next score
```

**Why routing is by `change_class` and not by domain:** the canon's collision rules already say Experience owns page *structure* and Growth owns *content and meta*. `listing-detail` therefore has candidates belonging to two different loops. Assigning a whole domain to one session would break the locked collision rules on day one.

### 1.1 Domain registry (seeded from the 19 audits)

| # | domain_key | Primary owner loop(s) by class |
|---|---|---|
| 1 | `visitor-identity` | Demand (tracking), Nurture (CRM surfacing) |
| 2 | `meta-ads` | Demand |
| 3 | `geo-pages` | Growth (content/meta), Experience (structure) |
| 4 | `faceted-search` | Growth |
| 5 | `aeo` | Growth |
| 6 | `listing-detail` | Growth (content), Experience (structure) |
| 7 | `market-reports` | Growth |
| 8 | `crm-dashboard` | Nurture, Experience (admin UX) |
| 9 | `expired-workflow` | Nurture |
| 10 | `fsbo-workflow` | Nurture |
| 11 | `cma-bpo` | Nurture, Transaction (legally-binding prose) |
| 12 | `saved-search` | Nurture |
| 13 | `newsletter-send` | Nurture |
| 14 | `social-sharing` | Growth |
| 15 | `search-map` | Growth, Experience |
| 16 | `content-scale` | Growth |
| 17 | `broker-toolkit` | Nurture, Experience |
| 18 | `brand-voice` | Growth (owns the gate), all loops consume |
| 19 | `loop-process` | Growth session acts as orchestrator |
| 20 | `transaction-tc` | Transaction (registered, contract unseeded — not covered by the 19 audits) |

**Seed corpus:** the 19 audit reports contain roughly 170 requirement rows already carrying `status`, `evidence`, `gap`, `effort`. Those rows ARE the initial `loop_candidates` and `loop_domains` contracts. This is a one-time import script, not a re-derivation (`scripts/loop-seed-from-audits.mjs`).

---

## 2. Data model

New migration: `supabase/migrations/20260722120000_loop_engine.sql` (expand-only).

```sql
-- ── 1. DOMAIN CONTRACTS ──────────────────────────────────────────────────────
create table if not exists public.loop_domains (
  domain_key      text primary key,
  title           text not null,
  contract_path   text not null,              -- data/loop/domains/<key>.contract.json
  probe_command   text,                       -- node scripts/probes/<key>.mjs
  probe_last_run  timestamptz,
  probe_last_pass boolean,
  probe_artifact  text,                       -- path/URL of last probe JSON
  status          text not null default 'active'
                  check (status in ('active','blocked_on_review','blocked_external',
                                    'done_pending_signoff','done_maintenance','paused')),
  requirements_total int not null default 0,
  requirements_met   int not null default 0,
  signed_off_by   text,
  signed_off_at   timestamptz,
  updated_at      timestamptz not null default now()
);

-- ── 2. THE ONE RANKED QUEUE ──────────────────────────────────────────────────
create table if not exists public.loop_candidates (
  id              uuid primary key default gen_random_uuid(),
  domain_key      text not null references public.loop_domains(domain_key),
  requirement_id  text not null,              -- stable id inside the contract
  title           text not null,
  change_class    text not null,              -- 'fail-closed-fallback','og-card','dead-code-delete',...
  owner_loop      text not null
                  check (owner_loop in ('growth','demand','nurture','transaction','experience')),
  approval_class  text not null
                  check (approval_class in ('continuous','draft-first','per-action')),

  -- impact test inputs (§3.1) — all four required or the row cannot be scored
  metric          text,                       -- must exist in site_signal or a named probe id
  baseline_value  numeric,
  baseline_at     timestamptz,
  predicted_delta numeric,
  window_days     int not null default 14,
  reachable       boolean,                    -- proven reachable by a user or registered cron
  reach_monthly   numeric,                    -- humans/month affected
  severity        int check (severity between 1 and 5),
  effort          text check (effort in ('S','M','L','XL')),
  money_path      boolean not null default false,
  blast_risk      int not null default 1 check (blast_risk in (1,2)),

  score           numeric,                    -- computed by loop-tick, never by an agent
  score_at        timestamptz,
  p0              boolean not null default false,

  status          text not null default 'candidate'
                  check (status in ('candidate','blocked_impact_test','in_progress',
                                    'awaiting_audit','audit_refuted','awaiting_approval',
                                    'shipped','measuring','closed','blocked','retired')),
  attempt_count   int not null default 0,
  cooldown_until  timestamptz,
  blocked_reason  text,
  ledger_id       uuid references public.site_improvement_ledger(id),
  action_id       uuid,                       -- marketing_brain_actions row when draft-first
  source          text not null default 'audit',
  evidence        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.loop_candidates (status, score desc);
create index on public.loop_candidates (owner_loop, status, score desc);
create unique index on public.loop_candidates (domain_key, requirement_id);

-- ── 3. HEARTBEAT (the blind spot that hid every staleness finding) ───────────
create table if not exists public.loop_runs (
  id            uuid primary key default gen_random_uuid(),
  loop_name     text not null,
  domain_key    text references public.loop_domains(domain_key),
  candidate_id  uuid references public.loop_candidates(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  outcome       text check (outcome in ('shipped','drafted','refuted','no_candidate',
                                        'blocked','idle','error')),
  models_used   jsonb not null default '{}'::jsonb,   -- {"opus":n,"sonnet":n,"haiku":n}
  cost_usd      numeric,
  commit_sha    text,
  artifact_path text,
  notes         text,
  session_id    text                                   -- lease holder
);
create index on public.loop_runs (loop_name, started_at desc);

-- lease: one session per loop, enforced in the DB not in prose
create unique index if not exists loop_runs_one_open_per_loop
  on public.loop_runs (loop_name) where finished_at is null;

-- ── 4. ADVERSARIAL FINDINGS (replaces out/audits/) ───────────────────────────
create table if not exists public.loop_audit_findings (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.loop_candidates(id),
  round         int not null default 1,
  claim         text not null,               -- the builder's assertion under test
  obligation    text not null                -- which of the 5 refutation duties (§5.2)
                check (obligation in ('reachability','error-branch','second-impl',
                                      'writer-reader','doc-vs-code')),
  result        text not null check (result in ('CONFIRMED','REFUTED','UNVERIFIABLE')),
  severity      text check (severity in ('critical','major','minor')),
  evidence      text not null,               -- file:line / query / rendered-URL
  auditor_model text not null,
  created_at    timestamptz not null default now()
);

-- ── 5. STANDING APPROVALS (the Matt-bottleneck release valve) ────────────────
create table if not exists public.loop_standing_approvals (
  id           uuid primary key default gen_random_uuid(),
  change_class text not null,
  domain_key   text,
  granted_by   text not null,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  max_uses     int,
  uses         int not null default 0,
  transcript_quote text not null,            -- Matt's literal words granting it
  revoked_at   timestamptz
);

-- ── 6. LEDGER EXTENSIONS (expand-only on existing tables) ────────────────────
alter table public.site_improvement_ledger add column if not exists domain_key text;
alter table public.site_improvement_ledger add column if not exists candidate_id uuid;
alter table public.site_improvement_ledger add column if not exists min_samples int default 30;
alter table public.site_improvement_ledger add column if not exists measured_by text; -- 'cron'|'manual'
alter table public.process_escape_ledger  add column if not exists domain_key text;
alter table public.process_escape_ledger  add column if not exists loop_run_id uuid;

alter table public.loop_domains enable row level security;
alter table public.loop_candidates enable row level security;
alter table public.loop_runs enable row level security;
alter table public.loop_audit_findings enable row level security;
alter table public.loop_standing_approvals enable row level security;

-- ── 7. STATUS VIEW ───────────────────────────────────────────────────────────
create or replace view public.loop_status as
select d.domain_key, d.title, d.status, d.requirements_met, d.requirements_total,
       d.probe_last_pass, d.probe_last_run,
       (select count(*) from public.loop_candidates c
          where c.domain_key = d.domain_key and c.status = 'candidate') as open_candidates,
       (select max(score) from public.loop_candidates c
          where c.domain_key = d.domain_key and c.status = 'candidate') as top_score,
       (select max(r.started_at) from public.loop_runs r
          where r.domain_key = d.domain_key) as last_touched
from public.loop_domains d;
```

After applying: `npm run ci:data-access -- --refresh` (G16).

---

## 3. Prioritization

### 3.1 The impact test (gate, runs before scoring)

A candidate that fails any of these is set to `blocked_impact_test` and is **not** worked. It is not deferred, it is not "someday". Failing the impact test is how busywork dies.

| # | Requirement | Mechanical check in `scripts/loop-score.mjs` |
|---|---|---|
| I1 | **Named metric** | `metric` non-null AND resolves to a `site_signal` metric or a registered probe id in `data/loop/probes.json` |
| I2 | **Live baseline** | `baseline_value` non-null AND `baseline_at` within 7 days |
| I3 | **Falsifiable prediction** | `predicted_delta` non-null, signed, non-zero, with `window_days` between 7 and 90 |
| I4 | **Reachability** | `reachable = true`, with evidence naming route registration / render-tree parent / `vercel.json` entry / prod env flag |

I4 is the single most important line in this spec. Across the 19 audits, the dominant defect class was code that exists and is unreachable (`inboxUnread` never passed, `getAdAudienceConversionReport` zero importers, `optimization-loop` unregistered, `SmartSearch` dead, the like button never rendered). A candidate to "improve" unreachable code is auto-rejected. The correct candidate for unreachable code is `change_class = 'dead-code-delete'` or `'wire-existing'`, both of which pass I4 trivially because the metric is "the path becomes reachable".

### 3.2 P0 preempt (bypasses scoring entirely)

Any candidate matching these takes the next slot in its owner loop regardless of score:

1. A published number contradicts its source (CLAUDE.md §0 violation on a public surface). Example from the audits: `get_beacon_price_bands` bucketing closed sales by `"ListPrice"`.
2. Compliance exposure: TCPA, fair-housing, license-risk, an owner's media-suppression flag bypassed, soliciting an off-market seller.
3. Privacy or authorization leak. Example: `broker-command-center` scope filters failing open for an unmapped broker email.
4. A money path is broken: lead capture, contact CTA, listing detail render, a ranking page 404/500.

P0 rows carry `p0 = true`. `loop-tick` alerts if a P0 is open longer than 24h.

### 3.3 Scoring function

```
score = (R × S × C × J) / (E × B)

R  reach          = log10(1 + reach_monthly)                clamp [0, 6]
S  severity       ∈ {1,2,3,4,5}                             anchors below
C  confidence     = (wins + 1) / (wins + losses + flats + 2) Laplace; 0.5 for a new class
J  journey mult   = 1.5 if money_path else 1.0
E  effort         = S:1  M:3  L:8  XL:20                     agent-hours
B  blast risk     = 2 if legally-binding / §0 stat surface / irreversible, else 1
```

**Severity anchors** (ordinal, not a feeling):

| S | Anchor | Audit example |
|---|---|---|
| 5 | Causes harm, legal exposure, or publishes a false number | closed sales bucketed by list price |
| 4 | Silently wrong: renders successfully while being incorrect or absent | listing page renders 200 with zero contact CTA after a 3s broker-query timeout |
| 3 | Visibly broken or absent to a user who wanted it | "Sold homes" nav link renders active inventory |
| 2 | Degraded: works but worse than it should | 5-year price history where 10 is wanted |
| 1 | Cosmetic or completeness-only | `llms-full.txt` absent |

**Confidence is learned, never asserted.** `C` is computed by `loop-tick` from `site_improvement_ledger` grouped by `change_class`. Inconclusive rows are excluded from the denominator. A brand-new class starts at 0.5 by construction, so the loop neither over-trusts nor blocks novelty.

**Auto-retire:** any `change_class` with ≥5 resolved ledger rows and `C < 0.30` is marked retired. All its candidates score 0 until Matt explicitly re-enables it. This is the mechanism that stops the loop from repeatedly doing a category of work that does not move anything.

### 3.4 Worked examples (real rows from the audits)

| Candidate | R | S | C | J | E | B | score |
|---|---|---|---|---|---|---|---|
| Listing-detail `ctaBroker` null-fallback removes all contact CTAs | 3.9 | 4 | 0.50 | 1.5 | 1 | 1 | **11.7** |
| `get_beacon_price_bands` ClosePrice fix | 2.3 | 5 | 0.50 | 1.0 | 1 | 2 | **2.9** + P0 preempt |
| Pass `inboxUnread` into ConsoleShell (1 line, dead badge) | 0.7 | 3 | 0.50 | 1.0 | 1 | 1 | **1.1** |
| Sitemap emits `/cities/{city}/{sub}` instead of the working `/communities/{city}-{sub}` | 3.5 | 4 | 0.50 | 1.0 | 1 | 1 | **7.0** |
| Render `aiReferrers` already loaded and discarded on 3 admin pages | 0.3 | 2 | 0.50 | 1.0 | 1 | 1 | **0.3** |
| Build `llms-full.txt` | 1.7 | 1 | 0.50 | 1.0 | 3 | 1 | **0.28** |
| 10 years of historical market reports | 2.6 | 2 | 0.50 | 1.0 | 20 | 2 | **0.07** |

Separation is roughly 170x between the top and bottom. That is the point: the loop does not "get to" the XL nice-to-have until the S-effort silent-failure class is exhausted.

**Score threshold:** candidates scoring below **0.5** are not worked. If a loop's entire queue is under 0.5, it records `outcome = 'no_candidate'` and stops. Manufacturing work below threshold is the failure this line prevents.

---

## 4. Model routing

### 4.1 The decision rule (one sentence)

**Route by (cost of an undetected wrong answer) ÷ (strength of the automatic oracle that would catch it).**

High cost with no oracle goes to Opus. Medium cost with a strong deterministic oracle goes to Sonnet. Low cost with a total, mechanically verifiable transform goes to Haiku.

### 4.2 Routing table

| Work class | Model | Oracle | Reasoning |
|---|---|---|---|
| Prioritization, cross-loop arbitration, DONE adjudication, final ship review, schema/architecture decisions | **Opus 4.8** | none | A wrong call here ships silently and compounds across 19 domains. There is no test for "we built the wrong thing." |
| Tier 2 adversarial adjudication | **Opus 4.8** | none | Deciding ship-vs-repair on a contested finding is judgment. |
| Tier 1 adversarial refutation | **Sonnet 4.5** minimum; **Opus** when the builder was Opus | partial | See §4.3 invariant. |
| Implementing a scored candidate | **Sonnet 4.5** | `tsc` + 125 gates + tests + probe battery + Tier 1 | Strong oracle. Opus here is ~15x the cost for work the gates already validate. |
| Codebase enumeration, grep sweeps, reading >10 files, bulk refactor | **Sonnet 4.5** | the cited file itself | Volume work. Matches existing CLAUDE.md orchestrator policy. |
| Draft copy, captions, listing prose | **Sonnet 4.5** | brand-voice gate + §0 trace | Gate is the oracle. |
| Bulk classification into a closed set, mechanical codemod, JSON reshape, tagging, dedupe | **Haiku 4.5** | total + schema-validated | Already proven in `lib/marketing-brain/audit-classifier.ts` at ~$0.0008/item. |
| Scoring, verdict computation, window closing, probe batteries, ledger writes, heartbeat | **NO MODEL** | deterministic | These must never vary with model behavior. `computeAuditVerdict` is the precedent. |

**Escalation:** a Haiku call returning low confidence or an out-of-set label escalates once to Sonnet. Recorded in `loop_runs.models_used`.

### 4.3 The auditor invariant

**Never verify with a model weaker than the one that built.** A cheaper auditor correlates with the builder's blind spots and manufactures false confidence, which is strictly worse than no audit because it consumes the review budget while certifying a defect. Auditor and builder must also use **different prompt lineages** (`lib/cma/audit.ts:1-17` already states this and is the model to copy).

### 4.4 Centralization (fixes a real finding)

Five hardcoded model constants exist today across `producer-runtime/route.ts:44`, `lib/cma/audit.ts:24`, `audit-classifier.ts:45`, `inbox-parser.ts:26`, `crm-inbox.ts:448`. Consolidate:

- New: `lib/loop/model-routing.ts` exporting `MODEL_FOR = { judgment, audit, implement, bulk, draft }` plus `routeFor(workClass, builderModel)`.
- New gate **G55**: `scripts/check-model-routing.mjs` fails on any raw `claude-*` / `us.anthropic.*` model-id literal outside `lib/loop/model-routing.ts`.
- Budget: each `loop_runs` row records `cost_usd`. Fleet daily ceiling `LOOP_DAILY_COST_CEILING_USD` (default 25). `loop-tick` pauses all loops and alerts when exceeded. **Cost per closed candidate** is a tracked process metric.

---

## 5. The adversarial audit stage

### 5.1 Three tiers, all mandatory, in order

**Tier 0 — Mechanical (no model).** `tsc`, `npm run ci:gates` (125), tests, real `next build`, `ci:route-smoke`, and the domain's probe battery. Existing machinery. A red Tier 0 never reaches Tier 1.

**Tier 1 — Adversarial refutation (fresh subagent, Sonnet minimum).** Spawned with a **deliberately starved context**: it receives only the claim list and the repo. It does **not** receive the builder's diff, reasoning, or transcript. Its system instruction is to produce a refutation, and it is told the builder is probably wrong.

Input contract, one row per claim:
```json
{ "candidate_id": "...", "claim": "Listing detail always renders a contact CTA",
  "builder_evidence": "app/listing/[listingKey]/page.tsx:457",
  "obligations": ["reachability","error-branch","second-impl","writer-reader","doc-vs-code"] }
```
Output contract, one row per (claim × obligation) into `loop_audit_findings`, each with `result` and independent `evidence` at file:line.

**Tier 2 — Adjudication (Opus, deterministic verdict).** Port `computeAuditVerdict` to `lib/loop/adversarial.ts`:

```ts
export function computeLoopVerdict(f: Finding[]): 'pass'|'repair'|'block' {
  const has = (ob: Obligation, sev: Severity[]) =>
    f.some(x => x.obligation === ob && x.result === 'REFUTED' && sev.includes(x.severity))
  if (has('reachability', ['critical','major'])) return 'block'   // unreachable == not shipped
  if (has('writer-reader', ['critical']))       return 'block'
  if (has('error-branch',  ['critical']))       return 'repair'
  if (has('second-impl',   ['critical','major']))return 'repair'  // divergent copy == class not fixed
  if (f.filter(x => x.result === 'REFUTED' && x.severity === 'major').length >= 2) return 'repair'
  if (f.some(x => x.result === 'UNVERIFIABLE' && x.severity !== 'minor')) return 'repair'
  return 'pass'
}
```
The verdict is computed **in code from the finding set**, never asserted by a model. The model's own opinion is recorded and never enforced. This is exactly the `lib/cma/audit.ts` calibration lesson.

### 5.2 "Assume it is broken", operationally

The auditor must attempt all five refutation obligations on every claim. These five are derived directly from the dominant defect classes across the 19 audits:

| Obligation | The question it must answer with evidence | Founding failure |
|---|---|---|
| **reachability** | Is this code path reached by a real user or a registered cron? Route registered, component present in the render tree, `vercel.json` entry, prod env flag on, linked from nav or another live page. | `optimization-loop` unregistered; `inboxUnread` never passed; like button never rendered; `getAdAudienceConversionReport` zero importers |
| **error-branch** | Read the null / catch / timeout / empty branch, not the success branch. What renders when the dependency fails? | `ctaBroker` null on a 3s timeout removes every contact CTA; scope filters failing open on an unmapped email |
| **second-impl** | Grep for a divergent copy of the same rule, list, component, or query path. Was the class fixed, or just this instance? | 12 hand-maintained banned-word lists; two map-search stacks; three market-stat engines |
| **writer-reader** | If something is read, prove a writer exists. If written, prove a reader exists. | `site_improvement_ledger` written by nothing; `sms_click` written and filtered out of the only UI |
| **doc-vs-code** | Any claim sourced from a `.md`, a docstring, a handoff note, or a prior audit is **unverified** until the code is read. | "wired in vercel.json" docstrings on unregistered crons; `SITE_SPEC.md` asserting a dead component is live |

An auditor that returns CONFIRMED on a claim without citing its own file:line evidence has its finding auto-downgraded to UNVERIFIABLE by `loop-tick`, which forces `repair`.

### 5.3 What happens on failure

```
verdict = repair  →  builder receives the refutation findings, gets exactly ONE repair round,
                     then re-audits with a NEW auditor instance.
                     (Port the bounded self-repair at lib/cma/build.ts:246-270.)

second repair fails →  candidate.status = 'audit_refuted'
                       attempt_count += 1
                       cooldown_until = now() + 14 days
                       row written to process_escape_ledger (what was claimed, why it was wrong,
                                                             the check that would have caught it)
                       loop moves to the next candidate. No third attempt, ever.

verdict = block   →  same as second-repair-fail, immediately. Nothing ships.

attempt_count >= 2 → candidate.status = 'blocked', requires either Matt's input or an explicitly
                     different change_class approach recorded on the row.
```

**Every audit failure must produce a new mechanical check** in the same commit as the eventual fix, per the canon escape protocol. That is what turns a refutation into permanent knowledge rather than a repeated argument.

---

## 6. Draft-First with Matt off the critical path

### 6.1 Three approval classes, set on the candidate at creation

| `approval_class` | Ships how | Examples |
|---|---|---|
| `continuous` | Immediately on green Tier 0 + Tier 1 pass. No Matt. | Gates, tests, infra, DAL, migrations, dead-code deletion, bugfix-to-intended-behavior, sitemap route correction, model routing, probe batteries |
| `draft-first` | Writes a `marketing_brain_actions` row `status='ready'`, appears in the existing `/admin/approval-queue`, waits for explicit approval | Any consumer-visible copy, UX, page layout, OG card, listing prose, market-report narrative, email/SMS templates |
| `per-action` | Never batched, never standing-approved. One explicit yes per action. | Publishing a post, sending a blast, ad spend, OAuth grants, anything irreversible or external |

This is the canon's existing approval model, made a column.

### 6.2 The four bottleneck-release mechanisms

1. **Reuse, do not rebuild, the review surface.** `marketing_brain_actions` + `/admin/approval-queue` already carry the protocol, the audit trail, and the publish sweep. The loop writes an action row and links it via `loop_candidates.action_id`.
2. **Cap and batch.** At most **3** open `awaiting_approval` items per domain and **12** fleet-wide. When the cap is hit, the domain switches to its highest-scoring `continuous` candidate. It does not stall. One review digest per day at 14:00 UTC, folded into the existing `analytics-daily-digest` cron, never per-item pings.
3. **Every review item arrives pre-verified.** The queue card shows: Tier 0 green, Tier 1 CONFIRMED count, the §0 verification trace, before/after screenshots, and the predicted metric delta. Matt approves an **outcome**, not an implementation. He should never be reading a diff to find a bug.
4. **Standing approvals with expiry.** `loop_standing_approvals` lets Matt say once, in his own words, "all OG-card fixes for the next 30 days" and have that consume automatically with a use counter and hard expiry. The row stores his literal transcript quote. Never inferred, never extended silently, revocable, and it cannot cover `per-action` classes.

### 6.3 Enforcement

Extend the existing `.husky/commit-msg` → `scripts/check-draft-first.mjs` (G12): a commit touching a user-facing surface must carry **both**:
```
Approved-by: matt          (or)  Standing-approval: <uuid>
Ledger: <site_improvement_ledger uuid>
```
The `Ledger:` trailer is new and is how §7's measurement stamp becomes mechanically unskippable. `continuous` candidates on infra paths are exempt from `Approved-by` but **not** from `Ledger:` unless `change_class` is in the `data/loop/measurement-exempt.json` allowlist (gates, tests, docs, type-only refactors).

---

## 7. Guardrails against busywork: the impact test and the measurement stamp

The impact test (§3.1) is the entry gate. The measurement stamp is the exit gate. Both are mechanical.

### 7.1 Stamp before ship

`site_improvement_ledger` row is INSERTed **before** the commit, carrying `metric`, `baseline_value`, `baseline_at`, `predicted_delta`, `window_days`, `min_samples`, `domain_key`, `candidate_id`. Its uuid goes in the commit trailer. No trailer, no commit (G12 extension).

### 7.2 Close the window with a cron, never an agent

New: fold into `app/api/cron/loop-tick/route.ts`. For every ledger row where `measured_at is null` and `shipped_at + window_days < now()`:

```
actual_delta = agg(site_signal, metric, surface, [shipped_at, shipped_at+window])
             - baseline_value

verdict:
  n < min_samples ......................... 'inconclusive'
  sign(actual) == sign(predicted)
      and |actual| >= 0.5*|predicted| ..... 'win'
  sign(actual) != sign(predicted)
      and |actual| >= 0.25*|predicted| .... 'loss'
  otherwise ............................... 'flat'
```

**The metric must come from `site_signal`**, which is populated by the substrate ingest crons that no loop agent writes. An agent cannot author the number that grades its own work. This is the anti-gaming core.

### 7.3 The feedback edge

`loop-tick` recomputes `C` per `change_class` from resolved ledger rows and rewrites `loop_candidates.score`. A class that keeps producing `flat` sinks below the 0.5 threshold on its own. A class at `C < 0.30` over ≥5 resolved rows auto-retires. The loop stops doing what does not work without anyone noticing and intervening.

### 7.4 Process metrics (published in the daily digest)

- Escapes per week (`process_escape_ledger`) — must trend to zero
- Idle-run rate (`loop_runs.outcome = 'idle'`) — must trend to zero
- Cost per closed candidate (`loop_runs.cost_usd` ÷ candidates reaching `closed`)
- Adversarial refutation rate — if it hits zero, the auditor has gone soft and needs its obligations tightened
- Median candidate age in `awaiting_approval`

---

## 8. Cadence, triggering, and resumable state

### 8.1 Deterministic tick (no model, cheap)

New route `app/api/cron/loop-tick/route.ts`, `maxDuration = 120`, `requireCronAuth`. Add to `vercel.json`:
```json
{ "path": "/api/cron/loop-tick", "schedule": "*/15 * * * *" }
```
Every tick: recompute `C` per class → rescore all candidates → close due measurement windows → run any due domain probes → update `loop_domains.status` → evaluate staleness → release stale leases (`loop_runs` open >90 min with no heartbeat) → enforce the cost ceiling → emit alerts.

**Rule: `loop-tick` never invokes a model and never ships code.** It is the metronome, not a worker.

### 8.2 Agent firing (the missing bridge)

The `mcp__scheduled-tasks` mechanism is proven live (two tasks fired within the hour). Create five, one per loop:

| Task name | Cron | Fires |
|---|---|---|
| `loop-growth` | `0 */3 * * *` | `/loop-next growth` |
| `loop-nurture` | `30 */4 * * *` | `/loop-next nurture` |
| `loop-demand` | `0 15 * * 1,4` | `/loop-next demand` |
| `loop-transaction` | `0 16 * * 2,5` | `/loop-next transaction` |
| `loop-experience` | `0 17 * * 3,6` | `/loop-next experience` |

Manual entry points unchanged: `/growth-loop`, `/crm-e2e`, `/tc-builder`, `/experience-rollout`, `/facebook-seller-growth`, plus the new `/loop-next <loop>`.

### 8.3 State lives in Supabase, full stop

Every artifact a fresh context needs is a row. Files are attachments referenced by `loop_runs.artifact_path`. `tmp/crm-e2e-latest.json` on one Mac is not fleet state and was exactly why a 13-day stall was invisible.

### 8.4 The resume packet

New route `app/api/admin/loop/next/route.ts` (admin-gated, also callable with `CRON_SECRET`). `GET /api/admin/loop/next?loop=growth` returns everything needed to start cold:

```json
{
  "lease": { "acquired": true, "run_id": "...", "expires_at": "..." },
  "measurement_due": [ { "ledger_id": "...", "surface": "...", "metric": "..." } ],
  "p0_open": [],
  "candidate": {
    "id": "...", "domain_key": "listing-detail", "requirement_id": "LD-06",
    "title": "Broker CTA must never resolve null",
    "change_class": "fail-closed-fallback", "approval_class": "continuous",
    "score": 11.7, "metric": "listing_contact_cta_present_pct",
    "baseline_value": 100, "predicted_delta": 0, "window_days": 14,
    "evidence": { "files": ["app/listing/[listingKey]/page.tsx:281,344,457"] },
    "preflight": ["docs/DATABASE_SCHEMA_SNAPSHOT.md", "design_system/.../listing-detail/parity.json"],
    "prior_attempts": [], "cooldown_until": null
  },
  "review_queue_depth": { "domain": 1, "fleet": 6, "cap": { "domain": 3, "fleet": 12 } },
  "budget": { "spent_today_usd": 4.10, "ceiling_usd": 25 },
  "domain_status": "active"
}
```

Order of operations inside a loop session is fixed: **close measurement windows first, then P0, then the top-scored candidate.** Learning outranks new work, exactly as the growth-loop skill already states.

### 8.5 Grind semantics preserved

A firing chains candidates back to back until one is true: every remaining candidate is blocked or below threshold, the review cap is hit for all draft-first work with no continuous work left, the cost ceiling is reached, or context is nearly spent (write the handoff row, release the lease, spawn fresh). "Did one thing and stopped" remains the failure mode this rule exists to prevent.

---

## 9. Failure modes and the specific mechanism that prevents each

| # | Failure mode | What it looks like here | Prevention mechanism |
|---|---|---|---|
| 1 | **Drift** — loop diverges from canon | Skills prioritize differently from the doc; pointers rot | G44 extended to **G53**: canon version must match all 3 pointers AND every `loop_domains.domain_key` must have a contract file AND every contract requirement must appear in `loop_candidates` |
| 2 | **Silent staleness** — a loop stops and nobody notices | crm-e2e 13 days stale, fb-ads 41 days, experience 6 weeks, all invisible | `loop_runs` heartbeat + `loop-tick` staleness alarm. No run for a loop in 2× its cadence pages Matt. This lands **before** any scheduler, or a scheduled loop that errors is exactly as invisible as an unscheduled one. |
| 3 | **Gaming the metric** | Agent picks the metric that already moved, or authors the grade | Metric must resolve to `site_signal`, populated only by substrate ingest crons. Prediction registered before ship. Verdict computed by cron, not agent. Confidence auto-retires losing classes. |
| 4 | **Thrash** — same item reworked forever | Re-attacking a surface inside its own measurement window | `attempt_count` ≥ 2 → `blocked`. `cooldown_until` blocks a re-attempt for 14 days. A surface with an open measurement window is excluded from candidacy. |
| 5 | **Silent no-op** — loop runs, ships nothing, reports green | The most dangerous mode because it looks healthy | `loop_runs.outcome` is a required enum. 3 consecutive `no_candidate` for a domain flips it to `done_pending_signoff`, forcing the DONE conversation. 3 consecutive `error` pages Matt. Idle-rate published in the digest. |
| 6 | **Review-queue backlog** — Matt becomes the bottleneck | 19 domains all queueing drafts | Per-domain cap 3, fleet cap 12. On cap, domain switches to `continuous` work. Daily batched digest. Standing approvals with expiry. Pre-verified cards. |
| 7 | **Busywork** — polishing what nobody reaches | Improving dead code; building `llms-full.txt` before fixing a broken CTA | Impact test I1-I4, especially **I4 reachability**. Score threshold 0.5. `dead-code-delete` is a legitimate cheap class so dead code gets removed, not improved. |
| 8 | **False-confidence audit** | A cheap auditor rubber-stamps a defect | Auditor invariant (§4.3): never weaker than the builder, never the same prompt lineage, starved of the builder's reasoning. Verdict computed in code. CONFIRMED without independent file:line evidence auto-downgrades to UNVERIFIABLE. |
| 9 | **Cross-session collision** | 5 sessions on one `main` checkout stashing each other's work | DB unique partial index `loop_runs_one_open_per_loop` is the lease. Lease auto-released at 90 min. Commits are pathspec-scoped to the candidate's declared files, and the declared file list is on the candidate row. |
| 10 | **Ledger rot** — measurement never written | Exactly what happened: one bespoke scheduled task wrote once then disabled itself | Measurement is a cron duty, not an agent duty. `Ledger:` commit trailer makes stamping unskippable. `loop-tick` closes windows unconditionally. |
| 11 | **Cron/route drift** | A route exists, claims a schedule in its docstring, is unregistered | New **G54** `scripts/check-cron-registered.mjs`: every `app/api/cron/*/route.ts` must have a `vercel.json` entry or a self-fetch caller, or be listed in an explicitly shrinking baseline. Three instances of this class already exist. |
| 12 | **Probe rot** | A domain contract with no working probe reports DONE forever | New **G56** `scripts/check-probe-coverage.mjs`: every `loop_domains` row needs a probe script that exited 0 within 48h, else the domain cannot hold `done_*` status. |
| 13 | **Cost runaway** | 5 sessions × Opus × grind semantics | `LOOP_DAILY_COST_CEILING_USD`. `loop-tick` pauses all loops on breach. Cost per closed candidate published. Routing table keeps Opus off bulk work. |
| 14 | **Contract inflation** — DONE recedes as fast as it is approached | Every audit adds requirements, nothing ever completes | Contract requirements are frozen at seed. New requirements require a `contract_version` bump recorded on the domain row and are reported separately from progress against the frozen set, so the completion percentage cannot be diluted silently. |

---

## 10. DONE

### 10.1 Per-domain DONE (all five conditions)

A domain reaches `done_pending_signoff` only when:

1. Every requirement in `data/loop/domains/<key>.contract.json` has `status = 'met'`.
2. Each met requirement carries an adversarial verdict of `pass` from a Tier 1 run that is **not** the one that shipped it (a later, independent re-verification).
3. The domain probe battery exits 0 within the last 48h (G56).
4. Zero open P0 rows and zero `blocked` candidates in the domain.
5. Every fixed class has a locking mechanism: a `ci:gates` entry, a probe check, or a test, named on the requirement row. A win that can silently regress is not done.

Then Matt signs off (`signed_off_by` / `signed_off_at`) and the domain moves to `done_maintenance`: probes keep running on the tick, no candidates are generated, and a reddened probe reopens the domain automatically.

**Contract shape** (`data/loop/domains/listing-detail.contract.json`):
```json
{
  "domain_key": "listing-detail",
  "contract_version": 1,
  "probe": "node scripts/probes/listing-detail.mjs",
  "requirements": [
    { "id": "LD-06",
      "statement": "Every listing detail render exposes at least one contact affordance",
      "probe_check": "listing-detail:contact-cta-present",
      "locking_gate": "scripts/probes/listing-detail.mjs#cta",
      "status": "unmet" }
  ]
}
```

### 10.2 Global DONE

All 20 registered domains at `done_maintenance` with Matt's sign-off, zero open P0, escapes-per-week at zero for 4 consecutive weeks, and the fleet idle-rate above 90% (loops firing and correctly finding nothing to do).

At that point the loop **downshifts, it does not stop**: `loop-tick` continues, probes continue, scheduled agent firings drop to weekly, and a loop wakes only when a probe reddens, a P0 opens, a measurement window closes, or a new requirement is registered. An improvement loop that terminates is a maintenance loop, and pretending otherwise is how the current ledgers went dark.

---

## 11. New mechanical gates

| Gate | Script | Enforces |
|---|---|---|
| **G53** | `scripts/check-loop-registry.mjs` | Canon version matches all 3 pointers (extends G44); every `loop_domains` key has a contract file; every contract requirement maps to a candidate; every `owner_loop` is one of the 5 |
| **G54** | `scripts/check-cron-registered.mjs` | Every `app/api/cron/*/route.ts` is in `vercel.json` or has a self-fetch caller, or sits in a shrink-only baseline |
| **G55** | `scripts/check-model-routing.mjs` | No raw `claude-*` / `us.anthropic.*` literal outside `lib/loop/model-routing.ts` |
| **G56** | `scripts/check-probe-coverage.mjs` | Every domain has a probe; no domain holds `done_*` on a stale or failing probe |
| **G57** | `scripts/check-ledger-stamp.mjs` | Every commit touching a candidate's declared files carries a `Ledger:` trailer resolving to a real ledger row (extends G12's commit-msg hook) |

All five wired into `ci:gates` and therefore into `push-with-gates.sh`, `.husky/pre-push`, and `ci.yml`. Catalog rows added to `docs/MECHANICAL_GATES.md`.

---

## 12. File and table change manifest

**Migrations**
- `supabase/migrations/20260722120000_loop_engine.sql` (§2), then `npm run ci:data-access -- --refresh`

**New library**
- `lib/loop/model-routing.ts` — the single model map + `routeFor()`
- `lib/loop/adversarial.ts` — `computeLoopVerdict()`, obligation types, refutation prompt builder (ported from `lib/cma/audit.ts`)
- `lib/loop/score.ts` — pure scorer, exported for both the cron and `scripts/loop-score.mjs`
- `lib/data/loop/getNextCandidate.ts`, `writeLoopRun.ts`, `writeLedgerRow.ts`, `closeMeasurementWindow.ts`, `writeAuditFinding.ts`, `getLoopStatus.ts`, `checkStandingApproval.ts` — DAL only, exported from `lib/data/index.ts` (G1)

**New routes**
- `app/api/cron/loop-tick/route.ts` + `vercel.json` entry `*/15 * * * *`
- `app/api/admin/loop/next/route.ts` — the resume packet

**New admin surface**
- `app/admin/(protected)/loop/page.tsx` — 20 domain cards (progress, probe state, top candidate, last run), the ranked fleet queue, open measurement windows, escapes, cost. Registered in `lib/admin/nav.ts` under a `loop.view` capability granted to superuser plus broker-read.

**New scripts**
- `scripts/loop-seed-from-audits.mjs` — one-time import of the ~170 audit requirement rows
- `scripts/probes/<domain>.mjs` × 20, built to the `crm-e2e-verify.mjs` shape
- `scripts/check-loop-registry.mjs`, `check-cron-registered.mjs`, `check-model-routing.mjs`, `check-probe-coverage.mjs`, `check-ledger-stamp.mjs`
- `scripts/__tests__/loop-score.test.mjs` — the scoring function is unit-tested, like `computeAuditVerdict`

**New data files**
- `data/loop/domains/*.contract.json` × 20
- `data/loop/probes.json` — registered probe-metric ids usable in `metric`
- `data/loop/change-classes.json` — class → owner_loop → default approval_class routing
- `data/loop/measurement-exempt.json` — classes exempt from the `Ledger:` trailer

**New skills**
- `.claude/skills/loop-next/SKILL.md` — the single entry point: acquire lease, GET resume packet, close windows, P0, work top candidate, Tier 0/1/2, ship or draft, write ledger, release lease, chain
- `.claude/skills/adversarial-verify/SKILL.md` — the Tier 1 subagent contract with the five obligations

**Edits to existing files**
- `docs/DEVELOPMENT_PROCESS.md` → v2.0.0 (domain registry, scoring weights, adversarial stage, DONE contracts, heartbeat, ledger table swap for `out/audits/`)
- `CLAUDE.md`, `marketing_brain_skills/producers/TEMPLATE.md`, `lib/marketing-brain/producer-output-class.ts` → pointer bump to `THE LOOP v2.0.0` (G44 requires same commit)
- The 5 loop `SKILL.md` files → replace the "Prioritize" section with "read the resume packet"; add lease acquire/release
- `app/api/cron/loop-health-check/route.ts` → add domain-loop staleness checks
- `.husky/commit-msg` / `scripts/check-draft-first.mjs` → `Ledger:` and `Standing-approval:` trailers
- `package.json` → 5 new `ci:*` scripts appended to `ci:gates`
- `docs/MECHANICAL_GATES.md` → G53-G57 rows
- `lib/marketing-brain/audit-classifier.ts`, `inbox-parser.ts`, `app/actions/crm-inbox.ts`, `app/api/cron/producer-runtime/route.ts`, `lib/cma/audit.ts` → import from `lib/loop/model-routing.ts`

**Deletions**
- `app/api/cron/optimization-loop/route.ts`, `app/actions/optimization-runs.ts`, its admin page, `insertOptimizationRun` in `lib/data/sync/syncWrites.ts`, table `optimization_runs` (contract migration after one deploy)

---

## 13. Rollout order (each step ships independently and is useful alone)

| Step | Ships | Why this order |
|---|---|---|
| 1 | Migration + DAL + `loop-tick` + heartbeat + `loop-health-check` extension | **Observability first.** A scheduler added before the heartbeat means a scheduled loop that errors is exactly as invisible as an unscheduled one. This is the lesson of the 13-day and 41-day stalls. |
| 2 | `scripts/loop-seed-from-audits.mjs` + 20 contract files + `/admin/loop` | Backlog becomes visible and ranked. Matt can see all 19 domains at once for the first time. |
| 3 | `lib/loop/score.ts` + impact test + G53 | Prioritization becomes mechanical and identical across sessions. |
| 4 | `lib/loop/model-routing.ts` + G55 | Cheap, unblocks cost control before grind semantics turn on. |
| 5 | `lib/loop/adversarial.ts` + `/adversarial-verify` skill + `loop_audit_findings` | Verification before autonomy. Never the other way round. |
| 6 | Ledger trailer (G57) + measurement close in `loop-tick` | Closes the learn loop. Confidence starts accumulating from the first shipped candidate. |
| 7 | `/loop-next` skill + resume packet route + 5 scheduled tasks | **Autonomy last.** Everything that makes autonomy safe is already in place. |
| 8 | G54, G56 + 20 probe batteries + deletions | Locks the classes this design exists to prevent. |

---

## 14. Open decisions requiring Matt

1. **Standing approvals**: acceptable at all, and if so which change classes and what maximum expiry? Without this the fleet cap of 12 makes him the throughput limit on all consumer-visible work.
2. **Fleet daily cost ceiling** in USD. Default proposed: 25.
3. **Score threshold** 0.5 and **effort scale** (S=1, M=3, L=8, XL=20 agent-hours). These set how much low-value work the loop declines to do.
4. **Auto-retire at C < 0.30 over 5 resolved rows**: correct aggressiveness, or should a losing class require his explicit kill?
5. **G45 producer freeze**: does building this orchestration count as frozen growth, or is it exempt as maintenance on the existing five loops? The freeze must be answered before step 7.
6. **`transaction-tc` contract**: the 19 audits do not cover it. Commission a 20th audit to seed it, or leave it running on `/tc-builder`'s ladder outside the contract system?