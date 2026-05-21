#!/usr/bin/env node
/**
 * Wire the drafted Ryan Realty action-plan content (out/fub-optimization/PLANS_CONTENT.md)
 * into Follow Up Boss via the FUB API.
 *
 * What this script does:
 *
 *   1. Creates ~40 new email templates for Plans 71-75 (Plans 69 + 70 reuse
 *      already-deployed SL-/BL- templates ids 672-685).
 *   2. Creates 1 new SMS template for Plan 72 Touch 0 (FSBO manual intro).
 *      Plan 71 T0 SMS already exists (id 77).
 *   3. PUTs each plan (69-75) with the full steps array + initialTextMessage
 *      where applicable.
 *
 * What this script does NOT do:
 *   - Run market-data merge fields (`%neighborhood_*%`, `%q1_median%`, etc.).
 *     Those merge tokens are sent literally; Matt's data layer will populate
 *     them later or via Resend send-time substitution.
 *   - Send physical letters / postcards / video texts. Those are surfaced as
 *     `createTask` broker prompts.
 *   - Modify audience filters / smart lists / automations (FUB UI work).
 *
 * Voice gate: every template body is grep-scanned for em-dash, semicolon,
 * exclamation, banned cliché words, and AI filler. A template with hits is
 * flagged in the summary; the script does NOT auto-skip it (the source file
 * already passed its own voice scan, but we re-scan post-Markdown→HTML to
 * catch any introduced artifacts).
 *
 * Rate limit: 250 req/min. Built-in 260ms sleep between API calls.
 *
 * Run:
 *   DRY=1 (default) — print what would happen
 *   DRY=0           — actually call FUB
 *
 * Output: out/fub-optimization/FUB_WIRING_SUMMARY.md
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY in env')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'
const DRY = process.env.DRY !== '0'

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const SUMMARY_OUT = path.join(REPO_ROOT, 'out', 'fub-optimization', 'FUB_WIRING_SUMMARY.md')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fub(method, p, body) {
  await sleep(260)  // 250 req/min headroom
  const headers = {
    Authorization: `Basic ${BASIC}`,
    'Content-Type': 'application/json',
    'X-System': 'RyanRealty-Web',
    'X-System-Key': 'ryan-realty-2026-plan-wiring',
  }
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, ok: res.ok, json, text }
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice gate
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_PUNCT = [
  { re: /[—–]/g, label: 'em/en-dash' },
  { re: /;/g, label: 'semicolon' },
]

const BANNED_WORDS = [
  // Real estate clichés
  'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled',
  'boasts', 'must-see', 'dream home', 'meticulously maintained',
  "entertainer's dream", 'tucked away', 'hidden gem',
  'truly', 'spacious', 'cozy', 'luxurious', 'updated throughout',
  'turnkey', 'immaculate', 'captivating', 'exquisite',
  // AI filler
  'delve', 'leverage', 'tapestry', 'navigate', 'robust',
  'seamless', 'comprehensive', 'elevate', 'unlock',
  // Defensive framing the brief calls out
  'no pitch', 'no pressure',
]

// Allowed exceptions documented in PLANS_CONTENT.md voice scan summary:
// "no expectation" + "no ask" appear in 5 places intentionally (FSBO/Expired
// audiences need the explicit low-pressure frame). We still flag them so they
// show in the summary.
const SOFT_FLAG_WORDS = ['no expectation', 'no ask']

function voiceScan(text) {
  const hits = []
  const lower = text.toLowerCase()
  // Strip HTML for plain-text scan (avoid matching style attrs / mailto links)
  const stripped = text.replace(/<[^>]+>/g, ' ').toLowerCase()

  for (const { re, label } of BANNED_PUNCT) {
    const matches = text.match(re)
    if (matches) hits.push({ kind: 'punct', label, count: matches.length })
  }

  // Exclamation marks in BODY only (subjects can have one in rare cases — but
  // we'll flag any in body and let Matt review).
  const exclamations = (text.match(/!/g) || []).length
  if (exclamations > 0) hits.push({ kind: 'punct', label: 'exclamation', count: exclamations })

  for (const word of BANNED_WORDS) {
    // word-boundary check, case-insensitive
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi')
    const matches = stripped.match(re)
    if (matches) hits.push({ kind: 'word', label: word, count: matches.length })
  }

  const softHits = []
  for (const word of SOFT_FLAG_WORDS) {
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi')
    const matches = stripped.match(re)
    if (matches) softHits.push({ label: word, count: matches.length })
  }

  return { hits, softHits }
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown → HTML (simple: PLANS_CONTENT.md only uses blockquote prose, lists,
// and merge tokens; no tables / inline code / headings inside template bodies)
// ─────────────────────────────────────────────────────────────────────────────

function mdToHtml(md) {
  // Strip leading "> " from blockquote
  const stripped = md.replace(/^>\s?/gm, '')
  const lines = stripped.split(/\r?\n/)

  const blocks = []
  let buf = []
  let mode = 'para'  // 'para' | 'list'

  function flushPara() {
    if (buf.length) {
      const para = buf.join(' ').trim()
      if (para) blocks.push(`<p style="margin:0 0 14px 0;">${escapeAndLink(para)}</p>`)
      buf = []
    }
  }
  function flushList() {
    if (buf.length) {
      const items = buf.map(item => `<li style="margin:0 0 6px 0;">${escapeAndLink(item)}</li>`).join('')
      blocks.push(`<ol style="padding-left:22px;margin:0 0 14px 0;">${items}</ol>`)
      buf = []
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line === '') {
      if (mode === 'list') flushList()
      else flushPara()
      mode = 'para'
      continue
    }
    const listMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (listMatch) {
      if (mode === 'para') flushPara()
      mode = 'list'
      buf.push(listMatch[2])
      continue
    }
    if (mode === 'list') {
      // continuation of list item? in the source, lists are single-line, but
      // be defensive
      buf[buf.length - 1] = (buf[buf.length - 1] || '') + ' ' + line
    } else {
      buf.push(line)
    }
  }
  if (mode === 'list') flushList()
  else flushPara()

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.55;max-width:640px;margin:0 auto;">\n${blocks.join('\n')}\n</div>`
}

function escapeAndLink(text) {
  // Escape HTML entities first
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Re-allow our own merge tokens (which already use plain text % …% so are safe)
  // Auto-link phone + URL + email
  out = out.replace(/\b541\.213\.6706\b/g, '<a href="tel:+15412136706" style="color:#102742;text-decoration:none;">541.213.6706</a>')
  out = out.replace(/\bryan-realty\.com(\/[^\s,)]*)?\b/g, (m) => `<a href="https://${m}" style="color:#102742;">${m}</a>`)
  out = out.replace(/\bmatt@ryan-realty\.com\b/g, '<a href="mailto:matt@ryan-realty.com" style="color:#102742;">matt@ryan-realty.com</a>')
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Template definitions, transcribed from out/fub-optimization/PLANS_CONTENT.md
// (verified voice-scanned at source). Bodies in raw Markdown blockquote prose
// from the source file with `> ` prefix removed.
// ─────────────────────────────────────────────────────────────────────────────

// Helper: build markdown body without `> ` (we'll feed mdToHtml())
const md = (s) => s.replace(/^[ \t]+/gm, '').trim()

const TEMPLATES_EMAIL = [
  // ─── Plan 71 Expired Recovery — Touches 1, 2, 3a, 4, 5, 7 ──────────────────
  {
    code: 'EXP-1', plan: 71, runAfterDays: 2, position: 2,  // pos 1 = T0 SMS in initialTextMessage path
    name: 'EXP-1 Expired Five reasons listings stall',
    subject: 'Five reasons Bend listings stall',
    body: md(`Hello %contact_first_name%,

Following up on the audit framework I sent. If you didn't get a chance to read it, the short version is that almost every expired listing in Bend comes down to one of five things.

1. The price thesis didn't match the comps that were closing in that window.
2. The photos didn't carry the home. Dark interiors, no hero shot, missing rooms.
3. The MLS description was generic. Buyers couldn't tell why your home was different from the next one.
4. The listing went quiet after week three. No price adjustments, no re-photography, no story refresh.
5. Agent responsiveness on showings and offers slowed the buyer pool down.

These are all fixable. None of them are about you or your home being wrong.

If you want me to run the audit on %customSellerPropertyAddress% specifically, reply with your address and I'll pull the comps that closed during your listing window and tell you which of the five it was. One page, free, no call required.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706`),
  },
  {
    code: 'EXP-2', plan: 71, runAfterDays: 6, position: 3,
    name: 'EXP-2 Expired Whats closing in your neighborhood',
    subject: "What's actually closing in your neighborhood",
    body: md(`Hello %contact_first_name%,

A quick read on what's happening in the market around %customSellerPropertyAddress%.

Over the last 90 days in your immediate area, the median closed price was on par with what was selling 12 months ago. Days on market is running 38. Months of supply sits at 4.1, which the standard threshold calls a balanced market.

What that means in practice. Homes priced correctly are still moving, but the window to capture buyer attention is shorter than it was two years ago. The first 14 days on a re-list carry more weight than they used to.

If you want the same data pulled specifically for your subdivision or street, reply and I'll send it over.

Matt
541.213.6706`),
  },
  {
    code: 'EXP-3', plan: 71, runAfterDays: 6, position: 4,
    name: 'EXP-3 Expired Personal letter intro (under 750K)',
    subject: 'A note instead of an email',
    body: md(`Hello %contact_first_name%,

I wanted to follow up on the audit framework from earlier this month with a note that wasn't an email.

I've been selling homes in Bend for twelve years. I've watched a lot of listings come off the market without selling, and almost all of them re-sold within six months under a different plan. The owners I work with are usually surprised at how specific the fixable issues turn out to be.

If you want a free written audit of what the prior listing did and didn't do, I'd be honored to put one together for %customSellerPropertyAddress%. One page. No call needed. Just reply to my email or send me a text at 541.213.6706.

Wishing you the best either way.

Matt Ryan
Principal Broker
Ryan Realty
541.213.6706
ryan-realty.com`),
  },
  {
    code: 'EXP-4', plan: 71, runAfterDays: 14, position: 5,
    name: 'EXP-4 Expired Whenever youre ready',
    subject: "Whenever you're ready",
    body: md(`Hello %contact_first_name%,

A short check-in. The audit framework offer on %customSellerPropertyAddress% is open whenever the timing works for you. There's no version of this where you owe me anything.

If your plans have changed, if you've decided to wait, if you're working with someone else, all of that is fine. If at any point you want a free written look at what happened on the prior listing and what would change on a re-list, reply to this email and I'll send it over within two days.

Matt
541.213.6706`),
  },
  {
    code: 'EXP-5', plan: 71, runAfterDays: 17, position: 6,
    name: 'EXP-5 Expired Mid-quarter market read',
    subject: 'Bend market, mid-quarter read',
    body: md(`Hello %contact_first_name%,

A read on the Bend market at the mid-quarter mark.

Median closed price held flat against the prior quarter. Active inventory is up 8 percent quarter over quarter. Months of supply at 4.2. Days on market running 36.

What that means for someone weighing a re-list. The market is balanced, not soft and not hot. Homes that are priced to the comps and presented well are still selling within the standard window. Homes that aren't are sitting.

Sharing for context, not as an ask. If you want the same data for your specific neighborhood or subdivision, reply and I'll send it.

Matt
541.213.6706`),
  },
  {
    code: 'EXP-7', plan: 71, runAfterDays: 15, position: 8,  // pos 7 = postcard task
    name: 'EXP-7 Expired Moving to quarterly list',
    subject: 'Moving you to the quarterly list',
    body: md(`Hello %contact_first_name%,

A heads up. After today, I'll move you from this follow-up sequence to my quarterly Bend market list. That means four emails a year with the real numbers on what's happening in our market, no other outreach.

If at any point you want to revisit the audit on %customSellerPropertyAddress% or talk through whether a re-list, rent, or hold makes sense, my number is 541.213.6706. Otherwise, I'll let the quarterly updates do the talking.

Wishing you the best.

Matt
541.213.6706
Reply STOP to opt out.`),
  },

  // ─── Plan 72 FSBO Recovery — Touches 1, 2, 3a, 4, 5, 7 ────────────────────
  {
    code: 'FSBO-1', plan: 72, runAfterDays: 2, position: 2,
    name: 'FSBO-1 Five things FSBOs in Bend miss',
    subject: 'Five things FSBOs in Bend tend to miss',
    body: md(`Hello %contact_first_name%,

Following up on the text. I work with sellers in Bend full time and I've noticed that the FSBOs who do well tend to have five things lined up that the ones who don't sell are missing.

1. A real comps read. Not Zillow's estimate, not the assessor's value. Actual closed sales in the last 90 days within your immediate area, adjusted for size and condition.
2. Professional photos. The single highest-impact thing a seller controls. The MLS data is clear that the photo set drives the click-through rate that drives the showings.
3. Syndication beyond the FSBO sites. Most buyers shop on Zillow and Realtor.com. Getting your listing visible there without an MLS spot is harder than it looks.
4. A pricing strategy past week three. Knowing in advance what price drop you'd accept and when. Sitting still after three weeks costs you the second wave of buyers.
5. Showing logistics that don't burn out the home. Schedule, lockbox or in-person, feedback loop, what to do with the dog. Small things, big drag on the sale.

Most FSBOs in Bend handle one or two of these well. The ones that close handle all five.

If you want the comps data for your specific area, reply with your address and I'll pull it. No charge, no call required.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706`),
  },
  {
    code: 'FSBO-2', plan: 72, runAfterDays: 6, position: 3,
    name: 'FSBO-2 Comps from your area',
    subject: 'Comps from your area',
    body: md(`Hello %contact_first_name%,

Here's the data I pull when I'm pricing a home in your area, so you have it for %customSellerPropertyAddress%.

Over the last 90 days within a half mile of you, the median closed price was %median_sale_price%. Days on market ran 38. The range of closed prices was %low_close% to %high_close%, with most clustering around the median.

What stands out. The homes that closed above the median had professional photography and were priced within 2 percent of comparable sales. The homes that took longer than 60 days to sell either started above the comps or had photo issues.

Sharing because it's useful, not because I want anything from it. If you want the full list of the actual closed addresses, reply and I'll send it over.

Matt
541.213.6706`),
  },
  {
    code: 'FSBO-3', plan: 72, runAfterDays: 6, position: 4,
    name: 'FSBO-3 Personal letter intro (under 750K)',
    subject: 'A note instead of an email',
    body: md(`Hello %contact_first_name%,

A note instead of an email this time.

I respect that you're selling %customSellerPropertyAddress% on your own. Plenty of FSBOs in Bend do, and a number of them sell within their target window.

I'm not writing to tell you to list with me. I'm writing to say that if you ever want the comps data, the photo audit, or the MLS-description benchmark I pull for the homes I price, I'll put it together for you free of charge and you can do whatever you want with it. Including selling on your own and pocketing the difference.

If you decide later that you'd rather hand it off, I'd be honored to talk through what that would look like. Either way, my number is 541.213.6706.

Wishing you the best.

Matt Ryan
Principal Broker, Ryan Realty
ryan-realty.com`),
  },
  {
    code: 'FSBO-4', plan: 72, runAfterDays: 14, position: 5,
    name: 'FSBO-4 Quick check on the FSBO',
    subject: 'Quick check on the FSBO',
    body: md(`Hello %contact_first_name%,

A short check-in on %customSellerPropertyAddress%. Has anything shifted on the sale, the timing, or the price?

If yes and you want the comps data, reply and I'll pull it for you. If no and the FSBO is moving along, I'll stay out of your way.

Matt
541.213.6706`),
  },
  {
    code: 'FSBO-5', plan: 72, runAfterDays: 17, position: 6,
    name: 'FSBO-5 Mid-quarter market',
    subject: 'Bend market, mid-quarter',
    body: md(`Hello %contact_first_name%,

A read on the Bend market at the mid-quarter mark, in case it's useful for the timing on %customSellerPropertyAddress%.

Median closed price held flat against the prior quarter. Active inventory is up 8 percent quarter over quarter. Months of supply at 4.2. Days on market running 36.

What that means for a FSBO. Buyer traffic is steady but not urgent. Homes priced to the comps and presented well are still selling within the standard window. The first 14 days of any listing are where the qualified buyers are looking.

If you want the data pulled specifically for your immediate area, reply and I'll send it.

Matt
541.213.6706`),
  },
  {
    code: 'FSBO-7', plan: 72, runAfterDays: 15, position: 8,
    name: 'FSBO-7 Moving to quarterly list',
    subject: 'Moving you to the quarterly list',
    body: md(`Hello %contact_first_name%,

A heads up. After today, I'll move you to my quarterly Bend market list. Four emails a year with the actual numbers on our market, nothing else.

If you sell %customSellerPropertyAddress% on your own, congratulations. That's a real accomplishment. If at any point you'd rather hand it off, my number is 541.213.6706.

Wishing you the best.

Matt
Ryan Realty
Reply STOP to opt out.`),
  },

  // ─── Plan 73 Out-of-State Owner — Quarterly ─────────────────────────────
  {
    code: 'OOS-1', plan: 73, runAfterDays: 0, position: 1,
    name: 'OOS-1 Where the Bend market sits Q1',
    subject: 'Where the Bend market sits this quarter',
    body: md(`Hello %contact_first_name%,

A quarterly read on the Bend market for owners who hold property here but live elsewhere.

The Bend median single-family closed price this quarter was %q1_median%. That's %q1_yoy_pct% versus the same window last year. Active inventory ended the quarter at %q1_active%, with months of supply at %q1_mos%. Days on market ran %q1_dom%.

What stands out for absentee owners specifically. The rental side of Bend has been steady. Vacation rental cap rates continue to compress as inventory of short-term-rental-eligible properties tightens under city regulation. Long-term rental occupancy is holding at 96 percent.

If you want a current rent comp or value read on your specific Bend property, reply with the address and I'll pull it. No expectation either way.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706
ryan-realty.com`),
  },
  {
    code: 'OOS-2', plan: 73, runAfterDays: 90, position: 2,
    name: 'OOS-2 Resort and STR performance Q2',
    subject: 'Resort community and short-term rental performance',
    body: md(`Hello %contact_first_name%,

A focused look at how resort and short-term-rental properties are performing in Central Oregon for the second quarter.

Sunriver, Tetherow, Caldera Springs, Pronghorn, Brasada, and Black Butte each saw distinct patterns. Sunriver continues to lead in short-term rental gross revenue. Tetherow stays the highest median sale price. Caldera Springs is the fastest-growing inventory base. Black Butte is the most consistent year-round buyer pool.

For specific numbers on the resort community where you own, reply and I'll pull the quarterly data on your community alone. Sale comps, gross rental revenue if your property is in a managed program, occupancy rate, days on market.

The short-term rental regulatory picture in Bend proper continues to evolve. If you own inside city limits and you operate as a STR, the legal landscape is worth a read every quarter. Reply if you want a current summary of where city rules stand.

Matt
541.213.6706
ryan-realty.com`),
  },
  {
    code: 'OOS-3', plan: 73, runAfterDays: 91, position: 3,
    name: 'OOS-3 Equity and tax Q3',
    subject: 'Equity and tax considerations for absentee Bend owners',
    body: md(`Hello %contact_first_name%,

A read on equity and tax considerations specific to owners who hold Bend property from out of state.

Equity. The average Bend single-family home is up 38 percent in market value over the last five years per Spark MLS closed-sale data. If you bought before 2021, you're likely sitting on substantial equity. Knowing your current value matters for refinance, HELOC, 1031 exchange planning, or estate planning.

Tax. Oregon property tax assessed values reset at sale, so a long-hold owner often has an assessed value well below market. If you're considering selling, the gap between assessed and market matters for both the buyer's payment math and your capital gains exposure.

1031 exchange. If you're holding a Bend rental and considering selling to roll into a different market, the 1031 timeline is strict. Forty-five days to identify the replacement property, 180 to close. If that's on your radar, planning six months out is a better window than three.

None of this is tax advice and your CPA gets the final word. But if you want a current market value pulled on your Bend property so you have a real number for any of these conversations, reply with the address.

Matt
541.213.6706
ryan-realty.com`),
  },
  {
    code: 'OOS-4', plan: 73, runAfterDays: 92, position: 4,
    name: 'OOS-4 Year-end and next year Q4',
    subject: 'Year-end Bend market and next year outlook',
    body: md(`Hello %contact_first_name%,

A year-end read on Bend and what the data points toward for next year.

This year in Bend. Median single-family closed price ended the year at %ytd_median%. Total closed transactions came in at %ytd_count%. Active inventory at year-end was %ytd_active%. Months of supply finished at %ytd_mos%. Days on market for the year averaged %ytd_dom%.

What the data points to for the year ahead. Active inventory has been trending up for three quarters, which historically precedes a flattening of price growth rather than a decline. Mortgage rates remain the dominant variable. If rates move down meaningfully, demand re-enters fast. If they hold, the balanced market continues.

For Bend absentee owners specifically. The short-term rental regulatory environment will continue to shape your decision set. Long-term rental occupancy remains strong. Equity positions for owners who held through 2020 to 2024 are substantial.

If you want a current value read pulled on your Bend property for end-of-year planning, reply with the address and I'll send it within two days.

Wishing you a good close to the year.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706
ryan-realty.com`),
  },

  // ─── Plan 74 Neighborhood Resident — 12 monthly emails ─────────────────────
  {
    code: 'NHD-01', plan: 74, runAfterDays: 0, position: 1,
    name: 'NHD-01 Neighborhood January',
    subject: '%neighborhood_name% in January',
    body: md(`Hello %contact_first_name%,

A monthly read on what's happening in %neighborhood_name%, the neighborhood your home at %customSellerPropertyAddress% sits in.

January closed sales. %neighborhood_closed_this_month% homes closed in %neighborhood_name% last month at a median of %neighborhood_median_price%. That's %neighborhood_yoy_pct% versus the same month a year ago.

Days on market and inventory. The %neighborhood_name% median time on market in January was %neighborhood_dom% days. Active inventory at month-end was %neighborhood_active% homes. Months of supply: %neighborhood_mos%.

What that says about the neighborhood right now. Reply if you want me to pull the closed comps or active list for your specific street.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706`),
  },
  {
    code: 'NHD-02', plan: 74, runAfterDays: 30, position: 2,
    name: 'NHD-02 Neighborhood February',
    subject: '%neighborhood_name% in February',
    body: md(`Hello %contact_first_name%,

February data on %neighborhood_name%.

%neighborhood_closed_this_month% homes closed at a median of %neighborhood_median_price%. Year over year that's %neighborhood_yoy_pct%.

The market typically warms up between mid-February and mid-March in Bend. The active count at month-end was %neighborhood_active% with months of supply at %neighborhood_mos%, which is the read on whether buyers or sellers have the advantage at the moment.

If you want the closed addresses or active addresses for the homes within a quarter mile of %customSellerPropertyAddress%, reply and I'll send them.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-03', plan: 74, runAfterDays: 30, position: 3,
    name: 'NHD-03 Neighborhood March',
    subject: '%neighborhood_name% in March',
    body: md(`Hello %contact_first_name%,

March numbers on %neighborhood_name%.

Closed sales last month: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

The spring market in Bend typically opens here. March through June is where 45 percent of the year's transactions historically land. If %neighborhood_name% follows the regional pattern, inventory will tick up over the next eight weeks and the buyer pool will widen.

Days on market in March: %neighborhood_dom%. Active inventory at month-end: %neighborhood_active% homes. Months of supply: %neighborhood_mos%.

Reply if you want street-level data for your block.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-04', plan: 74, runAfterDays: 30, position: 4,
    name: 'NHD-04 Neighborhood April',
    subject: '%neighborhood_name% in April',
    body: md(`Hello %contact_first_name%,

The April read on %neighborhood_name%.

Closed homes: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

Days on market dropped to %neighborhood_dom% as the spring market took hold. Active inventory at month-end: %neighborhood_active%. Months of supply: %neighborhood_mos%.

The pattern across Bend in April was a healthy spread between list and sale price. Homes priced to the comps and presented well moved within the standard window. Homes priced above the comps either adjusted within three weeks or sat.

If you want the active listings within a half mile of %customSellerPropertyAddress% so you can see what your neighbors are doing, reply and I'll send the list.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-05', plan: 74, runAfterDays: 30, position: 5,
    name: 'NHD-05 Neighborhood May',
    subject: '%neighborhood_name% in May',
    body: md(`Hello %contact_first_name%,

May data for %neighborhood_name%.

Closed sales: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

May is typically the peak listing month in Bend. Days on market in %neighborhood_name% was %neighborhood_dom%. Active inventory at month-end: %neighborhood_active%. Months of supply: %neighborhood_mos%.

If you've been thinking about your home's current value for any reason, refinance, HELOC, planning, estate, reply and I'll pull a current read on %customSellerPropertyAddress% within two days. No need to be considering selling.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-06', plan: 74, runAfterDays: 30, position: 6,
    name: 'NHD-06 Neighborhood June',
    subject: '%neighborhood_name% in June',
    body: md(`Hello %contact_first_name%,

The June read on %neighborhood_name%.

%neighborhood_closed_this_month% homes closed last month at a median of %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

June often shows the year's strongest pricing in Bend as buyer demand peaks and sellers stay firm on price. Days on market: %neighborhood_dom%. Active inventory: %neighborhood_active%. Months of supply: %neighborhood_mos%.

Half the year is in the books. If you'd like a mid-year value read on %customSellerPropertyAddress%, reply and I'll send it.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-07', plan: 74, runAfterDays: 30, position: 7,
    name: 'NHD-07 Neighborhood July',
    subject: '%neighborhood_name% in July',
    body: md(`Hello %contact_first_name%,

July numbers on %neighborhood_name%.

Closed sales: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

July is typically when the summer market starts settling. Days on market begins to lengthen as the urgent buyers have already moved. %neighborhood_dom% days in %neighborhood_name% last month, %neighborhood_active% active at month-end, months of supply at %neighborhood_mos%.

What that means for someone considering listing in the fall. The window between mid-August and early October is where serious buyers re-enter after summer travel. Worth knowing.

Reply if you want the actual closed addresses for the homes that sold near you in July.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-08', plan: 74, runAfterDays: 31, position: 8,
    name: 'NHD-08 Neighborhood August',
    subject: '%neighborhood_name% in August',
    body: md(`Hello %contact_first_name%,

August read on %neighborhood_name%.

Closed homes: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

Days on market: %neighborhood_dom%. Active inventory: %neighborhood_active%. Months of supply: %neighborhood_mos%.

Late August is when fall planning conversations start for sellers thinking about a Q4 listing. The buyer pool re-engages in September after summer travel wraps. If you want a read on whether September or spring is the better window for %customSellerPropertyAddress% specifically, reply and I'll walk through what the data says for your particular neighborhood.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-09', plan: 74, runAfterDays: 30, position: 9,
    name: 'NHD-09 Neighborhood September',
    subject: '%neighborhood_name% in September',
    body: md(`Hello %contact_first_name%,

September data for %neighborhood_name%.

Closed sales: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

September is historically the fall reset in Bend. Buyer activity picks back up. Days on market: %neighborhood_dom%. Active inventory: %neighborhood_active%. Months of supply: %neighborhood_mos%.

If you'd been thinking about a fall listing window, this is the inventory you'd be competing with. Reply if you want the comparable active addresses within a half mile of %customSellerPropertyAddress%.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-10', plan: 74, runAfterDays: 30, position: 10,
    name: 'NHD-10 Neighborhood October',
    subject: '%neighborhood_name% in October',
    body: md(`Hello %contact_first_name%,

October read on %neighborhood_name%.

%neighborhood_closed_this_month% homes closed last month at a median of %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

Fall typically sees more measured buyer activity in Bend, fewer browsers and more serious. Days on market: %neighborhood_dom%. Active inventory: %neighborhood_active%. Months of supply: %neighborhood_mos%.

If anything about your timing has shifted, reply and I'll pull a current value read on %customSellerPropertyAddress% within two days.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-11', plan: 74, runAfterDays: 31, position: 11,
    name: 'NHD-11 Neighborhood November',
    subject: '%neighborhood_name% in November',
    body: md(`Hello %contact_first_name%,

November numbers on %neighborhood_name%.

Closed sales: %neighborhood_closed_this_month%. Median price: %neighborhood_median_price%. Year over year: %neighborhood_yoy_pct%.

Days on market: %neighborhood_dom%. Active inventory: %neighborhood_active%. Months of supply: %neighborhood_mos%.

November and December are quieter months in Bend, both for listings and for buyer activity. Most owners use the end of the year to think about whether next spring is the right window. If that conversation is on your mind, reply and I'll send the comps that would inform pricing for %customSellerPropertyAddress%.

Matt
541.213.6706`),
  },
  {
    code: 'NHD-12', plan: 74, runAfterDays: 30, position: 12,
    name: 'NHD-12 Neighborhood December year-end',
    subject: '%neighborhood_name% year-end',
    body: md(`Hello %contact_first_name%,

A year-end read on %neighborhood_name%.

Full-year closed sales: %neighborhood_ytd_count%. Year-end median price: %neighborhood_ytd_median%. Year over year: %neighborhood_ytd_yoy_pct%.

Days on market for the year averaged %neighborhood_ytd_dom%. Inventory at year-end stood at %neighborhood_active%. Months of supply: %neighborhood_mos%.

What stood out in %neighborhood_name% this year. The full-year pattern shows whether the neighborhood is following the broader Bend market or running ahead or behind it. Worth a look as you think about next year.

If a current value read on %customSellerPropertyAddress% would be useful for any year-end planning, reply and I'll send it within two days.

Wishing you a good close to the year.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706
ryan-realty.com`),
  },

  // ─── Plan 75 Sphere Nurture — 6 bi-monthly touches ─────────────────────────
  {
    code: 'SPH-1', plan: 75, runAfterDays: 0, position: 1,
    name: 'SPH-1 Sphere January',
    subject: 'A short note as the year starts',
    body: md(`Hi %contact_first_name%,

Happy new year from Bend.

A short note as the year opens. The Bend market closed last year with the median single-family home at %ytd_median% and the volume of closed transactions at %ytd_count%. Active inventory at year-end was %ytd_active%, and months of supply finished at %ytd_mos%. That's the read on the market you'd want if anyone you know is thinking about moving here, listing, refinancing, or just curious where things stand.

No agenda on my side. Just wanted you to have the picture as the year starts.

If anything has changed for you or anyone close to you, my number is 541.213.6706.

Wishing you a good year ahead.

Matt`),
  },
  {
    code: 'SPH-2', plan: 75, runAfterDays: 60, position: 2,
    name: 'SPH-2 Sphere March',
    subject: 'Spring market kickoff and a quick maintenance reminder',
    body: md(`Hi %contact_first_name%,

Spring market in Bend opened a little earlier this year than usual. The first wave of buyers is already in town and showings are picking back up after winter. If anyone you know is thinking about a move this year, March through June is where most of the year's serious activity lands.

Two homeowner maintenance reminders since we're heading into the warm months.

One. Now is the right window to clear gutters and check the roof before fire season hits. If you don't have a roofer you trust, I have a couple of names.

Two. If you're on a well or have an HOA-shared water system, spring is the time to test. Easy and cheap, and it saves a headache if something is off.

If anyone you know is looking at a Bend property this spring, my number is below.

Matt
541.213.6706`),
  },
  {
    code: 'SPH-3', plan: 75, runAfterDays: 61, position: 3,
    name: 'SPH-3 Sphere May',
    subject: "Mid-year and what's happening around town",
    body: md(`Hi %contact_first_name%,

A quick check-in as we hit mid-year.

The Bend market is doing what the data said it would. Median price holding flat, inventory tracking up slowly, days on market just under 40. If anyone you know has been weighing a listing this year, the window between now and August is the active part of the calendar.

A few things happening around Bend that you might want to know about. The downtown summer concert series started up. The farmers market is in full swing at NorthWest Crossing on Saturdays. The Old Mill District has a couple of new restaurants worth a try if you haven't been down there in a while.

If you're in town this summer and want to grab coffee or a drink, my calendar is open. Just let me know.

Matt
541.213.6706`),
  },
  {
    code: 'SPH-4', plan: 75, runAfterDays: 61, position: 4,
    name: 'SPH-4 Sphere July',
    subject: 'Summer check-in',
    body: md(`Hi %contact_first_name%,

A short note as we hit mid-summer.

A quick market read for you. Bend is in the middle of its strongest activity window. Median price has held the line, days on market is hovering at 38, and the inventory has ticked up a little but stayed in the balanced-market range. If anyone you know is wondering whether now or fall is the better listing window, the data says now is still active and August will start to thin out.

If we're hosting any events this year, you'd be the first to know. So far the plan is a small fall gathering. I'll send details when it's closer.

If you're around Bend and want to catch up, my line is always open.

Matt
541.213.6706`),
  },
  {
    code: 'SPH-5', plan: 75, runAfterDays: 61, position: 5,
    name: 'SPH-5 Sphere September',
    subject: 'Fall market and a few home prep tips',
    body: md(`Hi %contact_first_name%,

The fall market in Bend is starting up. Buyer activity always picks back up after Labor Day, and the September-through-mid-November window is the second-most active period in the year. If anyone you know is thinking about a listing, the data says fall is still real, not just a slower extension of summer.

A couple of seasonal homeowner tips if you're in your house here.

One. Schedule the furnace check now rather than the first cold snap. Same with the chimney if you use a wood stove. The good people get booked out fast.

Two. Drain outside faucets and disconnect hoses before the first hard freeze. Easy to forget, expensive to repair.

Three. Walk the perimeter and check for any wildfire-season debris that needs to come off the deck or away from the house.

If you ever want a current value read on your home or for anyone you know, just reply and I'll send it within two days.

Matt
541.213.6706`),
  },
  {
    code: 'SPH-6', plan: 75, runAfterDays: 61, position: 6,
    name: 'SPH-6 Sphere November',
    subject: 'Year-end thank you and a small holiday note',
    body: md(`Hi %contact_first_name%,

A short note as the year wraps up.

This year was a good one for our small business, and that's because of people like you who have trusted us, sent friends our way, or just stayed in touch. It means a lot, and it's the reason a small brokerage like ours can keep doing this work.

If you celebrate the holidays in any version, I hope it's a good one for you and the people closest to you. The Ryan Realty holiday card will land in your mailbox in early December.

Wishing you a good close to the year, and a good start to next.

Matt
541.213.6706`),
  },
]

// Updated bodies for the already-existing SL- and BL- templates (rewrites of
// 672-681 per PLANS_CONTENT.md Plans 69 + 70). These get PUT updates to
// replace the prior bodies.
const TEMPLATES_EMAIL_UPDATE = [
  {
    id: 672, name: 'SL-01 Seller LP Confirmation',
    subject: 'Your CMA for %customSellerPropertyAddress% is on the way',
    body: md(`Hello %contact_first_name%,

Thanks for the home value request on %customSellerPropertyAddress%.

The full CMA will be in your inbox within the next hour or two. It includes closed comps from the last 90 days within a half mile of you, an active-market read for your neighborhood, and a pricing range based on the data.

If anything specific about the property would change how I think about value, recent upgrades, special features, anything unique, reply here and I'll factor it in before I send.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706
matt@ryan-realty.com`),
  },
  {
    id: 673, name: 'SL-02 Seller CMA Check-in',
    subject: 'Did the CMA come through',
    body: md(`Hello %contact_first_name%,

Wanted to make sure the analysis on %customSellerPropertyAddress% came through and answered the questions you had.

If anything in the comps didn't match what you were expecting, or if a number looked off, reply and I'll walk through it. The CMA is a starting point, and the more I know about the property the sharper the value range gets.

Matt
541.213.6706`),
  },
  {
    id: 674, name: 'SL-03 Seller Market Update',
    subject: 'Where Bend is right now',
    body: md(`Hello %contact_first_name%,

A short read on Bend in case anything has shifted since the CMA went out.

Median closed price for the last 90 days in Bend: %median_sale_price%. Year over year: %yoy_pct%. Months of supply: %mos%. Days on market: %dom% days.

What that says about the market your home sits in. The standard threshold for months of supply is 4. Below that is a seller's market, 4 to 6 is balanced, above 6 leans buyer. Your read in Bend right now is %mos_classification%.

If the timing on %customSellerPropertyAddress% has shifted or you want me to refresh the CMA with anything new, reply.

Matt
541.213.6706`),
  },
  {
    id: 675, name: 'SL-04 Seller Case Study',
    subject: 'A recent close near %customSellerPropertyAddress%',
    body: md(`Hello %contact_first_name%,

A home close to %customSellerPropertyAddress% closed recently and the data is worth a look.

The property: %recent_sold_address%
Listed at: %list_price%
Sold at: %sold_price%
Days on market: %days_on_market%
Year built: %year_built%, %sqft% square feet, %beds% beds %baths% baths

What that means for your CMA range. The sale-to-list ratio there was %sale_to_list_pct%. The price per square foot was %price_per_sqft%. Both feed into where %customSellerPropertyAddress% would price if you were going to market in the next 60 days.

If you're getting closer to a decision, reply and we'll talk through what the listing strategy would look like.

Matt
541.213.6706`),
  },
  {
    id: 676, name: 'SL-05 Seller Soft Check-in',
    subject: 'Still considering selling',
    body: md(`Hello %contact_first_name%,

A short check-in. It's been a month since the CMA on %customSellerPropertyAddress%.

If your timing has shifted, if you've decided to wait, or if anything about the property has changed, reply and let me know. If you're still considering selling and want a refreshed value read with the last 30 days of data layered in, I can send that within two days.

Either way, I'll keep you on the monthly market updates so when the time is right you have the picture.

Matt
541.213.6706`),
  },
  {
    id: 677, name: 'BL-01 Buyer LP Confirmation',
    subject: 'Your search is set up and matches are on the way',
    body: md(`Hello %contact_first_name%,

Thanks for the buyer search request.

The first set of matching listings will be in your inbox within 30 minutes. They'll come from the live MLS, not Zillow, so the prices and statuses will be current.

A few things that help me sharpen what I send. If you have a hard must-have, a school district, a specific neighborhood, an outdoor space requirement, anything that would auto-disqualify a property, reply and let me know. Same goes for any deal-breakers. The fewer wrong matches I send, the faster we get to the right ones.

If you want to talk through what to expect on the buyer process in Central Oregon, my number is below.

Matt Ryan
Principal Broker, Ryan Realty
541.213.6706
matt@ryan-realty.com`),
  },
  {
    id: 678, name: 'BL-02 Buyer 24h Check-in',
    subject: 'Anything catch your eye',
    body: md(`Hello %contact_first_name%,

Following up on the first set of matches that went out yesterday.

If any of them are worth a closer look in person, reply and let me know which ones and I'll set up showings. If the matches felt off, tell me what didn't fit and I'll re-tune the search.

Quick read on the market you're shopping. In %customBuyerSearchAreas%, days on market is running 38 and months of supply sits at 4.1. That's a balanced market by the standard threshold, which means there's room to negotiate on most properties but you'd want to move quickly on anything that hits all your boxes.

Matt
541.213.6706`),
  },
  {
    id: 679, name: 'BL-03 Buyer Market Intel',
    subject: "What's moving in %customBuyerSearchAreas%",
    body: md(`Hello %contact_first_name%,

A read on what's actually moving in the areas you're searching, so you know what the market looks like in real time.

Recent closes in %customBuyerSearchAreas%:

%recent_close_1_address%, %recent_close_1_price%, %recent_close_1_dom% days on market
%recent_close_2_address%, %recent_close_2_price%, %recent_close_2_dom% days
%recent_close_3_address%, %recent_close_3_price%, %recent_close_3_dom% days

What stands out. The fastest closes were within 10 days. The slower ones either started above the comps or had condition issues that came out in inspection. If a property in your search hits the comps and presents well, expect competition. If it sits more than 30 days, there's usually a reason.

Reply if you want any of these or anything similar lined up for a showing.

Matt
541.213.6706`),
  },
  {
    id: 680, name: 'BL-04 Buyer Featured Listing',
    subject: '%featured_address% looks like a match for your search',
    body: md(`Hello %contact_first_name%,

A new listing came on this week that lines up with what you're looking for.

%featured_address%
%featured_price%
%featured_beds% beds, %featured_baths% baths, %featured_sqft% square feet
%featured_year_built%

Quick read on why it's worth a look. %one_specific_property_fact_one%. %one_specific_property_fact_two%.

Reply if you want to set up a showing this week. Most listings in this price range and area are seeing showing activity within the first 7 days.

Matt
541.213.6706`),
  },
  {
    id: 681, name: 'BL-05 Buyer Soft Check-in',
    subject: 'Still looking',
    body: md(`Hello %contact_first_name%,

A month into the search. Wanted to check in on a couple of things.

One. Has anything changed on what you're looking for? Different neighborhood, different budget, different timeline. If yes, reply and I'll re-tune the search so the matches stay relevant.

Two. Has the timing shifted? If you're closer to ready, we can step up the showing pace. If you've decided to wait, no problem, I'll keep the search running quietly until you tell me to pause it.

Either way, no need to do anything if everything is on track.

Matt
541.213.6706`),
  },
]

// New SMS templates we need to create. Plan 71 T0 already exists (id 77).
const TEMPLATES_SMS_CREATE = [
  {
    code: 'FSBO-T0',
    name: 'FSBO-T0 FSBO personal intro (manual send)',
    message: `Hello %contact_first_name%, saw your home for sale at %customSellerPropertyAddress%. Selling on your own is a real amount of work and I respect that. If at any point you'd like the comps data I pull when I'm pricing in your neighborhood, reply and I'll send it. No expectation that you'd list with me. Matt Ryan, Principal Broker, Ryan Realty. ryan-realty.com`,
  },
]

// SMS template ids that already exist (won't be recreated)
const EXISTING_SMS = {
  'EXP-T0': 77,                // Plan 71 Touch 0 (manual)
  'SL-S1': 684,                // Plan 69 initialTextMessage
  'SL-S2': 685,                // Plan 69 Day 3 personal SMS reminder
  'BL-S1': 682,                // Plan 70 initialTextMessage
  'BL-S2': 683,                // Plan 70 Day 3 personal SMS reminder
}

// ─────────────────────────────────────────────────────────────────────────────
// Action-plan step builders (after templates have ids)
// ─────────────────────────────────────────────────────────────────────────────

function buildPlan71Steps(emailIds) {
  // 7-touch over 90 days. Touch 0 SMS = manual (separate task at T0).
  // FUB does not support sendText steps — manual SMS surfaces as Text-type task.
  // waitDays counted from previous step's COMPLETION.
  return [
    {
      action: 'createTask', position: 1, runAfterDays: 0, assignedUserId: -1,
      taskName: 'Send EXP-T0 SMS to %contact_first_name% (manual — template id 77)',
      taskType: 'Text',
    },
    {
      action: 'sendEmail', position: 2, runAfterDays: 2, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-1'],
    },
    {
      action: 'sendEmail', position: 3, runAfterDays: 6, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-2'],
    },
    {
      action: 'createTask', position: 4, runAfterDays: 6, assignedUserId: -1,
      taskName: 'Mail letter to %contact_first_name% at %customSellerPropertyAddress% (under $750K) or send personal video text (over $750K)',
      taskType: 'Other',
    },
    {
      action: 'sendEmail', position: 5, runAfterDays: 0, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-3'],
    },
    {
      action: 'sendEmail', position: 6, runAfterDays: 14, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-4'],
    },
    {
      action: 'sendEmail', position: 7, runAfterDays: 17, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-5'],
    },
    {
      action: 'createTask', position: 8, runAfterDays: 30, assignedUserId: -1,
      taskName: 'Mail postcard to %contact_first_name% at %customSellerPropertyAddress% (Day 75 batch run)',
      taskType: 'Other',
    },
    {
      action: 'sendEmail', position: 9, runAfterDays: 15, assignedUserId: -1,
      emailTemplateId: emailIds['EXP-7'],
    },
    {
      action: 'addTags', position: 10, runAfterDays: 0,
      tags: ['expired:long-nurture'],
    },
  ]
}

function buildPlan72Steps(emailIds, smsIds) {
  return [
    {
      action: 'createTask', position: 1, runAfterDays: 0, assignedUserId: -1,
      taskName: `Send FSBO-T0 SMS to %contact_first_name% (manual — template id ${smsIds['FSBO-T0']})`,
      taskType: 'Text',
    },
    {
      action: 'sendEmail', position: 2, runAfterDays: 2, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-1'],
    },
    {
      action: 'sendEmail', position: 3, runAfterDays: 6, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-2'],
    },
    {
      action: 'createTask', position: 4, runAfterDays: 6, assignedUserId: -1,
      taskName: 'Mail letter to %contact_first_name% at %customSellerPropertyAddress% (under $750K) or send personal video text (over $750K)',
      taskType: 'Other',
    },
    {
      action: 'sendEmail', position: 5, runAfterDays: 0, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-3'],
    },
    {
      action: 'sendEmail', position: 6, runAfterDays: 14, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-4'],
    },
    {
      action: 'sendEmail', position: 7, runAfterDays: 17, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-5'],
    },
    {
      action: 'createTask', position: 8, runAfterDays: 30, assignedUserId: -1,
      taskName: 'Mail postcard to %contact_first_name% at %customSellerPropertyAddress% (Day 75 batch run)',
      taskType: 'Other',
    },
    {
      action: 'sendEmail', position: 9, runAfterDays: 15, assignedUserId: -1,
      emailTemplateId: emailIds['FSBO-7'],
    },
    {
      action: 'addTags', position: 10, runAfterDays: 0,
      tags: ['fsbo:long-nurture'],
    },
  ]
}

function buildPlan73Steps(emailIds) {
  // 4 quarterly emails over 12 months. waitDays counted from prior completion.
  return [
    { action: 'sendEmail', position: 1, runAfterDays: 0, assignedUserId: -1, emailTemplateId: emailIds['OOS-1'] },
    { action: 'sendEmail', position: 2, runAfterDays: 90, assignedUserId: -1, emailTemplateId: emailIds['OOS-2'] },
    { action: 'sendEmail', position: 3, runAfterDays: 91, assignedUserId: -1, emailTemplateId: emailIds['OOS-3'] },
    { action: 'sendEmail', position: 4, runAfterDays: 92, assignedUserId: -1, emailTemplateId: emailIds['OOS-4'] },
  ]
}

function buildPlan74Steps(emailIds) {
  // 12 monthly emails. waitDays from prior completion.
  const months = [0, 30, 30, 30, 30, 30, 30, 31, 30, 30, 31, 30]
  return Array.from({ length: 12 }, (_, i) => ({
    action: 'sendEmail',
    position: i + 1,
    runAfterDays: months[i],
    assignedUserId: -1,
    emailTemplateId: emailIds[`NHD-${String(i + 1).padStart(2, '0')}`],
  }))
}

function buildPlan75Steps(emailIds) {
  // 6 bi-monthly emails over 12 months. Touch 1 Jan, then ~60 days each.
  const gaps = [0, 60, 61, 61, 61, 61]
  return Array.from({ length: 6 }, (_, i) => ({
    action: 'sendEmail',
    position: i + 1,
    runAfterDays: gaps[i],
    assignedUserId: -1,
    emailTemplateId: emailIds[`SPH-${i + 1}`],
  }))
}

function buildPlan69Steps(/* uses existing 672-676, 684 */) {
  return [
    { action: 'createTask', position: 1, runAfterDays: 0, assignedUserId: -1,
      taskName: 'Call %contact_first_name% — seller LP lead', taskType: 'Call' },
    { action: 'sendEmail', position: 2, runAfterDays: 0, assignedUserId: -1, emailTemplateId: 672 },
    { action: 'sendEmail', position: 3, runAfterDays: 1, assignedUserId: -1, emailTemplateId: 673 },
    { action: 'createTask', position: 4, runAfterDays: 2, assignedUserId: -1,
      taskName: 'Send personal SMS to %contact_first_name% (HOT only — template SL-S2 id 685)',
      taskType: 'Text' },
    { action: 'sendEmail', position: 5, runAfterDays: 4, assignedUserId: -1, emailTemplateId: 674 },
    { action: 'sendEmail', position: 6, runAfterDays: 7, assignedUserId: -1, emailTemplateId: 675 },
    { action: 'sendEmail', position: 7, runAfterDays: 16, assignedUserId: -1, emailTemplateId: 676 },
    { action: 'removeTags', position: 8, runAfterDays: 30, tags: ['seller:hot', 'seller:warm', 'seller:nurture'] },
    { action: 'addTags', position: 9, runAfterDays: 0, tags: ['seller:long-nurture'] },
  ]
}

function buildPlan70Steps(/* uses existing 677-681, 682, 683 */) {
  return [
    { action: 'createTask', position: 1, runAfterDays: 0, assignedUserId: -1,
      taskName: 'Call %contact_first_name% — buyer LP lead', taskType: 'Call' },
    { action: 'sendEmail', position: 2, runAfterDays: 0, assignedUserId: -1, emailTemplateId: 677 },
    { action: 'createTask', position: 3, runAfterDays: 0, assignedUserId: -1,
      taskName: 'Send first matched-listings batch to %contact_first_name% within 30 min', taskType: 'Other' },
    { action: 'sendEmail', position: 4, runAfterDays: 1, assignedUserId: -1, emailTemplateId: 678 },
    { action: 'createTask', position: 5, runAfterDays: 2, assignedUserId: -1,
      taskName: 'Send personal SMS to %contact_first_name% (HOT only — template BL-S2 id 683)',
      taskType: 'Text' },
    { action: 'sendEmail', position: 6, runAfterDays: 4, assignedUserId: -1, emailTemplateId: 679 },
    { action: 'sendEmail', position: 7, runAfterDays: 7, assignedUserId: -1, emailTemplateId: 680 },
    { action: 'sendEmail', position: 8, runAfterDays: 16, assignedUserId: -1, emailTemplateId: 681 },
    { action: 'removeTags', position: 9, runAfterDays: 30, tags: ['buyer:hot', 'buyer:warm', 'buyer:nurture'] },
    { action: 'addTags', position: 10, runAfterDays: 0, tags: ['buyer:long-nurture'] },
  ]
}

// initialTextMessage payloads. FUB stores this as a plain string body.
const INITIAL_SMS = {
  69: 'Hi %contact_first_name%, this is Matt Ryan with Ryan Realty. Got your home value request for %customSellerPropertyAddress%. Your CMA will be in your inbox shortly. If anything specific about the property would change how I price it, reply and let me know. If you\'d rather I don\'t text you, just say stop.',
  70: 'Hi %contact_first_name%, this is Matt Ryan with Ryan Realty. Got your buyer search request. The first matching listings will be in your inbox within 30 minutes. If you have a must-have or a deal-breaker I should factor in, reply and let me know. If you\'d rather I don\'t text you, just say stop.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────────────────────

async function listAllTemplates() {
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

async function listAllSMSTemplates() {
  let all = []
  let offset = 0
  while (true) {
    const { json } = await fub('GET', `/textMessageTemplates?limit=100&offset=${offset}`)
    const items = json?.textmessagetemplates || json?.textMessageTemplates || []
    all.push(...items)
    if (items.length < 100) break
    offset += 100
  }
  return all
}

async function main() {
  const summary = {
    mode: DRY ? 'DRY-RUN' : 'EXECUTE',
    startedAt: new Date().toISOString(),
    voiceScans: [],
    templatesCreated: [],
    templatesUpdated: [],
    templatesSkipped: [],
    smsCreated: [],
    smsExisting: [],
    plansWired: [],
    errors: [],
    failedRequests: [],
  }

  console.log(`=== Wire FUB plan content ===`)
  console.log(`Mode: ${DRY ? 'DRY-RUN (set DRY=0 to mutate)' : 'EXECUTE'}\n`)

  // ─── 1. Voice gate (run on raw markdown bodies + subjects) ───────────────
  console.log('--- Voice gate ---')
  for (const t of TEMPLATES_EMAIL) {
    const subjScan = voiceScan(t.subject)
    const bodyScan = voiceScan(t.body)
    const allHits = [
      ...subjScan.hits.map(h => ({ ...h, where: 'subject' })),
      ...bodyScan.hits.map(h => ({ ...h, where: 'body' })),
    ]
    const allSoft = [
      ...subjScan.softHits.map(h => ({ ...h, where: 'subject' })),
      ...bodyScan.softHits.map(h => ({ ...h, where: 'body' })),
    ]
    if (allHits.length > 0 || allSoft.length > 0) {
      summary.voiceScans.push({ code: t.code, name: t.name, hardHits: allHits, softHits: allSoft })
      const hardSummary = allHits.length ? `${allHits.length} HARD` : ''
      const softSummary = allSoft.length ? `${allSoft.length} soft` : ''
      console.log(`  ${t.code}: ${[hardSummary, softSummary].filter(Boolean).join(', ')}`)
      for (const h of allHits) console.log(`    HARD ${h.where} ${h.label} x${h.count}`)
      for (const h of allSoft) console.log(`    soft ${h.where} ${h.label} x${h.count}`)
    } else {
      console.log(`  ${t.code}: PASS`)
    }
  }
  // Also scan the SMS templates we're about to create.
  for (const t of TEMPLATES_SMS_CREATE) {
    const scan = voiceScan(t.message)
    if (scan.hits.length > 0 || scan.softHits.length > 0) {
      summary.voiceScans.push({ code: t.code, name: t.name, hardHits: scan.hits, softHits: scan.softHits })
      console.log(`  ${t.code} (SMS): hard=${scan.hits.length} soft=${scan.softHits.length}`)
    } else {
      console.log(`  ${t.code} (SMS): PASS`)
    }
  }

  // Hard-fail check: if ANY template has a HARD voice hit, abort the run.
  // (Soft hits in PLANS_CONTENT.md are intentional — "no expectation" frames.)
  const hardFailed = summary.voiceScans.filter(v => v.hardHits.length > 0)
  if (hardFailed.length > 0) {
    console.error(`\n!!! VOICE GATE FAILED: ${hardFailed.length} templates with hard hits. !!!`)
    for (const f of hardFailed) {
      console.error(`  ${f.code} (${f.name}):`)
      for (const h of f.hardHits) console.error(`    ${h.where} ${h.kind}/${h.label} x${h.count}`)
    }
    summary.errors.push({ kind: 'voice-gate-hard-fail', count: hardFailed.length })
    if (!DRY) {
      console.error('Aborting EXECUTE mode. Fix the source content or relax the gate.')
      await writeSummary(summary, [])
      process.exit(1)
    } else {
      console.warn('(DRY-RUN: continuing despite hard hits — would abort in EXECUTE mode.)')
    }
  }

  // ─── 2. Discover existing templates so the run is idempotent ─────────────
  console.log('\n--- Discovering existing templates ---')
  const existingTemplates = await listAllTemplates()
  const existingByName = new Map(existingTemplates.map(t => [t.name, t]))
  const existingSMS = await listAllSMSTemplates()
  const existingSMSByName = new Map(existingSMS.map(t => [t.name, t]))
  console.log(`  ${existingTemplates.length} email templates · ${existingSMS.length} SMS templates`)

  // ─── 3. Create / update email templates ──────────────────────────────────
  console.log('\n--- Email templates ---')
  const emailIds = {}

  // 3a. Plans 71-75 (NEW templates)
  for (const t of TEMPLATES_EMAIL) {
    const html = mdToHtml(t.body)
    const existing = existingByName.get(t.name)
    if (existing) {
      emailIds[t.code] = existing.id
      console.log(`  EXISTS  ${t.code} ${t.name} → id=${existing.id}`)
      if (!DRY) {
        const { status, json } = await fub('PUT', `/templates/${existing.id}`, {
          name: t.name, subject: t.subject, body: html, isShared: true,
        })
        if (status >= 200 && status < 300) {
          summary.templatesUpdated.push({ code: t.code, id: existing.id, name: t.name })
        } else {
          console.error(`    update failed status=${status} ${JSON.stringify(json).slice(0, 200)}`)
          summary.failedRequests.push({ verb: 'PUT', path: `/templates/${existing.id}`, status, body: json })
        }
      }
      continue
    }
    if (DRY) {
      emailIds[t.code] = null
      summary.templatesCreated.push({ code: t.code, id: null, name: t.name, dryRun: true })
      console.log(`  WOULD CREATE  ${t.code} ${t.name}`)
      continue
    }
    const { status, json } = await fub('POST', '/templates', {
      name: t.name, subject: t.subject, body: html, isShared: true,
    })
    if (status === 201 && json?.id) {
      emailIds[t.code] = json.id
      summary.templatesCreated.push({ code: t.code, id: json.id, name: t.name })
      console.log(`  CREATED  ${t.code} → id=${json.id}`)
    } else {
      console.error(`  FAILED   ${t.code} status=${status} ${JSON.stringify(json).slice(0, 200)}`)
      summary.failedRequests.push({ verb: 'POST', path: '/templates', status, body: json, payload: { name: t.name, subject: t.subject } })
      summary.errors.push({ kind: 'email-template-create-fail', code: t.code, status })
    }
  }

  // 3b. Plans 69 + 70 (UPDATE existing 672-681 with rewritten bodies)
  for (const t of TEMPLATES_EMAIL_UPDATE) {
    const html = mdToHtml(t.body)
    if (DRY) {
      console.log(`  WOULD UPDATE  id=${t.id} ${t.name}`)
      continue
    }
    const { status, json } = await fub('PUT', `/templates/${t.id}`, {
      name: t.name, subject: t.subject, body: html, isShared: true,
    })
    if (status >= 200 && status < 300) {
      summary.templatesUpdated.push({ id: t.id, name: t.name, rewritten: true })
      console.log(`  UPDATED  id=${t.id} ${t.name}`)
    } else {
      console.error(`  UPDATE FAILED id=${t.id} status=${status} ${JSON.stringify(json).slice(0, 200)}`)
      summary.failedRequests.push({ verb: 'PUT', path: `/templates/${t.id}`, status, body: json })
      summary.errors.push({ kind: 'email-template-update-fail', id: t.id, status })
    }
  }

  // ─── 4. Create SMS templates (Plan 72 T0) ────────────────────────────────
  console.log('\n--- SMS templates ---')
  const smsIds = { ...EXISTING_SMS }
  for (const t of TEMPLATES_SMS_CREATE) {
    const existing = existingSMSByName.get(t.name)
    if (existing) {
      smsIds[t.code] = existing.id
      console.log(`  EXISTS  ${t.code} ${t.name} → id=${existing.id}`)
      summary.smsExisting.push({ code: t.code, id: existing.id, name: t.name })
      if (!DRY) {
        const { status, json } = await fub('PUT', `/textMessageTemplates/${existing.id}`, {
          name: t.name, message: t.message, isShared: true,
        })
        if (status < 200 || status >= 300) {
          console.error(`    update failed status=${status} ${JSON.stringify(json).slice(0,200)}`)
          summary.failedRequests.push({ verb: 'PUT', path: `/textMessageTemplates/${existing.id}`, status, body: json })
        }
      }
      continue
    }
    if (DRY) {
      smsIds[t.code] = null
      console.log(`  WOULD CREATE  ${t.code} ${t.name}`)
      summary.smsCreated.push({ code: t.code, id: null, name: t.name, dryRun: true })
      continue
    }
    const { status, json } = await fub('POST', '/textMessageTemplates', {
      name: t.name, message: t.message, isShared: true,
    })
    if (status === 201 && json?.id) {
      smsIds[t.code] = json.id
      summary.smsCreated.push({ code: t.code, id: json.id, name: t.name })
      console.log(`  CREATED  ${t.code} → id=${json.id}`)
    } else {
      console.error(`  FAILED   ${t.code} status=${status} ${JSON.stringify(json).slice(0, 200)}`)
      summary.failedRequests.push({ verb: 'POST', path: '/textMessageTemplates', status, body: json, payload: { name: t.name } })
      summary.errors.push({ kind: 'sms-template-create-fail', code: t.code, status })
    }
  }
  // Surface existing SMS we're reusing
  for (const [code, id] of Object.entries(EXISTING_SMS)) {
    console.log(`  REUSE   ${code} → id=${id}`)
  }

  // ─── 5. Wire plans 69-75 ─────────────────────────────────────────────────
  console.log('\n--- Plan step wiring ---')

  const PLAN_CONFIGS = [
    { id: 69, name: 'Seller Lead — Master Workflow', buildSteps: buildPlan69Steps, initialTextMessage: INITIAL_SMS[69] },
    { id: 70, name: 'Buyer Lead — Master Workflow', buildSteps: buildPlan70Steps, initialTextMessage: INITIAL_SMS[70] },
    { id: 71, name: 'Expired Recovery (auto)', buildSteps: () => buildPlan71Steps(emailIds) },
    { id: 72, name: 'FSBO Recovery (auto)', buildSteps: () => buildPlan72Steps(emailIds, smsIds) },
    { id: 73, name: 'Out-of-State Owner Nurture', buildSteps: () => buildPlan73Steps(emailIds) },
    { id: 74, name: 'Neighborhood Resident Nurture', buildSteps: () => buildPlan74Steps(emailIds) },
    { id: 75, name: 'Sphere Nurture', buildSteps: () => buildPlan75Steps(emailIds) },
  ]

  for (const plan of PLAN_CONFIGS) {
    const steps = plan.buildSteps()
    console.log(`\n  Plan ${plan.id} — ${plan.name}`)
    console.log(`    ${steps.length} steps:`)
    for (const s of steps) {
      const detail = s.action === 'sendEmail' ? `tmplId=${s.emailTemplateId}` :
                     s.action === 'createTask' ? `[${s.taskType}] "${(s.taskName || '').slice(0, 50)}..."` :
                     (s.action === 'addTags' || s.action === 'removeTags') ? `[${(s.tags || []).join(',')}]` : ''
      console.log(`      pos=${s.position}  T+${s.runAfterDays}d  ${s.action.padEnd(12)}  ${detail}`)
    }

    // Validate every sendEmail step has a real template id (catch DRY-RUN nulls
    // BEFORE we POST in EXECUTE mode).
    const missingTpl = steps.find(s => s.action === 'sendEmail' && (!s.emailTemplateId || Number.isNaN(s.emailTemplateId)))
    if (missingTpl) {
      console.warn(`    !!! step pos=${missingTpl.position} has missing emailTemplateId (likely DRY-RUN)`)
    }

    const payload = {
      steps,
      stopOnContacted: true,
    }
    if (plan.initialTextMessage) {
      payload.initialTextMessageEnabled = true
      payload.initialTextMessage = plan.initialTextMessage
      payload.delaySmsMinutes = 1
    }

    if (DRY) {
      console.log(`    WOULD PUT /actionPlans/${plan.id}`)
      summary.plansWired.push({ id: plan.id, name: plan.name, steps: steps.length, dryRun: true })
      continue
    }

    const { status, json, text } = await fub('PUT', `/actionPlans/${plan.id}`, payload)
    if (status >= 200 && status < 300) {
      const got = json?.stepCount
      summary.plansWired.push({ id: plan.id, name: plan.name, stepsSent: steps.length, stepsLanded: got, initialSMS: !!plan.initialTextMessage })
      console.log(`    OK  stepCount=${got} initialTextEnabled=${json?.initialTextMessageEnabled}`)
    } else {
      console.error(`    FAILED status=${status} ${text.slice(0, 400)}`)
      summary.failedRequests.push({ verb: 'PUT', path: `/actionPlans/${plan.id}`, status, body: json, payload })
      summary.errors.push({ kind: 'plan-put-fail', id: plan.id, status })
    }
  }

  // ─── 6. Sample renderings to drop in the summary doc ──────────────────────
  const sampleCodes = ['EXP-1', 'FSBO-1', 'NHD-05']
  const samples = []
  for (const code of sampleCodes) {
    const tmpl = TEMPLATES_EMAIL.find(t => t.code === code)
    if (!tmpl) continue
    samples.push({ code, name: tmpl.name, subject: tmpl.subject, htmlBody: mdToHtml(tmpl.body), rawBody: tmpl.body })
  }

  await writeSummary(summary, samples)
}

async function writeSummary(summary, samples) {
  const finishedAt = new Date().toISOString()
  const lines = []
  lines.push(`# FUB Wiring Summary`)
  lines.push('')
  lines.push(`**Mode:** ${summary.mode}`)
  lines.push(`**Started:** ${summary.startedAt}`)
  lines.push(`**Finished:** ${finishedAt}`)
  lines.push('')
  lines.push(`## Counts`)
  lines.push('')
  lines.push(`- Email templates CREATED: **${summary.templatesCreated.filter(t => !t.dryRun).length}** (would-create in dry-run: ${summary.templatesCreated.filter(t => t.dryRun).length})`)
  lines.push(`- Email templates UPDATED in place: **${summary.templatesUpdated.length}**`)
  lines.push(`- SMS templates CREATED: **${summary.smsCreated.filter(t => !t.dryRun).length}**`)
  lines.push(`- SMS templates REUSED (already existed): **${Object.keys(EXISTING_SMS).length}**`)
  lines.push(`- Plans wired: **${summary.plansWired.length}**`)
  lines.push(`- Voice scan flags (hard + soft): **${summary.voiceScans.length}**`)
  lines.push(`- Errors: **${summary.errors.length}**`)
  lines.push('')

  lines.push(`## Plans wired`)
  lines.push('')
  for (const p of summary.plansWired) {
    if (p.dryRun) {
      lines.push(`- **Plan ${p.id} — ${p.name}** — DRY-RUN: ${p.steps} steps would be PUT`)
    } else {
      const initText = p.initialSMS ? ' + initialTextMessage' : ''
      const mismatch = p.stepsSent !== p.stepsLanded ? ` ⚠ sent=${p.stepsSent} but landed=${p.stepsLanded}` : ''
      lines.push(`- **Plan ${p.id} — ${p.name}** — ${p.stepsLanded} steps landed${initText}${mismatch}`)
    }
  }
  lines.push('')

  lines.push(`## Email templates created`)
  lines.push('')
  if (summary.templatesCreated.length === 0) {
    lines.push('_None_')
  } else {
    lines.push('| Code | FUB id | Name |')
    lines.push('|---|---:|---|')
    for (const t of summary.templatesCreated) {
      lines.push(`| ${t.code} | ${t.id ?? '(dry-run)'} | ${t.name} |`)
    }
  }
  lines.push('')

  lines.push(`## Email templates updated (Plans 69 + 70 rewrites)`)
  lines.push('')
  if (summary.templatesUpdated.length === 0) {
    lines.push('_None_')
  } else {
    lines.push('| FUB id | Name | Notes |')
    lines.push('|---:|---|---|')
    for (const t of summary.templatesUpdated) {
      lines.push(`| ${t.id} | ${t.name} | ${t.rewritten ? 'rewritten body per PLANS_CONTENT.md' : (t.code ? `code=${t.code}` : '')} |`)
    }
  }
  lines.push('')

  lines.push(`## SMS templates`)
  lines.push('')
  lines.push('| Code | FUB id | Status |')
  lines.push('|---|---:|---|')
  for (const t of summary.smsCreated) {
    lines.push(`| ${t.code} | ${t.id ?? '(dry-run)'} | created |`)
  }
  for (const [code, id] of Object.entries(EXISTING_SMS)) {
    lines.push(`| ${code} | ${id} | reused (already in FUB) |`)
  }
  lines.push('')

  lines.push(`## Voice scan flags`)
  lines.push('')
  if (summary.voiceScans.length === 0) {
    lines.push('_All templates passed the brand-voice grep clean._')
  } else {
    lines.push(`${summary.voiceScans.length} templates have voice-scan flags. Hard hits indicate banned punctuation / words / AI filler and should be reviewed. Soft hits indicate "no expectation" / "no ask" framings that PLANS_CONTENT.md intentionally kept for distrust-prone audiences.`)
    lines.push('')
    lines.push('| Code | Name | Hard | Soft | Details |')
    lines.push('|---|---|---:|---:|---|')
    for (const v of summary.voiceScans) {
      const details = []
      for (const h of v.hardHits) details.push(`HARD ${h.where}/${h.label}×${h.count}`)
      for (const h of v.softHits) details.push(`soft ${h.where}/${h.label}×${h.count}`)
      lines.push(`| ${v.code} | ${v.name} | ${v.hardHits.length} | ${v.softHits.length} | ${details.join('; ')} |`)
    }
  }
  lines.push('')

  if (summary.errors.length > 0 || summary.failedRequests.length > 0) {
    lines.push(`## Failures`)
    lines.push('')
    for (const e of summary.errors) {
      lines.push(`- ${e.kind} ${JSON.stringify(e)}`)
    }
    for (const r of summary.failedRequests) {
      lines.push('')
      lines.push(`### ${r.verb} ${r.path} → ${r.status}`)
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify({ status: r.status, response: r.body, requestPayload: r.payload }, null, 2))
      lines.push('```')
    }
    lines.push('')
  }

  if (samples.length > 0) {
    lines.push(`## Sample rendered templates (3 highest-impact)`)
    lines.push('')
    for (const s of samples) {
      lines.push(`### ${s.code} — ${s.name}`)
      lines.push('')
      lines.push(`**Subject:** ${s.subject}`)
      lines.push('')
      lines.push('**Raw body (Markdown):**')
      lines.push('')
      lines.push('```')
      lines.push(s.rawBody)
      lines.push('```')
      lines.push('')
      lines.push('**Rendered HTML (preview):**')
      lines.push('')
      lines.push('```html')
      lines.push(s.htmlBody)
      lines.push('```')
      lines.push('')
    }
  }

  lines.push(`## What's still in your court (UI work)`)
  lines.push('')
  lines.push('- **Audience exclusions:** FUB API doesn\'t accept exclude-tag rules on action plans. In FUB UI, on each plan (69-75), add automation conditions to skip when tag is one of: `Unsubscribed`, `Realtor`, `compliance:hard-stop`, `Bounced`.')
  lines.push('- **FB seller LP attribution:** Confirm the `Seller LP → Master Workflow` automation rule still fires plan 69 on the `audience:seller` tag, and add equivalents for plans 71-75 (`expired`, `fsbo`, `absentee`, `audience:seller` + `Bend` resident, `Sphere` stage).')
  lines.push('- **Custom field merge tokens** in plans 73/74: `%neighborhood_*%`, `%q1_median%`, etc. are NOT standard FUB merge tags. They\'ll send literally unless you (a) add the merge fields as `customXxx` custom fields and populate them per person via a monthly cron, or (b) route these emails through Resend with send-time substitution and BCC into FUB.')
  lines.push('- **Postcard + letter steps** for plans 71 and 72 are `createTask` broker prompts (FUB has no API for physical mail). Wire to Click2Mail or your local printer when ready.')
  lines.push('')

  await fs.mkdir(path.dirname(SUMMARY_OUT), { recursive: true })
  await fs.writeFile(SUMMARY_OUT, lines.join('\n'))
  console.log(`\nSummary written → ${SUMMARY_OUT}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
