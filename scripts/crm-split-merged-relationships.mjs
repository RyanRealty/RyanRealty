#!/usr/bin/env node
/**
 * crm-split-merged-relationships.mjs
 *
 * FUB merges a spouse/relationship's phone + email INTO the primary contact's
 * own phones/emails arrays, and imports the relationship as an unlinked row
 * (crm_relationships.related_person_id = NULL, just a related_name). Result: on
 * a contact like Ernie Oster, his wife Deb's number + email look like Ernie's,
 * and she can't be picked as a distinct group-text recipient.
 *
 * This splits the merge cleanly, per the FUB "Export all columns" relationship
 * data (Relationship N First/Last/Type/Phone 1/Email 1):
 *   1. If the relationship's phone/email overlaps the primary's arrays (the
 *      merge artifact), find/create the related person as their OWN contact
 *      (crm_people + crm_contact_points).
 *   2. Link them: set the existing unlinked relationship row's related_person_id
 *      and add the reciprocal row (both directions), matching linkContacts().
 *   3. Remove the related person's phone/email from the PRIMARY contact's arrays
 *      so each record shows only its own info.
 *
 * The composer already renders each linked person as a separate "Deb Oster ·
 * Spouse" recipient chip once related_person_id is set — this makes that work.
 *
 * Usage:
 *   node scripts/crm-split-merged-relationships.mjs                 # DRY-RUN all
 *   node scripts/crm-split-merged-relationships.mjs --only 21807    # one FUB id
 *   node scripts/crm-split-merged-relationships.mjs --only 21807 --apply
 *   node scripts/crm-split-merged-relationships.mjs --apply          # all (backup first)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = '/Users/matthewryan/RyanRealty';
const CSV = '/Users/matthewryan/Downloads/all-people-2026-07-14.csv';
const APPLY = process.argv.includes('--apply');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? Number(process.argv[onlyIdx + 1]) : null;

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ten = (s) => (String(s || '').replace(/\D/g, '').slice(-10) || null);
const RECIP = { spouse: 'spouse', partner: 'partner', sibling: 'sibling', 'co-buyer': 'co-buyer', friend: 'friend', parent: 'child', child: 'parent' };
const recipKind = (k) => RECIP[String(k || '').toLowerCase()] ?? 'related';

// ── CSV ───────────────────────────────────────────────────────────────────────
function parseCsv(str) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < str.length; i++) { const c = str[i];
    if (q) { if (c === '"') { if (str[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; }
  if (f.length || row.length) { row.push(f); rows.push(row); } return rows;
}
const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const H = rows[0];
const col = (n) => H.indexOf(n);
const cID = col('ID');
const relSlots = [1, 2].map((n) => ({
  fn: col(`Relationship ${n} First Name`), ln: col(`Relationship ${n} Last Name`), ty: col(`Relationship ${n} Type`),
  ph: col(`Relationship ${n} Phone 1`), em: col(`Relationship ${n} Email 1`),
})).filter((s) => s.fn >= 0);

// build fub id -> relationships[]
const relsByFub = new Map();
for (let r = 1; r < rows.length; r++) {
  const fub = Number(rows[r][cID]); if (!fub) continue;
  const list = [];
  for (const s of relSlots) {
    const fn = (rows[r][s.fn] || '').trim(), ln = (rows[r][s.ln] || '').trim();
    if (!fn && !ln) continue;
    list.push({ first: fn, last: ln, type: (rows[r][s.ty] || '').trim() || 'related', phone: (rows[r][s.ph] || '').trim(), email: (rows[r][s.em] || '').trim() });
  }
  if (list.length) relsByFub.set(fub, list);
}

// ── run ─────────────────────────────────────────────────────────────────────
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const actions = [];   // planned actions for report/backup
let created = 0, linked = 0, cleaned = 0, skipped = 0;

// Find a DIFFERENT existing contact that owns this phone/email. Excludes the
// primary itself — the merged phone is registered as a contact_point under the
// PRIMARY, so a naive match returns the primary (a self-link bug).
async function findExistingContact(phone10, email, excludeId) {
  if (phone10) {
    const { data } = await sb.from('crm_contact_points').select('person_id').eq('kind', 'phone').eq('value', phone10);
    const hit = (data || []).map((d) => d.person_id).find((id) => id !== excludeId);
    if (hit) return hit;
  }
  if (email) {
    const { data } = await sb.from('crm_people').select('id').neq('id', excludeId).contains('emails', JSON.stringify([{ value: email }])).limit(1);
    if (data?.[0]) return data[0].id;
  }
  return null;
}

const targets = ONLY ? [ONLY] : [...relsByFub.keys()];
for (const fub of targets) {
  const rels = relsByFub.get(fub);
  if (!rels) { if (ONLY) console.log(`fub ${fub}: no relationships in export`); continue; }
  const { data: pe } = await sb.from('crm_people').select('id, name, assigned_broker, phones, emails').eq('fub_legacy_id', fub).limit(1);
  const person = pe?.[0]; if (!person) { continue; }
  const mainId = person.id;
  const mainPhones = Array.isArray(person.phones) ? person.phones : [];
  const mainEmails = Array.isArray(person.emails) ? person.emails : [];

  const { data: relRows } = await sb.from('crm_relationships').select('id, related_person_id, related_name, kind').eq('person_id', mainId);

  for (const rel of rels) {
    const relName = `${rel.first} ${rel.last}`.trim();
    const relPhone10 = ten(rel.phone);
    const relEmail = rel.email.toLowerCase();
    // Skip FUB's own system "contacts" imported as relationships (their Sales /
    // Support desk), not real people.
    const FUB_SUPPORT = new Set(['8558889769', '8556225311']);
    if (relEmail.endsWith('@followupboss.com') || (relPhone10 && FUB_SUPPORT.has(relPhone10))) { continue; }
    // overlap: is the relationship's phone/email actually sitting on the primary record?
    const phoneOnMain = relPhone10 && mainPhones.some((p) => ten(p.value) === relPhone10);
    const emailOnMain = relEmail && mainEmails.some((e) => String(e.value || '').toLowerCase() === relEmail);
    if (!phoneOnMain && !emailOnMain) { continue; } // nothing merged in — leave it

    // the existing unlinked relationship row for this related person
    const row = (relRows || []).find((r) => r.related_person_id === null && String(r.related_name || '').trim().toLowerCase() === relName.toLowerCase());
    if (!row) { skipped++; continue; }

    // find or create the related contact (never the primary itself)
    let relatedId = await findExistingContact(relPhone10, relEmail, mainId);
    const plan = { mainId, mainName: person.name, relName, relPhone: rel.phone, relEmail, relType: rel.type, relRowId: row.id, willCreate: !relatedId };
    if (!relatedId) {
      const personRow = {
        name: relName, first_name: rel.first || null, last_name: rel.last || null, stage: 'Nurture',
        source: 'fub-relationship-split', assigned_broker: person.assigned_broker || 'matt',
        phones: relPhone10 ? [{ value: rel.phone, type: (rel.phone && 'Mobile') || 'Mobile', isPrimary: 1 }] : [],
        emails: relEmail ? [{ value: rel.email, type: 'home', isPrimary: 1 }] : [],
        tags: ['source:fub-relationship-split', `relationship:${String(rel.type).toLowerCase()}`],
      };
      if (APPLY) {
        const { data: ins, error } = await sb.from('crm_people').insert(personRow).select('id').single();
        if (error) { console.warn(`  ! create ${relName}: ${error.message}`); continue; }
        relatedId = ins.id;
        if (relPhone10) {
          // reroute the merged number: it is currently a contact_point under the
          // PRIMARY, so drop that and key it to the related person instead.
          await sb.from('crm_contact_points').delete().eq('kind', 'phone').eq('value', relPhone10).eq('person_id', mainId);
          await sb.from('crm_contact_points').insert({ person_id: relatedId, kind: 'phone', value: relPhone10, is_primary: true });
        }
      }
      created++;
    }
    plan.relatedId = relatedId ?? '(dry)';

    if (APPLY && relatedId) {
      await sb.from('crm_relationships').update({ related_person_id: relatedId }).eq('id', row.id);
      // reciprocal (skip if already present)
      const { data: back } = await sb.from('crm_relationships').select('id').eq('person_id', relatedId).eq('related_person_id', mainId).limit(1);
      if (!back?.[0]) await sb.from('crm_relationships').insert({ person_id: relatedId, related_person_id: mainId, related_name: person.name, kind: recipKind(rel.type) });
      // strip the related person's phone/email off the primary
      const newPhones = mainPhones.filter((p) => !(relPhone10 && ten(p.value) === relPhone10));
      const newEmails = mainEmails.filter((e) => !(relEmail && String(e.value || '').toLowerCase() === relEmail));
      await sb.from('crm_people').update({ phones: newPhones, emails: newEmails }).eq('id', mainId);
    }
    linked++; if (phoneOnMain || emailOnMain) cleaned++;
    actions.push(plan);
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} | contacts scanned: ${targets.length}`);
console.log(`related contacts created: ${created} | relationships linked: ${linked} | primaries cleaned: ${cleaned} | skipped(no rel row): ${skipped}`);
actions.slice(0, 10).forEach((a) => console.log(`  • ${a.mainName} (#${a.mainId}) → split "${a.relName}" (${a.relType}) ${a.relPhone} ${a.relEmail} ${a.willCreate ? '[create]' : `[link #${a.relatedId}]`}`));
if (APPLY) { fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out', `crm-split-relationships-${runId}.json`), JSON.stringify(actions, null, 2)); }
