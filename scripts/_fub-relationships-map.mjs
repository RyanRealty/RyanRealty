#!/usr/bin/env node
// One-off: correctly map FUB peopleRelationships → crm_relationships.
// Fixes the prior import (which read a non-existent r.relatedPersonId, leaving
// every related_person_id null). Resolves the related person to a real contact
// by matching the embedded email/phone, maps the FUB type to our vocab, and
// upserts on fub_legacy_id (idempotent).
//
//   node scripts/_fub-relationships-map.mjs            # dry run (report only)
//   node scripts/_fub-relationships-map.mjs --write    # upsert

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const WRITE = process.argv.includes('--write');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const FUB_AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64');
const FUB_HEADERS = { Authorization: FUB_AUTH, 'X-System': env.FOLLOWUPBOSS_SYSTEM || 'RyanRealtyPlatform', 'X-System-Key': env.FOLLOWUPBOSS_SYSTEM_KEY || '', Accept: 'application/json' };

const normPhone = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : null; };
const lc = (v) => String(v ?? '').trim().toLowerCase() || null;

// FUB free-text type → our RELATIONSHIP_TYPES vocab.
function mapType(t) {
  const s = String(t ?? '').trim().toLowerCase();
  if (!s) return 'other';
  if (/(spouse|wife|husband)/.test(s)) return 'spouse';
  if (/partner/.test(s)) return 'partner';
  if (/(son|daughter|child|kid)/.test(s)) return 'child';
  if (/(mother|father|parent|mom|dad)/.test(s)) return 'parent';
  if (/(brother|sister|sibling)/.test(s)) return 'sibling';
  if (/(co.?buyer|cobuyer)/.test(s)) return 'co-buyer';
  if (/assistant/.test(s)) return 'assistant';
  if (/refer/.test(s)) return 'referrer';
  return 'other';
}

async function main() {
  // 1. Pull all FUB relationships.
  const rels = [];
  let next = null;
  do {
    const url = 'https://api.followupboss.com/v1/peopleRelationships?limit=100' + (next ? `&next=${encodeURIComponent(next)}` : '');
    const res = await fetch(url, { headers: FUB_HEADERS });
    if (!res.ok) throw new Error(`FUB ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = await res.json();
    rels.push(...(d.peoplerelationships ?? d.peopleRelationships ?? []));
    next = d._metadata?.next ?? null;
  } while (next);
  console.log(`FUB relationships: ${rels.length}`);

  // 2. Map FUB person id → our crm id.
  const fubIds = [...new Set(rels.map((r) => r.personId).filter(Boolean))];
  const fubToCrm = new Map();
  for (let i = 0; i < fubIds.length; i += 500) {
    const { data } = await sb.from('crm_people').select('id,fub_legacy_id').in('fub_legacy_id', fubIds.slice(i, i + 500));
    (data ?? []).forEach((p) => fubToCrm.set(Number(p.fub_legacy_id), p.id));
  }

  // 3. Resolve related person → our crm id by email/phone (targeted lookups).
  const emails = [...new Set(rels.flatMap((r) => (r.emails ?? []).map((e) => lc(e.value)).filter(Boolean)))];
  const phones = [...new Set(rels.flatMap((r) => (r.phones ?? []).map((p) => normPhone(p.normalized ?? p.value)).filter(Boolean)))];
  const emailToCrm = new Map();
  const phoneToCrm = new Map();
  for (let i = 0; i < emails.length; i += 300) {
    const { data } = await sb.from('crm_contact_points').select('person_id,value,kind').in('value', emails.slice(i, i + 300));
    (data ?? []).forEach((c) => { const k = lc(c.value); if (k && !emailToCrm.has(k)) emailToCrm.set(k, c.person_id); });
  }
  // Phones in contact_points may be formatted; pull the candidate rows and normalize in JS.
  const { data: allPhonePts } = await sb.from('crm_contact_points').select('person_id,value').eq('kind', 'phone').limit(100000);
  (allPhonePts ?? []).forEach((c) => { const k = normPhone(c.value); if (k && !phoneToCrm.has(k)) phoneToCrm.set(k, c.person_id); });

  // 4. Build rows.
  let matchedPerson = 0, linkedRelated = 0, skipped = 0;
  const rows = [];
  for (const r of rels) {
    const personId = fubToCrm.get(Number(r.personId)) ?? null;
    if (!personId) { skipped++; continue; }
    matchedPerson++;
    let related = null;
    for (const e of r.emails ?? []) { const k = lc(e.value); if (k && emailToCrm.has(k)) { related = emailToCrm.get(k); break; } }
    if (!related) for (const p of r.phones ?? []) { const k = normPhone(p.normalized ?? p.value); if (k && phoneToCrm.has(k)) { related = phoneToCrm.get(k); break; } }
    if (related && related !== personId) linkedRelated++; else related = related === personId ? null : related;
    rows.push({ person_id: personId, related_person_id: related, related_name: r.name ?? null, kind: mapType(r.type), fub_legacy_id: r.id });
  }
  console.log(`mapped: ${rows.length} | person matched: ${matchedPerson} | related linked to a contact: ${linkedRelated} | skipped (no person match): ${skipped}`);

  if (!WRITE) { console.log('DRY RUN — pass --write to upsert.'); return; }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('crm_relationships').upsert(rows.slice(i, i + 200), { onConflict: 'fub_legacy_id' });
    if (error) throw new Error('upsert: ' + error.message);
  }
  console.log(`upserted ${rows.length} relationships.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
