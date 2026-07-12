/** Types for lib/owner-resolution.mjs (canonical impl shared with scripts). */

export type CountyOwner = {
  ownerRaw: string
  firstName: string | null
  lastName: string | null
  isEntity: boolean
  mailingStreet: string | null
  mailingCity: string | null
  mailingState: string | null
  mailingZip: string | null
  absentee: boolean
  outOfState: boolean
  taxlot: string | null
  accountId: string | null
}

export type SkipTraceResult = {
  phones: Array<{ number: string; type: string | null; dnc: boolean }>
  emails: string[]
  litigator: boolean
  dncTcpa: boolean
  deceased: boolean
  hardStop: boolean
  /** Real owner the skip-trace resolved — the human behind an LLC/trust when the county record is an entity. */
  person: { first: string | null; last: string | null; full: string | null } | null
  /** Skip-trace demographics (estimates). Null when the provider returned none. */
  demographics: {
    age: number | string | null
    ageRange: string | null
    dob: string | null
    gender: string | null
    maritalStatus: string | null
    householdSize: number | string | null
    presenceOfChildren: string | boolean | null
    occupation: string | null
    income: string | null
    netWorth: string | null
  } | null
  /** Skip-trace behavioral flags. */
  flags: {
    recentlyMoved: boolean
    recentlyDivorced: boolean
    equityRich: boolean
    vacant: boolean
  }
}

export type ResolvedOwner = {
  county: CountyOwner
  trace: SkipTraceResult | null
  bestEmail: string | null
  bestPhone: string | null
  complianceTags: string[]
}

export function parseOwnerName(raw: string): { firstName: string | null; lastName: string | null; isEntity: boolean }
export function deschutesCountyOwner(streetAddress: string, city?: string): Promise<CountyOwner | null>
export function batchDataSkipTrace(params: {
  street: string
  city: string
  state?: string
  zip?: string
  firstName?: string | null
  lastName?: string | null
  mailingStreet?: string | null
  mailingCity?: string | null
  mailingState?: string | null
  mailingZip?: string | null
}): Promise<SkipTraceResult | null>
export function resolveOwnerContact(streetAddress: string, city: string, zip?: string): Promise<ResolvedOwner | null>
