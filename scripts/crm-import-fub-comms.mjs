#!/usr/bin/env node
// FUB comms backfill: per-person text messages + emails → crm_timeline.
//
// FUB only exposes these collections per-person (?personId=), so this walks all
// 18K people. Bodies/subjects arrive REDACTED until the account unlocks content
// for the API (registered X-System-Key + owner email-sharing setting). Rows
// upsert on dedupe_key WITHOUT ignoreDuplicates, so re-running after the unlock
// overwrites the placeholders with real content in place.
//
//   node scripts/crm-import-fub-comms.mjs            # full run
//   node scripts/crm-import-fub-comms.mjs --limit=50 # first N people (smoke)

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const PERSON_LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity;

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64');
const HEADERS = { Authorization: AUTH, 'X-System': 'RyanRealtyPlatform', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fub(pathq) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://api.followupboss.com/v1' + pathq, { headers: HEADERS });
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`FUB ${res.status} on ${pathq}`);
    return res.json();
  }
  throw new Error('rate-limit retries exhausted: ' + pathq);
}

const BROKER_BY_FUB_USER = { 1: 'matt', 2: 'rebecca', 3: 'paul' };
const TEXT_HIDDEN = '* Body is hidden for privacy reasons *';
const EMAIL_HIDDEN = '[CONTENT HIDDEN]';

const clean = (v, hiddenMarker) => {
  if (v === null || v === undefined) return { value: null, hidden: false };
  const s = String(v);
  if (s.trim() === hiddenMarker) return { value: null, hidden: true };
  return { value: s, hidden: false };
};

function mapText(t, personId) {
  const body = clean(t.message, TEXT_HIDDEN);
  return {
    person_id: personId,
    ts: t.sent ?? t.created ?? new Date().toISOString(),
    kind: t.isIncoming ? 'sms_in' : 'sms_out',
    title: null,
    body: body.value,
    payload: {
      fromNumber: t.fromNumber ?? null,
      toNumber: t.toNumber ?? null,
      status: t.status ?? null,
      fubUserId: t.userId ?? null,
      contentHidden: body.hidden,
    },
    broker: BROKER_BY_FUB_USER[t.userId] ?? null,
    source: 'fub-import',
    fub_legacy_id: t.id,
    dedupe_key: `fub:text:${t.id}:p${personId}`,
  };
}

function mapEmail(e, personId, fubPersonId) {
  const subject = clean(e.subject, EMAIL_HIDDEN);
  const excerpt = clean(e.bodyExcerpt ?? e.body, EMAIL_HIDDEN);
  const rel = (e.relatedPeople ?? []).find((r) => r.personId === fubPersonId);
  const incoming = rel?.sentByPerson === true;
  return {
    person_id: personId,
    ts: e.date ?? e.created ?? new Date().toISOString(),
    kind: incoming ? 'email_in' : 'email_out',
    title: subject.value,
    body: excerpt.value,
    payload: {
      threadId: e.threadId ?? null,
      status: e.status ?? null,
      bounced: !!e.bounced,
      hasAttachments: !!e.hasAttachments,
      emailTemplateId: e.emailTemplateId ?? null,
      fubUserId: e.userId ?? null,
      contentHidden: subject.hidden || excerpt.hidden,
    },
    broker: BROKER_BY_FUB_USER[e.userId] ?? null,
    source: 'fub-import',
    fub_legacy_id: e.id,
    dedupe_key: `fub:email:${e.id}:p${personId}`,
  };
}

async function fetchAllFor(personId, fubId) {
  const rows = [];
  let texts = 0, emails = 0, hidden = 0;
  // texts
  let next = null;
  do {
    const data = await fub(`/textMessages?personId=${fubId}&limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    for (const t of data.textmessages ?? []) {
      const row = mapText(t, personId);
      if (row.payload.contentHidden) hidden++;
      rows.push(row); texts++;
    }
    next = (data.textmessages ?? []).length ? data._metadata?.next ?? null : null;
  } while (next);
  // emails
  next = null;
  do {
    const data = await fub(`/emails?personId=${fubId}&limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    for (const e of data.emails ?? []) {
      const row = mapEmail(e, personId, fubId);
      if (row.payload.contentHidden) hidden++;
      rows.push(row); emails++;
    }
    next = (data.emails ?? []).length ? data._metadata?.next ?? null : null;
  } while (next);
  return { rows, texts, emails, hidden };
}

async function flush(buffer) {
  if (!buffer.length) return;
  // in-batch dedupe (cursor-boundary overlaps)
  const seen = new Map();
  for (const row of buffer) seen.set(row.dedupe_key, row);
  buffer = [...seen.values()];
  // overwrite mode: re-runs replace hidden placeholders with real content
  const { error } = await sb.from('crm_timeline').upsert(buffer, { onConflict: 'dedupe_key' });
  if (error) throw new Error('timeline upsert: ' + error.message);
}

(async () => {
  const { data: importRow } = await sb.from('crm_imports').insert({ source: 'fub-comms', status: 'running' }).select('id').single();
  const counts = { people: 0, texts: 0, emails: 0, hidden: 0 };
  let buffer = [];
  try {
    let from = 0;
    outer: for (;;) {
      const { data: people, error } = await sb
        .from('crm_people')
        .select('id,fub_legacy_id')
        .not('fub_legacy_id', 'is', null)
        .order('id')
        .range(from, from + 999);
      if (error) throw new Error('people page: ' + error.message);
      if (!people.length) break;

      // small concurrency, polite pace (2 endpoints per person)
      const POOL = 5;
      for (let i = 0; i < people.length; i += POOL) {
        const batch = people.slice(i, i + POOL);
        const results = await Promise.all(batch.map((p) =>
          fetchAllFor(p.id, p.fub_legacy_id).catch((e) => {
            console.warn('person', p.fub_legacy_id, 'failed:', e.message);
            return { rows: [], texts: 0, emails: 0, hidden: 0 };
          })
        ));
        for (const r of results) {
          buffer.push(...r.rows);
          counts.texts += r.texts; counts.emails += r.emails; counts.hidden += r.hidden;
        }
        counts.people += batch.length;
        if (buffer.length >= 400) { await flush(buffer); buffer = []; }
        if (counts.people % 500 === 0) {
          console.log(`people ${counts.people} · texts ${counts.texts} · emails ${counts.emails}`);
          await sb.from('crm_imports').update({ counts }).eq('id', importRow.id);
        }
        if (counts.people >= PERSON_LIMIT) break outer;
        await sleep(60);
      }
      from += 1000;
    }
    await flush(buffer);
    await sb.from('crm_imports').update({ finished_at: new Date().toISOString(), status: 'done', counts }).eq('id', importRow.id);
    console.log('\nCOMMS IMPORT COMPLETE', JSON.stringify(counts));
  } catch (e) {
    await flush(buffer).catch(() => {});
    await sb.from('crm_imports').update({ finished_at: new Date().toISOString(), status: 'failed', counts, notes: String(e.message).slice(0, 500) }).eq('id', importRow.id);
    console.error('\nCOMMS IMPORT FAILED:', e.message);
    process.exit(1);
  }
})();
