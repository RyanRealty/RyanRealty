#!/usr/bin/env node
// Tag inventory export — READ-ONLY. Dumps every distinct tag on
// crm_people.tags (non-deleted) with its assignment count and prefix group to
// out/tag-inventory.csv. Feeds the TAG_STREAMLINE_PROPOSAL. Mutates nothing.
//
//   node scripts/_tag-inventory-export.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Page every non-deleted person's tags array and tally in JS (same shape the
// getCrmTags DAL uses). One tag counted once per person even if duplicated.
const counts = new Map();
let contacts = 0;
let from = 0;
const PAGE = 1000;
for (;;) {
  const { data, error } = await sb
    .from('crm_people')
    .select('id,tags')
    .eq('deleted', false)
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) break;
  for (const row of data) {
    contacts += 1;
    const seen = new Set();
    for (const t of Array.isArray(row.tags) ? row.tags : []) {
      if (typeof t === 'string' && t.length > 0) seen.add(t);
    }
    for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (data.length < PAGE) break;
  from += PAGE;
}

const prefixOf = (tag) => (tag.includes(':') ? tag.split(':')[0] : '(no-prefix)');
const rows = [...counts.entries()]
  .map(([tag, n]) => ({ tag, count: n, prefix: prefixOf(tag) }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

const totalAssignments = rows.reduce((s, r) => s + r.count, 0);

const csvEscape = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const lines = ['tag,assignment_count,prefix_group'];
for (const r of rows) lines.push([csvEscape(r.tag), r.count, csvEscape(r.prefix)].join(','));
fs.writeFileSync(path.join(ROOT, 'out/tag-inventory.csv'), lines.join('\n') + '\n');

console.log(`contacts=${contacts} distinct_tags=${rows.length} total_assignments=${totalAssignments}`);
console.log('wrote out/tag-inventory.csv');
