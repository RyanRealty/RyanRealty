#!/usr/bin/env node
/**
 * Forward the 9 verified P1 Ordway docs from matt@ryan-realty.com to
 * OrdwayAvenue2732@skyslope.com via the service-account Gmail API.
 *
 * Each forward = one email = one PDF attachment + descriptive subject.
 *
 * Logs every send (success or failure) to
 * tmp/skyslope-pdfs/<guid>/forward-log.json
 *
 * Usage: node --env-file=.env.local scripts/_ordway-forward-to-skyslope.mjs
 */
import { google } from 'googleapis'
import fs from 'node:fs/promises'
import path from 'node:path'

const FOLDER = 'f88642ff-22e6-4618-b9e1-40b168a439e1'
const PULLS_DIR = `tmp/skyslope-pdfs/${FOLDER}/gmail-pulls`
const LOG_PATH = `tmp/skyslope-pdfs/${FOLDER}/forward-log.json`

const FROM = 'matt@ryan-realty.com'
const TO = 'OrdwayAvenue2732@skyslope.com'

// The 9 P1 docs (8 + Wire Transfer Receipt), each with a target subject
// describing what it is so SkySlope's ingest can be triaged by humans later.
const FORWARDS = [
  {
    file: 'P1_CRITICAL_Deed.PDF',
    subject: '[Ordway forward] Recorded Statutory Warranty Deed - Deschutes County 6-9-25',
    body: 'Forwarding the recorded Statutory Warranty Deed for 2732 NW Ordway. Recorded with Deschutes County 6/9/25 at 9:30am, instrument 2025-14644. Grantors Ryan + Ashlee Bellinson, grantees Stephen Graham + Nicola Anne Murray as tenants by the entirety. Sale price $880,000. Escrow WT0274211 closed at Western Title.',
  },
  {
    file: 'P1_CRITICAL_Nic - DPOA.pdf',
    subject: '[Ordway forward] Nicola Murray DPOA - Stephen Graham as attorney-in-fact',
    body: 'Forwarding the Florida Durable Power of Attorney executed by Nicola Anne Murray on 11/5/2020, naming Stephen Graham as her attorney-in-fact. This was used to support remote signing during the Ordway closing.',
  },
  {
    file: 'P1_CRITICAL_BuyerBorrower Statement_signed.pdf',
    subject: '[Ordway forward] Buyer-signed Final Buyer Borrower Statement - WT0274211',
    body: 'Forwarding the BUYER-SIGNED version of the Final Buyer Borrower Statement for escrow WT0274211. SkySlope currently holds only the title-internal unsigned version (FINAL_-_BuyerBorrower_Statement_-_IHSA_712.pdf). This is the canonical executed closing statement.',
  },
  {
    file: 'P2_INVESTIGATE_Owner_Association_Addendum_-_to__be_signed.pdf',
    subject: '[Ordway forward] OREF 024 Owner Association Addendum - all parties initialed MR05072025',
    body: 'Forwarding the fully-initialed OREF 024 Owner Association Addendum for sale agreement MR05072025. Both buyers AND both sellers initialed (filename in source email said "to be signed" but the doc itself is fully executed). SkySlope currently holds only the buyer-initialed version.',
  },
  {
    file: 'P2_INVESTIGATE_Contingency_Removal_Addendum__without_financing.pdf',
    subject: '[Ordway forward] OREF 060 Contingency Removal Addendum 1 - all 4 sigs 5-20-25 MR05072025',
    body: 'Forwarding the FULLY-EXECUTED OREF 060 Contingency Removal Addendum 1 for sale agreement MR05072025. All four parties signed 5/20/25 (buyers Graham + Murray, sellers Bellinson + Bellinson). Contingencies removed: title, inspections, SPD, owner-association. SkySlope currently holds only the buyer-only version (75b3a021, mislabeled as Notice of Termination).',
  },
  {
    file: 'P2_INVESTIGATE_Contingency_Removal_Addendum_2_-_060_OREF.pdf',
    subject: '[Ordway forward] OREF 060 Contingency Removal Addendum 2 - all 4 sigs 6-3-25 MR05072025',
    body: 'Forwarding the FULLY-EXECUTED OREF 060 Contingency Removal Addendum 2 for sale agreement MR05072025. All four parties signed 6/3/25. Final contingencies removed: financing + "all requested repairs successfully completed and documented." SkySlope currently holds only the buyer-only version (9fd378d1, mislabeled as Notice of Termination).',
  },
  {
    file: 'P2_INVESTIGATE_Buyers_Repair_Addendum_-_2.pdf',
    subject: '[Ordway forward] OREF 022A Buyers Repair Addendum 2 - all 4 sigs 5-14-25 MR05072025',
    body: 'Forwarding the FULLY-EXECUTED OREF 022A Buyers Repair Addendum 2 for sale agreement MR05072025. Buyers Graham + Murray signed 5/14/25 at 3:32pm, sellers Bellinson + Bellinson signed 5/14/25, Section 5(a) "Seller will perform the Repairs/Corrective Action" CHECKED. Repair items 1.1-1.5 covering exhaust damper, concrete crack, window sills, vent plugs, downspout drainage. SkySlope currently holds only the buyer-only version (68f8d4d8).',
  },
  {
    file: 'P1_CRITICAL_PRELIMINARY REPORT-LINKED-titleLOOK.PDF',
    subject: '[Ordway forward] Preliminary Title Report - WT0274211 titleLOOK 16 pages',
    body: 'Forwarding the Western Title Preliminary Title Report for escrow WT0274211 (2732 NW Ordway). 16-page interactive titleLOOK report. Title officer Tyler Friesen, escrow officer Diane Ingersoll-Thorp.',
  },
  {
    file: 'P1_CRITICAL_2025-05-28_Wire Transfer Receipt.pdf',
    subject: '[Ordway forward] Buyer Wire Transfer Receipt - $432088.41 cash to close',
    body: 'Forwarding the Capital One wire transfer success receipt for the buyer cash to close. Amount $432,088.41 + $30 non-refundable fee. To Western Title Wells Fargo escrow. Confirmation MM6B2FPAXDACSLO. Memo: "Ordway Ave Cash To Close". Loan/Escrow WT0274211DI.',
  },
]

async function send(gmail, from, to, subject, body, attachmentPath) {
  const filename = path.basename(attachmentPath)
  const bin = await fs.readFile(attachmentPath)
  const b64 = bin.toString('base64')

  // Wrap base64 to 76 chars per RFC compliance
  const wrapped = b64.match(/.{1,76}/g).join('\r\n')

  const boundary = `----rr-fwd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
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
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
  return res.data
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL.trim(),
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: FROM,
})

const gmail = google.gmail({ version: 'v1', auth })
await auth.authorize()
console.error(`[auth] OK — sending as ${FROM}`)

const log = []
for (const fwd of FORWARDS) {
  const attachmentPath = path.join(PULLS_DIR, fwd.file)
  const ts = new Date().toISOString()
  console.error(`[send] ${fwd.subject}`)
  console.error(`       file: ${fwd.file}`)
  try {
    const result = await send(gmail, FROM, TO, fwd.subject, fwd.body, attachmentPath)
    log.push({
      ts,
      status: 'sent',
      from: FROM,
      to: TO,
      subject: fwd.subject,
      file: fwd.file,
      messageId: result.id,
      threadId: result.threadId,
    })
    console.error(`       -> sent (gmail msg id: ${result.id})`)
  } catch (e) {
    log.push({
      ts,
      status: 'error',
      from: FROM,
      to: TO,
      subject: fwd.subject,
      file: fwd.file,
      error: e.message || String(e),
    })
    console.error(`       -> ERROR: ${e.message || e}`)
  }
  // Brief throttle to be polite to SkySlope ingest
  await new Promise((r) => setTimeout(r, 1500))
}

await fs.writeFile(LOG_PATH, JSON.stringify(log, null, 2))
console.error(`\nWrote ${LOG_PATH}`)
console.error(`Sent OK: ${log.filter((l) => l.status === 'sent').length}/${log.length}`)
const fails = log.filter((l) => l.status !== 'sent')
if (fails.length) {
  console.error(`Failures (${fails.length}):`)
  for (const f of fails) console.error(`  - ${f.file}: ${f.error}`)
}
