/**
 * measureCountyOwnershipReach — how many CRM contacts the county homeowner
 * check (getCountyOwnershipForPerson) can search at all, and an evenly spaced
 * sample of them to run it on. Read by scripts/_county-ownership-reach.ts.
 *
 * A contact is searchable when parseContactName finds a first and last name in
 * it, or contactAddressesFrom finds a street address with a civic number (a PO
 * box or a bare city is not one). Counts only; no name leaves this function.
 *
 * QUERY SHAPE: crm_people (deleted = false), paged 1,000 at a time in id order
 * through fetchPagedRows, so PostgREST's response cap cannot truncate it.
 */
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { parseContactName } from '@/lib/crm/county-owner-match'
import { contactAddressesFrom } from '@/lib/data/crm/getCountyOwnership'

export type CountyOwnershipReach = {
  /** crm_people rows with deleted = false. */
  contacts: number
  /** A first and last name the matcher can use. */
  withFullName: number
  /** At least one street address with a civic number. */
  withStreetAddress: number
  /** At least one street address in Oregon (state OR or a 97xxx zip). */
  withOregonStreetAddress: number
  /** A full name or a street address: the check runs. */
  searchable: number
  /** Evenly spaced searchable contact ids, at most `sampleSize`. */
  sampleIds: number[]
  readAt: string
}

type ReachRow = {
  id: number
  first_name: string | null
  last_name: string | null
  name: string | null
  addresses: unknown
}

export async function measureCountyOwnershipReach(sampleSize = 50): Promise<CountyOwnershipReach> {
  const sb = createServiceClient()
  const { rows, error } = await fetchPagedRows<ReachRow>((from, to) =>
    sb
      .from('crm_people')
      .select('id,first_name,last_name,name,addresses')
      .eq('deleted', false)
      .order('id', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`crm_people read failed: ${error.message}`)

  let withFullName = 0
  let withStreetAddress = 0
  let withOregonStreetAddress = 0
  const searchableIds: number[] = []
  for (const r of rows) {
    const hasName = parseContactName(r).people.length > 0
    const addresses = contactAddressesFrom(r.addresses)
    const oregon =
      Array.isArray(r.addresses) &&
      (r.addresses as Array<Record<string, unknown>>).some((a) => {
        if (!a || typeof a !== 'object') return false
        const state = String(a.state ?? '').trim().toUpperCase()
        const zip = String(a.zip ?? a.code ?? '').trim()
        return contactAddressesFrom([a]).length > 0 && (state === 'OR' || state === 'OREGON' || /^97\d{3}/.test(zip))
      })
    if (hasName) withFullName++
    if (addresses.length > 0) withStreetAddress++
    if (oregon) withOregonStreetAddress++
    if (hasName || addresses.length > 0) searchableIds.push(Number(r.id))
  }

  const n = Math.max(0, Math.min(sampleSize, searchableIds.length))
  const step = n > 0 ? searchableIds.length / n : 0
  const sampleIds = Array.from({ length: n }, (_, i) => searchableIds[Math.floor(i * step)]!)

  return {
    contacts: rows.length,
    withFullName,
    withStreetAddress,
    withOregonStreetAddress,
    searchable: searchableIds.length,
    sampleIds,
    readAt: new Date().toISOString(),
  }
}
