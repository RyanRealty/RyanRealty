'use client'

/**
 * Deal files for /admin/crm/deals/[id]. 11F: taken off shadcn onto the locked
 * admin v2 language.
 *
 * Presentation only — the add/remove server actions, the "Name is required"
 * guard, the trim rules and every visible string are carried over unchanged.
 *
 * The list keeps its exact chrome without a shadcn semantic class: the old
 * divide-y + bordered wrapper becomes one hairline box on the <ul> plus a
 * `var(--a-border)` top rule on every row after the first, which is exactly
 * what divide-y drew.
 *
 * The date line is deliberately untouched, character for character. It is the
 * ci:hydration-safety baseline entry for this file (locale-date, no pinned
 * timeZone) and pinning the zone would move the printed day — a §0 figure
 * change, not a presentation change. Its LINE NUMBER moved with this edit, so
 * the baseline key needs re-writing at integration (the gate documents that as
 * the orchestrator's --write-baseline step).
 */

import { useTransition, useState } from 'react'
import { Button, IconButton, TextField } from '@/components/admin/v2'
import { addDealFile, removeDealFile } from '@/app/actions/crm-deals'
import type { CrmDealFile } from '@/lib/data/crm/getCrmDeal'

type Props = {
  dealId: number
  files: CrmDealFile[]
}

export function DealFiles({ dealId, files }: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  function handleAdd() {
    if (!name.trim()) {
      setAddError('Name is required')
      return
    }
    setAddError(null)
    startTransition(async () => {
      const res = await addDealFile(dealId, {
        name: name.trim(),
        url: url.trim() || null,
      })
      if (!res.ok) {
        setAddError(res.error)
      } else {
        setName('')
        setUrl('')
      }
    })
  }

  function handleRemove(fileId: number) {
    startTransition(async () => {
      await removeDealFile(dealId, fileId)
    })
  }

  return (
    <div className="space-y-4">
      {files.length > 0 ? (
        <ul style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)' }}>
          {files.map((f, i) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
              style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
            >
              <div className="min-w-0">
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="av2-textlink truncate text-sm font-medium"
                  >
                    {f.name}
                  </a>
                ) : (
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>
                    {f.name}
                  </span>
                )}
                {f.uploaded_by ? (
                  <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                    {f.uploaded_by} ·{' '}
                    {new Date(f.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>
              <IconButton
                label="Remove file"
                tone="danger"
                className="shrink-0"
                disabled={isPending}
                onClick={() => handleRemove(f.id)}
              >
                ✕
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          No files yet.
        </p>
      )}

      {/* Add by URL */}
      <details className="group">
        <summary
          className="cursor-pointer select-none text-xs font-medium hover:underline"
          style={{ color: 'var(--a-accent)' }}
        >
          + Add file by URL
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            placeholder="Purchase agreement"
          />
          <TextField
            label="URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isPending}
            placeholder="https://..."
          />
        </div>
        {addError ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--a-danger)' }}>
            {addError}
          </p>
        ) : null}
        <Button type="button" className="mt-3" disabled={isPending} onClick={handleAdd}>
          Add file
        </Button>
      </details>
    </div>
  )
}
