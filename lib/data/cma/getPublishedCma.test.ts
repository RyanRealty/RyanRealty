import { describe, expect, it } from 'vitest'
import {
  CMA_DOCUMENT_TERMS,
  CMA_DOCUMENT_TERMS_VERSION,
  highlightsFromSiteFacts,
  isPublishable,
  publishBlockers,
  publishConcerns,
} from '@/lib/data/cma/getPublishedCma'
import { computeAuditVerdict } from '@/lib/cma/audit'

/**
 * The publish guard.
 *
 * `isPublishable` is the single gate every surface runs through: the ungated
 * listing-page summary, the registration that mints a delivery token, and the
 * token exchange that serves the document. If it says no, none of the three
 * produce anything. These tests are the proof of the two hard constraints:
 * nothing publishes without the per-document flag, and the ungated payload has
 * no route to per-comp sold detail.
 */

/** One audit finding, shaped exactly as build.ts persists it. */
function finding(severity: string, category: string, claim = `a ${severity} ${category} defect`) {
  return { severity, category, claim, evidence: 'the data shown', compListingKey: null }
}

/** A build_summary whose adversarial audit ran and produced these findings. */
function audited(findings: ReturnType<typeof finding>[] = [], extra: Record<string, unknown> = {}) {
  return {
    pricing: { needs_review: findings.length > 0 },
    audit: { used_llm: true, model: 'claude-sonnet-4-5', verdict: 'pass', summary: 'ok', findings },
    ...extra,
  }
}

function publishableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cma-1',
    slug: 'cma-test',
    doc_type: 'cma',
    status: 'finalized',
    archived_at: null,
    value_low: 955000,
    value_high: 1060000,
    published_to_listing: true,
    build_summary: audited(),
    ...overrides,
  }
}

describe('isPublishable — the per-document opt-in', () => {
  it('accepts a finalized CMA that a human explicitly published', () => {
    expect(isPublishable(publishableRow())).toBe(true)
  })

  it('REFUSES when the publish flag is false — the whole point of the feature', () => {
    expect(isPublishable(publishableRow({ published_to_listing: false }))).toBe(false)
  })

  it('refuses when the publish flag is missing entirely (default state of every existing row)', () => {
    const row = publishableRow()
    delete (row as Record<string, unknown>).published_to_listing
    expect(isPublishable(row)).toBe(false)
  })

  it('refuses a null or undefined row', () => {
    expect(isPublishable(null)).toBe(false)
    expect(isPublishable(undefined)).toBe(false)
  })

  it('refuses anything that is not a plain CMA even when the flag is on', () => {
    // expired-audit documents analyse ANOTHER participant's failed listing.
    // ODS §7-3 withholds the right to name such properties in public
    // representations, and §5-4 W.1 bars expired and withdrawn listings from
    // display. 4 of the 7 candidate rows on 2026-07-30 were exactly this shape.
    expect(isPublishable(publishableRow({ doc_type: 'expired-audit' }))).toBe(false)
    expect(isPublishable(publishableRow({ doc_type: 'bpo' }))).toBe(false)
  })

  it('refuses a document that is not finished', () => {
    expect(isPublishable(publishableRow({ status: 'draft' }))).toBe(false)
    expect(isPublishable(publishableRow({ status: 'building' }))).toBe(false)
    expect(isPublishable(publishableRow({ status: 'archived' }))).toBe(false)
  })

  it('accepts both finished states', () => {
    expect(isPublishable(publishableRow({ status: 'finalized' }))).toBe(true)
    expect(isPublishable(publishableRow({ status: 'delivered' }))).toBe(true)
  })

  it('refuses an archived document even if the flag was left on', () => {
    expect(isPublishable(publishableRow({ archived_at: '2026-07-01T00:00:00Z' }))).toBe(false)
  })

  it('refuses a document whose own audit found something critical', () => {
    // CLAUDE.md §0: a human ticking a box does not outrank the document's own
    // adversarial audit.
    const row = publishableRow({ build_summary: audited([finding('critical', 'data-integrity')]) })
    expect(isPublishable(row)).toBe(false)
  })

  it('refuses a document no audit ever ran on, including every pre-audit legacy build', () => {
    // No audit means no severity information, so the severity rule has nothing
    // to read. Publishing on an absence of evidence is the §0 failure mode.
    expect(isPublishable(publishableRow({ build_summary: { pricing: { needs_review: false } } }))).toBe(false)
    expect(isPublishable(publishableRow({ build_summary: {} }))).toBe(false)
    expect(
      isPublishable(
        publishableRow({ build_summary: { audit: { used_llm: false, note: 'no key' }, pricing: {} } }),
      ),
    ).toBe(false)
  })

  it('refuses a document with no usable value range', () => {
    expect(isPublishable(publishableRow({ value_low: null, value_high: null }))).toBe(false)
    expect(isPublishable(publishableRow({ value_low: 0, value_high: 0 }))).toBe(false)
    // Inverted range means the numbers are wrong, so nothing renders.
    expect(isPublishable(publishableRow({ value_low: 1060000, value_high: 955000 }))).toBe(false)
  })
})

describe('publish eligibility is keyed to finding SEVERITY, not to the needs_review flag', () => {
  it('blocks on a critical finding in every category the auditor can emit', () => {
    for (const category of ['data-integrity', 'comp-selection', 'price-opinion', 'narrative', 'market-verdict', 'other']) {
      const row = publishableRow({ build_summary: audited([finding('critical', category)]) })
      expect(isPublishable(row), category).toBe(false)
      expect(publishBlockers(row).map((b) => b.code)).toContain('audit-critical')
    }
  })

  it('publishes a document whose worst finding is major', () => {
    const row = publishableRow({
      build_summary: audited([finding('major', 'comp-selection'), finding('major', 'narrative')]),
    })
    expect(publishBlockers(row)).toEqual([])
    expect(isPublishable(row)).toBe(true)
  })

  it('publishes a document whose worst finding is minor', () => {
    const row = publishableRow({ build_summary: audited([finding('minor', 'narrative')]) })
    expect(isPublishable(row)).toBe(true)
  })

  it('does not block on needs_review by itself, which is the queue signal and not the publish rule', () => {
    // A needs_review raised by an unresolved site fact or a missing market
    // cache row is real information, and it is shown as a concern. It is not a
    // number the system called unsound, so it does not gate the public page.
    const row = publishableRow({
      build_summary: {
        pricing: { needs_review: true, review_reason: 'No market cache row.' },
        audit: { used_llm: true, verdict: 'pass', summary: 'clean', findings: [finding('minor', 'narrative')] },
        accuracy_contract: {
          pass: true,
          forceReview: true,
          checks: [{ id: 'market-context-present', severity: 'review', pass: false, detail: 'No market cache row.' }],
        },
      },
    })
    expect(isPublishable(row)).toBe(true)
    expect(publishConcerns(row).map((c) => c.reason)).toContain('No market cache row.')
  })

  it('blocks a critical price-opinion finding even though the queue verdict stays pass', () => {
    // The exact divergence, asserted in both directions so neither side can
    // drift into the other. computeAuditVerdict treats a price-level
    // disagreement between two models as broker judgment, which is right for
    // "must Matt look at this". Publishing is the stricter question: the
    // recommendation IS what goes public, so an auditor calling it
    // indefensible stops it.
    const findings = [finding('critical', 'price-opinion', 'The $640,000 recommendation is not supported by the adjusted comps.')]
    expect(computeAuditVerdict(findings as never)).toBe('pass')
    const row = publishableRow({ build_summary: audited(findings) })
    expect(isPublishable(row)).toBe(false)
  })

  it('states the critical finding verbatim, because a broker reads the refusal', () => {
    const claim = 'The subject is stated as 2.5-bath but the comp set shows a 3-bath configuration.'
    const row = publishableRow({ build_summary: audited([finding('critical', 'data-integrity', claim)]) })
    const critical = publishBlockers(row).filter((b) => b.code === 'audit-critical')
    expect(critical).toHaveLength(1)
    expect(critical[0].reason).toContain(claim)
  })

  it('emits one blocker per critical finding, so none is summarised away', () => {
    const row = publishableRow({
      build_summary: audited([
        finding('critical', 'data-integrity', 'Septic shows none-found on an occupied 2004 home.'),
        finding('critical', 'comp-selection', 'Seven of eight comps are new spec construction.'),
        finding('major', 'narrative'),
      ]),
    })
    expect(publishBlockers(row).filter((b) => b.code === 'audit-critical')).toHaveLength(2)
  })
})

describe('publishConcerns — what does not block, in the audit’s own words', () => {
  it('returns majors and minors and never a critical', () => {
    const row = publishableRow({
      build_summary: audited([
        finding('critical', 'data-integrity', 'a critical claim'),
        finding('major', 'comp-selection', 'a major claim'),
        finding('minor', 'narrative', 'a minor claim'),
      ]),
    })
    const concerns = publishConcerns(row)
    expect(concerns.map((c) => c.reason)).toEqual(['a major claim', 'a minor claim'])
    expect(concerns.map((c) => c.severity)).toEqual(['major', 'minor'])
    expect(JSON.stringify(concerns)).not.toContain('a critical claim')
  })

  it('adds the build contract’s failing review checks, minus the two the findings already cover', () => {
    const row = publishableRow({
      build_summary: audited([], {
        accuracy_contract: {
          checks: [
            { id: 'llm-judgment-ran', severity: 'review', pass: false, detail: 'The comparability judge did not run.' },
            { id: 'adversarial-audit-clean', severity: 'review', pass: false, detail: 'Audit verdict: fail.' },
            { id: 'adversarial-audit-ran', severity: 'review', pass: false, detail: 'Audit did not run.' },
            { id: 'comp-floor', severity: 'hard', pass: false, detail: 'never reaches here' },
            { id: 'methods-converged', severity: 'info', pass: false, detail: 'informational only' },
            { id: 'market-context-present', severity: 'review', pass: true, detail: 'passing check' },
          ],
        },
      }),
    })
    expect(publishConcerns(row).map((c) => c.reason)).toEqual(['The comparability judge did not run.'])
  })

  it('strips punctuation the brand voice bans from stored model prose', () => {
    // Findings written before audit.ts sanitized at source still carry model
    // em-dashes and semicolons. CLAUDE.md §2 applies to what a human reads.
    const row = publishableRow({
      build_summary: audited([finding('major', 'narrative', 'The comp is weak—and the weight is high; review it.')]),
    })
    const reason = publishConcerns(row)[0].reason
    expect(reason).not.toMatch(/[—–;]/)
  })

  it('returns nothing for a row with no audit and no contract', () => {
    expect(publishConcerns(null)).toEqual([])
    expect(publishConcerns(publishableRow({ build_summary: {} }))).toEqual([])
  })
})

describe('highlightsFromSiteFacts — ungated capability facts', () => {
  // The live `build_summary.site` payload for cma-19496-tumalo-reservoir,
  // read from Supabase on 2026-07-30.
  const site = {
    zone: 'MUA10',
    septic: 'installed',
    acreage: 2.28,
    in_sfha: false,
    flood_zone: 'X',
    permit_count: 9,
    water_source: 'municipal',
    water_rights_count: 0,
    irrigation_district: 'Tumalo Irrigation District',
    wildfire_hazard: true,
  }

  it('turns county and FEMA facts into highlights, each carrying its basis', () => {
    const highlights = highlightsFromSiteFacts(site)
    expect(highlights.length).toBeGreaterThan(0)
    for (const h of highlights) {
      expect(h.headline.trim().length).toBeGreaterThan(0)
      expect(h.basis.trim().length).toBeGreaterThan(0)
    }
    expect(highlights.map((h) => h.headline)).toContain('2.28 acres')
    expect(highlights.map((h) => h.headline)).toContain('Zoned MUA10')
  })

  it('never emits a hazard as a marketing highlight', () => {
    const text = JSON.stringify(highlightsFromSiteFacts(site)).toLowerCase()
    expect(text).not.toContain('wildfire')
  })

  it('never sources a highlight from MLS or sold data', () => {
    // Capability facts come from the county and FEMA. If a basis string ever
    // starts citing the MLS, the ungated/gated boundary has moved and this
    // test is the tripwire.
    for (const h of highlightsFromSiteFacts(site)) {
      expect(h.basis.toLowerCase()).not.toContain('mls')
      expect(h.basis.toLowerCase()).not.toContain('oregon data share')
      expect(h.basis.toLowerCase()).not.toContain('sold')
      expect(h.basis.toLowerCase()).not.toContain('comparable')
    }
  })

  it('returns nothing rather than guessing when there are no site facts', () => {
    expect(highlightsFromSiteFacts(null)).toEqual([])
    expect(highlightsFromSiteFacts(undefined)).toEqual([])
    expect(highlightsFromSiteFacts({})).toEqual([])
  })
})

describe('registration terms', () => {
  it('carries every clause ODS §5-4 F requires an agreeing registrant to see', () => {
    const all = CMA_DOCUMENT_TERMS.join(' ').toLowerCase()
    // F.1 consumer-broker relationship
    expect(all).toContain('broker')
    // F.2 personal, non-commercial use
    expect(all).toContain('non-commercial')
    // F.3 bona fide interest
    expect(all).toMatch(/buying, selling, or leasing|real interest/)
    // F.4 no copying or redistribution
    expect(all).toContain('redistribute')
    // F.5 MLS copyright acknowledgment
    expect(all).toContain('copyright')
    // §5-4 H MLS access for compliance verification
    expect(all).toContain('verify that we are following mls rules')
  })

  it('imposes no financial obligation and creates no representation agreement (ODS §5-4 G)', () => {
    const all = CMA_DOCUMENT_TERMS.join(' ').toLowerCase()
    for (const banned of ['fee', 'payment', 'commission', 'you agree to pay', 'exclusive']) {
      expect(all).not.toContain(banned)
    }
  })

  it('pins a version so a later revision cannot rewrite what a past registrant accepted', () => {
    expect(CMA_DOCUMENT_TERMS_VERSION).toMatch(/^cma-doc-terms-\d{4}-\d{2}-\d{2}$/)
  })
})
