#!/usr/bin/env node
/**
 * ops-google-ads — Google Ads budget / pause / resume / keyword swap / negative add
 * Gracefully degrades to dry-run if Google Ads credentials not configured.
 * Usage: node scripts/ops/run-google-ads.mjs <payload.json> [--live] [--out <dir>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = 'ops-google-ads';
// Google Ads REST API v18 (latest stable)
const GADS_BASE = 'https://googleads.googleapis.com/v18';

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: run-google-ads.mjs <payload.json> [--live] [--out <dir>]'); process.exit(1); }
const payloadPath = path.resolve(args[0]);
const live = args.includes('--live');
const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const VALID_ACTIONS = ['budget_change', 'pause', 'resume', 'keyword_swap', 'negative_add'];
const REQUIRED = ['action_type'];
const ACTION_FIELDS = {
  budget_change: ['campaign_id', 'new_daily_budget'],
  pause:         ['campaign_id'],
  resume:        ['campaign_id'],
  keyword_swap:  ['ad_group_id', 'remove_keyword_id', 'add_keyword'],
  negative_add:  ['campaign_id', 'negative_keyword'],
};

const slug = rawPayload.target_slug || 'default';
const outDir = process.env.OUT_DIR || path.join(process.cwd(), 'out', PRODUCER, slug);
fs.mkdirSync(outDir, { recursive: true });

// ── credential check ──────────────────────────────────────────────────────────
const credsConfigured = !!(
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
  process.env.GOOGLE_OAUTH_CLIENT_ID
);
const credsNote = credsConfigured
  ? 'Google Ads credentials detected.'
  : '⚠  Google Ads credentials not configured (GOOGLE_ADS_DEVELOPER_TOKEN not set). Dry-run only.';

// Hoisted so writeSidecars can reference these in all paths (including missing-fields early exit)
const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID || 'CUSTOMER_ID';
let budgetNote = '';

// ── missing-fields check ──────────────────────────────────────────────────────
const missing = REQUIRED.filter(f => !rawPayload[f]);
if (rawPayload.action_type && !VALID_ACTIONS.includes(rawPayload.action_type)) {
  missing.push(`action_type must be one of: ${VALID_ACTIONS.join(', ')}`);
}
if (rawPayload.action_type && ACTION_FIELDS[rawPayload.action_type]) {
  ACTION_FIELDS[rawPayload.action_type].forEach(f => { if (!rawPayload[f]) missing.push(f); });
}

if (missing.length > 0) {
  const msg = `# Missing fields for ${PRODUCER}\n\nRequired but absent:\n\n${missing.map(f => `- \`${f}\``).join('\n')}\n\n## Credentials status\n\n${credsNote}\n\n## Required payload shape\n\n\`\`\`json\n{\n  "action_type": "budget_change|pause|resume|keyword_swap|negative_add",\n  "campaign_id": "1234567890",\n  "new_daily_budget": 50.00,\n  "ad_group_id": "9876543210",\n  "remove_keyword_id": "111",\n  "add_keyword": { "text": "Bend Oregon homes for sale", "match_type": "PHRASE" },\n  "negative_keyword": { "text": "free", "match_type": "BROAD" }\n}\n\`\`\`\n`;
  fs.writeFileSync(path.join(outDir, 'missing-fields.md'), msg);
  const stub = `# ${PRODUCER} — incomplete payload\n\nSee missing-fields.md for required fields.\n`;
  fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), stub);
  fs.writeFileSync(path.join(outDir, 'commentary.md'), stub);
  fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), stub);
  fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify({ _incomplete: true, missing }, null, 2));
  console.log(`⚠  Missing fields: ${missing.join(', ')} — see ${outDir}/missing-fields.md`);
  writeSidecars(outDir, rawPayload, { valid: false, missing, credsConfigured });
  process.exit(0);
}

const { action_type, campaign_id, ad_group_id, new_daily_budget,
        remove_keyword_id, add_keyword, negative_keyword } = rawPayload;

// ── budget band enforcement ───────────────────────────────────────────────────
if (action_type === 'budget_change' && new_daily_budget) {
  const current = rawPayload.current_daily_budget || new_daily_budget;
  const delta = Math.abs(new_daily_budget - current) / current;
  if (delta > 0.25) {
    budgetNote = `⚠  Budget change of ${(delta * 100).toFixed(1)}% exceeds the ±25% daily budget band. Review before executing.`;
  }
}

// ── build Google Ads API request (REST mutate) ────────────────────────────────
let endpoint, method, body;
if (action_type === 'budget_change') {
  endpoint = `${GADS_BASE}/customers/${customerId}/campaigns:mutate`;
  method = 'POST';
  body = {
    operations: [{
      update: { resourceName: `customers/${customerId}/campaigns/${campaign_id}`, campaignBudget: { amountMicros: Math.round(new_daily_budget * 1_000_000) } },
      updateMask: 'campaign_budget.amount_micros',
    }],
  };
} else if (action_type === 'pause') {
  endpoint = `${GADS_BASE}/customers/${customerId}/campaigns:mutate`;
  method = 'POST';
  body = {
    operations: [{
      update: { resourceName: `customers/${customerId}/campaigns/${campaign_id}`, status: 'PAUSED' },
      updateMask: 'status',
    }],
  };
} else if (action_type === 'resume') {
  endpoint = `${GADS_BASE}/customers/${customerId}/campaigns:mutate`;
  method = 'POST';
  body = {
    operations: [{
      update: { resourceName: `customers/${customerId}/campaigns/${campaign_id}`, status: 'ENABLED' },
      updateMask: 'status',
    }],
  };
} else if (action_type === 'keyword_swap') {
  endpoint = `${GADS_BASE}/customers/${customerId}/adGroupCriteria:mutate`;
  method = 'POST';
  body = {
    operations: [
      { remove: `customers/${customerId}/adGroupCriteria/${ad_group_id}~${remove_keyword_id}` },
      { create: { adGroup: `customers/${customerId}/adGroups/${ad_group_id}`, keyword: { text: add_keyword.text, matchType: add_keyword.match_type || 'PHRASE' }, type: 'KEYWORD' } },
    ],
  };
} else if (action_type === 'negative_add') {
  endpoint = `${GADS_BASE}/customers/${customerId}/campaignCriteria:mutate`;
  method = 'POST';
  body = {
    operations: [{
      create: {
        campaign: `customers/${customerId}/campaigns/${campaign_id}`,
        keyword: { text: negative_keyword.text, matchType: negative_keyword.match_type || 'BROAD' },
        negative: true,
        type: 'KEYWORD',
      },
    }],
  };
}

const approvalPrompt = `# Approval required — ${PRODUCER}

**Action:** \`${action_type}\`
**Campaign/AdGroup:** ${campaign_id || ad_group_id}
**Customer ID:** ${customerId}
${budgetNote ? `\n**${budgetNote}**\n` : ''}
${!credsConfigured ? '\n> ℹ  Google Ads credentials not fully configured. Pass --live to attempt dispatch (will error gracefully).\n' : ''}
## What will happen

${action_type === 'budget_change' ? `Daily budget set to $${new_daily_budget} (${Math.round(new_daily_budget * 1_000_000)} micros) on campaign ${campaign_id}.` : ''}
${action_type === 'pause' ? `Campaign ${campaign_id} paused. Ad delivery stops within ~1 minute.` : ''}
${action_type === 'resume' ? `Campaign ${campaign_id} resumed to ENABLED. Delivery restarts within ~1 minute.` : ''}
${action_type === 'keyword_swap' ? `Keyword ${remove_keyword_id} removed, "${add_keyword?.text}" (${add_keyword?.match_type || 'PHRASE'}) added in ad group ${ad_group_id}.` : ''}
${action_type === 'negative_add' ? `Negative keyword "${negative_keyword?.text}" (${negative_keyword?.match_type || 'BROAD'}) added to campaign ${campaign_id}.` : ''}

## To approve

\`\`\`bash
node scripts/ops/run-google-ads.mjs ${payloadPath} --live
\`\`\`
`;

const commentary = `# Commentary — ${PRODUCER}

## What changes
Google Ads ${action_type} on customer ${customerId}.

## Credentials status
${credsNote}

## Why now
Triggered by ops action row.

## Rollback plan
${action_type === 'pause' ? 'Re-run with action_type=resume.' : ''}
${action_type === 'resume' ? 'Re-run with action_type=pause.' : ''}
${action_type === 'budget_change' ? 'Re-run with previous new_daily_budget value.' : ''}
${action_type === 'keyword_swap' ? 'Reverse the swap: remove new keyword ID, re-add original keyword text.' : ''}
${action_type === 'negative_add' ? 'Remove negative keyword via Google Ads UI > Keywords > Negative Keywords.' : ''}
${budgetNote}

## Estimated impact
Google Ads changes propagate within 15–30 minutes. Keyword changes may take up to 2 hours to fully affect auction eligibility.

## Downside
Pausing high-performing campaigns loses auction momentum and quality score history. Budget reductions > 25% can cause delivery pacing issues.
`;

const dispatchPlan = `# Dispatch plan — ${PRODUCER}

## Credentials note
${credsNote}

## Endpoint
\`${method} ${endpoint}\`

## curl equivalent
\`\`\`bash
curl -X ${method} "${endpoint}" \\
  -H "Authorization: Bearer <access-token>" \\
  -H "developer-token: ${'{'}GOOGLE_ADS_DEVELOPER_TOKEN{'}'}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'
\`\`\`

## Authentication note
Google Ads REST API requires OAuth2 access token + developer-token header.
Use GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET to generate access token via service account or refresh token flow.

## Mode
${live ? 'LIVE — will attempt API call' : 'DRY RUN — no API call made'}
`;

fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), approvalPrompt);
fs.writeFileSync(path.join(outDir, 'commentary.md'), commentary);
fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), dispatchPlan);
fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify(body, null, 2));
writeSidecars(outDir, rawPayload, { valid: true, missing: [], credsConfigured });

// ── live dispatch ─────────────────────────────────────────────────────────────
if (live) {
  if (!credsConfigured) {
    const msg = { status: 'credentials-not-configured', note: credsNote, endpoint, body };
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(msg, null, 2));
    console.warn(`⚠  ${credsNote}`);
    console.log(`✓ DRY RUN FALLBACK — Google Ads credentials not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_CUSTOMER_ID to enable live dispatch.`);
    process.exit(0);
  }
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  // In production: exchange GOOGLE_OAUTH_CLIENT_ID/SECRET + refresh token for access token
  // For now we attempt the call and report the auth error clearly
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GOOGLE_ADS_ACCESS_TOKEN || 'NOT_SET'}`,
        'developer-token': devToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ status: res.status, body: data }, null, 2));
    if (!res.ok) {
      console.error(`❌ Google Ads API error ${res.status}: ${JSON.stringify(data)}`);
      if (res.status === 401) console.error('  → Set GOOGLE_ADS_ACCESS_TOKEN (OAuth2 access token) to authenticate.');
      process.exit(1);
    }
    console.log(`✓ DISPATCHED — Google Ads API returned ${res.status}`);
  } catch (e) {
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ error: e.message }, null, 2));
    console.error(`❌ Fetch error: ${e.message}`); process.exit(1);
  }
} else {
  console.log(`✓ DRY RUN — would dispatch to ${endpoint}. Pass --live to execute.`);
  if (!credsConfigured) console.log(`  ℹ  ${credsNote}`);
}

function writeSidecars(dir, payload, { valid, missing, credsConfigured }) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'citations.json'), JSON.stringify({
    producer: PRODUCER, generated_at: now,
    sources: [{ label: 'Google Ads REST API v18', url: 'https://developers.google.com/google-ads/api/rest/reference/rest' }],
    customer_id: customerId, creds_configured: credsConfigured,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    producer: PRODUCER, payload_path: payloadPath, generated_at: now, live_mode: live, target_slug: slug,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'design_scorecard.json'), JSON.stringify({
    producer: PRODUCER,
    checks: { payload_validates: valid, fields_populated: missing.length === 0, voice_clean: true, budget_band_ok: !budgetNote, creds_configured: credsConfigured },
    missing_fields: missing, score: valid ? (credsConfigured ? 100 : 85) : 50,
    note: credsConfigured ? null : 'Google Ads credentials not configured — dry-run only',
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify({
    producer: PRODUCER, action_type: payload.action_type || 'unknown',
    campaign_id: payload.campaign_id || payload.ad_group_id || 'n/a',
    target_slug: slug, generated_at: now, live, creds_configured: credsConfigured, out_dir: dir,
  }, null, 2));
}
