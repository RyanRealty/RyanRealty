/**
 * Live county owner-of-record reads for the CRM homeowner check (Matt 2026-10-14).
 *
 * Two counties publish who owns each parcel on a public, queryable layer:
 *   Deschutes  Assessor taxlot layer behind DIAL (the same layer
 *              lib/owner-resolution.mjs reads for expired listings): OWNER,
 *              account, taxlot, site address, tax mailing address.
 *   Crook      County GIS taxlot layer (the one scripts/gis/import-taxlots.mjs
 *              loads lot lines from): OWNER_NAME, account, map taxlot, site
 *              address (no city), tax mailing address, property class.
 * Jefferson publishes no queryable taxlot layer (docs/DATABASE_FOR_AI_AGENTS.md
 * "Taxlot coverage"), so it is never searched and the UI says so.
 *
 * Neither layer carries assessed value or sale price. Those come only from the
 * westside_parcels assessor export, and only for the parcels it holds.
 *
 * Read-only GETs, free, no key. Everything that goes into a where clause is
 * reduced to [A-Z0-9] first, so nothing a contact typed reaches the county's SQL.
 */

export type CountyKey = 'deschutes' | 'crook'

export const COUNTY_LABEL: Record<CountyKey, string> = {
  deschutes: 'Deschutes County',
  crook: 'Crook County',
}

export const COUNTY_SOURCE: Record<CountyKey, string> = {
  deschutes: 'Deschutes County Assessor taxlot layer (DIAL)',
  crook: 'Crook County GIS taxlot layer',
}

/**
 * Crook's site address carries no city or zip, so a contact address can only
 * be matched to it inside Crook's own towns. These are the city/zip pairs the
 * MLS files under Crook County (listings, CloseDate 2025-01-01 on, read
 * 2026-10-14) minus the Bend, Redmond and Terrebonne edge rows, which would let
 * a Deschutes street match a Crook street with the same number and name.
 */
export const CROOK_SITUS_PLACES = {
  cities: ['Prineville', 'Powell Butte', 'Paulina', 'Post'],
  zips: ['97754', '97753', '97751', '97752'],
} as const

const QUERY_URL: Record<CountyKey, string> = {
  deschutes: 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query',
  crook: 'https://gis.crookcountyor.gov/server/rest/services/CC_Taxlots_Helion/FeatureServer/0/query',
}

const OUT_FIELDS: Record<CountyKey, string> = {
  deschutes: [
    'Taxlot_Assessor_Account.Address',
    'Taxlot_Assessor_Account.Unit_Number',
    'Taxlot_Assessor_Account.City',
    'Taxlot_Assessor_Account.Zip',
    'Taxlot_Assessor_Account.TAXLOT',
    'dbo_GIS_MAILING.OWNER',
    'dbo_GIS_MAILING.ACCOUNT_ID',
    'dbo_GIS_MAILING.M_ADDRESS',
    'dbo_GIS_MAILING.M_CITY',
    'dbo_GIS_MAILING.M_STATE',
    'dbo_GIS_MAILING.M_ZIP',
  ].join(','),
  crook: [
    'ACCOUNT',
    'MAPTAXLOT',
    'OWNER_NAME',
    'SITUS_ADDRESS',
    'M_ADDRESS',
    'M_CITY',
    'M_STATE',
    'M_ZIP',
    'PC_DESC',
    'TAX_CARD_LINK',
  ].join(','),
}

/**
 * Most rows one read returns; a where clause that hits more says so
 * (`truncated`). A read by site address or account is a handful of parcels.
 * A read by name can be hundreds for a short, common name ("LEE" and "AL"
 * matched 425 Deschutes owners on 2026-10-14), so it gets the layers' own
 * page size: Deschutes serves 1,000 a read, Crook 2,000.
 */
export const PARCEL_READ_CAP = 250
export const NAME_READ_CAP = 1000

export type CountyOwnerRecord = {
  county: CountyKey
  /** Assessor account: Deschutes ACCOUNT_ID (westside_parcels.apn), Crook ACCOUNT. */
  account: string
  taxlot: string | null
  ownerRaw: string
  situsStreet: string | null
  situsUnit: string | null
  /** Deschutes only; Crook's site address has no city or zip. */
  situsCity: string | null
  situsZip: string | null
  mailingStreet: string | null
  mailingCity: string | null
  mailingState: string | null
  mailingZip: string | null
  /** Crook's property class description ("Res Improved"); Deschutes's layer has none. */
  propertyClass: string | null
  /** The county's own page or tax card for this parcel. */
  recordUrl: string | null
}

export type CountyOwnerQuery = {
  /** First name and family name words to look for in the owner string. */
  names: Array<{ first: string; last: string }>
  /** Civic number and the one distinctive street word ("2347", "LARKSPUR"). */
  addresses: Array<{ number: string; streetWord: string }>
  /** Deschutes accounts to read by id (westside_parcels.apn). */
  accounts: string[]
}

const MAX_NAMES = 4
const MAX_ADDRESSES = 8
const MAX_ACCOUNTS = 40

/** Reduce to what can go between quotes in a county where clause: A-Z and 0-9 only. */
export function whereToken(s: string | null | undefined, minLength = 2): string | null {
  const t = String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return t.length >= minLength ? t : null
}

/** The where clause for one county, or null when there is nothing to search. */
export function buildOwnerWhere(county: CountyKey, q: CountyOwnerQuery): string | null {
  const clauses: string[] = []
  const ownerCol = county === 'deschutes' ? 'UPPER(dbo_GIS_MAILING.OWNER)' : 'UPPER(OWNER_NAME)'
  for (const n of q.names.slice(0, MAX_NAMES)) {
    const first = whereToken(n.first)
    const last = whereToken(n.last)
    if (!first || !last) continue
    clauses.push(`(${ownerCol} LIKE '%${last}%' AND ${ownerCol} LIKE '%${first}%')`)
  }
  for (const a of q.addresses.slice(0, MAX_ADDRESSES)) {
    const num = /^\d{1,7}[A-Z]?$/.test(a.number.toUpperCase()) ? a.number.toUpperCase() : null
    const word = whereToken(a.streetWord)
    if (!num || !word) continue
    clauses.push(
      county === 'deschutes'
        ? `(Taxlot_Assessor_Account.House_Number = '${num}' AND UPPER(Taxlot_Assessor_Account.Address) LIKE '%${word}%')`
        : `(SITUS_ADDRESS LIKE '${num} %${word}%')`,
    )
  }
  if (county === 'deschutes') {
    const accounts = Array.from(new Set(q.accounts.filter((a) => /^\d{1,10}$/.test(a)))).slice(0, MAX_ACCOUNTS)
    if (accounts.length > 0) clauses.push(`dbo_GIS_MAILING.ACCOUNT_ID IN (${accounts.map((a) => `'${a}'`).join(',')})`)
  }
  return clauses.length > 0 ? clauses.join(' OR ') : null
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s.length > 0 ? s : null
}

type ArcgisResponse = {
  features?: Array<{ attributes?: Record<string, unknown> }>
  exceededTransferLimit?: boolean
  error?: { message?: string; code?: number }
}

/** Map a county query response to records, one per account. */
export function parseOwnerResponse(
  county: CountyKey,
  json: ArcgisResponse,
): { records: CountyOwnerRecord[]; truncated: boolean } {
  if (json.error) throw new Error(`${county} query error: ${json.error.message ?? json.error.code ?? 'unknown'}`)
  const byAccount = new Map<string, CountyOwnerRecord>()
  for (const f of json.features ?? []) {
    const a = f.attributes ?? {}
    const rec: CountyOwnerRecord | null =
      county === 'deschutes'
        ? (() => {
            const account = str(a['dbo_GIS_MAILING.ACCOUNT_ID'])
            const owner = str(a['dbo_GIS_MAILING.OWNER'])
            if (!account || !owner) return null
            return {
              county,
              account,
              taxlot: str(a['Taxlot_Assessor_Account.TAXLOT']),
              ownerRaw: owner,
              situsStreet: str(a['Taxlot_Assessor_Account.Address']),
              situsUnit: str(a['Taxlot_Assessor_Account.Unit_Number']),
              situsCity: str(a['Taxlot_Assessor_Account.City']),
              situsZip: str(a['Taxlot_Assessor_Account.Zip']),
              mailingStreet: str(a['dbo_GIS_MAILING.M_ADDRESS']),
              mailingCity: str(a['dbo_GIS_MAILING.M_CITY']),
              mailingState: str(a['dbo_GIS_MAILING.M_STATE']),
              mailingZip: str(a['dbo_GIS_MAILING.M_ZIP']),
              propertyClass: null,
              recordUrl: /^\d+$/.test(account) ? `https://dial.deschutes.org/Real/Index/${account}` : null,
            }
          })()
        : (() => {
            const account = str(a.ACCOUNT)
            const owner = str(a.OWNER_NAME)
            if (!account || !owner) return null
            const card = str(a.TAX_CARD_LINK)
            return {
              county,
              account,
              taxlot: str(a.MAPTAXLOT),
              ownerRaw: owner,
              situsStreet: str(a.SITUS_ADDRESS),
              situsUnit: null,
              situsCity: null,
              situsZip: null,
              mailingStreet: str(a.M_ADDRESS),
              mailingCity: str(a.M_CITY),
              mailingState: str(a.M_STATE),
              mailingZip: str(a.M_ZIP),
              propertyClass: str(a.PC_DESC),
              recordUrl: card && card.startsWith('https://gis.crookcountyor.gov/') ? card : null,
            }
          })()
    if (rec && !byAccount.has(rec.account)) byAccount.set(rec.account, rec)
  }
  return { records: [...byAccount.values()], truncated: json.exceededTransferLimit === true }
}

/**
 * Read one county with a where clause built by buildOwnerWhere. Throws on a
 * failed read. Deschutes answers a name read in about 3.5 s (measured
 * 2026-10-14); 15 s leaves room for a loaded machine, and the section streams,
 * so a slow county holds back only its own rows.
 */
export async function fetchOwnerRecordsByWhere(
  county: CountyKey,
  where: string,
  opts: { timeoutMs?: number; cap?: number } = {},
): Promise<{ records: CountyOwnerRecord[]; truncated: boolean }> {
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS[county],
    returnGeometry: 'false',
    resultRecordCount: String(opts.cap ?? PARCEL_READ_CAP),
    f: 'json',
  })
  const res = await fetch(`${QUERY_URL[county]}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
  })
  if (!res.ok) throw new Error(`${county} query HTTP ${res.status}`)
  return parseOwnerResponse(county, (await res.json()) as ArcgisResponse)
}
