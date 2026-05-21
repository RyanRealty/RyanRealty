#!/usr/bin/env node
/**
 * Download Ordway P1+P2 priority attachments from the categorized list
 * into tmp/skyslope-pdfs/<guid>/gmail-pulls/ so we can visually verify
 * each one before forwarding to SkySlope.
 *
 * Reads:  tmp/skyslope-pdfs/<guid>/gmail-catalog.json
 * Writes: tmp/skyslope-pdfs/<guid>/gmail-pulls/<safe-filename>
 *         tmp/skyslope-pdfs/<guid>/gmail-pulls.json   (manifest)
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const CATALOG = JSON.parse(await fs.readFile(`tmp/skyslope-pdfs/${FOLDER}/gmail-catalog.json`, 'utf8'))
const OUT_DIR = `tmp/skyslope-pdfs/${FOLDER}/gmail-pulls`
const OUT_MANIFEST = `tmp/skyslope-pdfs/${FOLDER}/gmail-pulls.json`

await fs.mkdir(OUT_DIR, { recursive: true })

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

function authFor(userEmail) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: SCOPES,
    subject: userEmail,
  })
}

// Build a single list of (bucket, filename, size, copies[0])
const targets = []
for (const bucket of ['P1_CRITICAL', 'P2_INVESTIGATE']) {
  for (const item of CATALOG[bucket]) {
    if (!item.copies?.length) continue
    const copy = item.copies[0]
    targets.push({
      bucket,
      filename: item.filename,
      size: item.size,
      inbox: copy.inbox,
      msgId: copy.msgId,
      subject: copy.subject,
      from: copy.from,
      date: copy.date,
    })
  }
}

// Sort: P1 first, then P2
targets.sort((a, b) => a.bucket.localeCompare(b.bucket) || String(a.date).localeCompare(String(b.date)))

console.log(`Downloading ${targets.length} attachments to ${OUT_DIR}`)

const manifest = []

// Group by inbox so we only authorize once per user
const byInbox = {}
for (const t of targets) {
  if (!byInbox[t.inbox]) byInbox[t.inbox] = []
  byInbox[t.inbox].push(t)
}

for (const inbox of Object.keys(byInbox)) {
  let auth
  try {
    auth = authFor(inbox)
    await auth.authorize()
  } catch (e) {
    console.error(`[${inbox}] AUTH FAIL: ${e.message}`)
    continue
  }
  const gmail = google.gmail({ version: 'v1', auth })

  for (const t of byInbox[inbox]) {
    // Re-fetch the message to find this exact attachment by filename
    let msg
    try {
      msg = await gmail.users.messages.get({ userId: 'me', id: t.msgId, format: 'full' })
    } catch (e) {
      console.error(`  [${t.filename}] msg fetch failed: ${e.message}`)
      manifest.push({ ...t, status: 'err_fetch', error: e.message })
      continue
    }

    // Walk payload looking for the filename
    let attId = null
    function walk(p) {
      if (!p) return
      if (p.filename === t.filename && p.body?.attachmentId) attId = p.body.attachmentId
      for (const sub of p.parts || []) walk(sub)
    }
    walk(msg.data.payload)

    if (!attId) {
      console.error(`  [${t.filename}] attachment not located in msg ${t.msgId}`)
      manifest.push({ ...t, status: 'err_no_attachment_id' })
      continue
    }

    let att
    try {
      att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: t.msgId, id: attId })
    } catch (e) {
      console.error(`  [${t.filename}] attachment fetch failed: ${e.message}`)
      manifest.push({ ...t, status: 'err_download', error: e.message })
      continue
    }

    // base64url decode
    const data = att.data.data.replace(/-/g, '+').replace(/_/g, '/')
    const buf = Buffer.from(data, 'base64')

    // Safe filename: replace path separators + collisions
    const safe = `${t.bucket}_${t.filename.replace(/[\\/]/g, '_')}`
    const localPath = path.join(OUT_DIR, safe)
    await fs.writeFile(localPath, buf)

    console.log(`  [${t.bucket}] ${t.filename} -> ${safe} (${buf.length}b)`)
    manifest.push({ ...t, status: 'ok', localPath, sizeOnDisk: buf.length })
  }
}

await fs.writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2))
console.log(`\nWrote ${manifest.length} manifest entries to ${OUT_MANIFEST}`)
console.log(`Downloaded: ${manifest.filter((m) => m.status === 'ok').length}`)
console.log(`Failed:     ${manifest.filter((m) => m.status !== 'ok').length}`)
