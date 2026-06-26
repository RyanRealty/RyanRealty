'use client'

import { useTransition, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
        <ul className="divide-y divide-border rounded-md border border-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-primary hover:underline"
                  >
                    {f.name}
                  </a>
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{f.name}</span>
                )}
                {f.uploaded_by ? (
                  <p className="text-xs text-muted-foreground">
                    {f.uploaded_by} ·{' '}
                    {new Date(f.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleRemove(f.id)}
                className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove file"
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No files yet.</p>
      )}

      {/* Add by URL */}
      <details className="group">
        <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">
          + Add file by URL
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Display name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              placeholder="Purchase agreement"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">URL</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
        </div>
        {addError ? <p className="mt-1 text-xs text-destructive">{addError}</p> : null}
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={isPending}
          onClick={handleAdd}
        >
          Add file
        </Button>
      </details>
    </div>
  )
}
