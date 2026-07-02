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
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch((e.target as HTMLInputElement).value)
          }}
          onBlur={(e) => {
            if (e.target.value.trim() !== q) submitSearch(e.target.value)
          }}
          placeholder="Search Templates"
          className="h-9 w-48 pl-8"
          aria-label="Search templates"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => {
          setFolderName('')
          setFolderOpen(true)
        }}
      >
        + Folder
      </Button>
      <Button type="button" size="sm" className="h-9" onClick={onNewTemplate}>
        + {noun}
      </Button>

      <Dialog
        open={folderOpen}
        onOpenChange={(o) => {
          if (!o) setFolderOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Name the folder, then create its first template inside it — templates you create
              while a folder is open are assigned to it automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-new-folder">Folder name</Label>
            <Input
              id="tpl-new-folder"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder()
              }}
              placeholder="e.g. Buyer, Seller, Drip..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createFolder} disabled={!folderName.trim()}>
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
