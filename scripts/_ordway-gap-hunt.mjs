#!/usr/bin/env node
/**
 * Targeted gmail hunt for the 9 specific doc gaps left after the
 * initial rename + reassignment pass on Ordway.
 *
 * Each gap has its own query stack — we cast a wide net per doc type
 * because the original 5-layer hunt focused on date window + Lisa Smith
 * sender + escrow number, which won't catch boilerplate disclosures
 * sent by title at a different point in the timeline.
 *
 * Writes:
 *   tmp/skyslope-pdfs/<guid>/gap-hunt.json   — raw hits per gap
 *   tmp/skyslope-pdfs/<guid>/gap-hunt.md     — human-readable list
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const BROKER_INBOXES = [
  'matt@ryan-realty.com',
  'rebeccapeterson@ryan-realty.com',
  'paul@ryan-realty.com',
]

// Wider date window — these disclosure docs can show up early (at first
// substantive contact) or late (at title processing), well outside the
// offer-cycle window we used originally.
const AFTER = '2025/03/01'
const BEFORE = '2025/07/01'

const PROPERTY_HOOK = `("Ordway" OR "2732 NW Ordway" OR "WT0274211" OR "MR05072025" OR "MR05042025" OR "MR04262025" OR "Graham" OR "Murray" OR "Bellinson")`

const GAPS = [
  {
    label: 'OREF_042_Initial_Agency_Disclosure',
    queries: [
      `${PROPERTY_HOOK} ("OREF 042" OR "OREF-042" OR "Initial Agency Disclosure" OR "Agency Disclosure Pamphlet" OR "10.4") after:${AFTER} before:${BEFORE}`,
      `("OREF 042" OR "Initial Agency Disclosure Pamphlet") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Buyers_Rep_Agreement_040_041_050',
    queries: [
      `${PROPERTY_HOOK} ("OREF 040" OR "OREF 041" OR "OREF 050" OR "Buyer Rep" OR "Buyer-Broker Service Agreement" OR "BBSA" OR "Buyer Representation Agreement") after:${AFTER} before:${BEFORE}`,
      `from:matt@ryan-realty.com (Graham OR Murray) ("OREF 040" OR "OREF 041" OR "OREF 050" OR "Buyer Rep" OR "BBSA") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'FIRPTA_Advisory_or_Cert',
    queries: [
      `${PROPERTY_HOOK} ("FIRPTA" OR "1445" OR "non-foreign" OR "Non Foreign" OR "foreign person") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Electronic_Funds_or_Wire_Fraud_Advisory',
    queries: [
      `${PROPERTY_HOOK} ("Electronic Funds" OR "Wire Fraud Advisory" OR "Wire Instructions Advisory" OR "WireSafe") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Real_Estate_Forms_Advisory',
    queries: [
      `${PROPERTY_HOOK} ("Real Estate Forms Advisory" OR "Forms Advisory" OR "OREF Forms") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Smoke_Alarm_Certificate_or_Advisory',
    queries: [
      `${PROPERTY_HOOK} ("Smoke Alarm" OR "Smoke Detector" OR "CO Detector" OR "Carbon Monoxide" OR "OREF 028" OR "Oregon Smoke") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Broker_Commission_Demand',
    queries: [
      `${PROPERTY_HOOK} ("Commission Demand" OR "Commission Instruction" OR "Broker Payout" OR "Demand For Commission" OR "Commission Disbursement Authorization" OR "CDA") after:${AFTER} before:${BEFORE}`,
    ],
  },
  {
    label: 'Transaction_Timeline',
    queries: [
      `${PROPERTY_HOOK} (Timeline OR "Transaction Timeline") after:${AFTER} before:${BEFORE}`,
    ],
  },
  // Broker Notes intentionally not searched — internal-only doc with no
  // external source. Will create directly if needed.
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

async function searchOne(gmail, q) {
  const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 40 })
  const ids = (res.data.messages || []).map((m) => m.id)
  const out = []
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    const headers = {}
    for (const h of msg.data.payload?.headers || []) headers[h.name.toLowerCase()] = h.value
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
      from: headers['from'],
      to: headers['to'],
      cc: headers['cc'],
      date: headers['date'],
      subject: headers['subject'],
      snippet: msg.data.snippet,
      attachments,
    })
  }
  return out
}

const findings = {}
for (const inbox of BROKER_INBOXES) {
  findings[inbox] = {}
  let auth
  try {
    auth = authFor(inbox)
    await auth.authorize()
  } catch (e) {
    console.error(`[${inbox}] AUTH FAIL: ${e.message}`)
    findings[inbox]._error = e.message
    continue
  }
  const gmail = google.gmail({ version: 'v1', auth })
  for (const gap of GAPS) {
    findings[inbox][gap.label] = []
    for (const q of gap.queries) {
      try {
        const hits = await searchOne(gmail, q)
        if (hits.length) {
          findings[inbox][gap.label].push({ query: q, hits })
        }
      } catch (e) {
        findings[inbox][gap.label].push({ query: q, error: e.message })
      }
    }
    const totalHits = findings[inbox][gap.label].reduce((n, r) => n + (r.hits?.length || 0), 0)
    console.error(`[${inbox}] ${gap.label}: ${totalHits} hits`)
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/gap-hunt.json`, JSON.stringify(findings, null, 2))

// Build human-readable summary, deduped per gap by (filename + size)
let md = `# Ordway gap-doc hunt\n\n`
md += `**Inboxes:** ${BROKER_INBOXES.join(', ')}\n`
md += `**Date window:** ${AFTER} to ${BEFORE}\n\n`

const NON_ORDWAY = /(3235 NW Cedar|Cedar Ave|2129 SW 35th|20702 Beaumont|2680 Nordic|Halpin|Crowson|Kwinnum)/i

for (const gap of GAPS) {
  md += `## ${gap.label}\n\n`
  // Collect all attachments across all inboxes for this gap
  const allAttach = []
  for (const inbox of BROKER_INBOXES) {
    const rs = findings[inbox][gap.label] || []
    for (const r of rs) {
      for (const m of r.hits || []) {
        if (NON_ORDWAY.test(m.subject || '')) continue
        for (const a of m.attachments || []) {
          allAttach.push({ ...a, inbox, msgId: m.id, subject: m.subject, from: m.from, date: m.date })
        }
      }
    }
  }
  // Dedupe by filename+size
  const seen = new Set()
  const dedup = []
  for (const a of allAttach) {
    const k = `${a.filename}|${a.size}`
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push(a)
  }
  // Filter out clear noise
  const NOISY = /(image\d{3}|Outlook\s-|HomesLockup|signature|signed-image)/i
  const interesting = dedup.filter((a) => !NOISY.test(a.filename) && !/\.(png|jpg|jpeg|gif)$/i.test(a.filename))

  if (interesting.length === 0) {
    md += `**No relevant attachments found in this gap window.**\n\n`
  } else {
    md += `Found ${interesting.length} candidate attachment(s):\n\n`
    interesting.sort((x, y) => String(x.date).localeCompare(String(y.date)))
    for (const a of interesting) {
      md += `- **\`${a.filename}\`** (${a.size}b)\n`
      md += `  - From: ${a.from}\n`
      md += `  - Date: ${a.date}\n`
      md += `  - Subject: ${a.subject}\n`
      md += `  - Inbox: ${a.inbox}\n`
      md += `  - msgId: ${a.msgId}  ·  attId: ${a.attachmentId.slice(0, 30)}...\n\n`
    }
  }
}

await fs.writeFile(`tmp/skyslope-pdfs/${FOLDER}/gap-hunt.md`, md)
console.log(`\nWrote tmp/skyslope-pdfs/${FOLDER}/gap-hunt.md`)
console.log(`Wrote tmp/skyslope-pdfs/${FOLDER}/gap-hunt.json`)
