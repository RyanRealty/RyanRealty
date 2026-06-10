#!/usr/bin/env node
// Normalize the 3 paused nurture sequences (FUB raw → engine schema), audit
// backlog 2026-06-10. Distinct from crm-normalize-sequences.mjs (the masters):
//
// FUB's runAfterDays is CUMULATIVE from enrollment (verified 2026-05-29 audit).
// Read that way, these three plans are misconfigured IN FUB — e.g. all 12
// "monthly" neighborhood emails land at day ~30, and the "quarterly" OOS
// emails at days 90/91/92. They never had a single enrollment in FUB, so the
// misconfiguration never surfaced. The template names (nhd january..december,
// sphere bimonthly, oos quarterly) make the authored INTENT unambiguous:
// relative gaps. So here delayDays = runAfterDays read as RELATIVE deltas.
//
// Sequences stay PAUSED. Activation is Matt's call — note that these are
// calendar-themed newsletters; enrollment-relative timing means "January"
// content can land in July. Revisit content or anchor dates before activating.
//
//   node scripts/crm-normalize-nurture-sequences.mjs          # dry run
//   node scripts/crm-normalize-nurture-sequences.mjs --live   # write

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const LIVE = process.argv.includes('--live');
const SEQ_IDS = [5, 6, 7];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: seqs, error: seqErr } = await sb.from('crm_sequences').select('id,name,status,steps').in('id', SEQ_IDS);
if (seqErr) throw new Error(seqErr.message);
const { data: tpls } = await sb.from('crm_templates').select('key,fub_legacy_id').not('fub_legacy_id', 'is', null);
const keyByFubId = new Map((tpls ?? []).map((t) => [t.fub_legacy_id, t.key]));

for (const s of seqs ?? []) {
  const steps = s.steps ?? [];
  if (!steps.length || !steps[0].action) { console.log(`SKIP ${s.id} ${s.name}: already normalized`); continue; }
  if (s.status !== 'paused') { console.log(`SKIP ${s.id} ${s.name}: status ${s.status}, expected paused`); continue; }
  const out = [];
  const problems = [];
  for (const st of [...steps].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (st.action !== 'sendEmail') { problems.push(`unsupported action "${st.action}" pos ${st.position}`); continue; }
    const templateKey = keyByFubId.get(st.emailTemplateId);
    if (!templateKey) { problems.push(`no template for FUB id ${st.emailTemplateId}`); continue; }
    out.push({ channel: 'email', delayDays: st.runAfterDays ?? 0, templateKey });
  }
  if (problems.length) { console.log(`SKIP ${s.id} ${s.name}: ${problems.join('; ')}`); continue; }
  let day = 0;
  console.log(`${LIVE ? 'WRITE' : 'would write'} ${s.id} ${s.name} (stays paused): ${out.length} steps`);
  for (const o of out) { day += o.delayDays; console.log(`    Day ${day}: ${o.templateKey}`); }
  if (LIVE) {
    const { error } = await sb.from('crm_sequences').update({ steps: out }).eq('id', s.id).eq('status', 'paused');
    if (error) throw new Error(error.message);
  }
}
console.log(LIVE ? 'done.' : 'DRY RUN — rerun with --live to write.');
