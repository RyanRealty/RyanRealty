#!/usr/bin/env node
/**
 * G3 lock: inbound create writes Lead; named writers advance Lead → Nurture.
 * Streamline v2 stamped Nurture at create and the packet showed Lead = 0.
 *
 *   node scripts/check-stage-truth.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

const journey = readFileSync('lib/crm/journey-advance.ts', 'utf8')
checks.push({
  label: "JOURNEY_ENTRY_STAGE is the string 'Lead'",
  ok: /export const JOURNEY_ENTRY_STAGE = 'Lead'/.test(journey),
})
for (const trigger of ['native-create', 'sequence-enroll', 'first-outbound', 'broker-set-stage', 'sequence-change-stage']) {
  checks.push({
    label: `JOURNEY_WRITERS names ${trigger}`,
    ok: journey.includes(`trigger: '${trigger}'`),
  })
}

const native = readFileSync('lib/data/crm/nativeCreate.ts', 'utf8')
checks.push({
  label: 'buildNativePersonRow stamps JOURNEY_ENTRY_STAGE (Lead)',
  ok: /stage:\s*JOURNEY_ENTRY_STAGE/.test(native) && /from '@\/lib\/crm\/journey-advance'/.test(native),
})
checks.push({
  label: 'nativeCreateGaps refuses a non-Lead stage',
  ok: /stage is not Lead/.test(native),
})

for (const [file, label] of [
  ['lib/data/crm/ensureNativeLead.ts', 'ensureNativeLead'],
  ['lib/data/crm/findOrCreatePersonByPhone.ts', 'findOrCreatePersonByPhone'],
  ['lib/data/crm/captureHotAnonymous.ts', 'captureHotAnonymous'],
]) {
  const src = readFileSync(file, 'utf8')
  checks.push({
    label: `${label} calls buildNativePersonRow`,
    ok: /buildNativePersonRow\(/.test(src) && /from '\.\/nativeCreate'/.test(src),
  })
}

const enroll = readFileSync('lib/crm/enroll.ts', 'utf8')
const enrollAdvance = enroll.match(/await advanceJourneyStage\(\{\s*personId,\s*trigger:\s*'sequence-enroll'\s*\}\)/g) ?? []
checks.push({
  label: 'autoEnrollPerson and manualEnrollPerson await sequence-enroll advance',
  ok: enrollAdvance.length >= 2,
})

const first = readFileSync('lib/crm/first-broker-action.ts', 'utf8')
checks.push({
  label: 'first-broker-action awaits first-outbound advance',
  ok: /await advanceJourneyStage\(\{\s*personId,\s*trigger:\s*'first-outbound'\s*\}\)/.test(first),
})

const seq = readFileSync('app/api/cron/crm-sequence-engine/route.ts', 'utf8')
checks.push({
  label: 'sequence engine records outbound after email send',
  ok: /recordSequenceOutbound\(sb,\s*\{[\s\S]*?kind:\s*'email_out'/.test(seq),
})
checks.push({
  label: 'sequence engine records outbound after SMS send',
  ok: /recordSequenceOutbound\(sb,\s*\{[\s\S]*?kind:\s*'sms_out'/.test(seq),
})
const outbound = readFileSync('lib/crm/sequence-outbound.ts', 'utf8')
checks.push({
  label: 'sequence outbound helper stamps first-outbound',
  ok: /stampFirstBrokerActionIfEmpty\(sb,\s*input\.personId/.test(outbound),
})
checks.push({
  label: 'sequence engine change_stage names sequence-change-stage',
  ok: /source:\s*'sequence-change-stage'/.test(seq),
})

const compose = readFileSync('lib/data/crm/getComposeAudienceOptions.ts', 'utf8')
checks.push({
  label: 'compose audience stages come from getCrmStages (not CRM_STAGES const)',
  ok: /getCrmStages\(/.test(compose) && !/from '@\/lib\/crm\/constants'/.test(compose),
})

const stageAction = readFileSync('app/actions/crm.ts', 'utf8')
checks.push({
  label: 'updateCrmStageAction timeline source is broker-set-stage',
  ok: /source:\s*'broker-set-stage'/.test(stageAction),
})

const bulk = readFileSync('lib/crm/bulk-handlers/set-stage.ts', 'utf8')
checks.push({
  label: 'bulk set-stage timeline source is broker-set-stage',
  ok: /source:\s*'broker-set-stage'/.test(bulk),
})

const migration = readFileSync('supabase/migrations/20260816030000_crm_stages_lead_entry.sql', 'utf8')
checks.push({
  label: 'migration reactivates Lead at position 0 (no people remap)',
  ok:
    /where key = 'Lead'/.test(migration) &&
    /is_active = true/.test(migration) &&
    !/update public\.crm_people/i.test(migration),
})

console.log('Stage-truth writer gate (G3)')
console.log('============================\n')
let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`  OK    ${c.label}`)
  else {
    failed++
    console.log(`  FAIL  ${c.label}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${checks.length} stage-truth checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} stage-truth checks pass.`)
process.exit(0)
