import { describe, expect, it } from 'vitest'
import { OREGON_FORM_LIBRARIES } from './form-catalog-diff'
import { buildFormCatalogCheckScript, FORM_CATALOG_SCRIPT_RULES } from './form-catalog-script'

describe('buildFormCatalogCheckScript', () => {
  const script = buildFormCatalogCheckScript()

  it('lists the three Oregon libraries Matt uses and no ingest secret', () => {
    for (const lib of OREGON_FORM_LIBRARIES) {
      expect(script).toContain(lib.code)
      expect(script).toContain(lib.sourceLibraryId)
    }
    expect(script).toContain(FORM_CATALOG_SCRIPT_RULES.origin)
    expect(script).not.toMatch(/TC_FORMS_INGEST_SECRET/)
    expect(script).not.toMatch(/ryan-realty\.com/)
    expect(script).not.toMatch(/Bearer < /)
  })

  it('keeps only current published versions and copies JSON', () => {
    expect(script).toContain("status === 'Published'")
    expect(script).toContain('publishedVersionId')
    expect(script).toContain('navigator.clipboard.writeText')
  })
})
