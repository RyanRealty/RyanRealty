/**
 * Shared types for the CMA zoning explainer registry.
 * Split out of lib/cma/zoning-explainer.ts so the per-jurisdiction profile
 * modules can import the shape without a circular import.
 */

export interface DevDimension {
  label: string
  value: string
}

export interface DevZoningExplainer {
  zone: string
  zoneName: string
  purpose: string
  permittedOutright: string[]
  conditional: string[]
  dimensional: DevDimension[]
  citation: string
  url: string
}

export type ZoneProfile = Omit<DevZoningExplainer, 'zone'>

export type DevJurisdiction =
  | 'City of Bend'
  | 'City of Redmond'
  | 'Deschutes County (unincorporated)'
