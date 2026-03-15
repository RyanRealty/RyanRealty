'use client'

import { useState } from 'react'
import SitePageEditor, { EDITABLE_PAGES } from './SitePageEditor'
import { Button } from "@/components/ui/button"

export default function SitePagesList() {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const page = editingKey ? EDITABLE_PAGES.find((p) => p.key === editingKey) : null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Editable pages</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit title and body (HTML) for each page. Changes appear on the live site immediately.
        </p>
        <ul className="mt-4 space-y-2">
          {EDITABLE_PAGES.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div>
                <span className="font-medium text-foreground">{p.label}</span>
                <span className="ml-2 text-sm text-muted-foreground">{p.path}</span>
              </div>
              <Button
                type="button"
                onClick={() => setEditingKey(p.key)}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {page && (
        <SitePageEditor
          page={page}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  )
}
