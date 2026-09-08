import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * SITE-09 invariant: EVERY site submit answers the visitor in the same minute.
 *
 * The failure this pins is not a bug in a function — it is a wire coming loose.
 * A refactor that drops one `await sendXConfirmation(...)` from an action leaves
 * a form that silently says nothing, and no unit test of the helper would notice.
 * So the contract is read off the action files themselves.
 */

const read = (p: string) => readFileSync(p, 'utf8')

describe('every site submit sends the visitor a same-minute confirmation', () => {
  it.each([
    ['app/contact/actions.ts', 'sendContactConfirmation'],
    ['app/actions/search-alert-capture.ts', 'sendAlertConfirmation'],
    ['app/lp/expired-listing/actions.ts', 'sendExpiredAcknowledgment'],
  ])('%s calls %s', (file, fn) => {
    const src = read(file)
    expect(src).toContain("@/lib/comms/site-confirmations")
    expect(src).toContain(`${fn}(`)
  })

  it('every capture in the file confirms, not only the saved search', () => {
    const src = read('app/actions/search-alert-capture.ts')
    // Every exported capture must reach the helper; one shared import is not
    // proof that all of them call it. Three since SITE-06 added the single-home
    // price watch: saved search, saved home, price watch.
    expect(src.match(/sendAlertConfirmation\(/g) ?? []).toHaveLength(3)
    expect(src).toContain("kind: 'search'")
    expect(src).toContain("kind: 'listing'")
    expect(src).toContain("kind: 'price-drop'")
  })

  it('the paths that already confirmed still do', () => {
    expect(read('app/communities/[slug]/_v3/place-value-actions.ts')).toContain('sendPlaceValueConfirmation(')
    // The seller LP confirms through createCmaRequest, whose notifyLead defaults
    // to true (lib/cma-request.ts) and fires sendLeadConfirmation. Passing
    // notifyLead:false there would silently take the confirmation away.
    const seller = read('app/lp/seller-home-value/actions.ts')
    expect(seller).toContain('createCmaRequest(')
    expect(seller).not.toContain('notifyLead: false')
  })

  it('the expired LP acknowledges the SUBMIT without mailing the report', () => {
    const src = read('app/lp/expired-listing/actions.ts')
    expect(src).toContain('sendExpiredAcknowledgment(')
    // The owner never asked us for a valuation; that rule outranks the ack.
    expect(src).toContain('notifyLead: false')
  })
})

describe('the confirmations are system sends, and say nothing they cannot back', () => {
  const helper = read('lib/comms/site-confirmations.ts')
  /** Comments carry this file's reasoning; only shipped code and copy is pinned. */
  const code = helper.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

  it('every send declares a system initiator — never a broker send (CLAUDE.md §1)', () => {
    expect(helper).toContain("initiator: { kind: 'system'")
    expect(helper).not.toContain("kind: 'broker'")
  })

  it('rides the governed chokepoint, never a provider rail', () => {
    expect(helper).toContain('sendGovernedEmail(')
    for (const rail of ['sendCrmEmail(', 'sendEmail(', 'sendSms(']) {
      expect(helper).not.toContain(rail)
    }
  })

  it('carries an idempotency key on every send, so a double submit mails once', () => {
    // Four in the sender's plumbing (param, type, pass-through) plus one literal
    // per confirmation family: contact, search alert, listing save, expired.
    expect((code.match(/idempotencyKey:/g) ?? []).length).toBeGreaterThanOrEqual(4)
    for (const prefix of [
      'contact:',
      'alert-search:',
      'alert-listing:',
      'alert-price-drop:',
      'payment-estimate:',
      'expired-ack:',
    ]) {
      expect(code).toContain(prefix)
    }
  })

  it('promises no duration to the visitor (§0: a date is a number)', () => {
    for (const claim of ['five minutes', '5 minutes', 'within an hour', 'business day', 'within 24']) {
      expect(code.toLowerCase()).not.toContain(claim)
    }
  })

  it('the saved-HOME variant never promises alerts the capture does not create', () => {
    // submitListingSaveCapture writes no listing_alerts row. Only the saved
    // SEARCH branch may say an alert is on.
    const listingBranch = code.slice(code.indexOf("const home = what || 'that home'"))
    // The visitor-facing lines, not the purpose string the rails log.
    expect(listingBranch).not.toMatch(/listing alert/i)
    expect(listingBranch).not.toMatch(/one email/i)
    expect(listingBranch).not.toMatch(/when a (new )?home/i)
  })

  it('the price-watch variant promises exactly the row it creates, and no more', () => {
    // submitListingPriceDropWatch writes a listing_alerts row whose events map
    // has price_change ON and everything else OFF. So this branch may promise an
    // email on a price change — and must not promise the new-listing feed the
    // saved-SEARCH branch promises, because this row will never send one.
    const branch = code.slice(
      code.indexOf("if (params.kind === 'price-drop')"),
      code.indexOf("if (params.kind === 'search')"),
    )
    expect(branch).toMatch(/watching the price/i)
    expect(branch).toMatch(/stop it from any of them/i)
    expect(branch).not.toMatch(/comes on the market/i)
    expect(branch).not.toMatch(/matches/i)
  })

  it('the payment estimate promises ONE send and states its assumptions', () => {
    // A one-time send of a figure the visitor built. No cadence to state and
    // nothing to unsubscribe from — but the assumptions behind the number ride
    // with it, because a payment with no rate, term and down payment is not a
    // payment (§0).
    const branch = code.slice(code.indexOf('export async function sendPaymentEstimate'))
    expect(branch).toContain('assumptions')
    expect(branch).toMatch(/estimate, not a quote/i)
    expect(branch).not.toMatch(/each new|per new|every new/i)
  })

  it('the search-alert confirmation is sent only after the alert row persists', () => {
    // The copy says the alert is on. That sentence must not go out ahead of the
    // row that makes it true, so the call sits below the upsertListingAlert
    // guard, not inside the tagging block above it.
    const src = read('app/actions/search-alert-capture.ts')
    const persisted = src.indexOf('await upsertListingAlert(')
    const confirmed = src.indexOf("kind: 'search'")
    expect(persisted).toBeGreaterThan(-1)
    expect(confirmed).toBeGreaterThan(persisted)
  })
})
