'use client'

/**
 * GenerateReportButton — weekly market-report trigger on the analytics hub.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the generateAction
 * contract, loading gate, result shape ({ ok, url } | { ok:false, error }),
 * and the open-in-new-tab link are untouched.
 */
import { useState } from 'react'
import type { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import { Button } from '@/components/admin/v2'

type GenerateAction = typeof generateWeeklyMarketReport

export default function GenerateReportButton({ generateAction }: { generateAction: GenerateAction }) {
  const [result, setResult] = useState<Awaited<ReturnType<GenerateAction>> | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    try {
      const res = await generateAction()
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button type="button" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating…' : 'Generate weekly report'}
      </Button>
      {result && (
        <div
          style={{
            marginTop: 'var(--a-s4)',
            borderRadius: 'var(--a-r-lg)',
            border: `1px solid ${result.ok ? 'var(--a-border)' : 'var(--a-warn)'}`,
            background: result.ok ? 'var(--a-inset)' : 'var(--a-warn-wash)',
            color: 'var(--a-text)',
            fontSize: 'var(--a-text-sm)',
            padding: 'var(--a-s4)',
          }}
        >
          {result.ok ? (
            <>
              <strong>Done.</strong>{' '}
              <a
                href={result.url}
                style={{ color: 'var(--a-accent)', textDecoration: 'underline' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.url}
              </a>
            </>
          ) : (
            <>
              <strong>Error:</strong> {result.error}
            </>
          )}
        </div>
      )}
    </div>
  )
}
