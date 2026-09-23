/**
 * Vault end-to-end with the test aliases: a listing that takes a lowball offer
 * nobody answers, a full-price offer, our counter, an accepted agreement, title
 * mail, an escrow-number-only wire note, an ambiguous client question, an offer
 * on a property with no file, closing, and post-close title mail. Real email
 * between our own Workspace mailboxes, filed by the real mail index, checked
 * against what a person would expect, then the client portal view is read back.
 *
 * Parties (canon, keep the names): Matt = broker (matt@), Marketing Test Lead =
 * seller (marketing@, CRM 57840), Vault Test Buyer = buyer + buyer's agent
 * (admin@, CRM 63415). Every subject starts with "[TC TEST <run>]". The file is
 * "99001 Alias Test Loop, Bend, OR 97701" (not a real address).
 *
 * WRITES PRODUCTION: sends email between our mailboxes, creates/updates the test
 * deal, files documents, writes tc_events/tc_offers/tc_mail_messages. Run only
 * with Matt's go-ahead, after the mail index is deployed (the old 15-minute
 * filer would otherwise also file these emails).
 *
 *   npx tsx scripts/tc-alias-e2e.ts run
 *   npx tsx scripts/tc-alias-e2e.ts verify --run <id>   (re-check a finished run)
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import { randomBytes } from 'node:crypto'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

const ADDRESS = '99001 Alias Test Loop, Bend, OR 97701'
const STREET = '99001 Alias Test Loop'
const NOFILE = '99002 Nofile Test Court'
const ESCROW = 'TT990011'
const BROKER = 'matt@ryan-realty.com'
const SELLER = { email: 'marketing@ryan-realty.com', personId: 57840, name: 'Marketing Test Lead' }
const BUYER = { email: 'admin@ryan-realty.com', personId: 63415, name: 'Vault Test Buyer' }
const SEND = ['https://www.googleapis.com/auth/gmail.send']
const READ = ['https://www.googleapis.com/auth/gmail.readonly']

type PdfKind = 'offer' | 'counter' | 'executed' | 'settlement'

async function makePdf(kind: PdfKind, price: number, earnest: number, financing: string, property = STREET): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const lines: string[] =
    kind === 'settlement'
      ? ['FINAL SETTLEMENT STATEMENT', `Property: ${property}, Bend, OR 97701`, `Escrow No. ${ESCROW}`, `Sale price $${price.toLocaleString('en-US')}`, 'Recorded and disbursed.']
      : kind === 'counter'
        ? ["SELLER'S COUNTER OFFER", `Property: ${property}, Bend, OR 97701`, `Seller counters the Purchase Price of $${price.toLocaleString('en-US')}.`, 'Signed by: Marketing Test Lead, Seller']
        : [
            'RESIDENTIAL REAL ESTATE SALE AGREEMENT',
            `Property: ${property}, Bend, OR 97701`,
            `PRICE: Buyer offers to buy the Property for the Purchase Price of $ ${price.toLocaleString('en-US')}.00`,
            `EARNEST MONEY: Buyer will deposit earnest money in the amount of $ ${earnest.toLocaleString('en-US')}`,
            `FINANCING: Buyer will obtain a ${financing} loan.`,
            'Signed by: Vault Test Buyer, Buyer',
            'Buyer Agent: Vault Test Buyer',
            ...(kind === 'executed' ? ['Signed by: Marketing Test Lead, Seller', 'Seller Agent: Matt Ryan'] : []),
          ]
  const pages = kind === 'settlement' || kind === 'counter' ? 1 : 3
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([612, 792])
    const text = p === 0 ? lines.slice(0, 5) : p === pages - 1 ? lines.slice(5) : [`Section ${p + 1} terms.`]
    text.forEach((t, i) => page.drawText(t, { x: 50, y: 720 - i * 22, size: 11, font }))
  }
  return Buffer.from(await doc.save())
}

function mime(input: {
  from: string
  to: string
  subject: string
  body: string
  inReplyTo?: string | null
  references?: string | null
  attachment?: { name: string; bytes: Buffer } | null
}): string {
  const boundary = `rr-${randomBytes(8).toString('hex')}`
  const head = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.references ?? input.inReplyTo}`] : []),
  ]
  if (!input.attachment) {
    return [...head, 'Content-Type: text/plain; charset=UTF-8', '', input.body].join('\r\n')
  }
  return [
    ...head,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${input.attachment.name}"`,
    `Content-Disposition: attachment; filename="${input.attachment.name}"`,
    'Content-Transfer-Encoding: base64',
    '',
    input.attachment.bytes.toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}--`,
  ].join('\r\n')
}

type Step = {
  id: string
  from: string
  to: string
  subject: string
  body: string
  replyTo?: string
  pdf?: { kind: PdfKind; name: string; price: number; earnest?: number; financing?: string; property?: string }
  expect: { status: string; deal: 'test' | null; category?: string; method?: string }
  after?: 'accept' | 'escrow' | 'close'
}

function scenario(run: string): Step[] {
  const t = `[TC TEST ${run}]`
  return [
    { id: 'low_offer', from: BUYER.email, to: BROKER, subject: `${t} Offer on ${STREET}`, body: 'Please see our offer attached.', pdf: { kind: 'offer', name: 'Offer_Sale_Agreement.pdf', price: 385000, earnest: 5000, financing: 'FHA' }, expect: { status: 'filed', deal: 'test', category: 'offer', method: 'address' } },
    { id: 'alert_noise', from: BUYER.email, to: BROKER, subject: `${t} 16 new listings for Bend homes`, body: `${STREET}. 123 Pine Street. 456 Oak Avenue. 789 Elm Drive.`, expect: { status: 'bulk', deal: null } },
    { id: 'full_offer', from: BUYER.email, to: BROKER, subject: `${t} Full price offer - ${STREET}`, body: 'Full price, conventional, 30 day close.', pdf: { kind: 'offer', name: 'Sale_Agreement.pdf', price: 449000, earnest: 10000, financing: 'Conventional' }, expect: { status: 'filed', deal: 'test', category: 'offer', method: 'address' } },
    { id: 'present_to_seller', from: BROKER, to: SELLER.email, subject: `${t} Two offers on ${STREET}`, body: 'Both offers are attached. The first is well under list; the second is full price. Call me when you have looked.', expect: { status: 'filed', deal: 'test' } },
    { id: 'our_counter', from: BROKER, to: BUYER.email, replyTo: 'full_offer', subject: `Re: ${t} Full price offer - ${STREET}`, body: 'Seller counter attached: price stays, close in 25 days.', pdf: { kind: 'counter', name: 'SCO1.pdf', price: 449000 }, expect: { status: 'filed', deal: 'test', category: 'counter' } },
    { id: 'accepted', from: BUYER.email, to: BROKER, replyTo: 'our_counter', subject: `Re: Re: ${t} Full price offer - ${STREET}`, body: 'Fully signed agreement attached.', pdf: { kind: 'executed', name: 'Sale_Agreement_Fully_Executed.pdf', price: 449000, earnest: 10000, financing: 'Conventional' }, expect: { status: 'filed', deal: 'test', category: 'executed_agreement' }, after: 'accept' },
    { id: 'open_escrow', from: BUYER.email, to: BROKER, subject: `${t} Open Escrow # ${ESCROW} Property: ${STREET}`, body: 'Escrow is open. Earnest money wiring instructions to follow by phone.', expect: { status: 'filed', deal: 'test', category: 'escrow_title', method: 'address' }, after: 'escrow' },
    { id: 'escrow_only', from: BUYER.email, to: BROKER, subject: `${t} Wire confirmation ${ESCROW}`, body: 'Earnest money received.', expect: { status: 'filed', deal: 'test', method: 'escrow' } },
    { id: 'ambiguous_client', from: BUYER.email, to: BROKER, subject: `${t} Question about the walkthrough`, body: 'What time works for the final walkthrough?', expect: { status: 'ambiguous', deal: null } },
    { id: 'no_file_offer', from: BUYER.email, to: BROKER, subject: `${t} Offer on ${NOFILE}`, body: 'Offer attached for your listing.', pdf: { kind: 'offer', name: 'Offer.pdf', price: 510000, earnest: 7500, financing: 'Cash', property: NOFILE }, expect: { status: 'unfiled_transaction', deal: null, category: 'offer' }, after: 'close' },
    { id: 'post_close', from: BUYER.email, to: BROKER, subject: `${t} Recorded deed and final settlement statement - ${STREET}`, body: 'Recorded this morning. Final statement attached.', pdf: { kind: 'settlement', name: 'Final_Settlement_Statement.pdf', price: 449000 }, expect: { status: 'filed', deal: 'test', category: 'post_close' } },
  ]
}

async function ensureTestDeal(sb: import('@supabase/supabase-js').SupabaseClient): Promise<{ dealId: string; listingCycleId: string }> {
  const { data: existing } = await sb.from('tc_deals').select('id').eq('address', ADDRESS).maybeSingle()
  if (existing?.id) {
    const { data: c } = await sb.from('tc_cycles').select('id').eq('deal_id', existing.id).eq('kind', 'listing').limit(1).maybeSingle()
    return { dealId: String(existing.id), listingCycleId: String(c?.id) }
  }
  const dealId = crypto.randomUUID()
  const listingCycleId = crypto.randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  await sb.from('tc_deals').insert({ id: dealId, property_key: `inhouse-99001-alias-test-loop-${dealId.slice(0, 8)}`, address: ADDRESS, city: 'Bend', state: 'OR', broker_name: 'Matt Ryan', stage: 'active_listing', stage_detail: 'TC TEST (alias harness)' })
  await sb.from('tc_cycles').insert({ id: listingCycleId, deal_id: dealId, kind: 'listing', source: 'inhouse', source_guid: `inhouse:${listingCycleId}`, status: 'Active', broker_name: 'Matt Ryan', listing_date: today, listing_price: 449000, sellers: [SELLER.name], buyers: [] })
  await sb.from('tc_deal_people').insert({ deal_id: dealId, person_id: SELLER.personId, role: 'seller' })
  await sb.from('tc_events').insert({ deal_id: dealId, cycle_id: listingCycleId, actor: 'system:tc-alias-e2e', action: 'deal_created', detail: { address: ADDRESS, test: true } })
  return { dealId, listingCycleId }
}

/** The broker's clicks, done the way the actions do them, labeled as the harness. */
async function brokerStep(sb: import('@supabase/supabase-js').SupabaseClient, kind: 'accept' | 'escrow' | 'close', ids: { dealId: string; saleCycleId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  if (kind === 'accept') {
    const close = new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10)
    await sb.from('tc_cycles').upsert({ id: ids.saleCycleId, deal_id: ids.dealId, kind: 'sale', source: 'inhouse', source_guid: `inhouse:${ids.saleCycleId}`, status: 'Pending', broker_name: 'Matt Ryan', contract_acceptance_date: today, escrow_closing_date: close, sale_price: 449000, inspection_days: 10, financing_days: 21, sellers: [SELLER.name], buyers: [BUYER.name] })
    await sb.from('tc_deals').update({ stage: 'pending', stage_detail: 'TC TEST (alias harness): accepted' }).eq('id', ids.dealId)
    await sb.from('tc_deal_people').upsert({ deal_id: ids.dealId, person_id: BUYER.personId, role: 'buyer' }, { onConflict: 'deal_id,person_id' })
    const { data: offers } = await sb.from('tc_offers').select('id, price').eq('deal_id', ids.dealId)
    const full = (offers ?? []).find((o) => Number(o.price) === 449000)
    if (full) await sb.from('tc_offers').update({ status: 'accepted' }).eq('id', full.id)
    await sb.from('tc_events').insert({ deal_id: ids.dealId, cycle_id: ids.saleCycleId, actor: 'system:tc-alias-e2e', action: 'listing_contract_accepted', detail: { test: true } })
  }
  if (kind === 'escrow') await sb.from('tc_cycles').update({ escrow_number: ESCROW, escrow_company: 'Test Title Co' }).eq('id', ids.saleCycleId)
  if (kind === 'close') {
    // Recorded yesterday, so the title mail that follows is unambiguously after close.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await sb.from('tc_cycles').update({ status: 'Closed', actual_closing_date: yesterday }).eq('id', ids.saleCycleId)
    await sb.from('tc_deals').update({ stage: 'closed', stage_detail: 'TC TEST (alias harness): closed' }).eq('id', ids.dealId)
    await sb.from('tc_events').insert({ deal_id: ids.dealId, cycle_id: ids.saleCycleId, actor: 'system:tc-alias-e2e', action: 'deal_stage_changed', detail: { to: 'closed', test: true } })
  }
}

/** The newest message matching q that this run has not already used. */
async function waitFor(gmail: import('googleapis').gmail_v1.Gmail, q: string, seen: Set<string>, tries = 30): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const r = await gmail.users.messages.list({ userId: 'me', q, maxResults: 10 })
    const id = (r.data.messages ?? []).map((m) => m.id!).find((x) => !seen.has(x))
    if (id) {
      seen.add(id)
      return id
    }
    await new Promise((res) => setTimeout(res, 3000))
  }
  return null
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'run') {
    console.error('usage: tc-alias-e2e.ts run')
    process.exit(2)
  }
  const { getGmailFor } = await import('@/lib/crm/gmail')
  const { indexGmailMessage, loadMailUniverse } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')
  const { header } = await import('@/lib/tc/gmail-message')
  const sb = createServiceClient()
  const run = randomBytes(3).toString('hex').replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  const { dealId } = await ensureTestDeal(sb)
  const saleCycleId = crypto.randomUUID()
  const brokerRead = getGmailFor(BROKER, READ)!
  const sentIds = new Map<string, string>() // step → RFC Message-ID
  const roots = new Map<string, string>() // step → first Message-ID of its thread
  const seen = new Set<string>()
  const results: Array<Record<string, unknown>> = []

  for (const step of scenario(run)) {
    const sender = getGmailFor(step.from, SEND)
    if (!sender) throw new Error(`no send client for ${step.from}`)
    const attachment = step.pdf
      ? { name: step.pdf.name, bytes: await makePdf(step.pdf.kind, step.pdf.price, step.pdf.earnest ?? 0, step.pdf.financing ?? 'Conventional', step.pdf.property) }
      : null
    const parent = step.replyTo ? sentIds.get(step.replyTo) ?? null : null
    const root = step.replyTo ? roots.get(step.replyTo) ?? parent : null
    const raw = mime({
      from: step.from,
      to: step.to,
      subject: step.subject,
      body: step.body,
      inReplyTo: parent,
      references: root && parent && root !== parent ? `${root} ${parent}` : parent,
      attachment,
    })
    await sender.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } })
    // The broker's copy (inbox for received mail, sent folder for ours) is what the index reads.
    const gid = await waitFor(brokerRead, `subject:"${step.subject.replace(/"/g, '')}" newer_than:1h`, seen)
    if (!gid) {
      results.push({ step: step.id, ok: false, error: 'never arrived in the broker mailbox' })
      continue
    }
    const meta = (await brokerRead.users.messages.get({ userId: 'me', id: gid, format: 'metadata', metadataHeaders: ['Message-ID'] })).data
    const rfc = header(meta.payload?.headers, 'Message-ID')
    if (rfc) {
      sentIds.set(step.id, rfc)
      roots.set(step.id, step.replyTo ? roots.get(step.replyTo) ?? rfc : rfc)
    }
    const universe = await loadMailUniverse(sb)
    const r = await indexGmailMessage({ gmail: brokerRead, mailbox: BROKER, brokerSlug: 'matt', gmailId: gid, universe, sb })
    const gotDeal = r.dealId ?? r.decision?.dealId ?? null
    const ok =
      (r.decision?.status ?? r.status) === step.expect.status &&
      (step.expect.deal === 'test' ? gotDeal === dealId : gotDeal !== dealId) &&
      (!step.expect.category || r.decision?.category === step.expect.category) &&
      (!step.expect.method || r.decision?.method === step.expect.method)
    results.push({
      step: step.id,
      ok,
      expected: step.expect,
      got: { status: r.decision?.status ?? r.status, onTestDeal: gotDeal === dealId, category: r.decision?.category, method: r.decision?.method, documents: r.documents, offer: !!r.offerId, reasons: r.decision?.reasons },
    })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${step.id}: ${JSON.stringify(results.at(-1)?.got)}`)
    if (step.after) await brokerStep(sb, step.after, { dealId, saleCycleId })
  }

  // Offers as a person would read them on the deal page.
  const { data: offers } = await sb.from('tc_offers').select('price, earnest_money, financing_type, status, source, replied_at, presented_to_seller_at').eq('deal_id', dealId).order('price')
  // The client portal, as each test client would see it.
  const { getClientDeal } = await import('@/lib/data/tc/client-transactions')
  const portal: Record<string, unknown> = {}
  for (const who of [SELLER, BUYER]) {
    const view = await getClientDeal({ userId: 'harness', email: who.email, personIds: [who.personId] }, dealId)
    portal[who.name] = view && {
      stage: view.stageLabel,
      role: view.role,
      milestones: view.milestones.map((m) => `${m.label}:${m.state}`),
      nextSteps: view.nextSteps.map((s) => s.title),
      documents: view.documents.map((d) => d.name),
      activity: view.activity.map((a) => a.label),
    }
  }
  const out = { run, dealId, results, offers, portal, passed: results.filter((r) => r.ok).length, total: results.length }
  fs.mkdirSync('tmp', { recursive: true })
  fs.writeFileSync(`tmp/tc-alias-e2e-${run}.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ offers, portal, passed: out.passed, total: out.total }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
