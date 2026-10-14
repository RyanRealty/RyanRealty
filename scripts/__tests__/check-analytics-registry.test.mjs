import { describe, expect, it } from 'vitest'
import { findViolations, readmePaths, registryPaths } from '../check-analytics-registry.mjs'

const README = `# x\n\n## Registry\n\n| File | Role |\n|---|---|\n| \`lib/lead-tracking.ts\` | generate_lead |\n| \`scripts/analytics-audit.mjs\` | audit |\n\n## Other\n\`lib/analytics/utm.ts\`\n`
const exists = () => true

describe('ci:analytics-registry', () => {
  it('reads paths from the README and its Registry section', () => {
    expect(readmePaths(README)).toEqual(new Set(['lib/lead-tracking.ts', 'scripts/analytics-audit.mjs', 'lib/analytics/utm.ts']))
    expect(registryPaths(README)).toEqual(new Set(['lib/lead-tracking.ts', 'scripts/analytics-audit.mjs']))
  })

  it('passes registered senders and API readers', () => {
    const files = [
      { path: 'lib/lead-tracking.ts', src: 'await fireGa4Event({})' },
      { path: 'scripts/analytics-audit.mjs', src: 'google.analyticsdata({ version })' },
      { path: 'lib/analytics/utm.ts', src: 'export {}' },
    ]
    expect(findViolations({ files, readme: README, exists })).toEqual([])
  })

  it('fails an unregistered one-off script that calls a Google analytics API', () => {
    const files = [{ path: 'scripts/_gsc-new-probe.mjs', src: 'const sc = google.searchconsole({ version: "v1", auth })' }]
    const v = findViolations({ files, readme: README, exists })
    expect(v).toHaveLength(1)
    expect(v[0]).toMatch(/_gsc-new-probe\.mjs calls a Google analytics API/)
  })

  it('fails an unregistered server GA4 sender and an unregistered lib/analytics module', () => {
    const files = [
      { path: 'app/actions/new-form.ts', src: 'void fireGa4Event({ eventName: "x" })' },
      { path: 'lib/analytics/new-thing.ts', src: 'export const a = 1' },
      { path: 'scripts/raw-mp.mjs', src: "fetch('https://www.google-analytics.com/mp/collect?x')" },
      { path: 'lib/crawl/scope-only.ts', src: "scopes: ['https://www.googleapis.com/auth/webmasters.readonly']" },
    ]
    expect(findViolations({ files, readme: README, exists })).toHaveLength(4)
  })

  it('ignores tests and files that touch no analytics API', () => {
    const files = [
      { path: 'lib/lead-tracking.consent.test.ts', src: 'fireGa4Event(' },
      { path: 'lib/other.ts', src: 'export const b = 2' },
    ]
    expect(findViolations({ files, readme: README, exists })).toEqual([])
  })

  it('fails a Registry row whose file is gone, and a missing README', () => {
    expect(findViolations({ files: [], readme: README, exists: (p) => p !== 'scripts/analytics-audit.mjs' })[0]).toMatch(/does not exist/)
    expect(findViolations({ files: [], readme: null, exists })[0]).toMatch(/is missing/)
  })
})
