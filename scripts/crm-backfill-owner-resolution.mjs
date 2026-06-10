#!/usr/bin/env node
// Backfill owner resolution for every "Owner of X" placeholder lead
// (Matt directive 2026-06-09). County records name them, BatchData finds
// their phones/emails, compliance flags land as tags, FUB + CRM both update.
//
//   node scripts/crm-backfill-owner-resolution.mjs --limit=3   # smoke
//   node scripts/crm-backfill-owner-resolution.mjs             # full run

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity;

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const { resolveOwnerContact } = await import('../lib/owner-resolution.mjs');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const FUB_AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64');
const FUB_HEADERS = { Authorization: FUB_AUTH, 'X-System': 'RyanRealtyPlatform', 'X-System-Key': env.FOLLOWUPBOSS_SYSTEM_KEY ?? '', 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull the property address out of custom fields or the placeholder name.
function addressOf(person) {
  const custom = person.custom ?? {};
  const addr = custom.customSellerPropertyAddress ?? custom.customPropertyAddress ?? null;
  if (addr) {
    // "19815 Nugget Ave, Bend, OR 97702" → street + city + zip
    const m = String(addr).match(/^([^,]+),\s*([^,]+?)(?:,\s*OR)?\s*(\d{5})?$/i);
    if (m) return { street: m[1].trim(), city: m[2].trim().replace(/,?\s*OR$/i, ''), zip: m[3] ?? undefined };
    return { street: String(addr), city: 'Bend', zip: undefined };
  }
  // "Owner of 19815 Nugget Ave (Bend)" name pattern
  const nm = String(person.name ?? '').match(/^Owner of\s+(.+?)(?:\s*\(([^)]+)\))?$/i);
  if (nm) return { street: nm[1].trim(), city: (nm[2] ?? 'Bend').trim(), zip: undefined };
  return null;
}

const counts = { scanned: 0, resolved: 0, named: 0, contactAdded: 0, compliance: 0, noCounty: 0, noAddress: 0, fubUpdated: 0, errors: 0 };

const { data: people, error } = await sb
  .from('crm_people')
  .select('id,fub_legacy_id,name,emails,phones,tags,custom')
  .ilike('name', 'owner of %')
  .order('id', { ascending: false })
  .limit(2000);
if (error) { console.error(error.message); process.exit(1); }
console.log(`placeholder leads found: ${people.length}${Number.isFinite(LIMIT) ? ` (processing first ${LIMIT})` : ''}`);

for (const p of people.slice(0, Number.isFinite(LIMIT) ? LIMIT : people.length)) {
  counts.scanned++;
  const addr = addressOf(p);
  if (!addr) { counts.noAddress++; continue; }
  try {
    const r = await resolveOwnerContact(addr.street, addr.city, addr.zip);
    if (!r) { counts.noCounty++; console.log(`  ✗ ${addr.street}: no county match`); continue; }
    counts.resolved++;
    const c = r.county;
    const fullName = c.isEntity ? c.ownerRaw : [c.firstName, c.lastName].filter(Boolean).join(' ') || c.ownerRaw;

    // merge contact points
    const emails = [...(p.emails ?? [])];
    const phones = [...(p.phones ?? [])];
    const hasRealEmail = emails.some((e) => e.value && !String(e.value).includes('placeholder.ryan-realty.com') && !String(e.value).includes('@unknown'));
    if (r.bestEmail && !emails.some((e) => String(e.value).toLowerCase() === r.bestEmail.toLowerCase())) {
      if (hasRealEmail) emails.push({ value: r.bestEmail, type: 'home' });
      else emails.unshift({ value: r.bestEmail, type: 'home', isPrimary: 1 });
      counts.contactAdded++;
    }
    if (r.bestPhone && !phones.some((ph) => String(ph.value).replace(/\D/g, '').slice(-10) === r.bestPhone.replace(/\D/g, '').slice(-10))) {
      phones.push({ value: r.bestPhone, type: 'mobile' });
    }

    const newTags = [...new Set([
      ...(p.tags ?? []),
      'owner-lookup:resolved',
      ...(c.absentee ? ['owner:absentee'] : []),
      ...(c.outOfState ? ['geo:out-of-state'] : []),
      ...r.complianceTags,
    ])].filter((t) => t !== 'owner-lookup:pending');

    // FUB first (source of truth during parallel run), then CRM mirror fields
    if (p.fub_legacy_id) {
      const firstName = c.isEntity ? fullName : (c.firstName ?? '');
      const lastName = c.isEntity ? '' : (c.lastName ?? '');
      const body = { firstName, lastName, emails, phones, tags: newTags };
      const res = await fetch(`https://api.followupboss.com/v1/people/${p.fub_legacy_id}`, {
        method: 'PUT', headers: FUB_HEADERS, body: JSON.stringify(body),
      });
      if (res.ok) counts.fubUpdated++;
      else console.warn(`  FUB update ${p.fub_legacy_id} → ${res.status}`);
      // resolution note for the record
      await fetch('https://api.followupboss.com/v1/notes', {
        method: 'POST', headers: FUB_HEADERS,
        body: JSON.stringify({ personId: p.fub_legacy_id, isHtml: false, body:
          `Owner resolved from Deschutes County records (taxlot ${c.taxlot ?? 'unknown'}): ${c.ownerRaw}. ` +
          `Mailing: ${[c.mailingStreet, c.mailingCity, c.mailingState].filter(Boolean).join(', ') || 'unknown'}. ` +
          `${c.absentee ? 'ABSENTEE owner. ' : ''}${c.outOfState ? 'OUT-OF-STATE. ' : ''}` +
          `Skip trace: ${r.trace ? `${r.trace.phones.length} phone(s), ${r.trace.emails.length} email(s)` : 'unavailable'}.` +
          `${r.complianceTags.length ? ` Compliance: ${r.complianceTags.join(', ')}.` : ''}`,
        }),
      }).catch(() => {});
      await sleep(150);
    }

    // CRM row
    await sb.from('crm_people').update({
      name: fullName,
      first_name: c.isEntity ? null : c.firstName,
      last_name: c.isEntity ? fullName : c.lastName,
      emails, phones, tags: newTags,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
    // refresh contact points
    await sb.from('crm_contact_points').delete().eq('person_id', p.id);
    const pts = [];
    for (const e of emails) { const v = String(e.value ?? '').trim().toLowerCase(); if (v && !v.includes('placeholder.')) pts.push({ person_id: p.id, kind: 'email', value: v, is_primary: !!e.isPrimary }); }
    for (const ph of phones) { const d = String(ph.value ?? '').replace(/\D/g, ''); const v = d.length >= 10 ? d.slice(-10) : d; if (v) pts.push({ person_id: p.id, kind: 'phone', value: v, is_primary: !!ph.isPrimary }); }
    if (pts.length) await sb.from('crm_contact_points').insert(pts);
    // suppression rows for hard flags
    if (r.complianceTags.includes('compliance:hard-stop')) {
      counts.compliance++;
      await sb.from('crm_suppressions').insert({ person_id: p.id, channel: 'all', reason: 'tcpa-hard-stop', source: 'owner-resolution' });
    }

    counts.named++;
    console.log(`  ✓ ${addr.street} → ${fullName}${c.absentee ? ' [absentee]' : ''}${c.outOfState ? ' [out-of-state]' : ''}${r.bestEmail ? ' +email' : ''}${r.bestPhone ? ' +phone' : ''}${r.complianceTags.length ? ' ⚠' + r.complianceTags.join(',') : ''}`);
  } catch (e) {
    counts.errors++;
    console.warn(`  ✗ ${addr.street}:`, e.message?.slice(0, 120));
  }
  await sleep(250);
}

console.log('\nBACKFILL RESULT', JSON.stringify(counts, null, 1));
