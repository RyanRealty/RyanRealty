#!/usr/bin/env node
/**
 * Deeper gmail hunt for the 7 remaining Ordway gaps. The first pass
 * filtered too narrowly on property/party names in subject lines. This
 * pass:
 *   - pulls every "Envelope completed: ..." email Lisa Smith or Matt
 *     sent or received in the Ordway window
 *   - looks inside each one for the actual party names + property in
 *     the BODY (not just the subject)
 *   - inspects every attachment to identify OREF 042 / 028 / 091 /
 *     FIRPTA / Electronic Funds / Smoke Alarms / Real Estate Forms
 *     Advisory etc. by filename pattern
 *   - cross-checks against the 7 Ordway gaps
 *
 * Writes tmp/skyslope-pdfs/<guid>/deeper-gap-hunt.md
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'

const BROKER_INBOXES = [
  'matt@ryan-realty.com',
  'rebeccapeterson@ryan-realty.com',
  'paul@ryan-realty.com',
]

const QUERIES = [
  // Layer A — Every DocuSign / SkySlope envelope-completed email Matt
  // got in the broader Ordway window. DocuSign subject lines usually
  // start with "Envelope completed:" or "Completed:".
  `(subject:"Envelope completed" OR subject:"Completed:" OR subject:"You have documents to sign") after:2025/03/01 before:2025/07/15 has:attachment`,
  // Layer B — DocuSign/SkySlope completion notices that mention
  // Bellinson / Graham / Murray in the BODY (Gmail searches body)
  `("Bellinson" OR "Stephen Graham" OR "Nicola Murray" OR "Nic Murray") (subject:"Envelope completed" OR subject:"Completed:") after:2025/03/01 before:2025/07/15`,
  // Layer C — Specifically look for OREF 042 / 028 / 091 attachments
  `has:attachment filename:OREF after:2025/03/01 before:2025/07/15`,
  // Layer D — Smoke alarm certification (Oregon OREF 028) — broader
  `("Smoke Alarm Certification" OR "Smoke Alarm Cert" OR "OREF 028" OR "Oregon Smoke Alarm") after:2025/03/01 before:2025/07/15`,
  // Layer E — FIRPTA non-foreign certification
  `("Certificate of Non-Foreign" OR "Non-Foreign Status" OR "FIRPTA Certification" OR "Section 1445") after:2025/03/01 before:2025/07/15`,
  // Layer F — Lisa Smith all-attachments — many Ordway-relevant envelopes
  // never mention Ordway by name (DocuSign subjects can be generic)
  `from:Lisa@thegarnergroup.com after:2025/04/01 before:2025/07/01 has:attachment`,
  // Layer G — Title Western: Commission Demand / CDA
  `(from:westerntitle.com OR from:firstam.com) ("Commission Demand" OR "CDA" OR "Commission Disbursement" OR "Demand for Commission") after:2025/03/01 before:2025/07/15`,
  // Layer H — Initial Agency Disclosure Pamphlet for Ordway-side specifically
  `("Initial Agency Disclosure" OR "Agency Disclosure Pamphlet" OR "OREF 042") ("Bellinson" OR "Graham" OR "Murray") after:2025/01/01 before:2025/07/15`,
]

function authFor(inbox) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: inbox,
  })
}

function decodePart(b64) {
  if (!b64) return ''
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extractBody(payload) {
  if (!payload) return ''
  if (payload.body?.data) return decodePart(payload.body.data)
  let out = ''
  for (const sub of payload.parts || []) out += extractBody(sub)
  return out
}

const allHits = {} // keyed by msgId; one entry per unique Ordway-related email

for (const inbox of BROKER_INBOXES) {
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
    let listed
    try {
      listed = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 })
    } catch (e) {
      console.error(`[${inbox}] query err: ${e.message}`)
      continue
    }
    for (const ref of listed.data.messages || []) {
      if (allHits[ref.id]) continue
      const msg = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' })
      const h = {}
      for (const x of msg.data.payload?.headers || []) h[x.name.toLowerCase()] = x.value
      const body = extractBody(msg.data.payload)
      const blob = `${h.from || ''}|${h.to || ''}|${h.cc || ''}|${h.subject || ''}|${msg.data.snippet || ''}|${body.slice(0, 5000)}`.toLowerCase()
      const ordwayPresent = /(ordway|bellinson|stephen\s*graham|nicola\s*(anne\s*)?murray|nic\s*murray|wt0274211|mr0?5072025|mr0?5042025|mr0?4262025|2732 nw)/i.test(blob)
      if (!ordwayPresent) continue
      const atts = []
      function walk(p) {
        if (!p) return
        if (p.filename && p.body?.attachmentId) {
          atts.push({ filename: p.filename, size: p.body.size, attachmentId: p.body.attachmentId })
        }
        for (const sub of p.parts || []) walk(sub)
      }
      walk(msg.data.payload)
      allHits[ref.id] = {
        msgId: ref.id,
        threadId: msg.data.threadId,
        inbox,
        from: h.from,
        to: h.to,
        cc: h.cc,
        date: h.date,
        subject: h.subject,
        snippet: msg.data.snippet,
        attachments: atts,
        bodyHints: {
          mentionsOREF042: /OREF[\s_-]*042|Initial Agency Disclosure|Agency Disclosure Pamphlet/i.test(body),
          mentionsOREF028: /OREF[\s_-]*028|Smoke Alarm|Smoke Detector/i.test(body),
          mentionsFIRPTA: /FIRPTA|non.foreign|Section 1445/i.test(body),
          mentionsElectronicFunds: /Electronic Funds|Wire Instructions|Wire Safe/i.test(body),
          mentionsRealEstateFormsAdvisory: /Real Estate Forms Advisory|Forms Advisory/i.test(body),
          mentionsSmokeAlarm: /Smoke Alarm|Smoke Detector/i.test(body),
          mentionsCommissionDemand: /Commission Demand|Commission Disbursement|CDA/i.test(body),
        },
      }
    }
  }
  console.error(`[${inbox}] cumulative hits: ${Object.keys(allHits).length}`)
}

// Bucket each unique hit by which gap-doc it likely contains
const buckets = {
  OREF_042_Initial_Agency_Disclosure: [],
  Smoke_Alarm: [],
  FIRPTA: [],
  Electronic_Funds: [],
  Real_Estate_Forms_Advisory: [],
  Commission_Demand: [],
  Other_envelope_completions: [],
}

for (const h of Object.values(allHits)) {
  const fNames = (h.attachments || []).map((a) => a.filename).join(' | ')
  const all = `${h.subject} ${fNames} ${h.snippet}`.toLowerCase()
  let placed = false
  if (h.bodyHints.mentionsOREF042 || /042|agency disclosure|pamphlet/i.test(fNames + ' ' + h.subject)) {
    buckets.OREF_042_Initial_Agency_Disclosure.push(h)
    placed = true
  }
  if (h.bodyHints.mentionsOREF028 || h.bodyHints.mentionsSmokeAlarm || /028|smoke|co detector/i.test(fNames + ' ' + h.subject)) {
    buckets.Smoke_Alarm.push(h)
    placed = true
  }
  if (h.bodyHints.mentionsFIRPTA || /firpta|non.foreign|1445/i.test(fNames + ' ' + h.subject)) {
    buckets.FIRPTA.push(h)
    placed = true
  }
  if (h.bodyHints.mentionsElectronicFunds || /electronic funds|wire safe|wire instructions/i.test(fNames + ' ' + h.subject)) {
    buckets.Electronic_Funds.push(h)
    placed = true
  }
  if (h.bodyHints.mentionsRealEstateFormsAdvisory || /forms advisory/i.test(fNames + ' ' + h.subject)) {
    buckets.Real_Estate_Forms_Advisory.push(h)
    placed = true
  }
  if (h.bodyHints.mentionsCommissionDemand || /commission demand|commission disbursement|cda\b/i.test(fNames + ' ' + h.subject)) {
    buckets.Commission_Demand.push(h)
    placed = true
  }
  if (!placed && /envelope completed/i.test(h.subject)) {
    buckets.Other_envelope_completions.push(h)
  }
}

let md = `# Ordway deeper gap hunt\n\n`
md += `**Total unique Ordway-related emails found:** ${Object.keys(allHits).length}\n\n`

for (const bucket of Object.keys(buckets)) {
  md += `## ${bucket} (${buckets[bucket].length})\n\n`
  if (buckets[bucket].length === 0) {
    md += `_No hits._\n\n`
    continue
  }
  for (const h of buckets[bucket]) {
    md += `### ${h.subject}\n`
    md += `- From: ${h.from} | To: ${h.to || ''} | Date: ${h.date}\n`
    md += `- Inbox: ${h.inbox} | msgId: ${h.msgId}\n`
    md += `- Snippet: ${(h.snippet || '').slice(0, 220)}\n`
    if (h.attachments.length) {
      md += `- Attachments:\n`
      for (const a of h.attachments) {
        if (/\.(png|jpg|jpeg|gif)$/i.test(a.filename)) continue
        md += `  - \`${a.filename}\` (${a.size}b)  attId:${a.attachmentId.slice(0, 30)}...\n`
      }
    }
    md += `\n`
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/deeper-gap-hunt.md`, md)
await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/deeper-gap-hunt.json`, JSON.stringify(allHits, null, 2))

console.log(`\nWrote deeper-gap-hunt.md`)
for (const b of Object.keys(buckets)) {
  console.log(`  ${b}: ${buckets[b].length}`)
}
