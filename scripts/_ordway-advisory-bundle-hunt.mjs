#!/usr/bin/env node
/**
 * Look at specific "Advisory bundle" envelope-completed emails and the
 * Buyer Representation Agreement emails to identify Ordway-specific
 * Initial Agency Disclosure / FIRPTA / Electronic Funds / etc.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
function authFor(inbox) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: SCOPES,
    subject: inbox,
  })
}

const QUERIES = [
  // Advisory bundle envelopes
  `subject:("Transaction Advisories" OR "Real Estate Advisories" OR "Advisories") after:2025/03/01 before:2025/07/01 has:attachment`,
  // Buyer rep envelope completions
  `subject:("Buyer Representation Agreement" OR "Buyer Agency Agreement" OR "Buyer's Agreement") after:2025/03/01 before:2025/07/01 has:attachment`,
  // Anything specifically about Ordway
  `subject:Ordway after:2025/03/01 before:2025/07/01 has:attachment`,
  // The "documents to sign" series for Ordway
  `subject:Ordway subject:"documents to sign" after:2025/03/01 before:2025/07/01`,
  // Initial Agency Disclosure with Bellinson seller name
  `(Bellinson AND ("042" OR "Initial Agency Disclosure" OR "Pamphlet")) after:2025/03/01 before:2025/07/01`,
  // FIRPTA + Ordway/Bellinson
  `(FIRPTA OR "1445") (Bellinson OR Ordway) after:2025/03/01 before:2025/07/01`,
]

const findings = {}
for (const inbox of ['matt@ryan-realty.com', 'rebeccapeterson@ryan-realty.com', 'paul@ryan-realty.com']) {
  findings[inbox] = []
  let auth
  try {
    auth = authFor(inbox)
    await auth.authorize()
  } catch (e) {
    console.error(`[${inbox}] AUTH FAIL: ${e.message}`)
    continue
  }
  const gmail = google.gmail({ version: 'v1', auth })
  for (const q of QUERIES) {
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 30 })
    for (const m of list.data.messages || []) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
      const h = {}
      for (const x of msg.data.payload?.headers || []) h[x.name.toLowerCase()] = x.value
      const atts = []
      function walk(p) {
        if (!p) return
        if (p.filename && p.body?.attachmentId) {
          atts.push({ filename: p.filename, size: p.body.size, attId: p.body.attachmentId })
        }
        for (const sub of p.parts || []) walk(sub)
      }
      walk(msg.data.payload)
      // Only keep if some Ordway-side person appears in headers OR if subject mentions Ordway / Bellinson / Graham / Murray
      const blob = `${h.from || ''}|${h.to || ''}|${h.cc || ''}|${h.subject || ''}|${msg.data.snippet || ''}`.toLowerCase()
      const isOrdway = /(ordway|bellinson|stephen graham|nicola murray|nic murray|wt0274211|mr05072025|mr05042025|mr04262025)/i.test(blob)
      if (!isOrdway) continue
      findings[inbox].push({
        query: q,
        msgId: m.id,
        threadId: msg.data.threadId,
        from: h.from,
        to: h.to,
        cc: h.cc,
        date: h.date,
        subject: h.subject,
        snippet: msg.data.snippet,
        attachments: atts,
      })
    }
  }
}

let md = `# Ordway-specific advisory-bundle hunt\n\n`
for (const inbox of Object.keys(findings)) {
  if (!findings[inbox].length) continue
  md += `## ${inbox}\n\n`
  // Dedupe by msgId
  const seen = new Set()
  for (const h of findings[inbox]) {
    if (seen.has(h.msgId)) continue
    seen.add(h.msgId)
    md += `### ${h.subject}\n`
    md += `- From: ${h.from}\n`
    md += `- Date: ${h.date}\n`
    md += `- Snippet: ${h.snippet}\n`
    if (h.attachments.length) {
      md += `- Attachments:\n`
      for (const a of h.attachments) {
        if (/\.(png|jpg|jpeg)$/i.test(a.filename)) continue
        md += `  - \`${a.filename}\` (${a.size}b)  msgId:${h.msgId}  attId:${a.attId.slice(0, 30)}...\n`
      }
    }
    md += `\n`
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/f88642ff-22e6-4618-b9e1-40b168a439e1/advisory-bundle-finds.md`, md)
console.log(`Wrote advisory-bundle-finds.md`)
const totalThreads = Object.values(findings).reduce((n, arr) => n + new Set(arr.map((x) => x.msgId)).size, 0)
console.log(`Total Ordway-specific threads found: ${totalThreads}`)
