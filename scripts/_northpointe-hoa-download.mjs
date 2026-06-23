#!/usr/bin/env node
/**
 * Download the Northpointe HOA document package Kristen Tellman (Mile High)
 * emailed Matt on 2026-03-30, so we can read the CC&Rs / Fine Schedule and
 * check for exterior paint / color / architectural-review provisions.
 *
 * Source message: gmail message id 19d408670af6b739 (matt@ryan-realty.com).
 * Writes to tmp/northpointe-hoa/<filename>.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const MSG_ID = '19d408670af6b739'
const USER = 'matt@ryan-realty.com'
const OUT_DIR = 'tmp/northpointe-hoa'
await fs.mkdir(OUT_DIR, { recursive: true })

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  subject: USER,
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

const msg = await gmail.users.messages.get({ userId: 'me', id: MSG_ID, format: 'full' })

const found = []
function walk(p) {
  if (!p) return
  if (p.filename && p.body?.attachmentId) found.push({ filename: p.filename, attId: p.body.attachmentId })
  for (const sub of p.parts || []) walk(sub)
}
walk(msg.data.payload)

console.log(`Found ${found.length} attachments`)
const seen = new Set()
for (const f of found) {
  if (seen.has(f.filename)) continue
  seen.add(f.filename)
  const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: MSG_ID, id: f.attId })
  const buf = Buffer.from(att.data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const safe = f.filename.replace(/[\\/]/g, '_')
  await fs.writeFile(path.join(OUT_DIR, safe), buf)
  console.log(`  ${safe} (${buf.length}b)`)
}
console.log('done ->', OUT_DIR)
