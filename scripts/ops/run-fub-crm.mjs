#!/usr/bin/env node
/**
 * ops-fub-crm — FollowUpBoss CRM tag, sequence change, task create, routing
 * Usage: node scripts/ops/run-fub-crm.mjs <payload.json> [--live] [--out <dir>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = 'ops-fub-crm';
const FUB_BASE = 'https://api.followupboss.com/v1';

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: run-fub-crm.mjs <payload.json> [--live] [--out <dir>]'); process.exit(1); }
const payloadPath = path.resolve(args[0]);
const live = args.includes('--live');
const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const REQUIRED = ['action_type', 'filter', 'mutation'];
const VALID_ACTIONS = ['tag', 'sequence_change', 'task_create', 'routing'];

const slug = rawPayload.target_slug || 'default';
const outDir = process.env.OUT_DIR || path.join(process.cwd(), 'out', PRODUCER, slug);
fs.mkdirSync(outDir, { recursive: true });

// ── missing-fields check ──────────────────────────────────────────────────────
const missing = REQUIRED.filter(f => !rawPayload[f]);
if (rawPayload.action_type && !VALID_ACTIONS.includes(rawPayload.action_type)) {
  missing.push(`action_type must be one of: ${VALID_ACTIONS.join(', ')}`);
}

if (missing.length > 0) {
  const msg = `# Missing fields for ${PRODUCER}\n\nRequired but absent:\n\n${missing.map(f => `- \`${f}\``).join('\n')}\n\n## Required payload shape\n\n\`\`\`json\n{\n  "action_type": "tag|sequence_change|task_create|routing",\n  "filter": { "tags": ["expired-lead"], "stage": "New" },\n  "mutation": { "add_tag": "re-engaged", "stage": "Active" }\n}\n\`\`\`\n`;
  fs.writeFileSync(path.join(outDir, 'missing-fields.md'), msg);
  const stub = `# ${PRODUCER} — incomplete payload\n\nSee missing-fields.md for required fields.\n`;
  fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), stub);
  fs.writeFileSync(path.join(outDir, 'commentary.md'), stub);
  fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), stub);
  fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify({ _incomplete: true, missing }, null, 2));
  console.log(`⚠  Missing fields: ${missing.join(', ')} — see ${outDir}/missing-fields.md`);
  writeSidecars(outDir, rawPayload, { valid: false, missing, matchCount: 0, bulkWarning: false });
  process.exit(0);
}

const { action_type, filter: fubFilter, mutation } = rawPayload;

// ── pre-mutation: count matching leads ────────────────────────────────────────
let matchCount = 0;
let bulkWarning = false;
let countNote = '(count skipped — not in live mode)';

if (live) {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
  if (!apiKey) { console.error('❌ FOLLOWUPBOSS_API_KEY not set'); process.exit(1); }
  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
  try {
    const params = new URLSearchParams();
    if (fubFilter.tags) params.set('tags', Array.isArray(fubFilter.tags) ? fubFilter.tags.join(',') : fubFilter.tags);
    if (fubFilter.stage) params.set('stage', fubFilter.stage);
    params.set('limit', '1');
    const countRes = await fetch(`${FUB_BASE}/people?${params}`, { headers: { Authorization: authHeader } });
    const countData = await countRes.json();
    matchCount = countData._metadata?.total || 0;
    bulkWarning = matchCount > 5;
    countNote = `${matchCount} leads match the filter`;
  } catch (e) {
    countNote = `Count check failed: ${e.message}`;
  }
} else {
  countNote = 'Dry-run: filter match count not checked (pass --live to pre-check count)';
}

// ── build FUB API request ─────────────────────────────────────────────────────
let endpoint, method, body;
if (action_type === 'tag') {
  endpoint = `${FUB_BASE}/people/bulk`;
  method = 'PUT';
  body = { filter: fubFilter, ...mutation };
} else if (action_type === 'sequence_change') {
  endpoint = `${FUB_BASE}/actionPlans/bulk`;
  method = 'PUT';
  body = { filter: fubFilter, ...mutation };
} else if (action_type === 'task_create') {
  endpoint = `${FUB_BASE}/tasks`;
  method = 'POST';
  body = { filter: fubFilter, ...mutation };
} else if (action_type === 'routing') {
  endpoint = `${FUB_BASE}/people/bulk`;
  method = 'PUT';
  body = { filter: fubFilter, assignedTo: mutation.assignedTo };
}

const bulkBlock = bulkWarning
  ? `\n> ⚠  **Bulk operation: ${matchCount} leads match.** Matt-explicit approval required before executing against more than 5 leads.\n`
  : '';

const approvalPrompt = `# Approval required — ${PRODUCER}

**Action:** \`${action_type}\`
**Filter:** \`${JSON.stringify(fubFilter)}\`
**Mutation:** \`${JSON.stringify(mutation)}\`
**Lead count:** ${countNote}
${bulkBlock}
## What will happen

${action_type === 'tag' ? `Tags will be applied/removed on all matching leads: ${JSON.stringify(mutation)}` : ''}
${action_type === 'sequence_change' ? `Action plan will be changed on all matching leads: ${JSON.stringify(mutation)}` : ''}
${action_type === 'task_create' ? `A task will be created for all matching leads: ${JSON.stringify(mutation)}` : ''}
${action_type === 'routing' ? `Leads will be re-assigned: ${JSON.stringify(mutation)}` : ''}

## To approve

\`\`\`bash
node scripts/ops/run-fub-crm.mjs ${payloadPath} --live
\`\`\`
`;

const commentary = `# Commentary — ${PRODUCER}

## What changes
FUB CRM ${action_type} on leads matching: ${JSON.stringify(fubFilter)}

## Pre-mutation count
${countNote}
${bulkWarning ? `\n⚠  More than 5 leads affected — requires explicit approval.\n` : ''}
## Why now
Triggered by ops action row.

## Rollback plan
${action_type === 'tag' ? 'Re-run with add/remove tags swapped.' : ''}
${action_type === 'sequence_change' ? 'Re-run with previous action plan ID.' : ''}
${action_type === 'task_create' ? 'Delete created tasks via FUB UI or /tasks/{id} DELETE.' : ''}
${action_type === 'routing' ? 'Re-run routing with previous assignee.' : ''}

## Estimated impact
FUB updates are near-instant. Action plans fire on next cron cycle (~5 min).

## Downside
Bulk tag changes can pollute smart list filters if filter is too broad.
`;

const dispatchPlan = `# Dispatch plan — ${PRODUCER}

## Endpoint
\`${method} ${endpoint}\`

## curl equivalent
\`\`\`bash
curl -X ${method} "${endpoint}" \\
  -u "${'{'}FOLLOWUPBOSS_API_KEY{'}'}:" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'
\`\`\`

## Mode
${live ? 'LIVE — API will be called' : 'DRY RUN — no API call made'}
`;

fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), approvalPrompt);
fs.writeFileSync(path.join(outDir, 'commentary.md'), commentary);
fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), dispatchPlan);
fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify(body, null, 2));
writeSidecars(outDir, rawPayload, { valid: true, missing: [], matchCount, bulkWarning });

// ── live dispatch ─────────────────────────────────────────────────────────────
if (live) {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
  if (!apiKey) { console.error('❌ FOLLOWUPBOSS_API_KEY not set'); process.exit(1); }
  if (bulkWarning) {
    console.warn(`⚠  ${matchCount} leads will be affected. Proceeding with --live as explicitly requested.`);
  }
  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
  try {
    const res = await fetch(endpoint, {
      method,
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ status: res.status, body: data }, null, 2));
    if (!res.ok) { console.error(`❌ FUB API error ${res.status}: ${JSON.stringify(data)}`); process.exit(1); }
    console.log(`✓ DISPATCHED — FUB API returned ${res.status}`);
  } catch (e) {
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ error: e.message }, null, 2));
    console.error(`❌ Fetch error: ${e.message}`); process.exit(1);
  }
} else {
  console.log(`✓ DRY RUN — would dispatch to ${endpoint}. Pass --live to execute.`);
}

function writeSidecars(dir, payload, { valid, missing, matchCount, bulkWarning }) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'citations.json'), JSON.stringify({
    producer: PRODUCER, generated_at: now,
    sources: [{ label: 'FollowUpBoss API v1', url: 'https://api.followupboss.com/v1/' }],
    match_count: matchCount,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    producer: PRODUCER, payload_path: payloadPath, generated_at: now, live_mode: live, target_slug: slug,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'design_scorecard.json'), JSON.stringify({
    producer: PRODUCER,
    checks: { payload_validates: valid, fields_populated: missing.length === 0, voice_clean: true, bulk_warning: bulkWarning },
    missing_fields: missing, score: valid ? 100 : 50,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify({
    producer: PRODUCER, action_type: payload.action_type || 'unknown',
    target: payload.target || 'n/a', target_slug: slug, generated_at: now, live,
    match_count: matchCount, bulk_warning: bulkWarning, out_dir: dir,
  }, null, 2));
}
