/**
 * Company-wide THE LOOP domains (v1.6.0).
 *
 * Growth/SEO is one row. A class that cannot name a domain here is not
 * company work — it is an ad-hoc task. Canon: docs/plans/COMPANY_IMPROVEMENT.md
 * A change that cannot name its blast-radius planes is not ready to start.
 */

export const COMPANY_BLAST_RADIUS = [
  'dal-stat',
  'public-site',
  'admin-crm',
  'reporting',
  'alerts-newsletters',
  'ads-audiences',
  'identity',
] as const

export type CompanyBlastRadiusPlane = (typeof COMPANY_BLAST_RADIUS)[number]

export const COMPANY_IMPROVEMENT_DOMAINS = [
  'public-ux',
  'seo-aeo',
  'leads',
  'nurture',
  'social-presence',
  'sales-insights',
  'transactions',
  'broker-tools',
  'recruit-retain',
  'data-sync',
  'factory',
  'license-voice',
] as const

export type CompanyImprovementDomain = (typeof COMPANY_IMPROVEMENT_DOMAINS)[number]

export type LedgerVerdict = 'win' | 'loss' | 'flat' | 'inconclusive'

export function isCompanyImprovementDomain(value: string): value is CompanyImprovementDomain {
  return (COMPANY_IMPROVEMENT_DOMAINS as readonly string[]).includes(value)
}

export function assertCompanyDomain(value: string): asserts value is CompanyImprovementDomain {
  if (!isCompanyImprovementDomain(value)) {
    throw new Error(`Unknown company domain: ${value}`)
  }
}

/**
 * Expertise routing: what a session MUST load before working a node in each
 * domain. Every animal has its own discipline; the loop-brief prints this for
 * the next node so no session works a domain cold. Entries are display paths
 * (some carry a section hint) — the canon's preflight contract still applies
 * on top for whatever the change touches (DB → schema snapshot, page → mockup).
 */
export const DOMAIN_REQUIRED_READS: Record<CompanyImprovementDomain, readonly string[]> = {
  'public-ux': [
    '.claude/skills/frontend-design/SKILL.md',
    'design_system/ryan-realty/SKILL.md',
    'docs/plans/PUBLIC_PRODUCT/decisions.md (locks)',
  ],
  'seo-aeo': ['.claude/skills/growth-loop/SKILL.md', 'docs/plans/seo-voice/GOAL_10X_EXECUTABLE.md'],
  leads: ['docs/MARKETING_LEAD_FLOW.md', 'docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md'],
  nurture: ['.claude/skills/crm-e2e/SKILL.md', 'docs/CRM_REPLACEMENT_BLUEPRINT.md'],
  'social-presence': [
    'social_media_skills/platform-best-practices/SKILL.md',
    'CLAUDE.md (§4 video rules, §5 brain pipeline)',
    'docs/plans/ENTERPRISE_MAP/xai-stack.md',
  ],
  'sales-insights': [
    'docs/DATABASE_FOR_AI_AGENTS.md',
    'marketing_brain_skills/producers/cma/SKILL.md',
    '.cursor/rules/cma-data-model.mdc',
  ],
  transactions: [
    '.claude/skills/tc-builder/SKILL.md',
    '.cursor/skills/oregon-orea-principal-broker/SKILL.md',
    'docs/TC_SYSTEM.md',
  ],
  'broker-tools': [
    '.claude/skills/admin-product-os/SKILL.md',
    'docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md',
    'docs/plans/ADMIN_PRODUCT/EXECUTION.md (live board)',
  ],
  'recruit-retain': ['docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md', 'docs/MASTER_SPEC.md'],
  'data-sync': ['.cursor/rules/sync-pipeline.mdc', 'docs/DATABASE_FOR_AI_AGENTS.md'],
  factory: [
    'docs/DEVELOPMENT_PROCESS.md',
    'docs/MECHANICAL_GATES.md',
    'docs/plans/AGENTIC_GRAPH_ENGINEERING_2026-07-30.md',
  ],
  'license-voice': ['marketing_brain_skills/brand-voice/VOICE.md', 'CLAUDE.md (§0 accuracy + §2 voice)'],
}

/** Learned confidence: win-rate over win+loss. New / inconclusive-only classes start at 0.5. */
export function confidenceFromVerdicts(verdicts: readonly LedgerVerdict[]): number {
  const counted = verdicts.filter((v) => v === 'win' || v === 'loss')
  if (counted.length === 0) return 0.5
  return counted.filter((v) => v === 'win').length / counted.length
}

export function scoreCandidate(input: {
  reach: number
  gapToBenchmark: number
  confidence: number
  effort: number
}): number {
  if (!(input.effort > 0)) return 0
  return (input.reach * input.gapToBenchmark * input.confidence) / input.effort
}
