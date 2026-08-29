/**
 * SubdivisionSchools — the plat node's CLOSING SECTION, PATTERN 6, QUIET
 * (design_system/public/PUBLIC_UI.md section 3): hairline supporting content
 * carrying the graph's outbound edges. The assigned schools come first, then
 * every other edge out of this plat.
 *
 * WHY ONE SECTION AND NOT TWO. Two rules meet here and only this shape satisfies
 * both. `ci:subdivision-stats-integrity` requires that this page CALL
 * getSubdivisionSchools and RENDER `<SubdivisionSchools>`, so the schools cannot
 * be folded into a page-level block under another name. PUBLIC_UI.md's rhythm
 * rule forbids two adjacent sections sharing a pattern, and the schools block and
 * the closing edge block are both Quiet, so as separate sections they would sit
 * adjacent whenever the conditional sections between them did not render. One
 * Quiet, owned here, is what holds both rules at once for every combination of
 * present and absent data. Nothing else on the page is conditional in a way that
 * can break the rhythm.
 *
 * THE SECTION 0 THRESHOLD IS RENDERED, NOT ASSUMED, AND NOT RESTATED. The claim
 * rule lives in getSubdivisionSchools as two exported constants, and the sentence
 * this section prints is BUILT FROM THOSE CONSTANTS rather than spelling their
 * values in prose. Restating them is a live drift surface: change either constant
 * and the public page asserts a threshold the DAL no longer applies, on a licensed
 * broker's surface, with nothing to catch it. Importing them makes the sentence
 * follow the rule by construction, which is stronger than a gate. Each entry also
 * prints the modal count over the total, so a reader sees the evidence behind the
 * claim. A level that does not clear the threshold is omitted, never guessed.
 *
 * The schools cross-link to /schools/<slug> only when the curated Central Oregon
 * schools registry resolves the MLS name. An unresolved name stays plain text
 * rather than becoming a link to a page that does not exist.
 */

import { V3Quiet, type V3QuietItem } from '@/components/site/v3'
import { findSchoolByName } from '@/data/co-schools'
import { subdivisionFaceSchoolAssignment } from './_v3/subdivision-face'
import {
  SCHOOL_MIN_AGREEMENT,
  SCHOOL_MIN_SAMPLES,
  type SubdivisionSchool,
} from '@/lib/data/subdivisions/getSubdivisionSchools'

const LEVEL_LABEL: Record<SubdivisionSchool['level'], string> = {
  elementary: 'Elementary',
  middle: 'Middle',
  high: 'High school',
  district: 'District',
}

interface Props {
  displayName: string
  schools: SubdivisionSchool[]
  /**
   * Oldest year in the closed-sales series when the school sample is the
   * historical set (189 listings since 2021 on Ridge). Live headline count
   * stays the Field's homes.
   */
  sinceYear?: number | null
  /**
   * Every other outbound edge this page carries, built at the page where the
   * data that justifies each one was read. Rendered after the schools.
   */
  edges: readonly V3QuietItem[]
}

export function SubdivisionSchools({ displayName, schools, sinceYear, edges }: Props) {
  const items: V3QuietItem[] = []

  for (const school of schools) {
    const name = school.name.trim()
    if (!name) continue
    items.push({
      kind: 'prose',
      term: LEVEL_LABEL[school.level],
      body: subdivisionFaceSchoolAssignment({
        schoolName: name,
        modalCount: school.modalCount,
        totalCount: school.totalCount,
        sinceYear,
      }),
    })
    const registered = findSchoolByName(name)
    if (registered) {
      items.push({ label: `${registered.name} school page`, href: `/schools/${registered.slug}` })
    }
  }

  if (items.length > 0) {
    // Both numbers come from the DAL's own constants. Neither is typed here.
    const agreementBit = `${Math.round(SCHOOL_MIN_AGREEMENT * 100)} percent`
    items.push({
      kind: 'prose',
      term: 'How these assignments were read',
      body:
        `School assignments reflect the historical listings recorded in ${displayName}. A school appears only ` +
        `when at least ${agreementBit} of at least ${SCHOOL_MIN_SAMPLES} of those listings name it. ` +
        `Confirm enrollment and boundaries with the district. The listing data comes from Oregon ` +
        `Data Share through Ryan Realty.`,
    })
  }

  items.push(...edges)

  if (items.length === 0) return null

  return (
    <V3Quiet
      id="around"
      eyebrow={schools.length > 0 ? `${displayName} · Schools and nearby` : `${displayName} · Nearby`}
      heading={`Around ${displayName}`}
      items={items}
    />
  )
}
