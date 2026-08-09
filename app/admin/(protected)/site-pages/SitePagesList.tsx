'use client'

/**
 * Editable-pages list island for /admin/site-pages.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — the EDITABLE_PAGES source, the editingKey state, the
 * SitePageEditor mount and every visible string are unchanged.
 *
 * Colour now reads from var(--a-*): the card is the hairline-held surface, each
 * row is the well one step below it so the list reads as rows inside the card,
 * and the Edit button is the v2 Button, which carries the hover and pressed
 * states the hand-rolled hover:opacity class did not.
 *
 * KNOWN GAP, stated rather than hidden: this file relative-imports
 * ./SitePageEditor, which is NOT part of this group and is still on shadcn. The
 * v2 token gate resolves relative imports, so /admin/site-pages cannot join
 * SCAN_DIRS until that editor migrates too.
 */

import { useState } from 'react'
import SitePageEditor, { EDITABLE_PAGES } from './SitePageEditor'
import { Button } from '@/components/admin/v2'

/** The section card: a hairline-held surface one step up from the page. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-surface)' } as const

/** A list row: one step DOWN from the card, so the rows separate from it. */
const ROW_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-inset)' } as const

export default function SitePagesList() {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const page = editingKey ? EDITABLE_PAGES.find((p) => p.key === editingKey) : null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6" style={CARD_STYLE}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--a-text)' }}>Editable pages</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--a-text-2)' }}>
          Edit title and body (HTML) for each page. Changes appear on the live site immediately.
        </p>
        <ul className="mt-4 space-y-2">
          {EDITABLE_PAGES.map((p) => (
            <li
              key={p.key}
              className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
              style={ROW_STYLE}
            >
              <div>
                <span className="font-medium" style={{ color: 'var(--a-text)' }}>{p.label}</span>
                <span className="ml-2 text-sm" style={{ color: 'var(--a-text-2)' }}>{p.path}</span>
              </div>
              <Button type="button" onClick={() => setEditingKey(p.key)}>
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
