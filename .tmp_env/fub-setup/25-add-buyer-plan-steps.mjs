#!/usr/bin/env node
/**
 * Adds the 10-step action plan to "Buyer Lead — Master Workflow" (plan id 70)
 * via PUT /v1/actionPlans/70 with a `steps` array. Mirror of the seller plan
 * 69 structure but with buyer-side tags + templates.
 *
 * Discovery: PUT /v1/actionPlans/{id} accepts a `steps` array (verified by
 * inspecting plan 69 after Matt built it in the UI). No need for the missing
 * /steps endpoint.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

const PLAN_ID = 70

const STEPS = [
  // T+0: Broker call task (SLA depends on tier — assigned broker reads from tag)
  {
    action: 'createTask',
    position: 1,
    runAfterDays: 0,
    assignedUserId: -1,  // FUB sentinel: "assign to lead's owner"
    taskName: 'Call %contact_first_name% — buyer LP lead',
    taskType: 'Call',
  },
  // T+0: Confirmation email
  {
    action: 'sendEmail',
    position: 2,
    runAfterDays: 0,
    assignedUserId: -1,
    emailTemplateId: 677,  // BL-01 Buyer LP Confirmation
  },
  // T+0: Task — broker curates + sends first batch of listings within 30min
  {
    action: 'createTask',
    position: 3,
    runAfterDays: 0,
    assignedUserId: -1,
    taskName: 'Send first matched-listings batch to %contact_first_name% within 30 min',
    taskType: 'Other',
  },
  // T+1d: Check-in
  {
    action: 'sendEmail',
    position: 4,
    runAfterDays: 1,
    assignedUserId: -1,
    emailTemplateId: 678,  // BL-02 Buyer 24h Check-in
  },
  // T+3d: Personal SMS for hot buyers (broker handles — skipped for warm/nurture)
  {
    action: 'createTask',
    position: 5,
    runAfterDays: 3,
    assignedUserId: -1,
    taskName: 'Send personal SMS to %contact_first_name% (HOT buyer — skip if warm/nurture)',
    taskType: 'Other',
  },
  // T+7d: Market intel
  {
    action: 'sendEmail',
    position: 6,
    runAfterDays: 7,
    assignedUserId: -1,
    emailTemplateId: 679,  // BL-03 Buyer Market Intel
  },
  // T+14d: Featured listing
  {
    action: 'sendEmail',
    position: 7,
    runAfterDays: 14,
    assignedUserId: -1,
    emailTemplateId: 680,  // BL-04 Buyer Featured Listing
  },
  // T+30d: Soft check-in
  {
    action: 'sendEmail',
    position: 8,
    runAfterDays: 30,
    assignedUserId: -1,
    emailTemplateId: 681,  // BL-05 Buyer Soft Check-in
  },
  // T+60d: Strip tier tags
  {
    action: 'removeTags',
    position: 9,
    runAfterDays: 60,
    tags: ['buyer:hot', 'buyer:warm', 'buyer:nurture'],
  },
  // T+60d: Promote to long-nurture
  {
    action: 'addTags',
    position: 10,
    runAfterDays: 60,
    tags: ['buyer:long-nurture'],
  },
]

const PLAN_PAYLOAD = {
  steps: STEPS,
  initialTextMessageEnabled: true,
  initialTextMessage: 'Hi %contact_first_name%, Matt at Ryan Realty. Got your search going. First batch in your inbox in 30 min. Anything I should factor in? Reply STOP to opt out.',
  delaySmsMinutes: 1,
  stopOnContacted: true,
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Target: plan id ${PLAN_ID} (Buyer Lead — Master Workflow)`)
  console.log(`Steps to add: ${STEPS.length}\n`)

  if (!DELETE) {
    console.log('Steps:')
    for (const s of STEPS) {
      console.log(`  pos=${s.position} t+${s.runAfterDays}d  ${s.action}${s.emailTemplateId ? ` template=${s.emailTemplateId}` : ''}${s.taskName ? ` "${s.taskName.slice(0, 60)}"` : ''}${s.tags?.length ? ` tags=[${s.tags.join(', ')}]` : ''}`)
    }
    console.log('\nDry-run. Set DELETE=1 to apply.')
    return
  }

  const r = await fetch(`https://api.followupboss.com/v1/actionPlans/${PLAN_ID}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-buyer-workflow',
    },
    body: JSON.stringify(PLAN_PAYLOAD),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  console.log(`PUT status: ${r.status}`)
  if (r.ok) {
    console.log(`✅ Plan updated. stepCount=${json?.stepCount}, initialTextMessageEnabled=${json?.initialTextMessageEnabled}`)
    console.log('\nFinal steps:')
    for (const s of (json?.steps || [])) {
      console.log(`  pos=${s.position} t+${s.runAfterDays}d  ${s.action}${s.emailTemplateId ? ` template=${s.emailTemplateId}` : ''}${s.tags?.length ? ` tags=[${s.tags.join(', ')}]` : ''}`)
    }
  } else {
    console.log('❌ Failed:', text.slice(0, 500))
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
