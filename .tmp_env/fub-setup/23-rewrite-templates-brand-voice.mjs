#!/usr/bin/env node
/**
 * Rewrites all 14 FUB templates (5 SL emails + 2 SL SMS + 5 BL emails + 2 BL SMS)
 * to comply with Ryan Realty brand voice per:
 *   - marketing_brain_skills/brand-voice/voice_guidelines.md (HARD em-dash ban)
 *   - CLAUDE.md §0.3 (banned words, pandering, editorializing)
 *   - Matt's 2026-05-17 directive: never pander, never editorialize, honest +
 *     transparent, never overtly state, let language speak for itself,
 *     authentic + not salesy
 *
 * Specific fixes applied:
 *   - All em-dashes (—, &mdash;) → comma or period
 *   - "Happy to walk through" → direct ask
 *   - "interesting things" / "a few things working in its favor" → cut
 *   - "the takeaway: clear story matters" → cut (overtly stated value)
 *   - "before it gets foot traffic" → cut (urgency editorializing)
 *   - Adds 2 missing seller SMS templates (SL-S1, SL-S2)
 *
 * Idempotent. Run: DELETE=1 to execute.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fub(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${BASIC}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json }
}

// Shared email shell — keeps the brand-aligned styling
function emailHtml(bodyHtml, signoff = 'Matt') {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

${bodyHtml}

<p style="margin-top:24px;">
${signoff}<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>
</p>

</div>`
}

function emailHtmlMattFull(bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">

${bodyHtml}

<p style="margin-top:24px;">
<strong>Matt Ryan</strong><br/>
Principal Broker, Ryan Realty<br/>
<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a><br/>
<a href="mailto:matt@ryan-realty.com" style="color:#102742;">matt@ryan-realty.com</a>
</p>

</div>`
}

// ──────────────────────────────────────────────────────────────────────────
// REWRITTEN CONTENT — every template
// ──────────────────────────────────────────────────────────────────────────

const TEMPLATES = {
  672: {
    name: 'SL-01 Seller LP Confirmation',
    subject: 'Got your home value request for %customSellerPropertyAddress%',
    body: emailHtmlMattFull(`<p>Hi %contact_first_name%,</p>

<p>We got your request for the home value analysis on <strong>%customSellerPropertyAddress%</strong>. I'm pulling comps now and you'll have it in your inbox shortly.</p>

<p>If there's anything I should know before then, recent upgrades, work you've done to the property, what your timing looks like, just reply here.</p>`),
  },

  673: {
    name: 'SL-02 Seller CMA Check-in',
    subject: 'Did the analysis come through?',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>Wanted to make sure the analysis on <strong>%customSellerPropertyAddress%</strong> came through.</p>

<p>If you want to dig into the numbers, I'm around. Call, text, or coffee, whatever works.</p>`),
  },

  674: {
    name: 'SL-03 Seller Market Update',
    subject: 'Where the local market is right now',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>A few things have moved in your area since the CMA. I'll pull the latest numbers and send specifics for your neighborhood in the next day or two.</p>

<p>If anything's changed on your end, timing, plans, the property, let me know.</p>`),
  },

  675: {
    name: 'SL-04 Seller Case Study',
    subject: 'A recent sale near you',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>A property near you closed recently. Worth a look if you're thinking about timing.</p>

<p>If you're getting closer to making a move, let's talk through what the next 60 days could look like for <strong>%customSellerPropertyAddress%</strong>.</p>`),
  },

  676: {
    name: 'SL-05 Seller Soft Check-in',
    subject: 'Still thinking about selling?',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>It's been a few weeks since the CMA on <strong>%customSellerPropertyAddress%</strong>. No pressure, just checking in.</p>

<p>If your timing's shifted, let me know. If not, I'll keep the market updates coming.</p>`),
  },

  677: {
    name: 'BL-01 Buyer LP Confirmation',
    subject: 'Got your listing search going',
    body: emailHtmlMattFull(`<p>Hi %contact_first_name%,</p>

<p>Thanks for setting up your search. I'm pulling listings that match what you're looking for. First batch in your inbox within 30 minutes.</p>

<p>After that, you'll get automatic alerts whenever something new hits the market in your criteria.</p>

<p>If there's anything I should know, a must-have, a deal-breaker, a neighborhood to skip, just reply here.</p>`),
  },

  678: {
    name: 'BL-02 Buyer 24h Check-in',
    subject: 'Anything caught your eye?',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>Sent the first batch yesterday. Anything look like a fit, or should I tighten the criteria?</p>

<p>Want to see one in person? I can set up a tour this week.</p>`),
  },

  679: {
    name: 'BL-03 Buyer Market Intel',
    subject: 'Where the market is in your search areas',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>A few things have moved in the areas you're searching since you started looking. I'll pull specifics for your price range and send through in the next day or two.</p>

<p>In the meantime, if anything's changed about what you're after, let me know.</p>`),
  },

  680: {
    name: 'BL-04 Buyer Featured Listing',
    subject: 'Worth a look',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>This one just hit the market and matches your criteria. Want to take a look this week?</p>`),
  },

  681: {
    name: 'BL-05 Buyer Soft Check-in',
    subject: 'Still looking?',
    body: emailHtml(`<p>Hi %contact_first_name%,</p>

<p>It's been a few weeks since we started your search. No pressure, just checking in.</p>

<p>If your criteria's shifted, let me know. If you're paused, I'll keep the alerts coming.</p>`),
  },

  682: {
    name: 'BL-S1 Buyer SMS Confirmation',
    subject: '[SMS]',
    body: `Hi %contact_first_name%, Matt at Ryan Realty. Got your search going. First batch in your inbox in 30 min. Anything I should factor in?`,
  },

  683: {
    name: 'BL-S2 Buyer SMS Check-in',
    subject: '[SMS]',
    body: `Hi %contact_first_name%, Matt at Ryan Realty checking in. Any of those listings worth a tour this week?`,
  },
}

// New SMS templates to CREATE (seller side, missing from earlier build)
const NEW_TEMPLATES = [
  {
    name: 'SL-S1 Seller SMS Confirmation',
    subject: '[SMS]',
    body: `Hi %contact_first_name%, Matt at Ryan Realty. Got your home value request for %customSellerPropertyAddress%. CMA in your inbox shortly. Anything I should factor in?`,
  },
  {
    name: 'SL-S2 Seller SMS Check-in',
    subject: '[SMS]',
    body: `Hi %contact_first_name%, Matt at Ryan Realty checking in on the home value analysis. Any questions on the numbers?`,
  },
]

// Strip HTML tags + style attributes + named entities so the lint only sees
// the user-visible text content of the email.
function visibleText(body) {
  return body
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // <style> blocks
    .replace(/\s+style="[^"]*"/gi, '')                // inline style attributes
    .replace(/<[^>]+>/g, ' ')                          // all other tags
    .replace(/&[a-z]+;/gi, ' ')                        // HTML entities
    .replace(/\s+/g, ' ')
    .trim()
}

// Validation: scan for em-dashes + banned words + semicolons in the VISIBLE
// text only (HTML attributes / CSS / entities ignored).
function lintTemplate(body) {
  const violations = []
  const text = visibleText(body)

  if (text.includes('—') || text.includes('–')) {
    violations.push('em-dash or en-dash present (HARD BAN)')
  }
  // Banned per CLAUDE.md voice guidelines
  const banned = ['stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled', 'boasts',
    'must-see', 'dream home', 'meticulously maintained', 'hidden gem', 'truly', 'happy to', 'love to',
    'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless', 'comprehensive', 'elevate',
    'unlock', 'holistic', 'dynamic', 'vibrant', 'bustling', 'eclectic', 'curated', 'bespoke', 'foster',
    'approximately', 'roughly', 'top producing', 'top 1 percent', 'white glove', 'luxury concierge',
    'premier brokerage', 'boutique brokerage', 'your real estate journey', 'we are passionate about',
    'we pride ourselves', 'act fast', "don't miss out", "won't last"]
  const lower = text.toLowerCase()
  for (const w of banned) {
    if (lower.includes(w.toLowerCase())) violations.push(`banned word: "${w}"`)
  }
  // Semicolons in user-visible text
  if (text.includes(';')) violations.push('semicolon present (banned)')
  return violations
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  // Lint all rewrites
  console.log('=== Voice lint pass ===')
  let lintPass = true
  for (const [id, t] of Object.entries(TEMPLATES)) {
    const v = lintTemplate(t.body)
    if (v.length) { console.log(`❌ id=${id} ${t.name}: ${v.join(', ')}`); lintPass = false }
    else console.log(`✅ id=${id} ${t.name}`)
  }
  for (const t of NEW_TEMPLATES) {
    const v = lintTemplate(t.body)
    if (v.length) { console.log(`❌ NEW ${t.name}: ${v.join(', ')}`); lintPass = false }
    else console.log(`✅ NEW ${t.name}`)
  }
  if (!lintPass) {
    console.log('\n❌ Lint failed. Fix violations before executing.')
    process.exit(1)
  }
  console.log('\n✅ All templates pass voice lint.\n')

  if (!DELETE) {
    console.log('Dry-run complete. Set DELETE=1 to actually update FUB.')
    return
  }

  // PUT each existing template
  console.log('=== Updating existing templates ===')
  let ok = 0, fail = 0
  for (const [id, t] of Object.entries(TEMPLATES)) {
    const r = await fub('PUT', `/templates/${id}`, t)
    if (r.status >= 200 && r.status < 300) {
      console.log(`  UPDATED id=${id} ${t.name}`)
      ok++
    } else {
      console.log(`  FAIL    id=${id} ${t.name} status=${r.status} ${JSON.stringify(r.json).slice(0,150)}`)
      fail++
    }
    await new Promise(r => setTimeout(r, 80))
  }

  // POST new SMS templates if they don't exist
  console.log('\n=== Creating new SMS templates ===')
  const all = []
  let next = '/templates?limit=100'
  while (next) {
    const r = await fub('GET', next)
    for (const t of (r.json?.templates || [])) all.push(t)
    const nl = r.json?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
  }
  const existingNames = new Set(all.map(t => t.name))
  for (const t of NEW_TEMPLATES) {
    if (existingNames.has(t.name)) {
      console.log(`  SKIP ${t.name} (already exists)`)
      continue
    }
    const r = await fub('POST', '/templates', t)
    if (r.status === 201) {
      console.log(`  CREATE ${t.name} → id=${r.json.id}`)
      ok++
    } else {
      console.log(`  FAIL ${t.name} status=${r.status} ${JSON.stringify(r.json).slice(0,150)}`)
      fail++
    }
  }

  console.log(`\nDone. ${ok} successful, ${fail} failed.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
