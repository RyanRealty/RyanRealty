#!/usr/bin/env node
/**
 * Jeanette Argyle (Bridgetown Files TC) carve-out — CROSS-INBOX re-do.
 *
 * The Matt-only mailbox pass returned false-clean for #11 / #13 / #18 / #19.
 * Matt's correction: those deals ran through REBECCA's mailbox. Jeanette became
 * the TC at some point and every deal after that point was hers. This script
 * re-runs the carve-out across all three broker inboxes via service-account
 * domain-wide delegation (the same path the SkySlope pipeline already uses).
 *
 * Usage:
 *   node --env-file=.env.local scripts/_jeanette-carveout-rebecca.mjs
 *
 * Writes:
 *   tmp/jeanette-carveout-2026-05-28/findings.json
 *
 * METHODOLOGY FIX (the thing the Matt-only pass got wrong):
 *   A bare "transactions@bridgetownfiles.com" term matches from/to/cc AND body
 *   AND attachment text. The Ignite-Connections realtor-exclusion CSV (which
 *   lists Bridgetown's email + a bunch of street names) produced FALSE POSITIVES
 *   for Penhollow / Simpson / 3480 in the Matt pass. So here every hit is tagged
 *   `bridgetownParticipant` = TRUE only when bridgetownfiles.com appears in
 *   from/to/cc. Participant-level is the decisive signal; body/attachment match
 *   alone is treated as weak/noise.
 *
 *   PASS A (master index): every Bridgetown-PARTICIPANT thread per inbox across
 *   the full June-2025 -> April-2026 span. This directly answers "which deals did
 *   Jeanette work through this inbox." Subjects + attachment filenames get matched
 *   against the 8 uncertain addresses.
 *
 *   PASS B (per-folder targeted): address token + Jeanette/Bickey/Bridgetown name
 *   + TC-intro phrases, windowed around each close date. Catches threads where her
 *   email wasn't a direct participant but a broker referenced her.
 */

import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = 'tmp/jeanette-carveout-2026-05-28'
const OUT_PATH = `${OUT_DIR}/findings.json`

const BROKER_INBOXES = [
  'matt@ryan-realty.com',
  'rebeccapeterson@ryan-realty.com',
  'paul@ryan-realty.com',
]

const BRIDGETOWN = 'transactions@bridgetownfiles.com'
const PARTICIPANT_GROUP = `{from:${BRIDGETOWN} to:${BRIDGETOWN} cc:${BRIDGETOWN}}`

// The 8 uncertain / unprocessed folders. addr = distinctive phrase token.
// Matt's prior on each is recorded for the final reconciliation.
const FOLDERS = [
  { n: 8,  guid: '13e20213', addr: '54474 Huntington',     close: '2026-04-09', prior: 'BAD pass — re-do; Matt-only said clean' },
  { n: 9,  guid: '6ef1013a', addr: '1050 NE Butler Market', close: '2025-06-06', prior: 'flagged — Lifestyles-side TC?' },
  { n: 10, guid: '45549882', addr: '3235 NW Cedar',        close: '2025-07-17', prior: 'flagged — declined coordination?' },
  { n: 11, guid: 'e1892930', addr: '20401 Penhollow',      close: '2025-07-25', prior: 'Matt: LIKELY Jeanette' },
  { n: 12, guid: '740abefb', addr: '1974 NW Newport Hills', close: '2025-08-14', prior: 'Matt-only said clean' },
  { n: 13, guid: '59152e77', addr: '3480 SW 45th',         close: '2025-08-14', prior: 'Matt: IS Jeanette' },
  { n: 18, guid: 'c9fcc145', addr: '2354 NW Drouillard',   close: '2025-10-27', prior: 'Matt: IS Jeanette' },
  { n: 19, guid: 'f620aee8', addr: '19571 SW Simpson',     close: '2026-03-16', prior: 'Matt: IS Jeanette' },
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

function dateWindow(closeIso, beforeDays, afterDays) {
  const c = new Date(closeIso + 'T00:00:00Z')
  const a = new Date(c.getTime() - beforeDays * 86400000)
  const b = new Date(c.getTime() + afterDays * 86400000)
  const fmt = (d) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
  return { after: fmt(a), before: fmt(b) }
}

// Pull headers + attachment filenames + snippet from one message.
function parseMessage(msg) {
  const headers = {}
  function harvest(p) {
    if (!p) return
    for (const h of p.headers || []) {
      const k = h.name.toLowerCase()
      if (!headers[k]) headers[k] = h.value
    }
    for (const sub of p.parts || []) harvest(sub)
  }
  harvest(msg.data.payload)
  const attachments = []
  function walk(p) {
    if (!p) return
    if (p.filename && p.filename.length && p.body?.attachmentId) {
      attachments.push({ filename: p.filename, mimeType: p.mimeType, size: p.body.size })
    }
    for (const sub of p.parts || []) walk(sub)
  }
  walk(msg.data.payload)
  const from = headers['from'] || ''
  const to = headers['to'] || ''
  const cc = headers['cc'] || ''
  const participantBlob = `${from} ${to} ${cc}`.toLowerCase()
  return {
    id: msg.data.id,
    threadId: msg.data.threadId,
    date: headers['date'] || '',
    from,
    to,
    cc,
    subject: headers['subject'] || '',
    snippet: msg.data.snippet || '',
    attachments,
    bridgetownParticipant: participantBlob.includes('bridgetownfiles.com'),
  }
}

async function listAll(gmail, q, cap = 60) {
  const ids = []
  let pageToken
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken })
    for (const m of res.data.messages || []) ids.push(m.id)
    pageToken = res.data.nextPageToken
  } while (pageToken && ids.length < cap)
  return ids.slice(0, cap)
}

async function detail(gmail, ids) {
  const out = []
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    out.push(parseMessage(msg))
  }
  return out
}

// Does a Pass-A thread reference one of our uncertain folders?
function matchFolders(text) {
  const t = (text || '').toLowerCase()
  const hits = []
  for (const f of FOLDERS) {
    // match on street number + first street word (robust to "St"/"Street"/"Ln"/"Lane" variance)
    const parts = f.addr.toLowerCase().split(' ')
    const num = parts[0]
    const lastWord = parts[parts.length - 1]
    if (t.includes(num) && t.includes(lastWord)) hits.push(f.n)
  }
  return hits
}

async function main() {
  const findings = { passA: {}, passB: {}, generatedAt: new Date().toISOString() }

  for (const inbox of BROKER_INBOXES) {
    let auth, gmail
    try {
      auth = authFor(inbox)
      await auth.authorize()
      gmail = google.gmail({ version: 'v1', auth })
    } catch (e) {
      console.error(`[${inbox}] AUTH FAIL: ${e?.message || e}`)
      findings.passA[inbox] = { _error: String(e?.message || e) }
      continue
    }

    // ---- PASS A: master index of every Bridgetown-participant thread ----
    const passAQ = `${PARTICIPANT_GROUP} after:2025/05/15 before:2026/04/30`
    try {
      const ids = await listAll(gmail, passAQ, 120)
      const msgs = await detail(gmail, ids)
      // keep only true participant matches (the group operator should guarantee
      // this, but double-check against the body-only false-positive class)
      const participantMsgs = msgs.filter((m) => m.bridgetownParticipant)
      // annotate each with which uncertain folder(s) it references
      for (const m of participantMsgs) {
        const blob = `${m.subject} ${m.snippet} ${m.attachments.map((a) => a.filename).join(' ')}`
        m.matchesFolders = matchFolders(blob)
      }
      findings.passA[inbox] = {
        query: passAQ,
        totalParticipantMsgs: participantMsgs.length,
        droppedNonParticipant: msgs.length - participantMsgs.length,
        messages: participantMsgs,
      }
      console.error(`[${inbox}] PASS A: ${participantMsgs.length} bridgetown-participant msgs (${msgs.length - participantMsgs.length} dropped as body-only)`)
    } catch (e) {
      findings.passA[inbox] = { query: passAQ, error: String(e?.message || e) }
      console.error(`[${inbox}] PASS A ERR: ${e?.message || e}`)
    }

    // ---- PASS B: per-folder targeted ----
    findings.passB[inbox] = {}
    for (const f of FOLDERS) {
      const win = dateWindow(f.close, 150, 21)
      const layers = [
        { label: 'B1-participant+addr', q: `${PARTICIPANT_GROUP} "${f.addr}" after:${win.after} before:${win.before}` },
        { label: 'B2-name+addr',        q: `("Jeanette" OR "Bickey" OR "Bridgetown") "${f.addr}" after:${win.after} before:${win.before}` },
        { label: 'B3-tcphrase+addr',    q: `("Transaction Coordinator" OR "Under Contract" OR "Transaction Timeline" OR "transactions@bridgetownfiles.com") "${f.addr}" after:${win.after} before:${win.before}` },
      ]
      const folderOut = { addr: f.addr, close: f.close, prior: f.prior, window: win, layers: {} }
      for (const layer of layers) {
        try {
          const ids = await listAll(gmail, layer.q, 30)
          const msgs = await detail(gmail, ids)
          folderOut.layers[layer.label] = {
            query: layer.q,
            count: msgs.length,
            participantCount: msgs.filter((m) => m.bridgetownParticipant).length,
            messages: msgs,
          }
        } catch (e) {
          folderOut.layers[layer.label] = { query: layer.q, error: String(e?.message || e) }
        }
      }
      const anyParticipant = Object.values(folderOut.layers).some((l) => (l.participantCount || 0) > 0)
      const anyHit = Object.values(folderOut.layers).some((l) => (l.count || 0) > 0)
      folderOut.verdict = anyParticipant ? 'JEANETTE-PARTICIPANT' : anyHit ? 'NAME-MENTION-ONLY' : 'NO-SIGNAL'
      findings.passB[inbox][`#${f.n}-${f.addr.replace(/\s+/g, '_')}`] = folderOut
      console.error(`[${inbox}] #${f.n} ${f.addr}: ${folderOut.verdict}`)
    }
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(findings, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
}

main().catch((e) => {
  console.error('FATAL:', e?.stack || e)
  process.exit(1)
})
