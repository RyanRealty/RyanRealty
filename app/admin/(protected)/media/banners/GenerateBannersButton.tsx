'use client'

/**
 * GenerateBannersButton — the one action on /admin/media/banners.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the action, the
 * loading latch, the result shape and every string are untouched.
 *
 * The result panel's two states were `border-warning bg-warning/10` and
 * `border-border bg-muted`; both resolve to the PUBLIC brand palette the admin
 * blacklists. They become the warn wash and the inset well. The panel sits on
 * the page background, so the inset reads as a well rather than vanishing into
 * its parent.
 */

import { useState } from 'react'
import type { generateAllMissingBanners } from '@/app/actions/banners'
import { Button } from '@/components/admin/v2'

type GenerateAction = typeof generateAllMissingBanners

export default function GenerateBannersButton({ generateAction }: { generateAction: GenerateAction }) {
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

  const failed = result != null && result.failed > 0

  return (
    <div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Generate missing banners'}
      </Button>
      {result && (
        <div
          className="mt-4 p-4"
          style={{
            border: '1px solid',
            borderColor: failed ? 'var(--a-warn)' : 'var(--a-border)',
            background: failed ? 'var(--a-warn-wash)' : 'var(--a-inset)',
            color: 'var(--a-text)',
            borderRadius: 'var(--a-r-md)',
            fontSize: 'var(--a-text-sm)',
          }}
        >
          <strong>Done:</strong> generated {result.generated}, failed {result.failed}.
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc" style={{ color: 'var(--a-warn)' }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 10 && <li>… and {result.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
