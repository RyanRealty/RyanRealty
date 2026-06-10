#!/usr/bin/env node
// Full FUB → crm_* import (Phase 0 of docs/CRM_REPLACEMENT_BLUEPRINT.md).
// Read-only against FUB; writes to the new crm_* tables only.
//
//   node scripts/crm-import-fub.mjs --smoke   # 25 people + matched notes/events, validate shape
//   node scripts/crm-import-fub.mjs --full    # everything: people, notes, events, calls, tasks,
//                                             # relationships, deals, templates, sequences,
//                                             # saved views, suppressions
//
// Idempotent: every row upserts on fub_legacy_id (or a dedupe_key for timeline rows).

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MODE = process.argv.includes('--smoke') ? 'smoke'
  : process.argv.includes('--full') ? 'full'
  : process.argv.includes('--rest') ? 'rest' // skip people/notes/events (already imported); run the tail collections
  : null;
if (!MODE) { console.error('usage: crm-import-fub.mjs --smoke | --full | --rest'); process.exit(1); }

// ── env ────────────────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const FUB_KEY = env.FOLLOWUPBOSS_API_KEY;
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!FUB_KEY || !SB_URL || !SB_SERVICE) { console.error('missing env: FOLLOWUPBOSS_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const FUB_AUTH = 'Basic ' + Buffer.from(FUB_KEY + ':').toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fub(pathq) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://api.followupboss.com/v1' + pathq, {
      headers: { Authorization: FUB_AUTH, 'X-System': 'RyanRealtyPlatform', Accept: 'application/json' },
    });
    if (res.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`FUB ${res.status} on ${pathq}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error('FUB rate-limit retries exhausted: ' + pathq);
}

// Cursor-paginate a FUB collection via _metadata.next tokens.
async function* fubPages(basePath, collectionKey, { maxPages = Infinity, limit = 100 } = {}) {
  const sep = basePath.includes('?') ? '&' : '?';
  let next = null;
  let page = 0;
  while (page < maxPages) {
    const url = `${basePath}${sep}limit=${limit}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
    const data = await fub(url);
    const items = data[collectionKey] ?? [];
    if (!items.length) return;
    yield items;
    page++;
    next = data._metadata?.next ?? null;
    if (!next) return;
    await sleep(120);
  }
}

// ── mappers ────────────────────────────────────────────────────────────────
const BROKER_BY_FUB_USER = { 1: 'matt', 2: 'rebecca', 3: 'paul' };

function normalizePhone(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length >= 10) return d.slice(-10); // canonical US 10-digit match key
  return d || null;
}

function mapPerson(p) {
  const custom = {};
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('custom') && v !== null && v !== '' && v !== undefined) custom[k] = v;
  }
  return {
    fub_legacy_id: p.id,
    fub_created_at: p.created ?? null,
    fub_updated_at: p.updated ?? null,
    first_name: p.firstName ?? null,
    last_name: p.lastName ?? null,
    name: p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
    stage: p.stage || 'Lead',
    source: p.source ?? null,
    source_url: p.sourceUrl ?? null,
    assigned_broker: BROKER_BY_FUB_USER[p.assignedUserId] ?? null,
    assigned_fub_user_id: p.assignedUserId ?? null,
    emails: p.emails ?? [],
    phones: p.phones ?? [],
    addresses: p.addresses ?? [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    custom,
    background: p.background ?? null,
    price: typeof p.price === 'number' ? p.price : null,
    picture_url: p.picture?.small ?? null,
    last_activity_at: p.lastActivity ?? null,
    raw: p,
    updated_at: new Date().toISOString(),
  };
}

function contactPointsFor(personRowId, p) {
  const pts = [];
  for (const e of p.emails ?? []) {
    const v = String(e.value ?? '').trim().toLowerCase();
    if (v) pts.push({ person_id: personRowId, kind: 'email', value: v, label: e.type ?? null, is_primary: !!e.isPrimary });
  }
  for (const ph of p.phones ?? []) {
    const v = normalizePhone(ph.value);
    if (v) pts.push({ person_id: personRowId, kind: 'phone', value: v, label: ph.type ?? null, is_primary: !!ph.isPrimary });
  }
  return pts;
}

// ── import steps ───────────────────────────────────────────────────────────
const counts = {};

async function importPeople() {
  let total = 0;
  const maxPages = MODE === 'smoke' ? 1 : Infinity;
  const limit = MODE === 'smoke' ? 25 : 100;
  for await (const items of fubPages('/people?fields=allFields&sort=created', 'people', { maxPages, limit })) {
    const rows = items.map(mapPerson);
    const { data, error } = await sb.from('crm_people').upsert(rows, { onConflict: 'fub_legacy_id' }).select('id,fub_legacy_id');
    if (error) throw new Error('people upsert: ' + error.message);
    const idByFub = new Map(data.map((r) => [r.fub_legacy_id, r.id]));
    const pts = [];
    for (const p of items) {
      const rowId = idByFub.get(p.id);
      if (rowId) pts.push(...contactPointsFor(rowId, p));
    }
    const personIds = [...idByFub.values()];
    if (personIds.length) {
      const del = await sb.from('crm_contact_points').delete().in('person_id', personIds);
      if (del.error) throw new Error('contact_points delete: ' + del.error.message);
    }
    if (pts.length) {
      const ins = await sb.from('crm_contact_points').insert(pts);
      if (ins.error) throw new Error('contact_points insert: ' + ins.error.message);
    }
    total += items.length;
    if (total % 1000 < limit) console.log(`  people: ${total}`);
  }
  counts.people = total;
  console.log(`people done: ${total}`);
}

let FUB_TO_CRM = new Map();
async function buildPersonMap() {
  FUB_TO_CRM = new Map();
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('crm_people').select('id,fub_legacy_id').range(from, from + 999);
    if (error) throw new Error('person map: ' + error.message);
    for (const r of data) if (r.fub_legacy_id) FUB_TO_CRM.set(r.fub_legacy_id, r.id);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`person map: ${FUB_TO_CRM.size}`);
}

async function upsertTimeline(rows) {
  if (!rows.length) return;
  const { error } = await sb.from('crm_timeline').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) throw new Error('timeline upsert: ' + error.message);
}

async function importNotes() {
  let total = 0, skipped = 0;
  const maxPages = MODE === 'smoke' ? 2 : Infinity;
  for await (const items of fubPages('/notes', 'notes', { maxPages })) {
    const rows = [];
    for (const n of items) {
      const personId = FUB_TO_CRM.get(n.personId);
      if (!personId) { skipped++; continue; }
      rows.push({
        person_id: personId, ts: n.created ?? new Date().toISOString(), kind: 'note',
        title: n.subject ?? null, body: n.body ?? null,
        payload: { isHtml: !!n.isHtml, createdBy: n.createdBy ?? n.createdById ?? null },
        source: 'fub-import', fub_legacy_id: n.id, dedupe_key: `fub:note:${n.id}`,
      });
    }
    await upsertTimeline(rows);
    total += rows.length;
    if (total % 2000 < 100) console.log(`  notes: ${total}`);
  }
  counts.notes = total; counts.notes_skipped = skipped;
  console.log(`notes done: ${total} (skipped ${skipped} without person match)`);
}

async function importEvents() {
  let total = 0, skipped = 0;
  const maxPages = MODE === 'smoke' ? 2 : Infinity;
  for await (const items of fubPages('/events', 'events', { maxPages })) {
    const rows = [];
    for (const e of items) {
      const personId = FUB_TO_CRM.get(e.personId ?? e.person?.id);
      if (!personId) { skipped++; continue; }
      rows.push({
        person_id: personId, ts: e.created ?? new Date().toISOString(), kind: 'web_event',
        title: [e.type, e.source].filter(Boolean).join(' · ') || 'Event',
        body: e.message ?? e.description ?? null,
        payload: { type: e.type ?? null, source: e.source ?? null, property: e.property ?? null, campaign: e.campaign ?? null },
        source: 'fub-import', fub_legacy_id: e.id, dedupe_key: `fub:event:${e.id}`,
      });
    }
    await upsertTimeline(rows);
    total += rows.length;
    if (total % 2000 < 100) console.log(`  events: ${total}`);
  }
  counts.events = total; counts.events_skipped = skipped;
  console.log(`events done: ${total} (skipped ${skipped})`);
}

async function importCalls() {
  let total = 0;
  for await (const items of fubPages('/calls', 'calls')) {
    const rows = [];
    for (const c of items) {
      const personId = FUB_TO_CRM.get(c.personId);
      if (!personId) continue;
      rows.push({
        person_id: personId, ts: c.created ?? new Date().toISOString(), kind: 'call',
        title: c.outcome ? `Call · ${c.outcome}` : 'Call',
        body: c.note ?? null,
        payload: { duration: c.duration ?? null, isIncoming: c.isIncoming ?? null, phone: c.phone ?? null, userId: c.userId ?? null },
        broker: BROKER_BY_FUB_USER[c.userId] ?? null,
        source: 'fub-import', fub_legacy_id: c.id, dedupe_key: `fub:call:${c.id}`,
      });
    }
    await upsertTimeline(rows);
    total += rows.length;
  }
  counts.calls = total;
  console.log(`calls done: ${total}`);
}

async function importTasks() {
  let total = 0;
  for await (const items of fubPages('/tasks', 'tasks')) {
    const rows = items.map((t) => ({
      person_id: FUB_TO_CRM.get(t.personId) ?? null,
      name: t.name ?? 'Task', type: t.type ?? null,
      // dueDateTime (when present) is a full ISO timestamp; dueDate is date-only
      due_at: t.dueDateTime ? t.dueDateTime : t.dueDate ? `${t.dueDate}T17:00:00Z` : null,
      completed_at: t.isCompleted ? (t.updated ?? new Date().toISOString()) : null,
      assigned_broker: BROKER_BY_FUB_USER[t.assignedUserId ?? t.userId] ?? null,
      origin: 'fub-import', fub_legacy_id: t.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from('crm_tasks').upsert(rows, { onConflict: 'fub_legacy_id' });
    if (error) throw new Error('tasks upsert: ' + error.message);
    total += rows.length;
  }
  counts.tasks = total;
  console.log(`tasks done: ${total}`);
}

async function importRelationships() {
  let total = 0;
  try {
    for await (const items of fubPages('/peopleRelationships', 'peoplerelationships')) {
      const rows = items.map((r) => ({
        person_id: FUB_TO_CRM.get(r.personId) ?? null,
        related_person_id: FUB_TO_CRM.get(r.relatedPersonId) ?? null,
        related_name: r.name ?? null, kind: r.type ?? null, fub_legacy_id: r.id,
      })).filter((r) => r.person_id);
      if (rows.length) {
        const { error } = await sb.from('crm_relationships').upsert(rows, { onConflict: 'fub_legacy_id' });
        if (error) throw new Error('relationships upsert: ' + error.message);
      }
      total += rows.length;
    }
  } catch (e) {
    // collection key casing differs across accounts; non-fatal
    console.warn('relationships import warning:', e.message);
  }
  counts.relationships = total;
  console.log(`relationships done: ${total}`);
}

async function importDeals() {
  const pipelines = await fub('/pipelines?limit=100');
  const pipeName = new Map((pipelines.pipelines ?? []).map((p) => [p.id, p.name]));
  let total = 0;
  for await (const items of fubPages('/deals', 'deals')) {
    const rows = items.map((d) => {
      const fubPersonId = d.people?.[0]?.id ?? d.personId ?? null;
      return {
        person_id: fubPersonId ? FUB_TO_CRM.get(fubPersonId) ?? null : null,
        name: d.name ?? null,
        pipeline: pipeName.get(d.pipelineId) ?? String(d.pipelineId ?? ''),
        stage: d.stageName ?? null, // NOTE: stage truth lives in stageName+enteredStageAt; d.status is always 'Active'
        entered_stage_at: d.enteredStageAt ?? null,
        value: typeof d.price === 'number' ? d.price : null,
        status: d.status ?? null,
        fub_legacy_id: d.id, raw: d, updated_at: new Date().toISOString(),
      };
    });
    const { error } = await sb.from('crm_deals').upsert(rows, { onConflict: 'fub_legacy_id' });
    if (error) throw new Error('deals upsert: ' + error.message);
    total += rows.length;
  }
  counts.deals = total;
  console.log(`deals done: ${total}`);
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function importTemplates() {
  let total = 0;
  for await (const items of fubPages('/templates', 'templates')) {
    const rows = items.map((t) => ({
      key: `email-${slug(t.name)}-${t.id}`, channel: 'email', name: t.name ?? `Template ${t.id}`,
      subject: t.subject ?? null, body: t.body ?? '', fub_legacy_id: t.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from('crm_templates').upsert(rows, { onConflict: 'key' });
    if (error) throw new Error('email templates upsert: ' + error.message);
    total += rows.length;
  }
  for await (const items of fubPages('/textMessageTemplates', 'textmessagetemplates')) {
    const rows = items.map((t) => ({
      key: `sms-${slug(t.name)}-${t.id}`, channel: 'sms', name: t.name ?? `SMS ${t.id}`,
      subject: null, body: t.message ?? t.body ?? '', fub_legacy_id: t.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from('crm_templates').upsert(rows, { onConflict: 'key' });
    if (error) throw new Error('sms templates upsert: ' + error.message);
    total += rows.length;
  }
  counts.templates = total;
  console.log(`templates done: ${total}`);
}

const LIVE_PLAN_IDS = [69, 70, 71, 72, 73, 74, 75];
async function importSequences() {
  let total = 0;
  for (const id of LIVE_PLAN_IDS) {
    const data = await fub(`/actionPlans/${id}`);
    const plan = data.actionplans?.[0] ?? data;
    if (!plan?.name) continue;
    const row = {
      name: plan.name, status: 'paused', description: `Ported from FUB action plan ${id}`,
      stop_on_reply: plan.stopOnContacted ?? true,
      steps: plan.steps ?? [], fub_legacy_plan_id: id, updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('crm_sequences').upsert(row, { onConflict: 'fub_legacy_plan_id' });
    if (error) throw new Error('sequences upsert: ' + error.message);
    total++;
    await sleep(120);
  }
  counts.sequences = total;
  console.log(`sequences done: ${total}`);
}

const SAVED_VIEWS = [
  { name: 'Leads', filter: { stage: 'Lead' }, position: 1 },
  { name: 'Hot Prospects', filter: { tagsAny: ['seller:hot', 'buyer:hot'] }, position: 2 },
  { name: 'Nurture', filter: { tagsAny: ['seller:nurture', 'buyer:nurture', 'seller:long-nurture', 'buyer:long-nurture'] }, position: 3 },
  { name: 'Buyers', filter: { tagsAny: ['audience:buyer'] }, position: 4 },
  { name: 'Sellers', filter: { tagsAny: ['audience:seller'] }, position: 5 },
  { name: 'Seller Prospects', filter: { stage: 'Seller Prospect' }, position: 6 },
  { name: 'Active Clients', filter: { stage: 'Active Client' }, position: 7 },
  { name: 'Past Clients', filter: { stage: 'Past Client' }, position: 8 },
  { name: 'Realtors', filter: { stage: 'Real Estate Agent' }, position: 9 },
  { name: 'Compliance Blocked', filter: { tagsAny: ['compliance:hard-stop'] }, position: 10, description: 'Hard-stopped contacts. Never market to this list.' },
  { name: 'Expired Pipeline', filter: { tagsAny: ['intent:expired-listing'] }, position: 11 },
  { name: 'FSBO Pipeline', filter: { tagsAny: ['intent:fsbo'] }, position: 12 },
];
async function seedSavedViews() {
  const { count, error } = await sb.from('crm_saved_views').select('id', { count: 'exact', head: true });
  if (error) throw new Error('saved views count: ' + error.message);
  if ((count ?? 0) > 0) { console.log('saved views already seeded'); return; }
  const { error: insErr } = await sb.from('crm_saved_views').insert(SAVED_VIEWS.map((v) => ({ ...v, shared: true })));
  if (insErr) throw new Error('saved views insert: ' + insErr.message);
  counts.saved_views = SAVED_VIEWS.length;
  console.log(`saved views seeded: ${SAVED_VIEWS.length}`);
}

const SUPPRESSION_RULES = [
  { tag: 'compliance:hard-stop', channel: 'all', reason: 'tcpa-hard-stop' },
  { tag: 'contact:do-not-call', channel: 'call', reason: 'do-not-call' },
  { tag: 'contact:do-not-text', channel: 'sms', reason: 'do-not-text' },
  { tag: 'do_not_email', channel: 'email', reason: 'do-not-email' },
  { tag: 'unsubscribed', channel: 'email', reason: 'unsubscribed' },
  { tag: 'bounced', channel: 'email', reason: 'bounce' },
  { tag: 'complained', channel: 'email', reason: 'complaint' },
];
async function seedSuppressions() {
  // rebuild import-sourced suppressions from current tags (idempotent)
  const del = await sb.from('crm_suppressions').delete().eq('source', 'import');
  if (del.error) throw new Error('suppressions clear: ' + del.error.message);
  let total = 0;
  for (const rule of SUPPRESSION_RULES) {
    let from = 0;
    for (;;) {
      const { data, error } = await sb.from('crm_people').select('id').contains('tags', [rule.tag]).range(from, from + 999);
      if (error) throw new Error('suppression scan: ' + error.message);
      if (!data.length) break;
      const rows = data.map((r) => ({ person_id: r.id, channel: rule.channel, value: null, reason: rule.reason, source: 'import' }));
      const ins = await sb.from('crm_suppressions').insert(rows);
      if (ins.error) throw new Error('suppression insert: ' + ins.error.message);
      total += rows.length;
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  counts.suppressions = total;
  console.log(`suppressions seeded: ${total}`);
}

// ── main ───────────────────────────────────────────────────────────────────
const startedAt = new Date().toISOString();
const { data: importRow, error: impErr } = await sb.from('crm_imports')
  .insert({ source: MODE === 'smoke' ? 'fub-smoke' : 'fub-full', status: 'running' })
  .select('id').single();
if (impErr) { console.error('crm_imports insert failed:', impErr.message); process.exit(1); }

try {
  if (MODE !== 'rest') {
    await importPeople();
  }
  await buildPersonMap();
  if (MODE !== 'rest') {
    await importNotes();
    await importEvents();
  }
  if (MODE === 'full' || MODE === 'rest') {
    await importCalls();
    await importTasks();
    await importRelationships();
    await importDeals();
    await importTemplates();
    await importSequences();
    await seedSavedViews();
    await seedSuppressions();
  }
  await sb.from('crm_imports').update({
    finished_at: new Date().toISOString(), status: 'done', counts,
    cursor: { people_synced_at: startedAt },
  }).eq('id', importRow.id);
  console.log('\nIMPORT COMPLETE', JSON.stringify(counts));
} catch (e) {
  await sb.from('crm_imports').update({ finished_at: new Date().toISOString(), status: 'failed', counts, notes: String(e.message).slice(0, 500) }).eq('id', importRow.id);
  console.error('\nIMPORT FAILED:', e.message);
  process.exit(1);
}
