#!/usr/bin/env node
/**
 * Download + forward the 2 gap-fill docs we located in gmail:
 *   1. Buyer Representation Agreement (Graham/Murray <-> Matt Ryan, signed 4/9/25)
 *   2. Harcourts Transaction Timeline (internal pre-existing)
 *
 * Send both to OrdwayAvenue2732@skyslope.com.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const FROM = 'matt@ryan-realty.com'
const TO = 'OrdwayAvenue2732@skyslope.com'
const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const PULLS_DIR = `tmp/skyslope-pdfs/${FOLDER}/gap-pulls`

await fs.mkdir(PULLS_DIR, { recursive: true })

const TARGETS = [
  {
    // Search-resolved at runtime to handle inbox attribution
    inbox: 'matt@ryan-realty.com',
    msgId: null,
    searchHook: { q: 'subject:"Buyer\'s Agreement" "buyer\'s agreement" from:bigoztrip', attFilenameContains: 'Buyer Representation Agreement' },
    attFilename: '2_9.4 Buyer Representation Agreement - Signed SG and NM.pdf',
    saveAs: 'buyer-rep-agreement.pdf',
    forwardSubject: '[Ordway forward] Buyer Representation Agreement - Graham Murray signed 4-9-25',
    forwardBody:
      'Forwarding the Buyer Representation Agreement between Matt Ryan / Ryan Realty and Stephen Graham + Nicola Murray.\n\nSigned 4/9/2025 by the buyers and emailed to Matt the same day. The buyer rep agreement is in place for the Ordway transaction (closed 6/9/25 at WT0274211, $880,000).',
  },
  {
    inbox: null,
    msgId: null,
    searchHook: { q: 'subject:"Transaction Timeline" "Ordway"', attFilenameContains: 'SKM_C450i' },
    attFilename: null,
    saveAs: 'transaction-timeline-harcourts.pdf',
    forwardSubject: '[Ordway forward] Transaction Timeline - Harcourts internal',
    forwardBody:
      'Forwarding the Harcourts Garner Group internal Transaction Timeline doc for 2732 NW Ordway. Captures purchase price, mutual acceptance, EM deadlines, closing date, possession, inspection compliance dates, and contact info for title, lender, and both agents. Sent by Lisa Smith.',
  },
]

// First resolve any null msgId targets via gmail search before we
// try to fetch them.
function authFor(inbox) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    subject: inbox,
  })
}

// Resolve any null msgIds by searching the target inbox.
async function resolveMsgId(t, inboxesToTry) {
  for (const inbox of inboxesToTry) {
    const auth = authFor(inbox)
    await auth.authorize()
    const gmail = google.gmail({ version: 'v1', auth })
    const r = await gmail.users.messages.list({
      userId: 'me',
      q: t.searchHook?.q || `"${t.attFilename}"`,
      maxResults: 10,
    })
    for (const m of r.data.messages || []) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
      function walk(p) {
        if (!p) return null
        if (p.filename && p.body?.attachmentId) {
          const matches =
            (t.searchHook?.attFilenameContains && p.filename.includes(t.searchHook.attFilenameContains)) ||
            (t.attFilename && p.filename === t.attFilename) ||
            (t.attFilenameRegex && t.attFilenameRegex.test(p.filename))
          if (matches) return { filename: p.filename, attId: p.body.attachmentId }
        }
        for (const sub of p.parts || []) {
          const f = walk(sub)
          if (f) return f
        }
        return null
      }
      const found = walk(msg.data.payload)
      if (found) {
        t.inbox = inbox
        t.msgId = m.id
        t.attFilename = found.filename
        console.log(`  resolved: ${found.filename} -> inbox=${inbox} msgId=${m.id}`)
        return t
      }
    }
  }
  console.error(`  COULD NOT RESOLVE: ${t.attFilename}`)
  return t
}

const ALL_INBOXES = ['matt@ryan-realty.com', 'rebeccapeterson@ryan-realty.com', 'paul@ryan-realty.com']
for (const t of TARGETS) {
  if (!t.msgId) await resolveMsgId(t, ALL_INBOXES)
}

// Download each target
const downloaded = []
for (const t of TARGETS) {
  const auth = authFor(t.inbox)
  await auth.authorize()
  const gmail = google.gmail({ version: 'v1', auth })
  const msg = await gmail.users.messages.get({ userId: 'me', id: t.msgId, format: 'full' })
  function walk(p) {
    if (!p) return null
    if (p.filename === t.attFilename && p.body?.attachmentId) return p.body.attachmentId
    for (const sub of p.parts || []) {
      const f = walk(sub)
      if (f) return f
    }
    return null
  }
  const attId = walk(msg.data.payload)
  if (!attId) {
    console.error(`  [${t.saveAs}] attachment not found in msg ${t.msgId}`)
    continue
  }
  const att = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: t.msgId,
    id: attId,
  })
  const buf = Buffer.from(att.data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const localPath = path.join(PULLS_DIR, t.saveAs)
  await fs.writeFile(localPath, buf)
  console.log(`  Downloaded ${t.saveAs} (${buf.length}b) from ${t.inbox}`)
  downloaded.push({ ...t, localPath, bytes: buf.length })
}

// Forward each
const auth = authFor(FROM)
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

const log = []
for (const d of downloaded) {
  const bin = await fs.readFile(d.localPath)
  const b64 = bin.toString('base64')
  const wrapped = b64.match(/.{1,76}/g).join('\r\n')
  const boundary = `----rr-gap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const filename = d.attFilename.replace(/[\\/]/g, '_')
  const message = [
    `From: ${FROM}`,
    `To: ${TO}`,
    `Subject: ${d.forwardSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    d.forwardBody,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapped,
    '',
    `--${boundary}--`,
  ].join('\r\n')
  const raw = Buffer.from(message).toString('base64url')
  try {
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    log.push({ subject: d.forwardSubject, file: d.saveAs, status: 'sent', messageId: res.data.id })
    console.log(`  Sent: ${d.forwardSubject}  (msg ${res.data.id})`)
  } catch (e) {
    log.push({ subject: d.forwardSubject, file: d.saveAs, status: 'err', error: e.message })
    console.error(`  ERROR: ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 1200))
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/gap-fill-log.json`, JSON.stringify(log, null, 2))
console.log(`\nWrote gap-fill-log.json — ${log.filter((l) => l.status === 'sent').length}/${log.length} sent`)
