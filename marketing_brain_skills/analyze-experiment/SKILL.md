---
name: analyze-experiment
description: >
  ANALYSIS producer (brain-internal). Designs A/B experiments for the marketing brain's
  test queue (action: 'design') and reads out completed tests to declare a winner or
  extend (action: 'readout'). All findings are written to marketing_decisions. No
  published output. No approval gate. Downstream generate-briefs reads winner rows to
  roll out winning variants and queue follow-up test hypotheses.
action_types:
  - analyze:ab_test_design
  - analyze:ab_test_readout
---

# analyze-experiment

**Scope:** Brain-internal experiment management. The design path computes sample size,
test duration, and variant specifications from a stated hypothesis, then persists the
design so the content pipeline knows which variants to create and track. The readout path
pulls performance data for a live test, computes statistical significance, declares a
winner or extends the test, and writes the verdict. This skill never publishes a variant
or changes a live page — it only produces structured data.

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** `marketing_decisions` row with `decision_type='experiment_design'` or `'experiment_readout'`

---

## 1. Scope

### In scope
- `analyze:ab_test_design` — power calculation, sample-size estimate, duration estimate, variant specs, design persistence
- `analyze:ab_test_readout` — fetch variant performance from analytics tables, compute significance, declare winner or verdict, write findings, enqueue follow-up actions

### Out of scope
- Creating the actual variant content — that is `content:*` producers dispatched by the brain after a design is approved
- Deploying a variant to the live site — that is `site:*` producers
- Running the A/B testing infrastructure (epsilon-greedy routing, traffic splits) — that is `automation_skills/automation/ab_testing/`
- Alerting Matt about test results — `generate-briefs` reads the readout findings and enqueues a `comms:matt_summary` if warranted

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `analyze:ab_test_design` | `action='design'`, `hypothesis`, `primary_metric` | `variants` optional; producer generates them if absent |
| `analyze:ab_test_readout` | `action='readout'`, `test_id`, `hypothesis`, `primary_metric` | `test_data` optional override for offline data |

### Payload schema

```typescript
interface ExperimentPayload {
  action: 'design' | 'readout';
  hypothesis: string;            // e.g. "Changing the hero CTA from 'Get a valuation' to 'See what your home is worth' increases form submissions"
  primary_metric: string;        // e.g. 'form_submission_rate', 'ctr', 'qualified_seller_leads'
  secondary_metrics?: string[];  // optional — tracked but not used for winner declaration
  practical_significance?: number; // MDE as decimal (e.g. 0.10 for 10% lift). Default: 0.10
  variants?: Array<{
    name: string;                // 'control' | 'treatment_a' | 'treatment_b'
    description: string;         // what is different in this variant
  }>;
  test_id?: string;              // for readout — the experiment's marketing_decisions row ID
  test_data?: Record<string, unknown>; // for readout — override with pre-fetched data
}
```

---

## 3. Full action row schema

```typescript
interface ExperimentActionRow {
  id: string
  action_type: 'analyze:ab_test_design' | 'analyze:ab_test_readout'
  target: string               // e.g. 'surface:hero_cta' or 'experiment:uuid'
  assigned_producer: string    // 'marketing_brain_skills/analyze-experiment'
  payload: ExperimentPayload
  data_evidence: {
    surface_url?: string       // the URL or component being tested
    current_baseline_rate?: number  // current conversion rate for sample-size calc
    daily_traffic?: number     // estimated daily sessions/impressions for duration calc
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

### Step 1 — Read the action row and claim it

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

Branch on `payload.action`:
- `'design'` → execute the Design sub-recipe (§4A)
- `'readout'` → execute the Readout sub-recipe (§4B)

---

### §4A — Design sub-recipe

**Step A1 — Extract parameters**

From payload: `hypothesis`, `primary_metric`, `practical_significance` (default 0.10),
`variants` (generate if absent).

From `data_evidence`: `current_baseline_rate`, `daily_traffic`.

If `current_baseline_rate` is missing, query `marketing_channel_daily` to estimate:

```sql
SELECT AVG(value)
FROM marketing_channel_daily
WHERE channel = '<relevant channel>'
  AND metric   = '<primary_metric>'
  AND scope    = 'account'
  AND date > (now() - INTERVAL '30 days');
```

If data is still unavailable, set a conservative baseline of 0.02 (2% conversion rate)
and note this assumption in the design output.

**Step A2 — Power calculation**

Use two-proportion z-test power calculation with:
- α = 0.05 (Type I error rate — 95% confidence level)
- Power = 0.80 (Type II error rate — 80% power to detect true effect)
- MDE = `practical_significance` (minimum detectable effect, default 0.10 = 10% relative lift)
- `baseline_rate` = `current_baseline_rate` (from data or conservative default)
- `treatment_rate` = `baseline_rate * (1 + MDE)`

Sample size per variant formula (explicit computation, not a library):

```
p1 = baseline_rate
p2 = baseline_rate * (1 + MDE)
p_avg = (p1 + p2) / 2
q_avg = 1 - p_avg

z_alpha = 1.960  // two-tailed, α=0.05
z_beta  = 0.842  // 80% power

n_per_variant = ceil(
  (z_alpha * sqrt(2 * p_avg * q_avg) + z_beta * sqrt(p1 * (1-p1) + p2 * (1-p2)))^2
  / (p1 - p2)^2
)
```

Show the full computation in the design output. Never use a black-box library result
without printing the intermediate values. This is the data accuracy mandate applied
to statistical claims.

**Step A3 — Estimate test duration**

```
total_sessions_needed = n_per_variant * number_of_variants
test_duration_days    = ceil(total_sessions_needed / daily_traffic)
```

If `daily_traffic` is not available from `data_evidence`, estimate from `marketing_channel_daily`:

```sql
SELECT AVG(value) as daily_avg
FROM marketing_channel_daily
WHERE channel = 'ga4'
  AND metric   = 'sessions'
  AND scope    = 'page'
  AND scope_id ILIKE '%<surface_url_fragment>%'
  AND date > (now() - INTERVAL '14 days');
```

If the estimated duration exceeds 90 days, note in the design: "Test may not reach
significance within a reasonable window at current traffic levels. Consider broadening
the surface or increasing the MDE threshold."

**Step A4 — Generate variants if not provided**

If `payload.variants` is empty, generate based on `hypothesis`:
- Always generate exactly 2 variants: `control` (current state) and `treatment_a` (the change proposed in the hypothesis).
- Extract the proposed change from the hypothesis text. Hypothesis format "Changing X from A to B increases Y" → control is A, treatment_a is B.
- If the hypothesis is more complex (multiple changes), generate `treatment_a` and `treatment_b` (one change per treatment, to isolate effect).

```typescript
interface VariantSpec {
  name: 'control' | 'treatment_a' | 'treatment_b';
  description: string;
  is_control: boolean;
  traffic_split: number;  // decimal; control gets 0.5 in a 2-variant test
}
```

**Step A5 — Persist design**

```typescript
interface ExperimentDesign {
  hypothesis: string;
  primary_metric: string;
  secondary_metrics: string[];
  baseline_rate: number;
  treatment_rate: number;
  mde: number;
  alpha: number;
  power: number;
  n_per_variant: number;
  total_sessions_needed: number;
  daily_traffic_estimate: number;
  estimated_duration_days: number;
  variants: VariantSpec[];
  power_calc_inputs: {  // show work for audit
    z_alpha: number;
    z_beta: number;
    p1: number;
    p2: number;
    p_avg: number;
  };
  designed_at: string;  // ISO
}
```

Write to `marketing_decisions`:

```sql
INSERT INTO marketing_decisions (
  decision_type, description, decided_at, outcome, metadata
) VALUES (
  'experiment_design',
  '<hypothesis — first 200 chars>',
  now(),
  'design_produced',
  '<ExperimentDesign as jsonb>'::jsonb
) RETURNING id;
```

Capture the returned `id` — this is the `test_id` that `analyze:ab_test_readout` will
reference later.

Enqueue variant-creation actions for each non-control variant:

```sql
INSERT INTO marketing_brain_actions (
  action_type, target, assigned_producer, payload, generation_reason, status
) VALUES (
  '<appropriate content action_type>',  -- e.g. 'site:copy_update' or 'content:fb_lead_gen_ad'
  '<surface target>',
  '<assigned producer from REGISTRY.md>',
  '{"variant_spec": {...}, "test_id": "<uuid>", "is_treatment": true}'::jsonb,
  'Variant creation for experiment: <hypothesis summary>',
  'pending'
);
```

Update action row:

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "test_id": "<marketing_decisions uuid>",
      "n_per_variant": <N>,
      "estimated_duration_days": <D>,
      "variants_created": <count>,
      "power_calc": {...}
    }'::jsonb
WHERE id = '<action_id>';
```

---

### §4B — Readout sub-recipe

**Step B1 — Load the design**

Retrieve the original experiment design from `marketing_decisions` by `test_id`:

```sql
SELECT metadata, decided_at, description
FROM marketing_decisions
WHERE id = '<test_id>'
  AND decision_type = 'experiment_design';
```

Extract: `primary_metric`, `baseline_rate`, `n_per_variant`, `variants`, `alpha`,
`hypothesis`, `estimated_duration_days`.

Compute `test_start_date` = `decided_at` from the design row.
Compute `test_end_date` = `now()`.
Compute `actual_duration_days` = days between start and end.

**Step B2 — Pull variant performance data**

For each variant, query `content_performance` or `marketing_channel_daily` for conversions
and exposure (impressions, sessions, or send volume depending on the primary_metric surface):

```sql
-- For site-based tests:
SELECT scope_id, SUM(value) as total
FROM marketing_channel_daily
WHERE channel = 'ga4'
  AND metric   = '<primary_metric>'
  AND scope    = 'page'
  AND scope_id IN (<variant page URLs>)
  AND date BETWEEN '<test_start_date>' AND '<test_end_date>'
GROUP BY scope_id;
```

For ad creative tests, use `meta_ads` channel with `scope='campaign'` or `scope_id` matching
the variant creative labels.

If `payload.test_data` is provided, use it directly (for offline or pre-pulled data).

**Step B3 — Compute statistical significance**

For conversion-rate metrics (binary): chi-square test.

```
For each variant pair (control vs treatment):
  observed = [[control_conversions, control_non_conversions],
              [treatment_conversions, treatment_non_conversions]]
  total_control   = control_conversions + control_non_conversions
  total_treatment = treatment_conversions + treatment_non_conversions
  expected_control_conv    = total_control   * (total_conversions / grand_total)
  expected_treatment_conv  = total_treatment * (total_conversions / grand_total)
  expected_control_non     = total_control   - expected_control_conv
  expected_treatment_non   = total_treatment - expected_treatment_conv

  chi_sq = sum over cells of: (observed - expected)^2 / expected

  // df = 1 for 2x2 table
  // chi-square critical value at α=0.05, df=1 = 3.841
  p_value_significant = chi_sq > 3.841
```

For continuous metrics (e.g. average session duration, CPC): Welch's t-test.

```
t_stat = (mean_treatment - mean_control) / sqrt(var_control/n_control + var_treatment/n_treatment)
df = Welch-Satterthwaite approximation
// Two-tailed p < 0.05 = significant
```

Show all intermediate values in the readout output. The verdict must be derivable from
the printed numbers — do not summarize without showing the computation.

**Step B4 — Sample size check**

Compare `n_per_variant` from design vs actual sample collected per variant.

If actual < `n_per_variant * 0.80` (less than 80% of required sample):
- Do not declare a winner.
- Verdict = `'inconclusive_insufficient_sample'`
- Compute `days_remaining` = `ceil((n_per_variant - actual_n) / daily_traffic)` where
  `daily_traffic` is the realized daily rate from the test period.
- Recommend extending the test by `days_remaining`.

**Step B5 — Declare verdict**

| condition | verdict | next step |
|---|---|---|
| p < 0.05 AND treatment better than control | `'treatment_wins'` | Roll out treatment; queue follow-up tests |
| p < 0.05 AND control better than treatment | `'control_wins'` | Keep control; queue a new hypothesis |
| p >= 0.05 AND sufficient sample | `'inconclusive_sufficient_sample'` | Evaluate cost to extend; likely kill and reframe hypothesis |
| p >= 0.05 AND insufficient sample | `'inconclusive_insufficient_sample'` | Extend by computed `days_remaining` |

**Step B6 — Build ExperimentReadout and persist**

```typescript
interface ExperimentReadout {
  test_id: string;
  hypothesis: string;
  primary_metric: string;
  test_start_date: string;
  test_end_date: string;
  actual_duration_days: number;
  variants: Array<{
    name: string;
    n: number;                  // sample size realized
    conversions: number;
    rate: number;               // conversions / n
  }>;
  statistical_method: 'chi_square' | 't_test';
  test_statistic: number;
  p_value_significant: boolean; // chi_sq > 3.841 or t-test p < 0.05
  sample_sufficient: boolean;
  verdict: 'treatment_wins' | 'control_wins' | 'inconclusive_sufficient_sample' | 'inconclusive_insufficient_sample';
  winner?: string;              // variant name; absent if inconclusive
  effect_size?: number;         // relative lift if winner declared
  days_to_extend?: number;      // present if verdict is inconclusive_insufficient_sample
  computation: {                // show work
    chi_sq_cells?: Record<string, number>;
    expected?: Record<string, number>;
    t_stat?: number;
    welch_df?: number;
  };
  produced_at: string;
}
```

```sql
INSERT INTO marketing_decisions (
  decision_type, description, decided_at, outcome, metadata
) VALUES (
  'experiment_readout',
  '<verdict: treatment_wins | control_wins | inconclusive> — <hypothesis first 100 chars>',
  now(),
  '<verdict>',
  '<ExperimentReadout as jsonb>'::jsonb
);
```

**Step B7 — Enqueue follow-up actions**

If verdict = `'treatment_wins'`:
```sql
-- Enqueue rollout
INSERT INTO marketing_brain_actions (action_type, target, assigned_producer, payload, generation_reason, status)
VALUES ('site:copy_update', '<surface target>', '<site-edit producer>', '{"variant_to_roll_out": "<winner>", "test_id": "<uuid>"}'::jsonb, 'Roll out winning variant from experiment <test_id>', 'pending');
```

If verdict = `'inconclusive_insufficient_sample'`:
```sql
-- Enqueue extension (no new content — just extend the window in marketing_decisions)
INSERT INTO marketing_brain_actions (action_type, target, assigned_producer, payload, generation_reason, status)
VALUES ('analyze:ab_test_readout', 'experiment:<test_id>', 'marketing_brain_skills/analyze-experiment', '{"action": "readout", "test_id": "<test_id>", "hypothesis": "...", "primary_metric": "..."}'::jsonb, 'Re-read experiment <test_id> after extension window', 'pending');
```

If verdict = `'control_wins'` or `'inconclusive_sufficient_sample'`:
- Enqueue a `comms:matt_summary` row with the verdict summary so Matt can consider a reframe.
- Do not auto-enqueue a new design — a human insight should inform the next hypothesis.

**Step B8 — Update action row**

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "test_id": "<uuid>",
      "verdict": "<verdict>",
      "winner": "<variant name or null>",
      "p_significant": <bool>,
      "effect_size": <number or null>,
      "actions_enqueued": <count>
    }'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | read `marketing_channel_daily`, `content_performance`, `marketing_decisions`; write new `marketing_decisions` rows and enqueue follow-up actions | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| No external statistical library | all formulas computed explicitly inline | chi-square critical value = 3.841 (df=1, α=0.05) — hardcoded constant, not looked up dynamically |
| No external APIs | all data is from Supabase cache; no live ad API calls | —  |

---

## 6. Output format

**Primary output:** `marketing_decisions` row with `decision_type='experiment_design'` or `'experiment_readout'`

**No file system output.** No `out/` directory. No scorecard. No Matt-facing alert
from this producer directly.

**Executor response on action row (design):**
```json
{
  "test_id": "uuid-of-marketing_decisions-row",
  "n_per_variant": 847,
  "estimated_duration_days": 18,
  "variants_created": 1,
  "power_calc": {
    "baseline_rate": 0.032,
    "treatment_rate": 0.0352,
    "z_alpha": 1.96,
    "z_beta": 0.842,
    "mde": 0.10
  }
}
```

**Executor response on action row (readout):**
```json
{
  "test_id": "uuid",
  "verdict": "treatment_wins",
  "winner": "treatment_a",
  "p_significant": true,
  "effect_size": 0.143,
  "actions_enqueued": 1
}
```

---

## 7. Approval gate

| approval_type | what it means |
|---|---|
| `none` | Brain-internal analysis. Produces database rows and enqueues follow-up actions. No published content. No live system changes. The rollout action that a `'treatment_wins'` verdict enqueues goes to a site-edit producer, which has its own `matt-review-PR` gate. |

---

## 8. Status flow

```
pending       <- producer reads row here
  |
  v
in_production <- set immediately
  |
  v
executed      <- set after design or readout written to marketing_decisions
  |
killed        <- set on missing test_id (readout), insufficient data, or query error
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| `test_id` not found (readout) | No `marketing_decisions` row with that id and `decision_type='experiment_design'` | Set `status='killed'`, `executor_response.error='experiment_design not found for test_id'`. Surface in next digest. |
| Baseline rate unavailable (design) | No `marketing_channel_daily` data for primary metric | Use conservative default 0.02. Log assumption clearly in design output under `power_calc_inputs.baseline_source='default_conservative'`. |
| Daily traffic estimate unavailable | No GA4 page-scope data for the surface URL | Use 50 sessions/day as conservative default. Note: this may produce an impractically long test duration estimate. Log in design output. |
| Variant data missing (readout) | `marketing_channel_daily` returns no rows for the variant page or campaign scope | Check that the content producer correctly tagged the variant surface with the `test_id`. Set `status='killed'` with `executor_response.error='no variant data found'`. The content producer may need to re-tag. |
| Chi-square computation produces divide-by-zero | An expected cell is zero (one variant had zero exposure) | Set verdict to `'inconclusive_insufficient_sample'` regardless of observed values. Log the zero-cell in computation. |
| Follow-up enqueue fails | Supabase insert fails on `marketing_brain_actions` | Retry once. If still failing, log the intended insertion in `executor_response.pending_actions` so it can be manually inserted. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy: all statistical inputs must trace to a live Supabase query; show intermediate computations
- `marketing_brain_skills/diagnose-performance/SKILL.md` — significance thresholds and anomaly definitions inform what the brain considers "worth testing"
- `automation_skills/automation/ab_testing/SKILL.md` — the infrastructure layer that routes traffic to variants and tags events; this skill reads what that infrastructure produces
- `marketing_brain_skills/generate-briefs/SKILL.md` — downstream consumer of readout verdicts; generate-briefs decides what to tell Matt and what new hypotheses to propose

**Downstream producers (triggered by this skill's output):**
- `marketing_brain_skills/producers/site-edit/SKILL.md` — rolls out winning variants to site pages
- `marketing_brain_skills/producers/comms-matt-alert/SKILL.md` — receives `comms:matt_summary` actions enqueued for inconclusive or control-wins verdicts

**Statistical reference (embedded — no external dependency):**
- Chi-square critical value: 3.841 (df=1, α=0.05, two-tailed)
- z-scores used in power calc: z_alpha=1.960 (α=0.05, two-tailed), z_beta=0.842 (power=0.80)
- Welch-Satterthwaite df approximation: standard formula, computed inline

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section F, row `analyze-experiment`
