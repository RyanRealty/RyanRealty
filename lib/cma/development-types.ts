/**
 * Public contract types for the CMA development section.
 * Split out of lib/cma/development.ts so the per-jurisdiction rule modules can
 * import the shapes without a circular import. lib/cma/development.ts re-exports
 * every name here, so the renderer's import path is unchanged.
 */
import type { DevZoningExplainer } from '@/lib/cma/zoning-types'

export type DevVerdict = 'yes' | 'conditional' | 'unlikely' | 'no' | 'confirm'

export interface DevItem {
  topic: 'Subdivide or partition' | 'ADU' | 'Second dwelling' | 'Middle housing' | 'Short-term rental'
  verdict: DevVerdict
  /** One-line answer in plain language. Leads with the capability. */
  headline: string
  /** The rule, how this parcel measures against it with the numbers shown,
   *  what the buyer would actually do, and what would disqualify it. */
  detail: string
  citation: string
  url: string
  /** Date this specific fact was last read against its primary source. */
  verifiedOn?: string
}

export interface DevResource {
  name: string
  role: string
  url: string
  phone: string | null
}

/** A realistic path a buyer could take, synthesised from cited facts only. */
export interface DevBuyerOption {
  headline: string
  detail: string
  /** Topics and citations this option derives from. Never empty. */
  basedOn: string[]
}

/** A sellable fact for the marketing side. Stands alone without the section. */
export interface DevMarketingHighlight {
  headline: string
  /** The citation or parcel fact it derives from. Never empty. */
  basis: string
}

export interface DevHoa {
  /** null = the MLS did not report it. Never inferred. */
  hasAssociation: boolean | null
  /** Formatted from the MLS fields, never invented. */
  feeLabel: string | null
  /** Resort or master association name when the parcel sits inside one. */
  resortAssociation: string | null
  /** What to obtain and where. NEVER characterizes unread CC&Rs. */
  ccrGuidance: string
}

export interface DevelopmentOpportunities {
  jurisdiction: 'City of Bend' | 'City of Redmond' | 'Deschutes County (unincorporated)'
  zone: string
  verifiedAsOf: string
  zoningExplainer: DevZoningExplainer | null
  items: DevItem[]
  buyerOptions: DevBuyerOption[]
  hoa: DevHoa | null
  marketingHighlights: DevMarketingHighlight[]
  disclaimer: string
  resources: DevResource[]
}

/** Date the regulatory registry was first verified against primary sources. */
export const REGS_VERIFIED_DATE = '2026-07-14'
/** Date of the most recent primary-source re-verification + expansion pass. */
export const REGS_REVERIFIED_DATE = '2026-07-30'

export const V1 = REGS_VERIFIED_DATE
export const V2 = REGS_REVERIFIED_DATE

