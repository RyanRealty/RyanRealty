/**
 * ONE NAME FOR A SALE'S SUBDIVISION, EVERYWHERE THE LETTER PRINTS IT (reader
 * review 2026-10-09, 20676 Wild Rose).
 *
 * The search story named 61197 Cottonwood's subdivision "CLAB", the MLS code
 * on its listing, and so did the map caption and every competition sentence,
 * while the map outlined and labeled the recorded plat the house sits in:
 * "Tara View Estates". The map labels a plat by its recorded name
 * (lib/cma/map-outlines.ts printedPlatName). So the text does too: a sale that
 * sits in a recorded plat polygon is named by that plat's recorded name, and a
 * sale no polygon holds keeps its MLS name.
 *
 * The MLS name stays on `subdivision`: the searches, the area reads and the
 * membership tests are keyed on it. The printed name rides beside it on
 * `platName`, and the printers (the search story, lib/pricing/comp-search.ts;
 * the area sentences and the map caption, lib/pricing/comp-area.ts
 * compAreaLabel; the method note, lib/cma/sales-method-note.ts) read it. A
 * sale on the subject's own ground keeps being named by the subject's own
 * subdivision (rule 24), as before.
 */
import { readBoundaryLabels } from '@/lib/data/geo/subdivision-ring'
import { printedPlatName } from '@/lib/cma/map-outlines'

/** A machine slug such as tara-view-estates is never a printed name. */
function isMachineSlug(text: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(text)
}

/** A recorded label as the letter prints it, or null when it is not a name. */
export function printedRecordedPlat(label: string | null | undefined): string | null {
  const text = printedPlatName(label)
  return text && !isMachineSlug(text) ? text : null
}

/**
 * Each sale with `platName` set to its recorded plat's printed name, read in
 * one query. A sale with no polygon, or a failed read, is returned unchanged:
 * it keeps its MLS name, which is what the letter printed before.
 */
export async function withRecordedPlatNames<T extends { subdivisionSlug?: string | null }>(
  comps: readonly T[],
): Promise<Array<T & { platName?: string | null }>> {
  const slugs = comps.map((c) => (c.subdivisionSlug ?? '').trim()).filter(Boolean)
  if (slugs.length === 0) return [...comps]
  const labels = await readBoundaryLabels('subdivision', slugs)
  if (!labels) return [...comps]
  return comps.map((c): T & { platName?: string | null } => {
    const slug = (c.subdivisionSlug ?? '').trim()
    const name = slug ? printedRecordedPlat(labels.get(slug)) : null
    return name ? { ...c, platName: name } : c
  })
}
