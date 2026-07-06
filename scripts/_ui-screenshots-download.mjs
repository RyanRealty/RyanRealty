#!/usr/bin/env node
/**
 * Download the CRM UI screenshots Matt emailed himself ("Ui 1" + "Ui 2")
 * into tmp/ui-screenshots/ so we can review them.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

// Load .env.local
try {
  const env = await fs.readFile('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) {
      let v = m[2].trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
} catch {}

const USER = 'matt@ryan-realty.com'
const MSG_IDS = ['19f03b72a14ed2bf', '19f03b789b263bd0'] // Ui 1, Ui 2
const OUT_DIR = 'tmp/ui-screenshots'
await fs.mkdir(OUT_DIR, { recursive: true })

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  subject: USER,
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

for (const msgId of MSG_IDS) {
  const msg = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
  const parts = []
  function walk(p) {
    if (!p) return
    if (p.filename && p.body?.attachmentId) parts.push(p)
    for (const sub of p.parts || []) walk(sub)
  }
  walk(msg.data.payload)
  console.log(`Msg ${msgId}: ${parts.length} attachments`)
  for (const p of parts) {
    const att = await gmail.users.messages.attachments.get({ userId: 'me', messageId: msgId, id: p.body.attachmentId })
    const buf = Buffer.from(att.data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    const local = path.join(OUT_DIR, p.filename)
    await fs.writeFile(local, buf)
    console.log(`  ${p.filename} (${buf.length}b)`)
  }
}
console.log('Done.')
