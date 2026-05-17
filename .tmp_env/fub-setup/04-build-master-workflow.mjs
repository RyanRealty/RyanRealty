#!/usr/bin/env node
/**
 * Build the full "Seller Lead — Master Workflow" in FUB via API.
 *
 * Creates:
 *   - 5 email templates (SL-01 confirmation, SL-02 24h check-in,
 *     SL-03 7d market update, SL-04 14d case study, SL-05 30d soft check-in)
 *   - 1 action plan "Seller Lead — Master Workflow" with all steps
 *     (SMS confirmation at T+0 via initialTextMessage, then 5 email + 1 task
 *      steps over 60 days, ending with tier-tag swap to seller:long-nurture)
 *
 * Does NOT delete the old plans (that's `05-delete-dead-plans.mjs`).
 * Does NOT create the automation rule (FUB blocks /v1/automations for
 * integrations; Matt does that one click in UI).
 *
 * Idempotent: looks up existing templates / plan by name before creating;
 * if they already exist, updates them via PUT instead of creating duplicates.
 *
 * Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md.
 *
 * Run: DRY=1 (default — print what would happen)
 *      DRY=0 to actually create / update FUB resources
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DRY = process.env.DRY !== '0'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

async function fub(method, p, body = null) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'Authorization': `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

// ─── Email templates ──────────────────────────────────────────────────────
// FUB merge tokens: %contact_first_name%, %contact_last_name%, %agent_name%,
// %agent_phone%, %agent_email%, and any customXxx custom-field name.
// Verified against existing template id=670 ("Tumalo Reservoir Rd — Open House")
// which uses %contact_first_name%.

const TEMPLATES = [
  {
    name: 'SL-01 Seller LP Confirmation',
    subject: 'Got your home value request for %customSellerPropertyAddress%',
    body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

<p>Hi %contact_first_name%,</p>

<p>Thanks for reaching out. We got your request for the home value analysis on <strong>%customSellerPropertyAddress%</strong>, and I'm pulling comps now.</p>

<p>You'll have the full personalized CMA in your inbox shortly. If anything specific about the property would change how I think about value, recent upgrades, special features, anything unique, just reply here and I'll factor it in.</p>

<p>Talk soon,</p>

<p style="margin-top:24px;">
<strong>Matt Ryan</strong><br/>
Principal Broker, Ryan Realty<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a><br/>
<a href="mailto:matt@ryan-realty.com" style="color:#102742;">matt@ryan-realty.com</a>
</p>

</div>`,
  },
  {
    name: 'SL-02 Seller CMA Check-in',
    subject: 'Did the CMA make sense?',
    body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

<p>Hi %contact_first_name%,</p>

<p>Wanted to make sure the analysis came through OK on <strong>%customSellerPropertyAddress%</strong>. The market has been doing some interesting things, and your property has a few things working in its favor.</p>

<p>Happy to walk through it over the phone or coffee if you want to dig in.</p>

<p style="margin-top:24px;">
Matt<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>
</p>

</div>`,
  },
  {
    name: 'SL-03 Seller Market Update',
    subject: 'Where the local market is right now',
    body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

<p>Hi %contact_first_name%,</p>

<p>A quick update on what's happening in your area that might affect what your home could fetch right now.</p>

<p>I'll send through the latest numbers in a follow-up with specifics for your neighborhood. In the meantime, if anything has shifted on your end, timing, expectations, the property itself, let me know.</p>

<p style="margin-top:24px;">
Matt<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>
</p>

</div>`,
  },
  {
    name: 'SL-04 Seller Case Study',
    subject: 'A recent comparable sale you would want to see',
    body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

<p>Hi %contact_first_name%,</p>

<p>A property near you closed recently and I thought you'd want to see how it played out. The takeaway for your home: a clear story for the right buyer matters a lot more than just the list price.</p>

<p>If you're getting closer to making a move, let's talk through what the next 60 days could look like for <strong>%customSellerPropertyAddress%</strong>.</p>

<p style="margin-top:24px;">
Matt<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>
</p>

</div>`,
  },
  {
    name: 'SL-05 Seller Soft Check-in',
    subject: 'Still thinking about selling?',
    body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

<p>Hi %contact_first_name%,</p>

<p>It's been a few weeks since the CMA on <strong>%customSellerPropertyAddress%</strong>. No pressure either way, just wanted to check in.</p>

<p>If your timing has shifted, I'm here. If not, I'll keep you on the market updates so when the time is right, you've got the picture.</p>

<p style="margin-top:24px;">
Matt<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>
</p>

</div>`,
  },
]

// ─── Master action plan ──────────────────────────────────────────────────
// Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md §3 + §7 + §8.
//
// SMS confirmation (SL-S1) goes via initialTextMessage at T+0 (delaySmsMinutes=1).
// 5 emails + 1 task + 2 tag-management steps = 8 steps total in the plan.
//
// FUB action plan SMS limit: only one SMS at enrollment (via initialTextMessage).
// The T+3d SMS for hot leads is handled by a Task step that the broker actions
// manually (Phase 4 — separate plan / cron can be added later if response data
// supports it).

const ACTION_PLAN = {
  name: 'Seller Lead — Master Workflow',
  stopOnContacted: true,   // pauses on any inbound lead activity
  delaySmsMinutes: 1,      // T+1 minute after enrollment
  initialTextMessageEnabled: true,
  initialTextMessage: 'Hey %contact_first_name%, Matt from Ryan Realty here. Got your home value request for %customSellerPropertyAddress%. CMA in your inbox shortly. Anything I should know first? Reply STOP to opt out.',
  number: '+15417033095',   // FUB-tracked broker line
}

// Step templates — emailTemplateId filled in after template creation.
function buildSteps(templateIdByName) {
  const tid = (n) => templateIdByName[n] ?? null

  return [
    {
      action: 'createTask',
      position: 1,
      runAfterDays: 0,
      taskName: 'Call %contact_first_name% — seller LP lead',
      taskType: 'Call',
      assignedUserId: -1,
    },
    {
      action: 'sendEmail',
      position: 2,
      runAfterDays: 0,
      emailTemplateId: tid('SL-01 Seller LP Confirmation'),
      assignedUserId: -1,
    },
    {
      action: 'sendEmail',
      position: 3,
      runAfterDays: 1,
      emailTemplateId: tid('SL-02 Seller CMA Check-in'),
      assignedUserId: -1,
    },
    {
      action: 'createTask',
      position: 4,
      runAfterDays: 3,
      taskName: 'Send personal SMS to %contact_first_name% (HOT seller — skip if warm/nurture)',
      taskType: 'Other',
      assignedUserId: -1,
    },
    {
      action: 'sendEmail',
      position: 5,
      runAfterDays: 7,
      emailTemplateId: tid('SL-03 Seller Market Update'),
      assignedUserId: -1,
    },
    {
      action: 'sendEmail',
      position: 6,
      runAfterDays: 14,
      emailTemplateId: tid('SL-04 Seller Case Study'),
      assignedUserId: -1,
    },
    {
      action: 'sendEmail',
      position: 7,
      runAfterDays: 30,
      emailTemplateId: tid('SL-05 Seller Soft Check-in'),
      assignedUserId: -1,
    },
    {
      action: 'removeTags',
      position: 8,
      runAfterDays: 60,
      tags: ['seller:hot', 'seller:warm', 'seller:nurture'],
    },
    {
      action: 'addTags',
      position: 9,
      runAfterDays: 60,
      tags: ['seller:long-nurture'],
    },
  ]
}

async function listTemplates() {
  let all = []
  let offset = 0
  while (true) {
    const { json } = await fub('GET', `/templates?limit=100&offset=${offset}`)
    const items = json?.templates || []
    all.push(...items)
    if (items.length < 100) break
    offset += 100
  }
  return all
}

async function listActionPlans() {
  const { json } = await fub('GET', '/actionPlans?limit=100')
  return json?.actionPlans || []
}

async function main() {
  console.log(`=== Build Seller Master Workflow ===`)
  console.log(`Mode: ${DRY ? 'DRY-RUN (set DRY=0 to mutate)' : 'EXECUTE'}\n`)

  // ─── 1. Templates ──────────────────────────────────────────────────────
  console.log('--- Email Templates ---')
  const existingTemplates = await listTemplates()
  const templateIdByName = {}

  for (const tmpl of TEMPLATES) {
    const existing = existingTemplates.find(t => t.name === tmpl.name)
    if (existing) {
      templateIdByName[tmpl.name] = existing.id
      console.log(`  EXISTS  ${tmpl.name} → id=${existing.id}`)
      if (!DRY) {
        // Update body in case we tweaked it.
        const { status } = await fub('PUT', `/templates/${existing.id}`, {
          subject: tmpl.subject,
          body: tmpl.body,
        })
        if (status >= 200 && status < 300) console.log(`    updated body+subject`)
        else console.log(`    update failed status=${status}`)
      }
      continue
    }
    if (DRY) {
      console.log(`  WOULD CREATE  ${tmpl.name}`)
      templateIdByName[tmpl.name] = null
      continue
    }
    const { status, json } = await fub('POST', '/templates', tmpl)
    if (status === 201 && json?.id) {
      templateIdByName[tmpl.name] = json.id
      console.log(`  CREATED  ${tmpl.name} → id=${json.id}`)
    } else {
      console.error(`  FAILED   ${tmpl.name} status=${status} ${JSON.stringify(json)}`)
    }
  }

  // ─── 2. Action Plan ────────────────────────────────────────────────────
  console.log('\n--- Action Plan ---')
  const existingPlans = await listActionPlans()
  const existingPlan = existingPlans.find(p => p.name === ACTION_PLAN.name)

  const steps = buildSteps(templateIdByName)
  console.log(`  steps: ${steps.length}`)
  for (const s of steps) {
    const detail = s.action === 'sendEmail' ? `tmplId=${s.emailTemplateId}` :
                   s.action === 'createTask' ? `"${s.taskName.slice(0,40)}..."` :
                   s.action === 'addTags' || s.action === 'removeTags' ? `[${s.tags.join(',')}]` : ''
    console.log(`    pos=${s.position}  T+${s.runAfterDays}d  ${s.action.padEnd(12)}  ${detail}`)
  }

  if (DRY) {
    console.log(`  WOULD ${existingPlan ? 'UPDATE id=' + existingPlan.id : 'CREATE'} plan "${ACTION_PLAN.name}"`)
    return
  }

  let planId
  if (existingPlan) {
    planId = existingPlan.id
    console.log(`  EXISTS  ${ACTION_PLAN.name} → id=${planId}`)
    // Update top-level fields.
    const { status } = await fub('PUT', `/actionPlans/${planId}`, ACTION_PLAN)
    if (status < 200 || status >= 300) console.error(`  plan update failed: ${status}`)
  } else {
    const { status, json } = await fub('POST', '/actionPlans', ACTION_PLAN)
    if (status !== 201 || !json?.id) {
      console.error(`  PLAN CREATE FAILED status=${status} ${JSON.stringify(json)}`)
      process.exit(1)
    }
    planId = json.id
    console.log(`  CREATED ${ACTION_PLAN.name} → id=${planId}`)
  }

  // ─── 3. Steps ─────────────────────────────────────────────────────────
  // FUB action plan steps endpoint: POST /v1/actionPlans/{id}/steps (probe first)
  console.log('\n--- Action Plan Steps ---')
  console.log('  Probing /v1/actionPlans/{id}/steps endpoint...')
  const { status: probeStatus, json: probeJson } = await fub('POST', `/actionPlans/${planId}/steps`, steps[0])
  console.log(`  probe POST → ${probeStatus} ${JSON.stringify(probeJson).slice(0,200)}`)

  // If sub-resource doesn't exist, fall back to PUT plan body with steps array.
  if (probeStatus === 404) {
    console.log('  Sub-resource not exposed. Trying PUT /actionPlans/{id} with steps...')
    const { status, json } = await fub('PUT', `/actionPlans/${planId}`, { steps })
    console.log(`  PUT → ${status} ${JSON.stringify(json).slice(0,300)}`)
  }

  // ─── Output: write planId for later scripts ─────────────────────────────
  const stateDir = path.join('.tmp_env', 'fub-setup', 'state')
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(
    path.join(stateDir, 'workflow.json'),
    JSON.stringify({ planId, templateIdByName, createdAt: new Date().toISOString() }, null, 2),
  )
  console.log(`\nState written to ${stateDir}/workflow.json`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
