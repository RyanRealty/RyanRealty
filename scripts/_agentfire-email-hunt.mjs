#!/usr/bin/env node
/**
 * AgentFire account recovery — Gmail service-account (DWD) hunt across Matt's
 * inbox for the AgentFire website account: login access, billing/cancellation,
 * and any media/export/download links.
 *
 * Usage: node --env-file=.env.local scripts/_agentfire-email-hunt.mjs
 * Writes: tmp/agentfire/email-hunt.json
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const OUT_PATH = 'tmp/agentfire/email-hunt.json'

// Matt's inbox is the target ("my emails"); add a couple likely-account inboxes.
const INBOXES = [
  'matt@ryan-realty.com',
  'admin@ryan-realty.com',
  'info@ryan-realty.com',
  'marketing@ryan-realty.com',
]

// All-time (AgentFire was the old site; setup may be years old).
const QUERIES = [
  { label: 'from-agentfire', q: 'from:agentfire.com' },
  { label: 'to-agentfire', q: 'to:agentfire.com OR cc:agentfire.com' },
  { label: 'agentfire-any', q: 'agentfire' },
  { label: 'agent-fire-space', q: '"agent fire"' },
  { label: 'agentfire-billing', q: 'agentfire (invoice OR receipt OR billing OR subscription OR payment OR renew OR charged OR cancel)' },
  { label: 'agentfire-access', q: 'agentfire (login OR password OR welcome OR "get started" OR account OR dashboard OR access)' },
]

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

function authFor(userEmail) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: SCOPES,
    subject: userEmail,
  })
}

function b64urlDecode(data) {
  if (!data) return ''
  try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') } catch { return '' }
}

function extractBody(payload) {
  // Prefer text/plain; fall back to text/html (stripped).
  let plain = '', html = ''
  function walk(p) {
    if (!p) return
    const mt = p.mimeType || ''
    if (mt === 'text/plain' && p.body?.data) plain += b64urlDecode(p.body.data) + '\n'
    else if (mt === 'text/html' && p.body?.data) html += b64urlDecode(p.body.data) + '\n'
    for (const sub of p.parts || []) walk(sub)
  }
  walk(payload)
  let text = plain
  if (!text && html) text = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  return { text: text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), html }
}

function linksFrom(text, html) {
  const urls = new Set()
  const re = /https?:\/\/[^\s"'<>)\]]+/gi
  for (const src of [text, html]) for (const m of (src || '').matchAll(re)) urls.add(m[0].replace(/[.,);]+$/, ''))
  return [...urls].filter((u) => /agentfire|login|account|dashboard|admin|billing|invoice|cancel|download|media|export|wp-|stripe|chargebee|recurly/i.test(u)).slice(0, 25)
}

async function main() {
  const all = []
  const seen = new Set()
  for (const inbox of INBOXES) {
    let auth
    try { auth = authFor(inbox); await auth.authorize() }
    catch (e) { console.error(`[${inbox}] AUTH FAIL: ${e?.message || e}`); continue }
    const gmail = google.gmail({ version: 'v1', auth })
    for (const layer of QUERIES) {
      let ids = []
      try {
        const res = await gmail.users.messages.list({ userId: 'me', q: layer.q, maxResults: 40 })
        ids = (res.data.messages || []).map((m) => m.id)
      } catch (e) { console.error(`[${inbox}] ${layer.label} list ERR: ${e?.message || e}`); continue }
      for (const id of ids) {
        const key = inbox + ':' + id
        if (seen.has(key)) continue
        seen.add(key)
        try {
          const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
          const headers = {}
          for (const h of msg.data.payload?.headers || []) headers[h.name.toLowerCase()] = h.value
          const { text, html } = extractBody(msg.data.payload)
          const attachments = []
          ;(function walk(p) { if (!p) return; if (p.filename?.length && p.body?.attachmentId) attachments.push({ filename: p.filename, mimeType: p.mimeType, size: p.body.size }); for (const s of p.parts || []) walk(s) })(msg.data.payload)
          all.push({
            inbox, id, layer: layer.label,
            date: headers['date'], from: headers['from'], to: headers['to'], subject: headers['subject'],
            snippet: msg.data.snippet,
            links: linksFrom(text, html),
            bodyPreview: text.slice(0, 4000),
            attachments,
          })
        } catch (e) { console.error(`[${inbox}] get ${id} ERR: ${e?.message || e}`) }
      }
    }
    console.error(`[${inbox}] done`)
  }
  // sort by date desc
  all.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(all, null, 2))
  console.log(`\n=== AgentFire email hunt: ${all.length} unique messages ===`)
  for (const m of all) {
    console.log(`\n• [${m.inbox}] ${m.date}\n  FROM: ${m.from}\n  SUBJ: ${m.subject}\n  SNIP: ${(m.snippet || '').slice(0, 160)}`)
    if (m.attachments.length) console.log('  ATT: ' + m.attachments.map((a) => a.filename).join(', '))
    if (m.links.length) console.log('  LINKS: ' + m.links.slice(0, 8).join('  '))
  }
  console.log(`\nFull bodies + all links written to ${OUT_PATH}`)
}
main().catch((e) => { console.error('FATAL:', e?.stack || e); process.exit(1) })
