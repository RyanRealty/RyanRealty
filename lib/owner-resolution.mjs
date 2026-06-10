/**
 * Owner resolution — public records + skip trace, fully automated
 * (Matt directive 2026-06-09: no more "Owner of X" placeholder leads).
 *
 * Chain:
 *  1. Deschutes County assessor taxlots (ArcGIS REST, structured, free,
 *     authoritative): situs address → OWNER + mailing address + taxlot.
 *     Replaces the old Apify screen-scrape of dial.deschutes.org.
 *  2. BatchData property skip-trace (~$0.07/hit): owner+address → phones,
 *     emails, TCPA/litigator/DNC/deceased flags (same integration as the
 *     Westside Bend farm enrichment).
 *
 * Compliance flags map per the locked TCPA rule: litigator OR dnc.tcpa OR
 * deceased → compliance:hard-stop + contact:do-not-call + contact:do-not-text.
 *
 * Plain .mjs so both the Next app (via owner-resolution.d.ts) and node
 * scripts share ONE canonical implementation (fub-client.mjs pattern).
 */

const TAXLOT_QUERY_URL = 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query'
const BATCHDATA_BASE = 'https://api.batchdata.com/api/v1'

const ENTITY_RE = /\b(LLC|TRUST|TRUSTEE|INC|CORP|LP|LLP|PARTNERSHIP|PROPERTIES|HOLDINGS|ESTATE|BANK|HOA|ASSOC)\b/i

/** Parse assessor "LAST, FIRST [MIDDLE]" (or entity) owner strings. */
export function parseOwnerName(raw) {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return { firstName: null, lastName: null, isEntity: false }
  if (ENTITY_RE.test(cleaned) || !cleaned.includes(',')) {
    return { firstName: null, lastName: cleaned, isEntity: ENTITY_RE.test(cleaned) }
  }
  const [last, rest] = cleaned.split(',', 2).map((s) => s.trim())
  const first = (rest ?? '').split(/[&/]| AND /i)[0].trim().split(' ')[0]
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s)
  return { firstName: first ? cap(first) : null, lastName: last ? cap(last) : null, isEntity: false }
}

/** Look up the owner of a Deschutes County property by situs address. Free, structured. */
export async function deschutesCountyOwner(streetAddress, city) {
  const norm = String(streetAddress).toUpperCase().replace(/\s+/g, ' ').trim()
  const houseNumber = (norm.match(/^\d+/) || [])[0]
  if (!houseNumber) return null
  const like = `${houseNumber}%${norm.replace(/^\d+\s*/, '').split(' ')[0]}%`
  try {
    const params = new URLSearchParams({
      where: `Taxlot_Assessor_Account.Address LIKE '${like.replace(/'/g, "''")}'`,
      outFields: 'Taxlot_Assessor_Account.Address,Taxlot_Assessor_Account.City,Taxlot_Assessor_Account.Zip,Taxlot_Assessor_Account.TAXLOT,dbo_GIS_MAILING.OWNER,dbo_GIS_MAILING.ACCOUNT_ID,dbo_GIS_MAILING.M_ADDRESS,dbo_GIS_MAILING.M_CITY,dbo_GIS_MAILING.M_STATE,dbo_GIS_MAILING.M_ZIP',
      returnGeometry: 'false',
      f: 'json',
    })
    const res = await fetch(`${TAXLOT_QUERY_URL}?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    let feats = data.features ?? []
    if (city) {
      const cityUp = String(city).toUpperCase()
      const filtered = feats.filter((f) => String(f.attributes['Taxlot_Assessor_Account.City'] ?? '').toUpperCase() === cityUp)
      if (filtered.length) feats = filtered
    }
    const a = feats[0]?.attributes
    const ownerRaw = a?.['dbo_GIS_MAILING.OWNER']?.trim()
    if (!a || !ownerRaw) return null
    const situs = String(a['Taxlot_Assessor_Account.Address'] ?? '').toUpperCase()
    const mailingStreet = a['dbo_GIS_MAILING.M_ADDRESS']?.trim() ?? null
    const mailingState = a['dbo_GIS_MAILING.M_STATE']?.trim() ?? null
    const absentee = !!mailingStreet && !mailingStreet.toUpperCase().startsWith(situs.split(' ')[0])
    const parsed = parseOwnerName(ownerRaw)
    return {
      ownerRaw,
      ...parsed,
      mailingStreet,
      mailingCity: a['dbo_GIS_MAILING.M_CITY']?.trim() ?? null,
      mailingState,
      mailingZip: a['dbo_GIS_MAILING.M_ZIP']?.trim() ?? null,
      absentee,
      outOfState: !!mailingState && mailingState.toUpperCase() !== 'OR',
      taxlot: a['Taxlot_Assessor_Account.TAXLOT'] ?? null,
      accountId: a['dbo_GIS_MAILING.ACCOUNT_ID'] != null ? String(a['dbo_GIS_MAILING.ACCOUNT_ID']) : null,
    }
  } catch (err) {
    console.warn('[owner-resolution] county lookup error:', err)
    return null
  }
}

/** BatchData property skip-trace (~$0.07). Same payload shape as the farm enrichment. */
export async function batchDataSkipTrace(params) {
  const key = process.env.BATCHDATA_API_KEY?.trim()
  if (!key) return null
  try {
    const body = {
      requests: [{
        propertyAddress: {
          street: params.street,
          city: params.city,
          state: params.state ?? 'OR',
          zip: String(params.zip ?? '').slice(0, 5) || undefined,
        },
        ...(params.mailingStreet ? {
          mailingAddress: {
            street: params.mailingStreet,
            city: params.mailingCity ?? undefined,
            state: params.mailingState ?? undefined,
            zip: String(params.mailingZip ?? '').slice(0, 5) || undefined,
          },
        } : {}),
        ...(params.firstName || params.lastName ? {
          name: { first: params.firstName ?? undefined, last: params.lastName ?? undefined },
        } : {}),
      }],
    }
    const res = await fetch(`${BATCHDATA_BASE}/property/skip-trace`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      console.warn('[owner-resolution] batchdata', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = await res.json()
    const person = data?.results?.persons?.[0]
    if (!person) return null
    const phones = (person.phoneNumbers ?? [])
      .filter((p) => p.number)
      .map((p) => ({ number: String(p.number), type: p.type ?? null, dnc: !!p.dnc }))
    const emails = (person.emails ?? []).map((e) => String(e.email)).filter(Boolean)
    const litigator = !!person.litigator
    const dncTcpa = !!person.dnc?.tcpa
    const deceased = !!person.death?.deceased
    return { phones, emails, litigator, dncTcpa, deceased, hardStop: litigator || dncTcpa || deceased }
  } catch (err) {
    console.warn('[owner-resolution] skip-trace error:', err)
    return null
  }
}

/** Full chain: county records → skip trace → compliance mapping. */
export async function resolveOwnerContact(streetAddress, city, zip) {
  const county = await deschutesCountyOwner(streetAddress, city)
  if (!county) return null
  const trace = await batchDataSkipTrace({
    street: streetAddress,
    city,
    zip,
    firstName: county.isEntity ? undefined : county.firstName,
    lastName: county.isEntity ? undefined : county.lastName,
    mailingStreet: county.mailingStreet,
    mailingCity: county.mailingCity,
    mailingState: county.mailingState,
    mailingZip: county.mailingZip,
  })
  const complianceTags = []
  if (trace?.hardStop) complianceTags.push('compliance:hard-stop', 'contact:do-not-call', 'contact:do-not-text')
  else if (trace?.phones?.some((p) => p.dnc)) complianceTags.push('contact:do-not-call')
  const bestPhone =
    trace?.phones?.find((p) => !p.dnc && /mobile|wireless/i.test(p.type ?? ''))?.number ??
    trace?.phones?.find((p) => !p.dnc)?.number ?? null
  return {
    county,
    trace,
    bestEmail: trace?.emails?.[0] ?? null,
    bestPhone,
    complianceTags,
  }
}
