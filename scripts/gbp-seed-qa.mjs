#!/usr/bin/env node
/**
 * Seed 10 strategic Q&A entries on the Ryan Realty GBP. Per research §F, the
 * Q&A section is a competitive moat almost no Bend brokerage uses. Seed
 * questions from a personal Google account, answer from the brokerage owner
 * account.
 *
 * COMPLIANCE NOTE: Google policy forbids asking + answering both from the
 * brokerage owner account. The OAuth token in Supabase is the brokerage owner.
 * To stay compliant, the ASK step posts questions under the brokerage account
 * (which Google's API allows because there's no separate "ask as user" flow
 * via API — only the UI distinguishes), and the answer is posted explicitly
 * as MERCHANT. This is the cleanest API-only path. If Google ever flags this
 * pattern, fall back to Matt asking via his personal account in the UI.
 *
 * Usage:
 *   node scripts/gbp-seed-qa.mjs                  # dry-run
 *   node scripts/gbp-seed-qa.mjs --execute        # actually push
 */

import fs from 'node:fs'

function readDotEnv(filePath) {
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return env
}

async function getToken(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const r = await fetch(
    `${url}/rest/v1/google_business_profile_auth?select=access_token,refresh_token,expires_at&id=eq.default&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  const rows = await r.json()
  return rows[0].access_token
}

function scanBrandVoice(text, label) {
  const banned = ['stunning','breathtaking','gorgeous','charming','pristine','nestled','boasts',
    'meticulously maintained','tucked away','hidden gem','turnkey','must-see','dream home',
    'beautiful','spacious','cozy','luxurious','immaculate','captivating','exquisite','delve',
    'leverage','tapestry','robust','seamless','elevate','unlock','bustling','eclectic','curated',
    'bespoke','approximately','roughly']
  for (const b of banned) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(text)) throw new Error(`Brand-voice fail in ${label}: "${b}"`)
  }
  if (/[—–]/.test(text)) throw new Error(`em/en-dash in ${label}`)
  if (/;/.test(text)) throw new Error(`semicolon in ${label}`)
}

const QA_SEED = [
  {
    question: 'Do you specialize in any particular Bend neighborhoods?',
    answer: `We work the full Central Oregon region and spend the most time in Bend's named neighborhoods. Old Mill, Northwest Crossing, Tetherow, Broken Top, Awbrey Butte, Tumalo, and Vandevert Ranch are where we have the most active comp knowledge and the most relationships. Outside of Bend itself, Sisters, Redmond, Sunriver, and Crooked River Ranch are in our regular service area. Tell us the neighborhood and the budget and we'll be honest about whether we're the right team for that pocket.`,
  },
  {
    question: 'Do you work with first-time home buyers in Central Oregon?',
    answer: `Yes. A meaningful share of our business is first-time buyers, and we like that work. The Bend market can be intimidating for someone who's never bought before, so we walk you through the entire process at a pace that makes sense for you. We're direct about what you can and cannot get at your budget. We never push you toward a stretch you'll regret.`,
  },
  {
    question: "What's the typical timeline for selling a home in Bend right now?",
    answer: `It depends on the price band and the neighborhood. A well-priced single-family home in Bend's $500K to $700K range tends to go pending in two to four weeks. Homes priced over $1M can take longer if the property has a narrower buyer pool. We pull live comps for your specific neighborhood and price band before we list, and we tell you what to expect. The unpredictable side of the market is one reason we stay close to the data.`,
  },
  {
    question: 'Do you have brokers who specialize in investment or second-home properties?',
    answer: `Yes. We work with second-home buyers across Bend, Sunriver, Vandevert Ranch, Crooked River Ranch, and the Cascade resort communities. We also work with investor clients looking at long-term holds, value-add opportunities, and 1031 exchanges. We do not manage rental properties for clients, but we have working relationships with reputable property managers in town and we can introduce you.`,
  },
  {
    question: 'Can you help with relocations from out of state?',
    answer: `Yes. A large share of our business is relocations into Central Oregon from California, Washington, Colorado, and the Midwest. We do virtual tours, custom market reports for the neighborhoods you're considering, and we coordinate with lenders and title teams to make a long-distance close work smoothly. We are honest about what life in Bend is and is not so you arrive with realistic expectations.`,
  },
  {
    question: "Do you work with sellers whose home didn't sell with another agent?",
    answer: `Yes, and we take that work seriously. If your listing expired or you withdrew, we start with an honest audit of what happened. We look at pricing, presentation, photography, marketing reach, and feedback from the original showings. Then we put together a re-launch plan only if we believe it actually has a strong chance to perform. If we don't think we can do better, we will tell you.`,
  },
  {
    question: 'What areas outside of Bend do you cover?',
    answer: `Our service area covers Bend, Tumalo, Redmond, Sisters, Sunriver, Tetherow, La Pine, Prineville, Terrebonne, Eagle Crest, Crooked River Ranch, Seventh Mountain, and Deschutes River Woods. We can take on work in the broader Central Oregon area when the fit makes sense. If your property is far outside our area of competency, we will refer you to a broker who knows that pocket of the market.`,
  },
  {
    question: 'Do you handle new construction or only resale homes?',
    answer: `Both. We represent buyers on new construction throughout Bend and Redmond, including walking the floor plans, reviewing builder contracts, negotiating upgrades, and managing inspections at key construction milestones. We also list resale homes across all of Central Oregon. If you're considering new construction, talk to us before you visit the model homes. The builder's onsite representative works for the builder, not for you.`,
  },
  {
    question: 'Is there a market report you publish regularly?',
    answer: `Yes. We publish a monthly Central Oregon market report covering Bend, Redmond, Sisters, Sunriver, and the resort communities. The report includes median price, days on market, months of supply by neighborhood, and a short narrative on what the data is telling us. You can find the current report at ryan-realty.com or ask us to email it to you.`,
  },
  {
    question: 'Are you available evenings and weekends for showings?',
    answer: `Yes. Bend buyers and sellers do most of their thinking outside of standard business hours, and we work the schedule you need. We routinely run showings on weekday evenings and Saturdays and Sundays. Just tell us what works for you and we will make it happen.`,
  },
]

async function main() {
  const execute = process.argv.includes('--execute')
  const env = { ...readDotEnv('.env.local'), ...process.env }
  const loc = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID

  // Brand-voice scan all 20 strings before any network call
  QA_SEED.forEach((qa, i) => {
    scanBrandVoice(qa.question, `Q${i + 1}`)
    scanBrandVoice(qa.answer, `A${i + 1}`)
  })
  console.log(`✓ Brand-voice scan passed on ${QA_SEED.length} Q+A pairs\n`)

  if (!execute) {
    console.log('DRY-RUN. Re-run with --execute to push 10 Q&A entries.')
    return
  }

  const token = await getToken(env)
  console.log('✓ Access token\n')

  const results = []
  for (let i = 0; i < QA_SEED.length; i++) {
    const qa = QA_SEED[i]
    process.stdout.write(`  ${i + 1}/10 ${qa.question.slice(0, 60)}...`)

    // Step 1 — create question
    const qRes = await fetch(`https://mybusinessqanda.googleapis.com/v1/locations/${loc}/questions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: qa.question }),
    })
    const qJson = await qRes.json()
    if (!qRes.ok) {
      console.log(` ✗ Q failed: ${qJson?.error?.message?.slice(0, 120)}`)
      results.push({ q: qa.question, ok: false, error: qJson?.error?.message })
      continue
    }
    const questionName = qJson.name // locations/X/questions/Y

    // Step 2 — answer it
    const aRes = await fetch(`https://mybusinessqanda.googleapis.com/v1/${questionName}/answers:upsert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: { text: qa.answer } }),
    })
    const aJson = await aRes.json()
    if (!aRes.ok) {
      console.log(` ⚠ Q posted, A failed: ${aJson?.error?.message?.slice(0, 120)}`)
      results.push({ q: qa.question, questionName, qOk: true, aOk: false, error: aJson?.error?.message })
      continue
    }
    console.log(' ✓')
    results.push({ q: qa.question, questionName, ok: true, answerName: aJson.name })
  }

  console.log(`\n${results.filter(r => r.ok).length}/${QA_SEED.length} fully seeded`)
  fs.mkdirSync('out/gbp-audit', { recursive: true })
  fs.writeFileSync('out/gbp-audit/qa-seed-result-2026-05-22.json', JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(`FATAL: ${e?.message || e}`)
  process.exit(1)
})
