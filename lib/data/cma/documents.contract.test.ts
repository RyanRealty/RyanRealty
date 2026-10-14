import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'lib/data/cma/documents.ts'), 'utf8')

describe('CMA admin review read stays off the blobs', () => {
  it('getCmaAdminReviewRowBySlug never selects html_content, citations, or render_args', () => {
    expect(SRC).toMatch(/CMA_ADMIN_REVIEW_COLUMNS/)
    expect(SRC).toMatch(/html_path/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*html_content/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*citations/)
    expect(SRC).not.toMatch(/CMA_ADMIN_REVIEW_COLUMNS\s*=\s*'[^']*render_args/)
  })

  it('getCmaProspectAsk reads last list from expired_listings / fsbo_listings by cma_id', () => {
    expect(SRC).toMatch(/export async function getCmaProspectAsk/)
    expect(SRC).toMatch(/from\('expired_listings'\)/)
    expect(SRC).toMatch(/from\('fsbo_listings'\)/)
    expect(SRC).toMatch(/\.eq\('cma_id'/)
  })

  it('getOutreachBuildProspect reads compliance and contact from the linked prospect', () => {
    expect(SRC).toMatch(/export async function getOutreachBuildProspect/)
    expect(SRC).toMatch(/compliance_hard_stop/)
    expect(SRC).toMatch(/contact_email/)
    expect(SRC).toMatch(/export async function getListingParcelNumber/)
    expect(SRC).toMatch(/parcel_number/)
  })

  it('getCmaProspectEnrichmentNotes reads the county notes by cma_id and throws when the read fails', () => {
    expect(SRC).toMatch(/export async function getCmaProspectEnrichmentNotes/)
    expect(SRC).toMatch(/select\('enrichment_notes'\)/)
    expect(SRC).toMatch(/getCmaProspectEnrichmentNotes expired failed/)
    expect(SRC).toMatch(/getCmaProspectEnrichmentNotes fsbo failed/)
  })
})
