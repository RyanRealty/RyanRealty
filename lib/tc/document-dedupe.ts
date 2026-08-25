/**
 * One document per cycle per content hash.
 *
 * The same PDF reaches a file more than once by design: we seal it, we email a
 * completion copy, Gmail sync files what we sent, the other side replies with
 * it attached, and a mailbox offer carries it again. Deduping on the message's
 * own attachment id or on the filename cannot see any of that — every arrival
 * looks new. Apollo ended up holding six copies of one signed sale agreement.
 *
 * The bytes are the identity. Callers hash what they are about to store and
 * reuse the existing row instead of inserting a second one.
 */

/**
 * Just enough of the PostgREST client to run one lookup. Typing the real
 * generated client here makes tsc chase the whole schema (TS2589) at every
 * call site, so the shape stays local and the call sites stay typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural client shape; the query below is the whole contract
type DocumentQuery = { from: (table: string) => any }

/**
 * The id of the document already on this cycle with these bytes, or null.
 * A null/blank hash never matches — an unhashed write cannot be deduped, so it
 * is treated as new rather than silently folded into an unrelated row.
 */
export async function existingDocumentIdByHash(
  sb: DocumentQuery,
  cycleId: string,
  sha256: string | null | undefined,
): Promise<string | null> {
  if (!sha256?.trim() || !cycleId) return null
  const { data } = await sb
    .from('tc_documents')
    .select('id, archived')
    .eq('cycle_id', cycleId)
    .eq('sha256', sha256)
    .limit(1)
  const row = (data ?? [])[0]
  return row ? String(row.id) : null
}
