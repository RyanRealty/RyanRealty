import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cmaReportButtonHtml } from '@/lib/cma/report-button'
import { buildEmailPreviewDoc, withPreviewLinkTarget } from '@/lib/crm/email-body'

const REPORT = 'https://ryan-realty.com/cma/cma-3711-purcell'
const editor = readFileSync(resolve('components/admin/crm/EmailBodyEditor.tsx'), 'utf8')

describe('CMA report link in the admin preview', () => {
  it('does not change the button HTML the send path uses', () => {
    const html = cmaReportButtonHtml(REPORT)
    expect(html).toContain(`href="${REPORT}"`)
    expect(html).toContain('READ THE FULL REPORT')
    expect(html).not.toContain('target=')
    expect(html).not.toContain('<base')
  })

  it('opens preview links in a real tab so the admin cookie is sent', () => {
    const sent = buildEmailPreviewDoc('Hello', cmaReportButtonHtml(REPORT), 'html')
    expect(sent).not.toContain('<base')
    const preview = withPreviewLinkTarget(sent)
    expect(preview).toContain('<base target="_blank">')
    expect(preview).toContain(`href="${REPORT}"`)
    expect(editor).toContain('withPreviewLinkTarget')
    expect(editor).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"')
    expect(editor).not.toContain('allow-scripts')
    expect(editor).not.toContain('allow-same-origin')
  })
})
