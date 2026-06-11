#!/usr/bin/env node
/**
 * Ordway compliance-gap email hunt — Gmail service-account search across
 * all three Ryan Realty broker inboxes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_ordway-gmail-hunt.mjs
 *
 * Writes:
 *   tmp/skyslope-pdfs/f88642ff-22e6-4618-b9e1-40b168a439e1/gmail-hunt.json
 *
 * Search layers per CLAUDE.md / skyslope-form-compliance gap-detection
 * routine:
 *   1. Lisa Smith sender + property + date window
 *   2. Escrow number WT0274211
 *   3. Sale agreement numbers (MR05042025, MR05072025, MR04262025)
 *   4. Broad "Ordway" attachment net
 *   5. DigiSign envelope IDs from this folder's PDFs
 */

import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const FOLDER_GUID = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const OUT_PATH = `tmp/skyslope-pdfs/${FOLDER_GUID}/gmail-hunt.json`

const BROKER_INBOXES = [
  'matt@ryan-realty.com',
  'rebeccapeterson@ryan-realty.com',
  'paul@ryan-realty.com',
]

// Date window: 1 week before earliest activity (4/26) to 1 week after closing (6/9)
const AFTER = '2025/04/19'
const BEFORE = '2025/06/16'

// Layer queries — each broker's inbox runs all of these.
const QUERIES = [
  {
    label: 'L1-lisa-smith-attachments',
    q: `from:thegarnergroup.com after:${AFTER} before:${BEFORE} has:attachment`,
  },
  {
    label: 'L1-lisa-smith-no-attach',
    q: `from:thegarnergroup.com after:${AFTER} before:${BEFORE}`,
  },
  {
    label: 'L2-escrow-number',
    q: `"WT0274211" after:${AFTER} before:${BEFORE}`,
  },
  {
    label: 'L3-sale-numbers',
    q: `("MR05072025" OR "MR05042025" OR "MR04262025") after:${AFTER} before:${BEFORE}`,
  },
  {
    label: 'L4-ordway-attachments',
    q: `"Ordway" after:${AFTER} before:${BEFORE} has:attachment`,
  },
  {
    label: 'L4-ordway-broad',
    q: `"2732 NW Ordway" after:${AFTER} before:${BEFORE}`,
  },
  // DigiSign envelope IDs extracted from this folder's PDFs (page 1 watermark)
  {
    label: 'L5-digisign-envelopes',
    q: `("616d24b8-a777" OR "8fa10510-fb25" OR "c733119a-b568" OR "4a954636-512a" OR "8dd90587-7ad1" OR "13aa3974-c7b3" OR "12fb0ccc-e853" OR "eda10320-2867" OR "31330941-b488" OR "16a39f0d-ed55" OR "28886c48-08f9" OR "3de8b9cb-d18b" OR "9d957a88-1f1a" OR "28898d33" OR "1731-bb-65fb" OR "c733119a")`,
  },
  {
    label: 'L6-graham-murray-counter-window',
    q: `("Graham" OR "Murray") after:2025/05/04 before:2025/05/13 has:attachment`,
  },
  {
    label: 'L7-diane-ingersoll-attachments',
    q: `from:westerntitle.com after:${AFTER} before:${BEFORE} has:attachment`,
  },
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

async function listAndDetail(gmail, q, max = 30) {
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: max })
  const ids = (res.data.messages || []).map((m) => m.id)
  const out = []
  for (const id of ids) {
    // 'full' so payload.parts has attachment filenames + attachmentId; without
    // this, metadata format hides everything below the top-level body.
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    const headers = {}
    // Headers live on the top-level payload in 'full' mode
    for (const h of msg.data.payload?.headers || []) headers[h.name.toLowerCase()] = h.value
    // Also pull headers from inner parts as a fallback
    function harvestHeaders(p) {
      if (!p) return
      for (const h of p.headers || []) {
        const k = h.name.toLowerCase()
        if (!headers[k]) headers[k] = h.value
      }
      for (const sub of p.parts || []) harvestHeaders(sub)
    }
    harvestHeaders(msg.data.payload)
    // Pull attachment filenames recursively
    const attachments = []
    function walk(p) {
      if (!p) return
      if (p.filename && p.filename.length && p.body?.attachmentId) {
        attachments.push({ filename: p.filename, mimeType: p.mimeType, size: p.body.size, attachmentId: p.body.attachmentId })
      }
      for (const sub of p.parts || []) walk(sub)
    }
    walk(msg.data.payload)
    out.push({
      id,
      threadId: msg.data.threadId,
      date: headers['date'],
      from: headers['from'],
      to: headers['to'],
      cc: headers['cc'],
      subject: headers['subject'],
      snippet: msg.data.snippet,
      attachments,
    })
  }
  return out
}

async function main() {
  const findings = {}
  for (const inbox of BROKER_INBOXES) {
    findings[inbox] = {}
    let auth
    try {
      auth = authFor(inbox)
      await auth.authorize()
    } catch (e) {
      console.error(`[${inbox}] AUTH FAIL: ${e?.message || e}`)
      findings[inbox]._error = String(e?.message || e)
      continue
    }
    const gmail = google.gmail({ version: 'v1', auth })
    for (const layer of QUERIES) {
      try {
        const hits = await listAndDetail(gmail, layer.q, 40)
        findings[inbox][layer.label] = {
          query: layer.q,
          count: hits.length,
          messages: hits,
        }
        console.error(`[${inbox}] ${layer.label}: ${hits.length} hits`)
      } catch (e) {
        findings[inbox][layer.label] = { query: layer.q, error: String(e?.message || e) }
        console.error(`[${inbox}] ${layer.label} ERR: ${e?.message || e}`)
      }
    }
  }

  // De-duplicate across inboxes by message id, build summary
  const seenIds = new Set()
  const uniqueByThread = {}
  let totalHits = 0
  for (const inbox of Object.keys(findings)) {
    for (const layerName of Object.keys(findings[inbox])) {
      const layer = findings[inbox][layerName]
      if (!layer.messages) continue
      for (const m of layer.messages) {
        totalHits++
        if (seenIds.has(m.id)) continue
        seenIds.add(m.id)
        if (!uniqueByThread[m.threadId]) {
          uniqueByThread[m.threadId] = {
            firstSeenInbox: inbox,
            subject: m.subject,
            from: m.from,
            date: m.date,
            attachments: [],
            layers: new Set(),
            messages: [],
          }
        }
        const t = uniqueByThread[m.threadId]
        t.layers.add(layerName)
        t.messages.push({ inbox, id: m.id, from: m.from, to: m.to, cc: m.cc, date: m.date, subject: m.subject, snippet: m.snippet, attachments: m.attachments })
        for (const a of m.attachments) t.attachments.push({ ...a, msgId: m.id, inbox })
      }
    }
  }

  // Convert sets to arrays
  for (const tid of Object.keys(uniqueByThread)) {
    uniqueByThread[tid].layers = [...uniqueByThread[tid].layers]
  }

  const summary = {
    folderGuid: FOLDER_GUID,
    dateWindow: { after: AFTER, before: BEFORE },
    brokerInboxes: BROKER_INBOXES,
    layersRun: QUERIES.map((q) => ({ label: q.label, q: q.q })),
    totalHits,
    uniqueThreadCount: Object.keys(uniqueByThread).length,
    threadsWithAttachments: Object.entries(uniqueByThread)
      .filter(([, t]) => t.attachments.length > 0)
      .map(([tid, t]) => ({ threadId: tid, ...t })),
    threadsWithoutAttachments: Object.entries(uniqueByThread)
      .filter(([, t]) => t.attachments.length === 0)
      .map(([tid, t]) => ({ threadId: tid, ...t })),
    rawByInbox: findings,
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(summary, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
  console.log(`Total hits across all layers: ${totalHits}`)
  console.log(`Unique threads: ${summary.uniqueThreadCount}`)
  console.log(`Threads with attachments: ${summary.threadsWithAttachments.length}`)
}

main().catch((e) => {
  console.error('FATAL:', e?.stack || e)
  process.exit(1)
})
