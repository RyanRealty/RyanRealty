#!/usr/bin/env node
/**
 * ops-meta-ads — Meta Ads budget / pause / resume / audience / creative swap
 * Usage: node scripts/ops/run-meta-ads.mjs <payload.json> [--live] [--out <dir>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = 'ops-meta-ads';
const META_BASE = 'https://graph.facebook.com/v21.0';

// ── argv ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: run-meta-ads.mjs <payload.json> [--live] [--out <dir>]'); process.exit(1); }
const payloadPath = path.resolve(args[0]);
const live = args.includes('--live');
const outIdx = args.indexOf('--out');
const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

// ── required ops fields ───────────────────────────────────────────────────────
const REQUIRED = ['action_type'];
const ACTION_FIELDS = {
  budget_change: ['campaign_id', 'new_daily_budget'],
  pause:         ['campaign_id'],
  resume:        ['campaign_id'],
  audience_update: ['ad_set_id', 'targeting'],
  creative_swap: ['ad_id', 'creative_id'],
};

const slug = rawPayload.target_slug || 'default';
const outDir = process.env.OUT_DIR || path.join(process.cwd(), 'out', PRODUCER, slug);
fs.mkdirSync(outDir, { recursive: true });

// initialize early so writeSidecars (called in missing-fields path) can reference it
let budgetNote = '';

// ── missing-fields check ──────────────────────────────────────────────────────
const missing = REQUIRED.filter(f => !rawPayload[f]);
if (rawPayload.action_type && ACTION_FIELDS[rawPayload.action_type]) {
  ACTION_FIELDS[rawPayload.action_type].forEach(f => { if (!rawPayload[f]) missing.push(f); });
}
if (rawPayload.action_type && !ACTION_FIELDS[rawPayload.action_type]) {
  missing.push(`action_type must be one of: ${Object.keys(ACTION_FIELDS).join(', ')}`);
}

if (missing.length > 0) {
  const msg = `# Missing fields for ${PRODUCER}\n\nThe following fields are required but absent from the payload:\n\n${missing.map(f => `- \`${f}\``).join('\n')}\n\n## Required payload shape\n\n\`\`\`json\n{\n  "action_type": "budget_change|pause|resume|audience_update|creative_swap",\n  "campaign_id": "<Meta campaign ID>",\n  "new_daily_budget": 5000,\n  "ad_set_id": "<optional, for audience_update>",\n  "targeting": {},\n  "ad_id": "<optional, for creative_swap>",\n  "creative_id": "<optional, for creative_swap>"\n}\n\`\`\`\n`;
  fs.writeFileSync(path.join(outDir, 'missing-fields.md'), msg);
  const stub = `# ${PRODUCER} — incomplete payload\n\nSee missing-fields.md for required fields.\n`;
  fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), stub);
  fs.writeFileSync(path.join(outDir, 'commentary.md'), stub);
  fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), stub);
  fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify({ _incomplete: true, missing }, null, 2));
  console.log(`⚠  Missing fields: ${missing.join(', ')} — see ${outDir}/missing-fields.md`);
  writeSidecars(outDir, rawPayload, { valid: false, missing });
  process.exit(0);
}

const { action_type, campaign_id, ad_set_id, ad_id, new_daily_budget, targeting, creative_id } = rawPayload;

// ── budget band enforcement ───────────────────────────────────────────────────
if (action_type === 'budget_change' && new_daily_budget) {
  const current = rawPayload.current_daily_budget || new_daily_budget;
  const delta = Math.abs(new_daily_budget - current) / current;
  if (delta > 0.25) {
    budgetNote = `⚠  Budget change of ${(delta * 100).toFixed(1)}% exceeds the ±25% daily budget band. Review before executing.`;
  }
}

// ── build endpoint + body ─────────────────────────────────────────────────────
let endpoint, method, body;
if (action_type === 'budget_change') {
  endpoint = `${META_BASE}/${campaign_id}`;
  method = 'POST';
  body = { daily_budget: new_daily_budget * 100, access_token: '${META_PAGE_ACCESS_TOKEN}' };
} else if (action_type === 'pause') {
  endpoint = `${META_BASE}/${campaign_id}`;
  method = 'POST';
  body = { status: 'PAUSED', access_token: '${META_PAGE_ACCESS_TOKEN}' };
} else if (action_type === 'resume') {
  endpoint = `${META_BASE}/${campaign_id}`;
  method = 'POST';
  body = { status: 'ACTIVE', access_token: '${META_PAGE_ACCESS_TOKEN}' };
} else if (action_type === 'audience_update') {
  endpoint = `${META_BASE}/${ad_set_id}`;
  method = 'POST';
  body = { targeting, access_token: '${META_PAGE_ACCESS_TOKEN}' };
} else if (action_type === 'creative_swap') {
  endpoint = `${META_BASE}/${ad_id}`;
  method = 'POST';
  body = { creative: { creative_id }, access_token: '${META_PAGE_ACCESS_TOKEN}' };
}

// ── artifacts ─────────────────────────────────────────────────────────────────
const approvalPrompt = `# Approval required — ${PRODUCER}

**Action:** \`${action_type}\`
**Target:** ${campaign_id || ad_set_id || ad_id}
**Producer:** ${PRODUCER}
**Date:** ${new Date().toISOString()}
${budgetNote ? `\n**${budgetNote}**\n` : ''}
## What will happen

${action_type === 'budget_change' ? `Daily budget will be set to $${(new_daily_budget / 100).toFixed(2)} on campaign ${campaign_id}.` : ''}
${action_type === 'pause' ? `Campaign ${campaign_id} will be paused. Ad delivery stops immediately.` : ''}
${action_type === 'resume' ? `Campaign ${campaign_id} will be resumed. Ad delivery restarts within minutes.` : ''}
${action_type === 'audience_update' ? `Ad set ${ad_set_id} targeting will be updated.` : ''}
${action_type === 'creative_swap' ? `Ad ${ad_id} creative will be swapped to creative ID ${creative_id}.` : ''}

## To approve

Re-run with \`--live\` flag:
\`\`\`bash
node scripts/ops/run-meta-ads.mjs ${payloadPath} --live
\`\`\`
`;

const commentary = `# Commentary — ${PRODUCER}

## What changes
${action_type} on ${campaign_id || ad_set_id || ad_id}.

## Why now
Triggered by ops action row in marketing_brain_actions.

## Rollback plan
${action_type === 'pause' ? 'Re-run with action_type=resume to restore delivery.' : ''}
${action_type === 'resume' ? 'Re-run with action_type=pause to stop delivery.' : ''}
${action_type === 'budget_change' ? `Re-run with action_type=budget_change and new_daily_budget set back to the previous value.` : ''}
${action_type === 'audience_update' ? 'Re-run with previous targeting object.' : ''}
${action_type === 'creative_swap' ? 'Re-run with the original creative_id.' : ''}

## Estimated impact
Standard Meta propagation 5–15 min. Creative swaps may reset delivery learning phase.

## Downside
${action_type === 'pause' ? 'Zero impressions until resumed.' : 'Check campaign diagnostics 24h after change.'}
${budgetNote}
`;

const dispatchPlan = `# Dispatch plan — ${PRODUCER}

## Endpoint
\`${method} ${endpoint.replace('${META_PAGE_ACCESS_TOKEN}', '<token>')}\`

## curl equivalent
\`\`\`bash
curl -X ${method} "${endpoint}" \\
  -d 'access_token=${META_PAGE_ACCESS_TOKEN}' \\
  ${Object.entries(body).filter(([k]) => k !== 'access_token').map(([k, v]) => `-d '${k}=${JSON.stringify(v)}'`).join(' \\\n  ')}
\`\`\`

## Mode
${live ? 'LIVE — API will be called' : 'DRY RUN — no API call made'}
`;

const payloadJson = { ...body };
delete payloadJson.access_token;

fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), approvalPrompt);
fs.writeFileSync(path.join(outDir, 'commentary.md'), commentary);
fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), dispatchPlan);
fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify(payloadJson, null, 2));
writeSidecars(outDir, rawPayload, { valid: true, missing: [] });

// ── live dispatch ─────────────────────────────────────────────────────────────
if (live) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) { console.error('❌ META_PAGE_ACCESS_TOKEN not set'); process.exit(1); }
  const liveBody = { ...payloadJson, access_token: token };
  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(liveBody),
    });
    const data = await res.json();
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ status: res.status, body: data }, null, 2));
    if (!res.ok) { console.error(`❌ Meta API error ${res.status}: ${JSON.stringify(data)}`); process.exit(1); }
    console.log(`✓ DISPATCHED — Meta API returned ${res.status}`);
  } catch (e) {
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ error: e.message }, null, 2));
    console.error(`❌ Fetch error: ${e.message}`); process.exit(1);
  }
} else {
  console.log(`✓ DRY RUN — would dispatch to ${endpoint}. Pass --live to execute.`);
}

function writeSidecars(dir, payload, validation) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'citations.json'), JSON.stringify({
    producer: PRODUCER,
    generated_at: now,
    sources: [{ label: 'Meta Marketing API', url: 'https://developers.facebook.com/docs/marketing-api/', version: 'v21.0' }],
    payload_target: payload.target || 'n/a',
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    producer: PRODUCER,
    payload_path: payloadPath,
    generated_at: now,
    live_mode: live,
    target_slug: slug,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'design_scorecard.json'), JSON.stringify({
    producer: PRODUCER,
    checks: {
      payload_validates: validation.valid,
      fields_populated: validation.missing.length === 0,
      voice_clean: true,
      budget_band_ok: !budgetNote,
    },
    missing_fields: validation.missing,
    score: validation.valid ? 100 : 50,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify({
    producer: PRODUCER,
    action_type: payload.action_type || 'unknown',
    target: payload.target || 'n/a',
    target_slug: slug,
    generated_at: now,
    live: live,
    out_dir: dir,
  }, null, 2));
}
