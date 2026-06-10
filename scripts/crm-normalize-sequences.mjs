#!/usr/bin/env node
// Normalize the 4 master sequences (FUB raw steps → native engine schema) and
// activate them. runAfterDays is CUMULATIVE from enrollment (verified against
// the 2026-05-29 audit's day labels), so steps sort by (runAfterDays, position)
// and store delta delays.
//
//   node scripts/crm-normalize-sequences.mjs

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

const PLANS = [69, 70, 71, 72];

const cleanMerge = (s) =>
  String(s ?? '')
    .replaceAll('%contact_first_name%', '%first%')
    .replace(/%custom[A-Za-z]*Address%/g, '%address%');

(async () => {
  const { data: templates } = await sb.from('crm_templates').select('key,fub_legacy_id,channel');
  const tplByFub = new Map(templates.filter((t) => t.channel === 'email').map((t) => [t.fub_legacy_id, t.key]));

  const FUB_AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64');
  for (const planId of PLANS) {
    const { data: seq } = await sb.from('crm_sequences').select('id,name,status').eq('fub_legacy_plan_id', planId).single();
    // always normalize from FUB's raw plan definition (idempotent re-runs)
    const fubRes = await fetch('https://api.followupboss.com/v1/actionPlans/' + planId, {
      headers: { Authorization: FUB_AUTH, 'X-System': 'RyanRealtyPlatform' },
    });
    if (!fubRes.ok) { console.error('FUB plan fetch failed', planId, fubRes.status); process.exit(1); }
    const fubPlan = await fubRes.json();
    seq.steps = fubPlan.steps ?? fubPlan.actionplans?.[0]?.steps ?? [];
    if (!seq.steps.length) { console.error('no raw steps for plan', planId); process.exit(1); }
    // runAfterDays is absolute-from-enrollment, EXCEPT trailing tag steps
    // entered as runAfterDays=0 meaning "with the previous step" — those
    // inherit the plan's final day (verified against the 2026-05-29 audit:
    // AP69 day-60 tag swap, AP70 day-90, AP71/72 end-of-plan).
    const maxDay = Math.max(...seq.steps.map((x) => Number(x.runAfterDays ?? 0)));
    const effective = seq.steps.map((x) => ({
      ...x,
      _day: (['addTags', 'removeTags'].includes(x.action) && Number(x.runAfterDays ?? 0) === 0 && x.position > 1)
        ? maxDay
        : Number(x.runAfterDays ?? 0),
    }));
    const raw = effective.sort((a, b) => (a._day - b._day) || (a.position - b.position));

    const native = [];
    let prevDay = 0;
    for (const st of raw) {
      const day = Number(st._day ?? 0);
      const delayDays = Math.max(0, day - prevDay);
      prevDay = day;
      if (st.action === 'sendEmail' && st.emailTemplateId) {
        const templateKey = tplByFub.get(st.emailTemplateId);
        if (!templateKey) { console.error(`plan ${planId}: missing template for fub id ${st.emailTemplateId}`); process.exit(1); }
        native.push({ channel: 'email', delayDays, templateKey });
      } else if (st.action === 'createTask') {
        native.push({ channel: 'task', delayDays, taskName: cleanMerge(st.taskName), taskType: st.taskType ?? 'Follow Up' });
      } else if (st.action === 'addTags') {
        native.push({ channel: 'tag', delayDays, addTags: st.tags ?? [] });
      } else if (st.action === 'removeTags') {
        native.push({ channel: 'tag', delayDays, removeTags: st.tags ?? [] });
      } else {
        console.error(`plan ${planId}: unknown action ${st.action} — refusing to activate`); process.exit(1);
      }
    }

    const { error } = await sb.from('crm_sequences').update({
      steps: native,
      status: 'active',
      description: `Normalized from FUB action plan ${planId} on 2026-06-10. Auto-enrolls new leads (created after the enrollment epoch) via /api/cron/crm-auto-enroll.`,
      updated_at: new Date().toISOString(),
    }).eq('id', seq.id);
    if (error) { console.error(error.message); process.exit(1); }
    console.log(`AP${planId} "${seq.name}": ${native.length} steps normalized → ACTIVE`);
    for (const [i, s] of native.entries()) console.log(`   ${i}: +${s.delayDays}d ${s.channel} ${s.templateKey ?? s.taskName ?? JSON.stringify(s.addTags ?? s.removeTags)}`);
  }
})();
