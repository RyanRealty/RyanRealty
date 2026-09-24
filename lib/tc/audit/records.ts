/**
 * The principal broker's record check for one deal: every record Oregon
 * requires the file to hold, whether the Vault holds it, and the rule that
 * requires it. Pure. Sources (primary text, current after the 2026-01-01
 * amendments): ORS 696.280; OAR 863-015-0135, -0140, -0215, -0250, -0260;
 * the Real Estate Agency's "Records of Professional Real Estate Activity -
 * Sales". Research notes: docs/TC_RECORDS_AUDIT.md.
 *
 * A record counts only when the document reader has identified it, and an
 * agreement counts as executed only when the reader and the check against the
 * printed form agree (lib/tc/doc-read/cross-check.ts). Archived documents are
 * still records (the Vault's archive keeps the file; offers are archived as
 * records, never deleted), so they count for "kept" requirements; a document
 * of agreement counts for "executed" only while it is the live copy.
 */

export type AuditDocForm = { profile: string | null; form: string; verdict: string; checkedAgainst: string | null }
export type AuditDoc = { id: string; name: string; archived: boolean; ingestedAt: string; forms: AuditDocForm[] }
export type AuditOffer = { id: string; buyerName: string; status: string; submittedAt: string | null; presentedAt: string | null; repliedAt: string | null; documentId: string | null }
export type AuditReview = { documentIds: string[]; reviewedAt: string; decision: string }

export type AuditInput = {
  /** Which side Ryan Realty represents: a listing file means the seller. */
  side: 'seller' | 'buyer' | 'both'
  stage: string
  docs: AuditDoc[]
  offers: AuditOffer[]
  reviews: AuditReview[]
  mailFiled: number
  yearBuilt: number | null
  /** SkySlope checklist items imported with the file: completed (approved) and still in review. */
  checklist?: { completed: number; inReview: number }
  /**
   * Where the principal broker's review of this file is recorded. Matt
   * 2026-09-24: "currently im reviewing there [SkySlope] but will review here
   * when we cut over." A file that came from SkySlope is reviewed in SkySlope;
   * a file opened in the Vault is reviewed on Sign-off (tc_principal_reviews).
   */
  reviewSystem?: 'skyslope' | 'vault'
}

export type AuditStatus = 'ok' | 'missing' | 'review' | 'na' | 'elsewhere'
export type AuditRow = { key: string; requirement: string; citation: string; status: AuditStatus; detail: string; documents: string[] }

type Kind = 'listing' | 'buyerRep' | 'pamphlet' | 'faa' | 'spds' | 'saleAgreement' | 'counter' | 'addendum' | 'earnestMoney' | 'settlement' | 'lbp' | 'termination'

/** What kind of record a form the reader identified is. */
export function kindOf(f: Pick<AuditDocForm, 'profile' | 'form'>): Kind | null {
  const p = f.profile ?? ''
  const t = (f.form ?? '').toLowerCase()
  if (p === 'oref-015-listing-agreement' || (/listing\s+(?:agreement|contract)|exclusive\s+right\s+to\s+sell/.test(t) && !/addendum|amend|cancel|terminat|change|input/.test(t))) return 'listing'
  if (p === 'oref-050-buyer-rep' || /buyer\s+(?:representation|service)\s+agreement/.test(t)) return 'buyerRep'
  if (p === 'oref-042-pamphlet' || /agency\s+disclosure\s+pamphlet/.test(t)) return 'pamphlet'
  if (/final\s+agency\s+acknowledg/.test(t)) return 'faa'
  if (p === 'oref-021-lbp' || /lead[\s-]*based\s+paint/.test(t)) return 'lbp'
  if (p === 'oref-020-spd' || /property\s+disclosure\s+statement/.test(t)) return 'spds'
  if (p === 'earnest-money-receipt' || /earnest\s+money|receipt\s+(?:of|for)\s+(?:deposit|funds|incoming\s+wire)|incoming\s+wire/.test(t)) return 'earnestMoney'
  if (p === 'settlement-statement' || /settlement\s+statement|closing\s+statement|final\s+(?:seller|buyer)'?s?\s+statement/.test(t)) return 'settlement'
  if (p === 'oref-057-termination' || /termination/.test(t)) return 'termination'
  if (p === 'oref-003-counter' || p === 'generic-counter' || /counter\s*-?\s*offer/.test(t)) return 'counter'
  if (p === 'oref-001-rsa' || p === 'generic-purchase-agreement' || (/(?:sale|purchase)(?:\s+and\s+sale)?\s+agreement/.test(t) && !/addendum|amend|counter/.test(t))) return 'saleAgreement'
  if (/addendum|amendment/.test(t)) return 'addendum'
  return null
}

const EXECUTED = new Set(['fully_executed'])
const ANSWERED = new Set(['fully_executed', 'countered', 'rejected'])
const UNDER_CONTRACT = new Set(['pending', 'closed'])

type Found = { doc: AuditDoc; form: AuditDocForm }

function found(docs: readonly AuditDoc[], kind: Kind, opts: { live?: boolean } = {}): Found[] {
  const out: Found[] = []
  for (const doc of docs) {
    if (opts.live && doc.archived) continue
    for (const form of doc.forms) if (kindOf(form) === kind) out.push({ doc, form })
  }
  return out
}

const names = (fs: readonly Found[]) => [...new Set(fs.map((f) => f.doc.name))]

function executedRow(key: string, requirement: string, citation: string, all: Found[], live: Found[], missingText: string): AuditRow {
  const done = live.filter((f) => EXECUTED.has(f.form.verdict))
  if (done.length) {
    const checked = done.find((f) => f.form.checkedAgainst)
    return { key, requirement, citation, status: 'ok', detail: `Fully executed${checked ? `, checked against ${checked.form.checkedAgainst}` : ''}.`, documents: names(done) }
  }
  if (all.length) {
    const words = [...new Set(all.map((f) => f.form.verdict.replace(/_/g, ' ')))].join(', ')
    return { key, requirement, citation, status: 'review', detail: `On file but not fully executed (${words}).`, documents: names(all) }
  }
  return { key, requirement, citation, status: 'missing', detail: missingText, documents: [] }
}

/** Every record requirement for the deal, in the order an auditor reads a file. */
export function auditDeal(input: AuditInput): AuditRow[] {
  const { docs, side, stage } = input
  const rows: AuditRow[] = []
  const seller = side === 'seller' || side === 'both'
  const buyer = side === 'buyer' || side === 'both'
  const contract = UNDER_CONTRACT.has(stage)

  // 1. Agency agreements.
  rows.push(
    seller
      ? executedRow('listing', 'Listing agreement', 'OAR 863-015-0250(1)(c)', found(docs, 'listing'), found(docs, 'listing', { live: true }), 'No listing agreement is on the file.')
      : { key: 'listing', requirement: 'Listing agreement', citation: 'OAR 863-015-0250(1)(c)', status: 'na', detail: 'Buyer-side file.', documents: [] },
  )
  rows.push(
    buyer
      ? executedRow('buyer_rep', 'Buyer representation agreement', 'ORS 696.810; OAR 863-015-0250(1)(c)', found(docs, 'buyerRep'), found(docs, 'buyerRep', { live: true }), 'No buyer representation agreement is on the file.')
      : { key: 'buyer_rep', requirement: 'Buyer representation agreement', citation: 'ORS 696.810; OAR 863-015-0250(1)(c)', status: 'na', detail: 'Seller-side file.', documents: [] },
  )

  // 2. Agency disclosure: the pamphlet is delivered (not signed); the final agency acknowledgment is signed.
  const pamphlet = found(docs, 'pamphlet')
  rows.push({
    key: 'pamphlet',
    requirement: 'Initial agency disclosure pamphlet delivered',
    citation: 'OAR 863-015-0215',
    status: pamphlet.length ? 'ok' : 'missing',
    detail: pamphlet.length ? 'Delivered copy on file.' : 'No copy of the initial agency disclosure pamphlet is on the file.',
    documents: names(pamphlet),
  })
  if (contract) {
    const faa = found(docs, 'faa')
    const rsa = found(docs, 'saleAgreement', { live: true }).filter((f) => EXECUTED.has(f.form.verdict))
    const faaDone = faa.filter((f) => EXECUTED.has(f.form.verdict) && !f.doc.archived)
    rows.push(
      faaDone.length || rsa.some((f) => f.form.profile === 'oref-001-rsa')
        ? { key: 'faa', requirement: 'Final agency acknowledgment signed', citation: 'ORS 696.845; OAR 863-015-0250(1)(a)-(b)', status: 'ok', detail: faaDone.length ? 'Signed.' : 'Signed within the fully executed sale agreement.', documents: names(faaDone.length ? faaDone : rsa) }
        : faa.length || found(docs, 'saleAgreement', { live: true }).some((f) => f.form.profile === 'oref-001-rsa' && f.form.verdict === 'countered')
          ? { key: 'faa', requirement: 'Final agency acknowledgment signed', citation: 'ORS 696.845; OAR 863-015-0250(1)(a)-(b)', status: 'review', detail: faa.length ? 'On file but not signed by every party.' : 'Part of the sale agreement, which was answered by counteroffer: confirm both parties signed the acknowledgment.', documents: names(faa.length ? faa : found(docs, 'saleAgreement', { live: true })) }
          : { key: 'faa', requirement: 'Final agency acknowledgment signed', citation: 'ORS 696.845; OAR 863-015-0250(1)(a)-(b)', status: 'missing', detail: 'No signed final agency acknowledgment is on the file.', documents: [] },
    )
  }

  // 3. Seller's property disclosure.
  const spds = found(docs, 'spds')
  const spdsLive = found(docs, 'spds', { live: true })
  if (seller || contract) {
    const executed = spdsLive.filter((f) => EXECUTED.has(f.form.verdict))
    const sellerSigned = spdsLive.filter((f) => f.form.verdict === 'partially_executed')
    rows.push(
      executed.length
        ? { key: 'spds', requirement: "Seller's property disclosure statement", citation: 'ORS 105.464-.475; OAR 863-015-0250(1)(f)', status: 'ok', detail: contract ? 'Signed by the seller, receipt acknowledged by the buyer.' : 'Signed.', documents: names(executed) }
        : sellerSigned.length && !contract
          ? { key: 'spds', requirement: "Seller's property disclosure statement", citation: 'ORS 105.464-.475; OAR 863-015-0250(1)(f)', status: 'ok', detail: 'Signed by the seller; the buyer acknowledges receipt when an offer comes.', documents: names(sellerSigned) }
          : spds.length
            ? { key: 'spds', requirement: "Seller's property disclosure statement", citation: 'ORS 105.464-.475; OAR 863-015-0250(1)(f)', status: 'review', detail: contract ? "On file but the buyer's acknowledgment of receipt is not confirmed." : 'On file but not signed by the seller.', documents: names(spds) }
            : { key: 'spds', requirement: "Seller's property disclosure statement", citation: 'ORS 105.464-.475; OAR 863-015-0250(1)(f)', status: 'missing', detail: 'No seller\'s property disclosure statement is on the file (or a written exemption under ORS 105.475).', documents: [] },
    )
  }

  // 4. Lead-based paint, homes built before 1978.
  const lbp = found(docs, 'lbp')
  if (input.yearBuilt != null && input.yearBuilt < 1978) {
    rows.push(executedRow('lbp', 'Lead-based paint disclosure (built before 1978)', '40 CFR 745.113', lbp, found(docs, 'lbp', { live: true }), `Built ${input.yearBuilt}: the lead-based paint disclosure is required and none is on the file.`))
  } else if (input.yearBuilt == null && !lbp.length) {
    rows.push({ key: 'lbp', requirement: 'Lead-based paint disclosure (built before 1978)', citation: '40 CFR 745.113', status: 'review', detail: 'Year built unknown: confirm the home was built in 1978 or later, or file the disclosure.', documents: [] })
  }

  // 5. Every offer and counteroffer, answered or not, with delivery and response recorded.
  const offerDocs = [...found(docs, 'saleAgreement'), ...found(docs, 'counter')]
  if (input.offers.length || offerDocs.length || contract) {
    const noResponse = input.offers.filter((o) => !o.repliedAt && !o.presentedAt && !['accepted', 'rejected', 'countered', 'withdrawn', 'expired'].includes(o.status))
    rows.push({
      key: 'offers',
      requirement: 'Every offer and counteroffer kept, with delivery and response recorded',
      citation: 'OAR 863-015-0135(3); OAR 863-015-0250(1)',
      status: !input.offers.length && !offerDocs.length ? 'missing' : noResponse.length ? 'review' : 'ok',
      detail: !input.offers.length && !offerDocs.length
        ? 'No offer is on the file.'
        : `${input.offers.length} offer${input.offers.length === 1 ? '' : 's'} recorded, ${offerDocs.length} offer or counteroffer document${offerDocs.length === 1 ? '' : 's'} kept${noResponse.length ? `; no delivery or response recorded for ${noResponse.map((o) => o.buyerName).join(', ')}` : ''}.`,
      documents: names(offerDocs),
    })
  }

  // 6. The fully executed sale agreement, addenda, earnest money, closing.
  if (contract) {
    rows.push(executedRow('sale_agreement', 'Fully executed sale agreement', 'OAR 863-015-0135(4); OAR 863-015-0250(1)(c)', found(docs, 'saleAgreement'), found(docs, 'saleAgreement', { live: true }).concat(found(docs, 'counter', { live: true }).filter((f) => EXECUTED.has(f.form.verdict))), 'No fully executed sale agreement is on the file.'))
    const addenda = found(docs, 'addendum', { live: true })
    const open = addenda.filter((f) => !ANSWERED.has(f.form.verdict) && f.form.verdict !== 'reference')
    rows.push({
      key: 'addenda',
      requirement: 'Addenda signed by buyer and seller',
      citation: 'OAR 863-015-0135(9)',
      status: open.length ? 'review' : 'ok',
      detail: !addenda.length ? 'No addenda on the file.' : open.length ? `${open.length} of ${addenda.length} not fully executed.` : `${addenda.length} addend${addenda.length === 1 ? 'um' : 'a'}, all executed.`,
      documents: names(open.length ? open : addenda),
    })
    const em = found(docs, 'earnestMoney')
    rows.push({
      key: 'earnest_money',
      requirement: 'Earnest money receipt',
      citation: 'OAR 863-015-0250(1)(d); OAR 863-015-0135(6)-(7)',
      status: em.length ? 'ok' : 'missing',
      detail: em.length ? 'Receipt on file.' : 'No earnest money receipt is on the file.',
      documents: names(em),
    })
  }
  if (stage === 'closed') {
    const st = found(docs, 'settlement')
    rows.push({ key: 'settlement', requirement: 'Settlement statement', citation: 'OAR 863-015-0250(1)(d),(3)', status: st.length ? 'ok' : 'missing', detail: st.length ? 'On file.' : 'No settlement statement is on the file.', documents: names(st) })
  }

  // 7. Correspondence.
  rows.push({
    key: 'correspondence',
    requirement: 'Correspondence with the parties filed',
    citation: 'OAR 863-015-0250(1)(f)',
    status: input.mailFiled > 0 ? 'ok' : 'missing',
    detail: input.mailFiled > 0 ? `${input.mailFiled} message${input.mailFiled === 1 ? '' : 's'} filed to this deal.` : 'No email is filed to this deal.',
    documents: [],
  })

  // 8. Principal broker review of every document of agreement.
  const agreements = docs.filter((d) => !d.archived && d.forms.some((f) => ['listing', 'buyerRep', 'saleAgreement', 'counter', 'addendum', 'termination'].includes(kindOf(f) ?? '') && ANSWERED.has(f.verdict)))
  if (agreements.length) {
    const reviewed = new Set(input.reviews.filter((r) => r.decision === 'approved').flatMap((r) => r.documentIds))
    const pending = agreements.filter((d) => !reviewed.has(d.id))
    const ck = input.checklist
    if (input.reviewSystem === 'skyslope') {
      const counts = ck ? ` SkySlope checklist: ${ck.completed} item${ck.completed === 1 ? '' : 's'} completed, ${ck.inReview} still in review.` : ''
      rows.push({
        key: 'principal_review',
        requirement: 'Principal broker review of each document of agreement (within 7 banking days)',
        citation: 'OAR 863-015-0140(4)',
        status: 'elsewhere',
        detail: `Reviewed in SkySlope until the Vault cutover; SkySlope holds the reviewer and date.${counts}`,
        documents: [],
      })
      return rows
    }
    const skyslope = ck && (ck.completed || ck.inReview) ? ` SkySlope checklist: ${ck.completed} item${ck.completed === 1 ? '' : 's'} marked completed, ${ck.inReview} still in review; the Vault has no reviewer and date for those.` : ''
    rows.push({
      key: 'principal_review',
      requirement: 'Principal broker review of each document of agreement (within 7 banking days)',
      citation: 'OAR 863-015-0140(4)',
      status: pending.length ? 'missing' : 'ok',
      detail: (pending.length ? `${agreements.length - pending.length} of ${agreements.length} reviewed in the Vault.` : `All ${agreements.length} reviewed.`) + (pending.length ? skyslope : ''),
      documents: pending.map((d) => d.name),
    })
  }
  return rows
}

export function auditScore(rows: readonly AuditRow[]): { ok: number; missing: number; review: number; applicable: number } {
  // A record kept in another system (principal review in SkySlope before the cutover) is not scored here.
  const applicable = rows.filter((r) => r.status !== 'na' && r.status !== 'elsewhere')
  return {
    ok: applicable.filter((r) => r.status === 'ok').length,
    missing: applicable.filter((r) => r.status === 'missing').length,
    review: applicable.filter((r) => r.status === 'review').length,
    applicable: applicable.length,
  }
}
