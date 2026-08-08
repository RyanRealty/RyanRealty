'use client'

/**
 * TemplatesToolbar — the §13.1.1/§13.2.1 top-right control row, shared by the
 * folder list and both template lists:
 *
 *   [Search Templates] [+ Folder] [+ Email Template / + Text Template]
 *
 * Search + folder navigation live in the URL (?t=&folder=&q=) so the server
 * page owns filtering; "+ Folder" navigates into a new (empty) folder — the
 * folder persists the moment its first template is created with that
 * category. "+ Template" is a callback into the owning list's create modal.
 *
 * P11 admin v2: shadcn Input/Button/Dialog/Label → SearchField, Button,
 * Dialog + TextField from components/admin/v2. ci:admin-ui rule C allows ONE
 * primary-variant Button per file, and this file has two candidates: the
 * always-visible "+ {noun}" CTA and the new-folder dialog's submit. The CTA
 * keeps primary (it is the view's action); the dialog submit is quiet, where
 * footer position already carries the affirmative.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button, Dialog, SearchField, TextField } from '@/components/admin/v2'

export function tplUrl(params: { t: 'email' | 'text'; folder?: string | null; q?: string | null }): string {
  const sp = new URLSearchParams()
  sp.set('t', params.t)
  if (params.folder) sp.set('folder', params.folder)
  if (params.q) sp.set('q', params.q)
  return `/admin/crm/settings/templates?${sp.toString()}`
}

export function TemplatesToolbar({
  kind,
  folder,
  q,
  onNewTemplate,
}: {
  kind: 'email' | 'text'
  folder: string | null
  q: string
  onNewTemplate: () => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState(q)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  const noun = kind === 'email' ? 'Email Template' : 'Text Template'

  function submitSearch(value: string) {
    // Searching from the folder level jumps to the all-templates list so
    // results across every folder are visible.
    router.push(tplUrl({ t: kind, folder: folder ?? 'all', q: value.trim() || null }))
  }

  function createFolder() {
    const name = folderName.trim()
    if (!name) return
    setFolderOpen(false)
    setFolderName('')
    router.push(tplUrl({ t: kind, folder: `cat:${name}` }))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          style={{ color: 'var(--a-text-2)' }}
        />
        <SearchField
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch((e.target as HTMLInputElement).value)
          }}
          onBlur={(e) => {
            if (e.target.value.trim() !== q) submitSearch(e.target.value)
          }}
          placeholder="Search Templates"
          aria-label="Search templates"
          style={{ width: 192, paddingLeft: 28 }}
        />
      </div>
      <Button
        type="button"
        variant="quiet"
        onClick={() => {
          setFolderName('')
          setFolderOpen(true)
        }}
      >
        + Folder
      </Button>
      <Button type="button" onClick={onNewTemplate}>
        + {noun}
      </Button>

      <Dialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        title="New folder"
        description="Name the folder, then create its first template inside it — templates you create while a folder is open are assigned to it automatically."
        footer={
          <>
            <Button variant="quiet" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={createFolder} disabled={!folderName.trim()}>
              Create folder
            </Button>
          </>
        }
      >
        <TextField
          label="Folder name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createFolder()
          }}
          placeholder="e.g. Buyer, Seller, Drip..."
          autoFocus
        />
      </Dialog>
    </div>
  )
}
