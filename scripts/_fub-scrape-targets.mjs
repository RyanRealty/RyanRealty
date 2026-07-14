// Build the target list for the FUB text-body scrape recovery.
// Writes scratchpad/fub-targets.json: one entry per FUB person that has
// redacted imported texts, with the exact crm_timeline rows to fill
// (ordered chronologically) so scraped bodies can be aligned by (order,direction).
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = '/Users/matthewryan/RyanRealty';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('crm_timeline')
    .select('id, person_id, kind, ts, payload')
    .eq('source', 'fub-import')
    .in('kind', ['sms_in', 'sms_out'])
    .order('person_id', { ascending: true })
    .order('ts', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  rows.push(...data.filter((r) => r.payload?.contentHidden === true));
  if (data.length < PAGE) break;
}

// map person_id -> fub_legacy_id + name
const pids = [...new Set(rows.map((r) => r.person_id))];
const people = new Map();
for (let i = 0; i < pids.length; i += 500) {
  const { data, error } = await sb.from('crm_people').select('id, fub_legacy_id, name').in('id', pids.slice(i, i + 500));
  if (error) throw error;
  for (const p of data) people.set(p.id, p);
}

const byPerson = new Map();
for (const r of rows) {
  const p = people.get(r.person_id) || {};
  if (!p.fub_legacy_id) continue; // need FUB id to visit the page
  if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, { person_id: r.person_id, fub_id: p.fub_legacy_id, name: p.name, msgs: [] });
  byPerson.get(r.person_id).msgs.push({ id: r.id, dir: r.kind === 'sms_in' ? 'in' : 'out', ts: r.ts });
}

const targets = [...byPerson.values()].sort((a, b) => b.msgs.length - a.msgs.length); // most texts first
fs.writeFileSync(path.join(ROOT, 'scratchpad', 'fub-targets.json'), JSON.stringify(targets, null, 1));
console.log(`targets: ${targets.length} people, ${rows.length} messages`);
console.log(`top 5 by msg count:`, targets.slice(0, 5).map((t) => `${t.name}(fub ${t.fub_id}): ${t.msgs.length}`).join(' | '));
