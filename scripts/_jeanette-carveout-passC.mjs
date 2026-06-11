#!/usr/bin/env node
/**
 * Jeanette carve-out — PASS C (loose-token, NOT address-locked).
 *
 * Pass B required the literal street-address phrase, which misses Jeanette's
 * TC emails that key off CLIENT NAME / SUBDIVISION / escrow# instead of the
 * street address. This pass runs the Bridgetown participant group against
 * LOOSE tokens per folder, in a tight window around each close date, across
 * all three inboxes, and dumps every subject so the address-independent
 * threads surface.
 *
 * Usage: node --env-file=.env.local scripts/_jeanette-carveout-passC.mjs
 * Writes: tmp/jeanette-carveout-2026-05-28/passC.json
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const OUT = 'tmp/jeanette-carveout-2026-05-28/passC.json'
const BROKER_INBOXES = ['matt@ryan-realty.com', 'rebeccapeterson@ryan-realty.com', 'paul@ryan-realty.com']
const BRIDGETOWN = 'transactions@bridgetownfiles.com'
const GROUP = `{from:${BRIDGETOWN} to:${BRIDGETOWN} cc:${BRIDGETOWN}}`
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

// Still-uncertain folders with LOOSE tokens (street name / client / subdivision).
const FOLDERS = [
  { n: 8,  close: '2026-04-09', tokens: ['Huntington'] },
  { n: 10, close: '2025-07-17', tokens: ['Cedar'] },
  { n: 11, close: '2025-07-25', tokens: ['Penhollow'] },
  { n: 12, close: '2025-08-14', tokens: ['Newport Hills'] },
  { n: 13, close: '2025-08-14', tokens: ['45th', 'Millard', 'Forked Horn'] },
]

function authFor(u) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: SCOPES, subject: u,
  })
}
function win(closeIso, days) {
  const c = new Date(closeIso + 'T00:00:00Z')
  const fmt = (d) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
  return { after: fmt(new Date(c - days * 86400000)), before: fmt(new Date(c.getTime() + days * 86400000)) }
}
function parse(msg) {
  const h = {}
  ;(msg.data.payload?.headers || []).forEach((x) => { h[x.name.toLowerCase()] = x.value })
  const part = `${h.from || ''} ${h.to || ''} ${h.cc || ''}`.toLowerCase().includes('bridgetownfiles.com')
  return { date: h.date || '', from: h.from || '', to: h.to || '', cc: h.cc || '', subject: h.subject || '', snippet: msg.data.snippet || '', participant: part }
}
async function run(gmail, q) {
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 40 })
  const out = []
  for (const m of res.data.messages || []) {
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'] })
    out.push(parse(full))
  }
  return out
}

async function main() {
  const findings = {}
  for (const inbox of BROKER_INBOXES) {
    findings[inbox] = {}
    let gmail
    try {
      const auth = authFor(inbox); await auth.authorize()
      gmail = google.gmail({ version: 'v1', auth })
    } catch (e) { findings[inbox]._error = String(e?.message || e); continue }
    for (const f of FOLDERS) {
      const w = win(f.close, 90)
      const orTokens = f.tokens.map((t) => `"${t}"`).join(' OR ')
      const q = `${GROUP} (${orTokens}) after:${w.after} before:${w.before}`
      try {
        const msgs = await run(gmail, q)
        const part = msgs.filter((m) => m.participant)
        findings[inbox][`#${f.n}`] = { q, total: msgs.length, participant: part.length, messages: part }
        console.error(`[${inbox.replace('@ryan-realty.com', '')}] #${f.n} tokens=[${f.tokens.join('|')}]: ${part.length} participant / ${msgs.length} total`)
      } catch (e) {
        findings[inbox][`#${f.n}`] = { q, error: String(e?.message || e) }
      }
    }
  }
  await fs.writeFile(OUT, JSON.stringify(findings, null, 2))
  console.log(`\nWrote ${OUT}`)
}
main().catch((e) => { console.error('FATAL:', e?.stack || e); process.exit(1) })
