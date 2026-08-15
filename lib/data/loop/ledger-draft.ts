import { assertCompanyDomain, type CompanyImprovementDomain } from './domains'

export type ImprovementLedgerDraft = {
  domain: CompanyImprovementDomain
  changeClass: string
  surface: string
  description: string
  metric: string
  predictedDelta?: number | null
  baselineValue?: number | null
  windowDays?: number
  commitSha?: string | null
  notes?: string | null
}

export function assertLedgerDraft(input: {
  domain: string
  changeClass: string
  surface: string
  description: string
  metric: string
}): asserts input is ImprovementLedgerDraft {
  assertCompanyDomain(input.domain)
  if (!input.changeClass.trim()) throw new Error('changeClass is required')
  if (!input.surface.trim()) throw new Error('surface is required')
  if (!input.description.trim()) throw new Error('description is required')
  if (!input.metric.trim()) throw new Error('metric is required')
}
