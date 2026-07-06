#!/usr/bin/env node
/**
 * CRM source-field cleanup. Collapses duplicate/variant source labels onto one
 * canonical vocabulary. Reversible: snapshots (id, old source) to a backup JSON
 * BEFORE any write. Idempotent (a row already on the canonical label is skipped).
 *
 *   node scripts/_crm-source-cleanup.mjs            # dry run (counts only)
 *   node scripts/_crm-source-cleanup.mjs --apply    # back up + rewrite
 *   node scripts/_crm-source-cleanup.mjs --revert <backup.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// old label -> canonical label. Anything not a key here is left untouched.
const MAP = {
  // westside county-assessor farm -> Farm (Matt's call 2026-07-05)
  'westside-farm-assessor': 'Farm',
  'County Assessor — West Side Bend 2026-05': 'Farm',
  // expired-listing variants
  'Expired Listing Cron': 'Expired Listing',
  'expired-listing-cron': 'Expired Listing',
  // website variants
  'Ryan-Realty.com': 'Website',
  'ryan-realty.com': 'Website',
  'website-signup': 'Website',
  // inbound comms
  'inbound-call': 'Inbound Call',
  'inbound-sms': 'Inbound Text',
  // social
  'Facebook': 'Social',
  'IG': 'Social',
  // manual / unknown -> Manual Entry
  'Manual entry': 'Manual Entry',
  '<unspecified>': 'Manual Entry',
  'Company': 'Manual Entry',
  // test junk -> Import
  'smoke-test-ap69-validemail': 'Import',
  'AI- Claude': 'Import',
};

const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert') ? process.argv[process.argv.indexOf('--revert') + 1] : null;

async function pullAll(sourceValues) {
  const rows = [];
  for (const src of sourceValues) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('crm_people').select('id,source').eq('deleted', false).eq('source', src).range(from, from + 999);
      if (error) throw new Error(`${src}: ${error.message}`);
      rows.push(...data);
      if (data.length < 1000) break;
    }
  }
  return rows;
}

if (REVERT) {
  const backup = JSON.parse(fs.readFileSync(REVERT, 'utf8'));
  console.log(`reverting ${backup.length} rows from ${REVERT}`);
  let n = 0;
  for (const r of backup) {
    const { error } = await sb.from('crm_people').update({ source: r.source }).eq('id', r.id);
    if (error) throw new Error(`${r.id}: ${error.message}`);
    if (++n % 1000 === 0) console.log(`  ${n}/${backup.length}`);
  }
  console.log(`reverted ${n} rows.`);
  process.exit(0);
}

const oldLabels = Object.keys(MAP);
const affected = await pullAll(oldLabels);
const byLabel = new Map();
for (const r of affected) byLabel.set(r.source, (byLabel.get(r.source) || 0) + 1);
console.log(`apply=${APPLY}. affected rows: ${affected.length}`);
for (const [k, v] of [...byLabel.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}  (${v})  ->  ${MAP[k]}`);

if (!APPLY) { console.log('\nDRY — pass --apply to back up + rewrite'); process.exit(0); }

// 1) back up BEFORE any write
const stamp = process.argv.find((a) => a.startsWith('--stamp='))?.split('=')[1] || 'backup';
const backupPath = path.join(ROOT, 'out', `source-cleanup-${stamp}.json`);
fs.mkdirSync(path.dirname(backupPath), { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify(affected.map((r) => ({ id: r.id, source: r.source })), null, 0));
console.log(`\nbacked up ${affected.length} (id, old source) -> ${backupPath}`);

// 2) rewrite per old label (deterministic UPDATE ... WHERE source = old)
let total = 0;
for (const oldLabel of oldLabels) {
  const target = MAP[oldLabel];
  const { error, count } = await sb.from('crm_people').update({ source: target }, { count: 'exact' }).eq('deleted', false).eq('source', oldLabel);
  if (error) throw new Error(`${oldLabel}: ${error.message}`);
  if (count) { console.log(`  ${oldLabel} -> ${target}: ${count}`); total += count; }
}
console.log(`\nrewrote ${total} rows. revert with: node scripts/_crm-source-cleanup.mjs --revert ${backupPath}`);
