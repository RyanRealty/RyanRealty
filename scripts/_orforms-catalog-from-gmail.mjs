#!/usr/bin/env node
/**
 * Enumerate the OR Forms catalog by searching Matt's gmail for every
 * "Form X.Y - Title" attachment we can find across all past transactions.
 *
 * Strategy: search for envelope-completed emails over the last 2 years
 * with PDF attachments, then dedupe by filename pattern matching the
 * OR Forms naming convention.
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  subject: 'matt@ryan-realty.com',
})
await auth.authorize()
const gmail = google.gmail({ version: 'v1', auth })

const QUERIES = [
  // SkySlope-generated envelope completion notifications carry the OR Forms with form# in filename
  'from:noreply@skyslope.com subject:"Envelope completed" has:attachment after:2024/01/01 before:2026/06/01',
  // DocuSign / Dotloop envelopes
  'subject:"Envelope completed" has:attachment after:2024/01/01 before:2026/06/01',
  // Direct OR Forms with "Form X.Y" in filename
  'filename:"Form" has:attachment after:2024/01/01',
]

const formCatalog = {} // key: form# like "9.4", value: { title, count, samples[] }

for (const q of QUERIES) {
  console.error(`[query] ${q}`)
  let pageToken = undefined
  let pages = 0
  do {
    const r = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken })
    pageToken = r.data.nextPageToken
    pages++
    if (pages > 10) break // safety: max 1000 messages
    for (const ref of r.data.messages || []) {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' })
        function walk(p) {
          if (!p) return
          if (p.filename && p.body?.attachmentId) {
            const fn = p.filename
            // Look for OR Forms filename pattern: anything containing "Form X.Y" or "X.Y-Title" or "X_Y_Title"
            // Common patterns:
            //   "9.4 BUYER REPRESENTATION AGREEMENT.pdf"
            //   "9.4-Buyer-Representation-Agreement.pdf"
            //   "Form_9_4_BBSA.pdf"
            //   "1.1 Oregon Residential Purchase and Sale Agreement.pdf"
            const m1 = fn.match(/^(\d{1,2}[.\-_]\d{1,2}[A-Z]?)[\s\-_]+([A-Za-z][^.]{5,80}?)\.(pdf|PDF)$/)
            if (m1) {
              const num = m1[1].replace(/[\-_]/g, '.')
              const title = m1[2].replace(/[_\-]/g, ' ').trim()
              if (!formCatalog[num]) formCatalog[num] = { title, count: 0, samples: [] }
              formCatalog[num].count++
              if (formCatalog[num].samples.length < 3) formCatalog[num].samples.push(fn.slice(0, 80))
            }
          }
          for (const sub of p.parts || []) walk(sub)
        }
        walk(msg.data.payload)
      } catch (e) {
        // skip
      }
    }
  } while (pageToken)
}

// Sort by form number numerically
const sortedKeys = Object.keys(formCatalog).sort((a, b) => {
  const [aMaj, aMin] = a.split('.').map((x) => parseFloat(x.replace(/[A-Za-z]/g, '')))
  const [bMaj, bMin] = b.split('.').map((x) => parseFloat(x.replace(/[A-Za-z]/g, '')))
  return aMaj - bMaj || aMin - bMin
})

let md = `# OR Forms catalog enumerated from gmail attachments\n\n`
md += `**Found ${sortedKeys.length} distinct form numbers from matt@'s gmail attachments.**\n\n`
md += `| Form # | Title | Hits | Sample filename |\n|---|---|---|---|\n`
for (const num of sortedKeys) {
  const f = formCatalog[num]
  md += `| ${num} | ${f.title} | ${f.count} | \`${f.samples[0]}\` |\n`
}
const OUT = 'tmp/skyslope-checklist-audit-2026-05-21/or-forms-catalog-from-gmail.md'
await fs.writeFile(OUT, md)
console.error(`\nWrote ${OUT}`)
console.log(`Distinct OR Form numbers found: ${sortedKeys.length}`)
for (const k of sortedKeys) console.log(`  ${k}  ${formCatalog[k].title}`)
