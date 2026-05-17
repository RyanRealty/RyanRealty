---
name: ops-fub-crm
description: >
  Executes CRM mutations in Follow Up Boss — tag apply/remove, sequence
  start/stop, task creation, and agent routing changes — based on a structured
  action row from the marketing brain. Requires Matt's explicit approval for
  operations affecting more than 5 leads; single-lead ops surface a draft for
  review. Enforces count verification before any bulk operation to prevent
  overly-broad filters from hitting unintended leads.
action_types:
  - ops:fub_tag_fix
  - ops:fub_sequence_change
  - ops:fub_task_create
  - ops:fub_routing
---

# ops-fub-crm — Follow Up Boss CRM Operational Producer

**Scope:** Executes mutations to the Follow Up Boss CRM on behalf of the marketing
brain. Handles tag management, sequence enrollment, task creation, and agent
routing changes. For bulk operations, verifies the lead count against the
expected_count guardrail before calling the API. Never performs a bulk write
without Matt's explicit approval when the affected count exceeds 5 leads.

Does NOT read or export lead data for analytics (that is `audit-crm`). Does NOT
send emails or SMS through FUB (email sends go through `ops-email-send`; FUB
automated sequences are started here but their content is owned by the sequence
configuration in FUB, not by this producer). Does NOT create new leads (leads
are created by the lead-capture paths in `docs/MARKETING_LEAD_FLOW.md`).

**Status:** Canonical
**Locked:** 2026-05-13 · **Updated:** 2026-05-17 (canonical seller workflow added)
**Exemplar output:** Action row status transitions + `executor_response` jsonb in
`marketing_brain_actions`.

---

## 0. The canonical seller workflow (2026-05-17 lock)

**Read FIRST when working on anything seller-touching:**

- **`docs/FUB_SELLER_WORKFLOW_2026-05-17.md`** — the locked spec. Defines the canonical kebab-case namespaced tag schema (`audience:seller`, `seller:{hot|warm|nurture|long-nurture|recovery|in-conversation|do-not-contact}`, `source:*`, `broker:*`), the 10-touch cadence over 60 days, the round-robin assignment rule, the 6 custom fields, and the architectural constraint (FUB blocks send-API for integrations — auto messages fire from FUB's own action-plan engine).
- **`docs/FUB_AUDIT_2026-05-17.md`** — read-only audit that drove the redesign.
- **`docs/FUB_UI_SETUP_RUNBOOK.md`** — Matt's one-time FUB UI setup runbook.

**Anytime you receive an `ops:fub_*` action involving sellers:**

1. Use only canonical tags (no Title Case `Seller`, no legacy `hot-seller` kebab without namespace, no `auto:seller-seq:*`). The full schema is in `docs/FUB_SELLER_WORKFLOW_2026-05-17.md` §4.
2. The master action plan name is `Seller Lead — Master Workflow` — do not enroll in any legacy `*KTS AP …` plan or `Seller - Home Evaluation Request` (id 5).
3. Adding `seller:in-conversation` pauses the workflow. Adding `seller:do-not-contact` stops it.
4. Pause-on-reply runs every 15 min via `/api/cron/seller-workflow-pause` — do not duplicate that logic.
5. Round-robin assignment lives in `app/lp/seller-home-value/actions.ts` + Supabase `marketing_assignments` table — do not write your own assignment logic in this producer.

---

## 1. Scope

### In scope
- `ops:fub_tag_fix` — apply or remove one or more tags on a lead or filtered set
- `ops:fub_sequence_change` — enroll a lead in a sequence, stop a sequence, or
  move a lead from one sequence to another
- `ops:fub_task_create` — create a task (call, email, follow-up) for the assigned
  listing agent, with due date and note
- `ops:fub_routing` — change the assigned agent for one or more leads

### Out of scope
- Exporting leads for audience building — handled by `scripts/export-fub-custom-audience.mjs`
- Sending direct emails or SMS — handled by `ops-email-send`
- Creating new lead records — handled by webhook ingest paths in `app/api/`
- Deleting lead records — never automated; requires Matt's manual action in FUB UI

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:fub_tag_fix` | `action`, `lead_ids` or `filter`, `payload.tags`, `payload.operation` | `operation`: `'apply'` or `'remove'` |
| `ops:fub_sequence_change` | `action`, `lead_ids` or `filter`, `payload.sequence_id`, `payload.operation` | `operation`: `'start'`, `'stop'`, or `'move'` |
| `ops:fub_task_create` | `action`, `lead_ids`, `payload.task_type`, `payload.due_date`, `payload.note` | Always explicit `lead_ids` — never filter for task creation |
| `ops:fub_routing` | `action`, `lead_ids` or `filter`, `payload.assigned_agent_id` | Agent ID must be a valid FUB user ID |

### Payload schema

```typescript
interface FubOpsPayload {
  action: 'tag_apply' | 'tag_remove' | 'sequence_start' | 'sequence_stop' |
          'task_create' | 'route_change';
  lead_ids: string[] | { filter: Record<string, unknown> };
  // Explicit list of FUB person IDs (numeric strings), OR a FUB People API
  // filter object. Filter is only allowed for tag and routing ops — never
  // for task creation (tasks require explicit IDs for accountability).
  payload: Record<string, unknown>;
  // Action-specific fields:
  //   tag ops:       { tags: string[], operation: 'apply' | 'remove' }
  //   sequence ops:  { sequence_id: string, operation: 'start' | 'stop' | 'move',
  //                    from_sequence_id?: string }
  //   task creation: { task_type: 'call' | 'email' | 'follow_up',
  //                    due_date: string,    // ISO date string
  //                    note: string,        // task body text
  //                    priority?: 'high' | 'normal' }
  //   route change:  { assigned_agent_id: string,
  //                    assigned_agent_name: string }
  rationale: string;             // Data-backed reason from the brain
  expected_count?: number;       // Required when lead_ids is a filter object
}
```

---

## 3. Full action row schema

```typescript
interface FubCrmActionRow {
  id: string;
  action_type: string;           // 'ops:fub_tag_fix' | 'ops:fub_sequence_change' | etc.
  target: string;                // 'fub:segment:<segment_name>' or 'fub:person:<id>'
  assigned_producer: string;     // 'marketing_brain_skills/producers/ops-fub-crm'
  payload: FubOpsPayload;
  data_evidence: {
    audit_source?: string;       // e.g. 'audit-crm'
    opportunity_area?: string;   // e.g. 'leads missing seller-intent tag'
    signal_evidence?: string;    // e.g. '47 leads with Hot Seller stage have no hot-seller tag'
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

### Step 1 — Read the action row

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If row is not `status='pending'`, halt silently (another agent has it).

### Step 2 — Load mandatory references

- `CLAUDE.md` §0 — Data Accuracy mandate
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `docs/MARKETING_LEAD_FLOW.md` — understand tag conventions, sequence logic, and
  the conditional tagging rules (hot-seller / warm-seller / nurture-only)
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §2 — lead form conditional logic tags

### Step 3 — Resolve lead_ids (filter path)

If `payload.lead_ids` is a filter object (not an explicit array), query the FUB
People API to count and preview matching leads:

```
GET https://api.followupboss.com/v1/people
    ?<filter_params>&limit=1&fields=id,name,tags,stage
Authorization: Basic <base64(FOLLOWUPBOSS_API_KEY:)>
```

Extract `totalCount` from the response. Compare to `payload.expected_count`:

```
if totalCount > expected_count * 1.5:
  → HALT. Surface to Matt:
    "Filter returned {totalCount} leads — {1.5x * expected_count:.0f} above the
     expected {expected_count}. The filter may be too broad.
     Filter used: {JSON.stringify(filter)}.
     Reply 'proceed' to continue anyway, or provide a corrected filter."
  → Set status='ready', executor_response = { error: 'filter_too_broad', actual_count: N, expected_count: M }
  → Stop.
```

If `totalCount` is within acceptable range, fetch all matching IDs by paginating
the People API (FUB default limit 25, max 100 per page). Collect all `id` values.
Replace `payload.lead_ids` with the resolved explicit array before proceeding.

### Step 4 — Determine approval gate

```
if resolved_lead_count > 5:
  approval_gate = 'matt-explicit'
else:
  approval_gate = 'matt-review-draft'
```

### Step 5 — Surface to Matt

**For bulk ops (> 5 leads) — explicit approval required:**

```
Proposed FUB CRM change — [action_type] on [lead_count] leads

  OPERATION
    Type:     [action] ([tag name] / [sequence name] / [agent name])
    Scope:    [lead_count] leads
    Segment:  [target from action row]

  AFFECTED LEADS (sample — first 5)
    [lead_id] — [name] — [current tags/stage]
    [lead_id] — [name] — [current tags/stage]
    ... ([lead_count - 5] more)

  RATIONALE
    [payload.rationale]
    [data_evidence.signal_evidence if present]

  ACTION ROW
    ID: [action_id]
    Source: [data_evidence.audit_source]

Reply "yes" / "approved" / "go" to execute across all [lead_count] leads.
Reply "no" or "kill" to cancel.
```

**For single-lead ops (≤ 5 leads) — draft review:**

```
CRM update draft — [action_type]

  Lead: [name] (FUB ID: [id])
  Change: [human-readable description]
  Reason: [rationale]

Reply "ship it" / "go" / "approved" to apply.
```

Set `status='ready'` in the action row. Stop. Wait for Matt.

### Step 6 — Execute via FUB API (post-approval only)

After Matt's explicit approval, set `status='approved'`:

```sql
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<action_id>';
```

Execute operations. Batch when lead count > 50 to respect FUB rate limits
(FUB throttles at approximately 100 req/10s for write operations).

**Tag apply:**
```
PUT https://api.followupboss.com/v1/people/<person_id>
Body: { "tags": [...current_tags, ...new_tags] }
```
FUB tags are set as a full replacement array — always merge with existing tags,
never overwrite the full tag list unless removal is intended.

**Tag remove:**
```
PUT https://api.followupboss.com/v1/people/<person_id>
Body: { "tags": [...current_tags].filter(t => !tags_to_remove.includes(t)) }
```
Fetch current tags first for each person before computing the removal diff.

**Sequence start:**
```
POST https://api.followupboss.com/v1/actionPlans/subscriptions
Body: {
  "personId": <person_id>,
  "actionPlanId": <sequence_id>,
  "assignedUserId": <current_assigned_agent_id>
}
```

**Sequence stop:**
```
DELETE https://api.followupboss.com/v1/actionPlans/subscriptions/<subscription_id>
```
Requires first fetching the active subscription ID for the person + sequence pair.

**Task create:**
```
POST https://api.followupboss.com/v1/tasks
Body: {
  "personId": <person_id>,
  "type": <task_type>,
  "dueDate": <due_date>,
  "note": <note>,
  "assignedUserId": <assigned_agent_id>,
  "priority": <priority>
}
```

**Route change:**
```
PUT https://api.followupboss.com/v1/people/<person_id>
Body: { "assignedTo": <assigned_agent_name>, "assignedUserId": <assigned_agent_id> }
```

### Step 7 — Capture per-lead results, update action row

Accumulate results for every person_id processed:

```json
{
  "person_id": "12345",
  "status": "success" | "error",
  "api_response": { ... },
  "error_detail": "..." // only on error
}
```

After all leads processed:

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "operation": "<action>",
      "total_requested": <N>,
      "success_count": <N>,
      "error_count": <N>,
      "errors": [...],
      "executed_at": "<iso>",
      "batch_results": [...]
    }'::jsonb
WHERE id = '<action_id>';
```

### Step 8 — Confirm to Matt

```
Executed — FUB CRM [action]

  [success_count] of [total_requested] leads updated successfully.
  [error_count > 0: "X failed — see executor_response for detail."]

Action row [action_id] → status: executed.
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| FUB REST API v1 | People read + write, tasks, action plans | `FOLLOWUPBOSS_API_KEY` |
| Supabase MCP | Action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `lib/followupboss.ts` | `findPersonByEmail`, `fubHeaders`, `FubPerson` types | imported |
| `lib/fub.ts` | `pushToFub` — event-based FUB writes | imported (for event logging) |

---

## 6. Output format

**No file deliverable.** Output is the mutated CRM state + the updated action row.

**executor_response schema:**
```json
{
  "operation": "tag_apply",
  "total_requested": 12,
  "success_count": 12,
  "error_count": 0,
  "errors": [],
  "executed_at": "2026-05-13T15:00:00Z",
  "batch_results": [
    { "person_id": "111", "status": "success" },
    { "person_id": "222", "status": "success" }
  ]
}
```

---

## 7. Approval gate

| approval_type | when | who can grant |
|---|---|---|
| `matt-explicit` | Operations affecting > 5 leads | Matt only |
| `matt-review-draft` | Single-lead and ≤ 5 lead operations | Matt only |

**Approval words:** "yes," "approved," "go," "ship it," "proceed."
Silence is not approval.

---

## 8. Status flow

```
pending         ← producer reads row here
  │
  ▼
in_production   ← set immediately; executed_at = now()
  │
  ▼ (leads resolved, guardrails computed)
ready           ← set when surface message sent to Matt
  │
  ▼ (Matt approves)
approved        ← approved_by='matt', approved_at=now()
  │
  ▼ (FUB API calls complete)
executed        ← executor_response populated
  │
  ▼ (optional: 48h check by audit-crm)
measured

killed          ← filter too broad (unresolved), Matt says no, API error after retry
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Filter too broad | `totalCount > expected_count * 1.5` | Halt, surface to Matt with filter and counts. Status='ready'. |
| Missing `FOLLOWUPBOSS_API_KEY` | `getAuth()` returns null | Set status='killed'. Surface: "FOLLOWUPBOSS_API_KEY not set. No API call made." |
| Person not found | FUB returns 404 on person_id | Log as error in batch_results. Continue remaining leads. Surface summary at end. |
| Sequence/action plan not found | FUB returns 404 on sequence_id | Halt the sequence op entirely. Surface to Matt: "Sequence ID [id] not found in FUB. Verify the sequence exists and the ID matches." |
| Tag write stomps existing tags | Tags are set as full array replacement | Always fetch current tags before write. Never send a tags array without merging with current. |
| FUB rate limit (429) | HTTP 429 on bulk write | Back off 10s, retry. If 3 consecutive 429s, pause for 60s and retry once more. Log retries in executor_response. |
| Task creation without explicit IDs | Filter used for task_create | Hard-block. Task creation requires explicit lead_ids — filter path is disabled for this action type. Surface to Matt. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy mandate
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `docs/MARKETING_LEAD_FLOW.md` — tag conventions, sequence names, conditional tagging rules
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §2 — seller intent tags (hot-seller, warm-seller, nurture-only)

**Capabilities used:**
- `lib/followupboss.ts` — `findPersonByEmail`, `fubHeaders`, auth helpers
- `lib/fub.ts` — `pushToFub` for event-type writes

**Brain components that generate ops:fub_* action rows:**
- `marketing_brain_skills/audit-crm/` — surfaces tag gaps, SLA failures, unrouted leads
- `marketing_brain_skills/generate-briefs/` — creates routing + sequence action rows from signals

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `ops-fub-crm`
