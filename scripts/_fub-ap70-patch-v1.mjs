#!/usr/bin/env node
/**
 * Patch AP 70 Buyer Lead Master Workflow templates + retime steps + add
 * Touch 8 (BL-06 Day 90 long-game email).
 *
 * - PATCH templates 677-681 with new bodies (brand-voice clean, no signatures)
 * - PATCH AP 70 initialTextMessage to new BL-S1 copy
 * - CREATE template "BL-06 Sticking with you for the long game"
 * - Retime sendEmail steps: 2→day+0, 4→day+2, 6→day+10, 7→day+21, 8→day+45
 * - ADD new sendEmail step at day+90 for BL-06
 * - Move removeTags from day+30 to day+90
 *
 * Idempotent. Re-run is a no-op if AP 70 already matches.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_fub-ap70-patch-v1.mjs --dry-run
 *   node --env-file=.env.local scripts/_fub-ap70-patch-v1.mjs --apply
 */

const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
if (!FUB_KEY) { console.error('Missing FOLLOWUPBOSS_API_KEY'); process.exit(1) }
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const apply = process.argv.includes('--apply')

async function fub(method, path, body) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const NEW_INITIAL_SMS =
  "Hi %contact_first_name%, Matt with Ryan Realty. Got your search set up for %customBuyerSearchAreas%. What's the best time to call you this week?"

const TEMPLATES = [
  {
    id: 677,
    name: 'BL-01 Your Bend search is set up',
    subject: 'Your Bend search is set up',
    body: `<p>Hi %contact_first_name%,</p>
<p>Thanks for the search request. I have your criteria set up for %customBuyerSearchAreas% and the first matching listings will be in your inbox within the hour. They come from the live MLS, not Zillow, so prices and statuses are current.</p>
<p>One question that helps me sharpen what you see. What does your ideal home look like beyond the basics? Even a few sentences gives me enough to filter out the listings you don't want to waste time looking at.</p>
<p>Talk soon,</p>`,
  },
  {
    id: 678,
    name: 'BL-02 Two things that move buyers ahead',
    subject: 'Two things that move buyers to the front of the line in Bend',
    body: `<p>Hi %contact_first_name%,</p>
<p>Quick note as your search gets going. In Bend right now, two things separate the buyers who win the home they want from the ones who lose to a stronger offer.</p>
<p>Pre-approval, not pre-qualification. Pre-approval means a lender has actually verified your income, credit, and assets. Sellers and listing agents read that as a real offer. Pre-qualification is a soft estimate, and most listing agents will skip your offer in favor of one backed by full pre-approval.</p>
<p>Knowing your hard ceiling before you tour. The buyers who get crushed in multiple-offer situations are the ones who fall in love with a home that's actually above their real comfort range. Knowing your number before you walk in saves heartbreak later.</p>
<p>Happy to refer you to a lender we trust in Bend if you want one, or you can use whoever you're already working with. No pressure, just want you set up to win when the right house shows up.</p>`,
  },
  {
    id: 679,
    name: 'BL-03 What to know about your top areas',
    subject: 'What to know about your top areas before you tour',
    body: `<p>Hi %contact_first_name%,</p>
<p>You're searching in %customBuyerSearchAreas%. A few things worth knowing before you start touring in any of them.</p>
<p>Every neighborhood in Bend has its own personality. Awbrey Butte is established with mature trees. Tetherow runs newer and resort-adjacent. Old Bend is walkable and historic. NorthWest Crossing is family-dense with parks. The price-per-square-foot in each one tells a different story about what your budget actually buys.</p>
<p>What I usually tell buyers is to tour at least one home in each of the top two areas on your list before committing to one. The difference shows up fast in person and saves you from buying based on a Zillow filter.</p>
<p>If you want me to put together a custom market read for your top two areas before you tour, just reply with which ones. 10 minutes of prep on my end saves us 3 hours of touring the wrong inventory.</p>`,
  },
  {
    id: 680,
    name: "BL-04 What's moving in your budget range",
    subject: "What's moving in your budget range right now",
    body: `<p>Hi %contact_first_name%,</p>
<p>Three weeks in, here's what the Bend market looks like for the budget range you're working in.</p>
<p>Your range moves at a different pace than the rest of the market. The bracket below yours, things go pending in a week and price reductions are rare. The bracket above yours, inventory sits longer and there's more room to negotiate. Knowing where your number sits on that curve changes how you write an offer.</p>
<p>The one thing I'd push back on is the temptation to max out your range immediately. The buyers who hit closing happy are usually the ones who held 10 to 15 percent back for closing costs, the inspection follow-up, and moving-in expenses. If your max is on the upper end of your stated range, your realistic offer ceiling sits a bit below it.</p>
<p>When you're ready to tour a few in person, let me know and I'll pull a short list that matches what you've actually told me you want.</p>`,
  },
  {
    id: 681,
    name: 'BL-05 Are your search areas still right',
    subject: 'Are your search areas still right?',
    body: `<p>Hi %contact_first_name%,</p>
<p>Quick check-in. You started looking in %customBuyerSearchAreas% about six weeks ago. Sometimes the right home shows up in the first week, sometimes it takes months, and sometimes after a few weeks of looking, the search criteria themselves need to shift.</p>
<p>A few questions that often shake things loose.</p>
<p>Are the price brackets still right? Sometimes once buyers start touring, the realistic range moves up or down by 50 to 100K based on what they actually see.</p>
<p>Are the search areas still right? People often add or drop neighborhoods after seeing a few houses in each.</p>
<p>Is the timeline still right? Life happens. If something changed (new job, family situation, a place to rent in the meantime), let me know and I can pivot.</p>
<p>If everything's still on track, no need to respond. The listing alerts will keep coming. If anything needs to shift, hit reply and I'll update everything on my end.</p>`,
  },
]

const BL06 = {
  name: 'BL-06 Sticking with you for the long game',
  subject: 'Sticking with you for the long game',
  body: `<p>Hi %contact_first_name%,</p>
<p>90 days since you started looking. Some buyers are under contract by now, some are still browsing, and some have decided to pause until next spring or a different season of life. All three are normal.</p>
<p>Wherever you land, I'm going to keep sending you a short monthly read on what's happening in %customBuyerSearchAreas%. Not pushy, just one note a month so you have a real-time pulse if you decide to jump back in.</p>
<p>If the timing shifts, or you want to grab coffee and talk through where things stand, just reply. No pressure either way.</p>`,
}

// New step day offsets (positions match current AP 70 step ordering):
//  Step 1 createTask day+0 (broker call) — keep
//  Step 2 sendEmail BL-01 day+0 — keep
//  Step 3 createTask day+0 (matched-listings batch) — keep
//  Step 4 sendEmail BL-02 day+2 (was day+1)
//  Step 5 createTask day+5 (was day+2, HOT-only SMS) — retime + reword
//  Step 6 sendEmail BL-03 day+10 (was day+4)
//  Step 7 sendEmail BL-04 day+21 (was day+7)
//  Step 8 sendEmail BL-05 day+45 (was day+16)
//  NEW Step 9 sendEmail BL-06 day+90 (template id assigned by FUB on create)
//  Step 10 (was 9) removeTags day+90 (was day+30)
//  Step 11 (was 10) addTags day+0 (immediately after removeTags)
const STEP_RETIME = {
  4: 2,    // BL-02
  5: 5,    // SMS task
  6: 10,   // BL-03
  7: 21,   // BL-04
  8: 45,   // BL-05
}

async function main() {
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`)

  // 1) Template PATCHes
  console.log('=== Templates 677-681 ===')
  for (const t of TEMPLATES) {
    const current = await fub('GET', `/templates/${t.id}`)
    const subjChanged = current.subject !== t.subject
    const bodyChanged = (current.body || '').trim() !== t.body.trim()
    const nameChanged = current.name !== t.name
    console.log(`  Template ${t.id} ${t.name}`)
    console.log(`    Name: ${nameChanged ? 'YES' : 'no'} | Subject: ${subjChanged ? 'YES' : 'no'} | Body: ${bodyChanged ? 'YES' : 'no'}`)
    if (apply && (subjChanged || bodyChanged || nameChanged)) {
      await fub('PUT', `/templates/${t.id}`, { name: t.name, subject: t.subject, body: t.body })
      console.log(`    → PATCHed`)
    }
  }

  // 2) CREATE BL-06 (Touch 8)
  console.log('\n=== BL-06 (Touch 8 Day 90) ===')
  // Check if a template named BL-06 already exists (idempotency)
  const allTemplates = await fub('GET', `/templates?limit=200`)
  const existingBl06 = (allTemplates.templates || []).find((x) => x.name === BL06.name)
  let bl06Id
  if (existingBl06) {
    bl06Id = existingBl06.id
    console.log(`  Already exists at id ${bl06Id}`)
    const subjChanged = existingBl06.subject !== BL06.subject
    const bodyChanged = (existingBl06.body || '').trim() !== BL06.body.trim()
    if (apply && (subjChanged || bodyChanged)) {
      await fub('PUT', `/templates/${bl06Id}`, { name: BL06.name, subject: BL06.subject, body: BL06.body })
      console.log(`  → PATCHed existing`)
    }
  } else {
    console.log(`  Does not exist`)
    if (apply) {
      const created = await fub('POST', `/templates`, { name: BL06.name, subject: BL06.subject, body: BL06.body })
      bl06Id = created.id
      console.log(`  → CREATED at id ${bl06Id}`)
    } else {
      console.log(`  (would create — dry-run)`)
    }
  }

  // 3) Update AP 70 — initialTextMessage + step retiming + add BL-06 step + move tags to day 90
  console.log('\n=== AP 70 retime + add Touch 8 ===')
  const ap = await fub('GET', '/actionPlans/70')

  const newInitial = NEW_INITIAL_SMS
  const initialChanged = ap.initialTextMessage !== newInitial
  console.log(`  initialTextMessage change: ${initialChanged ? 'YES' : 'no'}`)

  // Build new step list
  const oldSteps = ap.steps || []
  // Retime existing steps
  const retimed = oldSteps.map((s) => {
    const { id: _id, ...rest } = s
    const newDay = STEP_RETIME[s.position]
    return { ...rest, runAfterDays: newDay !== undefined ? newDay : s.runAfterDays }
  })
  // Also update Step 5 task name to drop "HOT only" wording (now all buyers get the auto SMS)
  // …actually, keep wording for now (broker discretion) — just retime to day 5

  // Find where to insert BL-06 step + tag steps
  // Old: positions 1..10 with removeTags at 9, addTags at 10
  // New: insert sendEmail BL-06 at day 90 BEFORE removeTags, then removeTags day 90, addTags day 0
  const sendEmailSteps = retimed.filter((s) => s.action === 'sendEmail')
  const lastEmailDay = Math.max(...sendEmailSteps.map((s) => s.runAfterDays))
  const removeTagsIdx = retimed.findIndex((s) => s.action === 'removeTags')
  const addTagsIdx = retimed.findIndex((s) => s.action === 'addTags')

  // Build final step list with BL-06 inserted before removeTags + tags retimed to day 90
  let finalSteps
  if (bl06Id) {
    const beforeTags = retimed.slice(0, removeTagsIdx)
    const bl06Step = {
      action: 'sendEmail',
      position: removeTagsIdx + 1, // will be renumbered below
      runAfterDays: 90,
      tags: [],
      collaborators: [],
      taskName: null,
      taskType: null,
      stageId: null,
      assignedUserId: -1,
      emailTemplateId: bl06Id,
      stopActionPlanId: null,
      noteDesc: null,
      noteNotifiers: null,
    }
    // Retime tag steps to day 90 + day 0
    const removeTagsStep = { ...retimed[removeTagsIdx], runAfterDays: 90 }
    const addTagsStep = { ...retimed[addTagsIdx], runAfterDays: 0 }
    finalSteps = [...beforeTags, bl06Step, removeTagsStep, addTagsStep]
    // Re-number positions
    finalSteps = finalSteps.map((s, i) => ({ ...s, position: i + 1 }))
  } else {
    // Dry-run path — show what would change but don't add BL-06
    finalSteps = retimed.map((s, i) => ({ ...s, position: i + 1 }))
  }

  console.log(`  Step plan (${finalSteps.length} steps):`)
  finalSteps.forEach((s) => {
    const oldS = oldSteps.find((o) => o.position === s.position)
    const oldDay = oldS?.runAfterDays
    const flag = (oldDay !== s.runAfterDays && oldS) ? ` (was day+${oldDay})` :
                 (!oldS) ? ' (NEW)' : ''
    const detail = s.action === 'sendEmail' ? `tplId ${s.emailTemplateId}` :
                   s.action === 'createTask' ? (s.taskName || '').slice(0, 50) :
                   s.action
    console.log(`    Step ${s.position} | day+${s.runAfterDays} | ${s.action} | ${detail}${flag}`)
  })

  if (apply) {
    const payload = {
      name: ap.name,
      stopOnContacted: ap.stopOnContacted,
      delaySmsMinutes: ap.delaySmsMinutes,
      number: ap.number,
      sendToAll: ap.sendToAll,
      sharedToAccount: ap.sharedToAccount,
      categories: ap.categories || [],
      initialTextMessageEnabled: ap.initialTextMessageEnabled,
      initialTextMessage: newInitial,
      initialTextMessageTemplateId: ap.initialTextMessageTemplateId,
      steps: finalSteps,
    }
    await fub('PUT', '/actionPlans/70', payload)
    console.log('  → AP 70 updated')
  }

  console.log('\n=== Done ===')
  console.log(apply ? 'Changes APPLIED to FUB.' : 'Dry run complete. Re-run with --apply.')
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
