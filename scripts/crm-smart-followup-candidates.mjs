#!/usr/bin/env node
// Smart follow-ups, stage 1: select quiet working leads and export context
// packs as JSON (NO LLM calls — the drafting happens in the plan-billed
// Claude Code routine, not via API credits. Matt directive 2026-06-10.)
//
//   node scripts/crm-smart-followup-candidates.mjs            # → tmp/smart-followup-candidates.json
//   CRM_SMART_FOLLOWUP_CAP=3 node scripts/...                 # smaller batch

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CAP = Number(process.env.CRM_SMART_FOLLOWUP_CAP ?? '8');
const WORKING_STAGES = ['Lead', 'Seller Prospect', 'A - Hot 1-3 Months', 'B - Warm 3-6 Months', 'Active Client'];
const QUIET_DAYS = { hot: 2, warm: 5, other: 14 };
const tierOf = (tags) => tags.some((t) => /:hot$/.test(t)) ? 'hot' : tags.some((t) => /:warm$/.test(t)) ? 'warm' : 'other';

const { data: candidates, error } = await sb
  .from('crm_people')
  .select('id,name,first_name,tags,stage,assigned_broker,custom,last_activity_at,fub_created_at,emails,phones')
  .in('stage', WORKING_STAGES)
  .or(`last_activity_at.gte.${new Date(Date.now() - 60 * 86400e3).toISOString()},fub_created_at.gte.${new Date(Date.now() - 14 * 86400e3).toISOString()}`)
  .order('last_activity_at', { ascending: false, nullsFirst: false })
  .limit(400);
if (error) { console.error(error.message); process.exit(1); }

const out = [];
const perBroker = {};
const skips = {};
const skip = (r) => { skips[r] = (skips[r] ?? 0) + 1; };

for (const p of candidates ?? []) {
  const broker = p.assigned_broker ?? 'matt';
  if ((perBroker[broker] ?? 0) >= CAP) { skip('broker-cap'); continue; }
  const tags = p.tags ?? [];
  if (tags.includes('compliance:hard-stop')) { skip('hard-stop'); continue; }

  const quietDays = QUIET_DAYS[tierOf(tags)];
  const since = new Date(Date.now() - quietDays * 86400e3).toISOString();
  const { count: recentOutbound } = await sb
    .from('crm_timeline').select('id', { count: 'exact', head: true })
    .eq('person_id', p.id).in('kind', ['email_out', 'sms_out', 'note', 'call']).gte('ts', since);
  if ((recentOutbound ?? 0) > 0) { skip('recent-outbound'); continue; }

  const { count: suppressed } = await sb
    .from('crm_suppressions').select('id', { count: 'exact', head: true })
    .eq('person_id', p.id).eq('channel', 'all');
  if ((suppressed ?? 0) > 0) { skip('suppressed'); continue; }

  const { data: timeline } = await sb
    .from('crm_timeline').select('ts,kind,title,body')
    .eq('person_id', p.id).order('ts', { ascending: false }).limit(12);
  const custom = p.custom ?? {};

  out.push({
    personId: p.id,
    name: p.name,
    firstName: p.first_name ?? (p.name ?? '').split(' ')[0],
    broker,
    stage: p.stage,
    tags,
    hasTextHistory: (timeline ?? []).some((t) => t.kind === 'sms_in' || t.kind === 'sms_out'),
    property: custom.customSellerPropertyAddress ?? null,
    statedTimeline: custom.customMoveTimeline ?? null,
    quietDays,
    recentActivity: (timeline ?? []).map((t) => ({
      date: String(t.ts).slice(0, 10),
      kind: t.kind,
      title: (t.title ?? '').slice(0, 100),
      body: (t.body ?? '').replace(/\s+/g, ' ').slice(0, 240),
    })),
  });
  perBroker[broker] = (perBroker[broker] ?? 0) + 1;
}

fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
const outPath = path.join(ROOT, 'tmp/smart-followup-candidates.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), candidates: out, skips }, null, 1));
console.log(`wrote ${out.length} candidate context packs → ${outPath}`);
console.log('skips:', JSON.stringify(skips));
