#!/usr/bin/env node
/**
 * Patch the 5 seller-workflow email templates with Matt-approved v2 copy
 * (no signature blocks, no broken merge tokens, brand-voice clean) and
 * retime AP 69 step day offsets to match the new cadence.
 *
 * Idempotent: re-running is a no-op if the templates already match.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_fub-ap69-patch-v2.mjs --dry-run
 *   node --env-file=.env.local scripts/_fub-ap69-patch-v2.mjs --apply
 */

const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
if (!FUB_KEY) { console.error('Missing FOLLOWUPBOSS_API_KEY'); process.exit(1) }
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const apply = process.argv.includes('--apply')

async function fub(method, path, body) {
  const r = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: AUTH,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 250)}`)
  return text ? JSON.parse(text) : null
}

const TEMPLATES = [
  {
    id: 672,
    name: 'SL-01 Seller LP Confirmation',
    subject: 'Got your home value request for %customSellerPropertyAddress%',
    body: `<p>Hi %contact_first_name%,</p>
<p>Thanks for the home value request on %customSellerPropertyAddress%. The full CMA will be in your inbox within the next hour or two. It includes closed comps from the last 90 days within a half mile of you, an active-market read for your neighborhood, and a pricing range based on the condition and feature set you described.</p>
<p>If anything about the property would change how I think about value, just reply. Recent upgrades, special features, anything specific. I'll factor it in.</p>
<p>Talk soon,</p>`,
  },
  {
    id: 673,
    name: 'SL-02 A few thoughts',
    subject: 'A few thoughts on %customSellerPropertyAddress%',
    body: `<p>Hi %contact_first_name%,</p>
<p>Wanted to follow up on the CMA I sent over for %customSellerPropertyAddress%. The market in %customNeighborhood% has been doing some interesting things lately, and your property has a few things working in its favor.</p>
<p>Two questions that help me sharpen the picture:</p>
<ol>
<li>Are you considering selling soon, or are you mostly trying to understand the number for planning?</li>
<li>Anything you'd want me to factor in that wasn't in the original request? Upgrades, condition specifics, timing constraints.</li>
</ol>
<p>Happy to walk through it over the phone if that's easier. Either way, no pressure.</p>`,
  },
  {
    id: 674,
    name: "SL-03 What's happening in %customNeighborhood%",
    subject: "What's happening in %customNeighborhood%",
    body: `<p>Hi %contact_first_name%,</p>
<p>Quick read on what's been happening in %customNeighborhood% this month.</p>
<p>Inventory is moving. Homes that price right and show well are getting attention quickly. The ones that linger usually share one of two issues. Pricing that hasn't caught up to the comps, or photos that aren't doing the property justice.</p>
<p>Worth keeping in mind for %customSellerPropertyAddress% if you decide to move on a sale this year. The pricing window matters more than most people realize.</p>
<p>If you want a quick walkthrough of what your home would look like if we listed it tomorrow, I can put a prep plan together. Staging notes, photography, suggested updates, listing strategy. No commitment.</p>`,
  },
  {
    id: 675,
    name: 'SL-04 Three questions before you list',
    subject: 'Three questions worth asking before you list in %customNeighborhood%',
    body: `<p>Hi %contact_first_name%,</p>
<p>If selling %customSellerPropertyAddress% is on the table this year, three questions usually decide whether the listing is clean or painful.</p>
<ol>
<li>Are the comps actually comparable? Square footage and bedroom count are the easy part. Lot size, view, layout, and condition move the needle more. The right comp set narrows your price range from a $200K spread to a $30K one.</li>
<li>How do you look against active competition? Buyers don't compare your home to last year's closed sales. They compare it to the three houses they toured Saturday. If those three are priced sharper or look better in photos, you're not going to win.</li>
<li>What do you net at each price? List price minus closing costs minus repairs minus carrying costs is the only number that matters. The "what could we sell for" question is interesting, but "what do you actually walk away with" runs the decision.</li>
</ol>
<p>If you want to talk through any of these for %customSellerPropertyAddress%, just let me know. 15 minutes by phone is usually enough.</p>`,
  },
  {
    id: 676,
    name: 'SL-05 Still thinking about selling',
    subject: 'Still thinking about selling, %contact_first_name%?',
    body: `<p>Hi %contact_first_name%,</p>
<p>Quick check-in. I sent over the CMA on %customSellerPropertyAddress% a few weeks back. Sometimes these come together right away, sometimes they sit on the back burner for months, and sometimes the answer turns out to be "not this year, maybe next."</p>
<p>All three are fine. Just wanted to make sure you have what you need.</p>
<p>One question. Is your timing still flexible, or is something coming up that would push a sale onto the calendar (new job, family situation, market change)? If any of that has shifted since we first connected, I'd love to know so I can be useful.</p>
<p>Otherwise, I'll keep an eye on the %customNeighborhood% market and check in if I see something that changes the picture.</p>`,
  },
]

// AP 69 step retiming: position → new runAfterDays
const STEP_RETIME = {
  3: 2,   // SL-02 (T+48h)
  4: 3,   // HOT SMS task (T+72h conditional)
  5: 10,  // SL-03 (T+10d)
  6: 21,  // SL-04 (T+21d)
  7: 45,  // SL-05 (T+45d)
  8: 60,  // removeTags (T+60d)
}

async function main() {
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`)

  // 1) Template patches
  console.log('=== Templates ===')
  for (const t of TEMPLATES) {
    const current = await fub('GET', `/templates/${t.id}`)
    const changed = current.subject !== t.subject || current.body?.trim() !== t.body.trim()
    console.log(`  Template ${t.id} ${t.name}`)
    console.log(`    Subject change: ${current.subject !== t.subject ? 'YES' : 'no'}`)
    console.log(`    Body change:    ${current.body?.trim() !== t.body.trim() ? 'YES' : 'no'}`)
    if (apply && changed) {
      await fub('PUT', `/templates/${t.id}`, {
        name: t.name,
        subject: t.subject,
        body: t.body,
      })
      console.log(`    → PATCHed`)
    }
  }

  // 2) AP 69 step retiming
  console.log('\n=== AP 69 step retiming ===')
  const ap = await fub('GET', '/actionPlans/69')
  const newSteps = (ap.steps || []).map((s) => {
    const newDay = STEP_RETIME[s.position]
    if (newDay !== undefined && newDay !== s.runAfterDays) {
      console.log(`  Step ${s.position} ${s.action}: day+${s.runAfterDays} → day+${newDay}`)
      return { ...s, runAfterDays: newDay }
    }
    return s
  })
  const anyChange = newSteps.some((s, i) => s.runAfterDays !== ap.steps[i].runAfterDays)
  if (!anyChange) console.log('  (no timing changes needed)')
  if (apply && anyChange) {
    // Strip read-only fields FUB rejects on PUT
    const editableSteps = newSteps.map((s) => {
      const { id: _id, ...rest } = s
      return rest
    })
    const payload = {
      name: ap.name,
      stopOnContacted: ap.stopOnContacted,
      delaySmsMinutes: ap.delaySmsMinutes,
      number: ap.number,
      sendToAll: ap.sendToAll,
      sharedToAccount: ap.sharedToAccount,
      categories: ap.categories || [],
      initialTextMessageEnabled: ap.initialTextMessageEnabled,
      initialTextMessage: ap.initialTextMessage,
      initialTextMessageTemplateId: ap.initialTextMessageTemplateId,
      steps: editableSteps,
    }
    await fub('PUT', '/actionPlans/69', payload)
    console.log('  → AP 69 step timings updated')
  }

  console.log('\n=== Done ===')
  console.log(apply ? 'Changes APPLIED to FUB.' : 'Dry run complete. Re-run with --apply.')
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
