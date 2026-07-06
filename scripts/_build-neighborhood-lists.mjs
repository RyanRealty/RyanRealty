#!/usr/bin/env node
/**
 * Build a saved smart list per neighborhood (mirrors the River West view, id 39):
 * ast = { neighborhood: <slug> } on the crm_people.neighborhood_slug column,
 * owner_email = matt, is_shared=false, is_protected=false. Idempotent (skips a
 * name that already exists). READ the existing River West view for the exact shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OWNER = 'matt@ryan-realty.com';
const label = (slug) => slug.replace(/^bend-/, '').split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

// neighborhoods with contacts (exclude the already-built River West)
const counts = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_people').select('neighborhood_slug').eq('deleted', false).not('neighborhood_slug', 'is', null).range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const r of data) counts.set(r.neighborhood_slug, (counts.get(r.neighborhood_slug) || 0) + 1);
  if (data.length < 1000) break;
}
counts.delete('bend-river-west');
const slugs = [...counts.entries()].sort((a, b) => b[1] - a[1]);

// existing view names + max position (idempotent + append)
const { data: existing } = await sb.from('crm_saved_views').select('name,position');
const haveName = new Set((existing || []).map((v) => v.name));
let pos = Math.max(11, ...(existing || []).map((v) => v.position ?? 0)) + 1;

const rows = [];
for (const [slug, n] of slugs) {
  const name = `${label(slug)} Homeowners`;
  if (haveName.has(name)) continue;
  rows.push({
    name, description: null,
    ast: { op: 'and', type: 'group', nodes: [{ field: 'neighborhood', value: slug }] },
    filter: { neighborhood: slug },
    owner_email: OWNER, is_shared: false, is_protected: false, position: pos++,
    _count: n,
  });
}
console.log(`neighborhoods with contacts: ${slugs.length}. lists to create: ${rows.length}. apply=${APPLY}`);
console.log(rows.map((r) => `${r.name} (${r._count})`).join('\n'));
if (!APPLY) { console.log('\nDRY — pass --apply to create'); process.exit(0); }

for (const r of rows) {
  const { _count, ...row } = r;
  const { error } = await sb.from('crm_saved_views').insert(row);
  if (error) throw new Error(`${r.name}: ${error.message}`);
}
console.log(`\ncreated ${rows.length} neighborhood smart lists.`);
