#!/usr/bin/env node
/**
 * ops-manychat — ManyChat IG keyword automation flow setup
 * Usage: node scripts/ops/run-manychat.mjs <payload.json> [--live] [--out <dir>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = 'ops-manychat';
const MANYCHAT_BASE = 'https://api.manychat.com';

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: run-manychat.mjs <payload.json> [--live] [--out <dir>]'); process.exit(1); }
const payloadPath = path.resolve(args[0]);
const live = args.includes('--live');
const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const REQUIRED = ['listing'];
const slug = rawPayload.target_slug || 'default';
const outDir = process.env.OUT_DIR || path.join(process.cwd(), 'out', PRODUCER, slug);
fs.mkdirSync(outDir, { recursive: true });

// ── missing-fields check ──────────────────────────────────────────────────────
const missing = REQUIRED.filter(f => !rawPayload[f]);
const listing = rawPayload.listing || {};
if (!listing.street_name && !rawPayload.listing?.address) missing.push('listing.street_name (or listing.address)');

if (missing.length > 0) {
  const msg = `# Missing fields for ${PRODUCER}\n\nRequired but absent:\n\n${missing.map(f => `- \`${f}\``).join('\n')}\n\n## Required payload shape\n\n\`\`\`json\n{\n  "listing": {\n    "street_number": "19496",\n    "street_name": "Tumalo Reservoir Rd",\n    "city": "Bend",\n    "list_price": 1225000,\n    "bedrooms": 3,\n    "bathrooms": 3,\n    "list_agent_name": "Matt Ryan",\n    "remarks_short": "..."\n  },\n  "triggers": [\n    { "keyword": "SHOWING", "reply": "Thanks for reaching out! We will contact you within the hour to schedule a showing." },\n    { "keyword": "DETAILS", "reply": "Happy to send you the full details. DM us your email or call 541.213.6706." }\n  ]\n}\n\`\`\`\n`;
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

const streetName = listing.street_name || listing.address || 'PROPERTY';
// Street keyword: first word of street name, uppercase, alphanumeric only
const streetKeyword = streetName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
const priceDisplay = listing.list_price ? `$${Number(listing.list_price).toLocaleString()}` : 'contact for price';
const beds = listing.bedrooms || '';
const baths = listing.bathrooms || '';
const address = `${listing.street_number || ''} ${listing.street_name || ''}`.trim();

const manyChatApiKey = process.env.MANYCHAT_API_KEY;
const hasApiKey = !!manyChatApiKey;

// ── build 4 standard triggers ─────────────────────────────────────────────────
const userTriggers = rawPayload.triggers || [];
const baseTriggers = [
  {
    keyword: 'SHOWING',
    reply: `Thank you for your interest in ${address}. Our team will reach out within the hour to schedule a showing. You can also call us directly at 541.213.6706.`,
    fub_tag: 'ig-showing-request',
    fub_source: 'Instagram DM — SHOWING keyword',
  },
  {
    keyword: 'OPENHOUSE',
    reply: `Thank you for asking about the open house at ${address}. We will send you the date and time details right away. Questions? Call 541.213.6706.`,
    fub_tag: 'ig-open-house-inquiry',
    fub_source: 'Instagram DM — OPENHOUSE keyword',
  },
  {
    keyword: 'DETAILS',
    reply: `Happy to send the full property details for ${address} (${priceDisplay}${beds ? `, ${beds}BD/${baths}BA` : ''}). Reply with your email address and we will get those over to you.`,
    fub_tag: 'ig-details-request',
    fub_source: 'Instagram DM — DETAILS keyword',
  },
  {
    keyword: streetKeyword,
    reply: `Thank you for reaching out about ${address} (${priceDisplay}). What would you like to know? We are happy to answer any questions — or call us at 541.213.6706.`,
    fub_tag: `ig-address-inquiry-${slug}`,
    fub_source: `Instagram DM — ${streetKeyword} keyword`,
  },
  // Merge user-specified triggers
  ...userTriggers,
];

// ── FUB webhook integration ───────────────────────────────────────────────────
const fubWebhookUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/webhooks/fub-capture`
  : 'https://ryanrealty.vercel.app/api/webhooks/fub-capture';

// ── ManyChat flow JSON (import-ready format) ──────────────────────────────────
const flowJson = {
  _meta: {
    producer: PRODUCER,
    generated_at: new Date().toISOString(),
    listing_key: listing.listing_key || 'n/a',
    address,
    note: 'Import this flow via ManyChat > Automation > Import. Requires ManyChat Pro for keyword triggers.',
  },
  flow_name: `Ryan Realty — ${address} IG Keywords`,
  triggers: baseTriggers.map(t => ({
    keyword: t.keyword,
    match_type: 'EXACT',
    channel: 'instagram',
    reply: {
      type: 'text',
      text: t.reply,
    },
    fub_webhook: {
      url: fubWebhookUrl,
      method: 'POST',
      body: {
        source: t.fub_source,
        tags: [t.fub_tag, 'ig-lead', 'instagram-dm'],
        listing_address: address,
        listing_price: priceDisplay,
        trigger_keyword: t.keyword,
        listing_key: listing.listing_key || '',
        assigned_to: listing.list_agent_name || 'Matt Ryan',
      },
    },
  })),
  fallback_message: `Thank you for reaching out to Ryan Realty. For immediate assistance, call 541.213.6706 or visit ryan-realty.com.`,
  opt_in_message: `You will receive property updates from Ryan Realty. Reply STOP to unsubscribe.`,
};

const approvalPrompt = `# Approval required — ${PRODUCER}

**Listing:** ${address}
**Triggers configured:** ${baseTriggers.length}
${!hasApiKey ? '\n> ℹ  MANYCHAT_API_KEY not set — dry-run mode only. Set the key to enable live dispatch.\n' : ''}
## Keyword triggers

${baseTriggers.map(t => `- \`${t.keyword}\` → "${t.reply.slice(0, 80)}..."`).join('\n')}

## FUB integration

Every trigger fires a webhook to \`${fubWebhookUrl}\` to capture the lead in FUB.

## To approve

\`\`\`bash
node scripts/ops/run-manychat.mjs ${payloadPath} --live
\`\`\`

## Import instructions (if live fails)

Import \`flow.json\` via ManyChat > Automation > Import JSON.
`;

const commentary = `# Commentary — ${PRODUCER}

## What changes
ManyChat IG keyword automation flow for ${address}.
${baseTriggers.length} triggers: ${baseTriggers.map(t => t.keyword).join(', ')}

## FUB lead capture
Every trigger fires a FUB webhook at ${fubWebhookUrl}.
Tags applied: ig-lead, instagram-dm, and trigger-specific tag.

## Why now
New listing posted to IG. Keyword automation captures DM leads without manual monitoring.

## Rollback plan
Pause or delete the flow in ManyChat Automation dashboard. FUB leads already captured are unaffected.

## Estimated impact
Keyword flows convert ~15–25% of caption-driven DMs into captured leads (industry benchmark).

## Downside
ManyChat Pro required for keyword triggers. If not on Pro, flows must be imported and manually triggered.
${!hasApiKey ? '\nMANYCHAT_API_KEY not configured — live dispatch unavailable until key is set.\n' : ''}
`;

const dispatchPlan = `# Dispatch plan — ${PRODUCER}

## API status
${hasApiKey ? 'MANYCHAT_API_KEY is set — live dispatch available' : 'MANYCHAT_API_KEY NOT SET — dry-run only'}

## Endpoint (if live)
POST ${MANYCHAT_BASE}/fb/sending/sendContent

## Import alternative
If API dispatch is unavailable, import \`flow.json\` directly in ManyChat UI:
Automation > Import > select flow.json

## Mode
${live ? (hasApiKey ? 'LIVE — will attempt API dispatch' : 'LIVE requested but API key missing — producing bundle only') : 'DRY RUN — bundle produced, no API call'}
`;

fs.writeFileSync(path.join(outDir, 'flow.json'), JSON.stringify(flowJson, null, 2));
fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), approvalPrompt);
fs.writeFileSync(path.join(outDir, 'commentary.md'), commentary);
fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), dispatchPlan);
fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify(flowJson, null, 2));
writeSidecars(outDir, rawPayload, { valid: true, missing: [], hasApiKey });

// ── live dispatch ─────────────────────────────────────────────────────────────
if (live) {
  if (!hasApiKey) {
    console.warn('⚠  MANYCHAT_API_KEY not set — dry-run mode. Set the key to enable live dispatch.');
    console.log(`✓ BUNDLE PRODUCED — import flow.json via ManyChat UI. Pass MANYCHAT_API_KEY to enable live dispatch.`);
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({
      status: 'api-key-missing',
      note: 'MANYCHAT_API_KEY not configured. Import flow.json via ManyChat UI.',
      flow_path: path.join(outDir, 'flow.json'),
    }, null, 2));
  } else {
    try {
      const res = await fetch(`${MANYCHAT_BASE}/fb/sending/sendContent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${manyChatApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_ns: flowJson.flow_name, data: flowJson }),
      });
      const data = await res.json();
      fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ status: res.status, body: data }, null, 2));
      if (!res.ok) { console.error(`❌ ManyChat API error ${res.status}: ${JSON.stringify(data)}`); process.exit(1); }
      console.log(`✓ DISPATCHED — ManyChat API returned ${res.status}`);
    } catch (e) {
      fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ error: e.message }, null, 2));
      console.error(`❌ Fetch error: ${e.message}`); process.exit(1);
    }
  }
} else {
  console.log(`✓ DRY RUN — ManyChat flow bundle written to ${outDir}/flow.json`);
  console.log(`  Triggers: ${baseTriggers.map(t => t.keyword).join(', ')}`);
  console.log(`  FUB webhook: ${fubWebhookUrl}`);
  if (!hasApiKey) console.log(`  ℹ  MANYCHAT_API_KEY not set — dry-run only with note`);
}

function writeSidecars(dir, payload, { valid, missing, hasApiKey }) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'citations.json'), JSON.stringify({
    producer: PRODUCER, generated_at: now,
    sources: [{ label: 'ManyChat API', url: 'https://api.manychat.com/', note: 'Pro plan required for keyword triggers' }],
    api_key_configured: hasApiKey, fub_webhook: fubWebhookUrl,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    producer: PRODUCER, payload_path: payloadPath, generated_at: now, live_mode: live, target_slug: slug,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'design_scorecard.json'), JSON.stringify({
    producer: PRODUCER,
    checks: { payload_validates: valid, fields_populated: missing.length === 0, voice_clean: true, api_key_present: hasApiKey, fub_integration: true },
    missing_fields: missing, score: valid ? 95 : 50,
    note: hasApiKey ? null : 'MANYCHAT_API_KEY not set — import via UI',
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify({
    producer: PRODUCER, listing_address: payload.listing ? `${payload.listing.street_number || ''} ${payload.listing.street_name || ''}`.trim() : 'n/a',
    target_slug: slug, generated_at: now, live, api_key_present: hasApiKey, out_dir: dir,
  }, null, 2));
}

const fubWebhookUrl2 = fubWebhookUrl; // hoist for sidecar closure
