'use client'

// @no-parity — internal admin tool (TC deal document upload)
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTcUploadUrl, finalizeTcUpload } from '@/app/actions/tc'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

type ChecklistOption = { id: string; name: string }

export function DocumentUpload({
  cycleId,
  checklistItems,
}: {
  cycleId: string
  checklistItems: ChecklistOption[]
}) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [itemId, setItemId] = useState<string>('none')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setItemId('none')
    setBusy(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const upload = async () => {
    if (!file) return
    setError(null)

    setBusy('Preparing…')
    const ticket = await createTcUploadUrl(cycleId, file.name, file.type, file.size)
    if (!ticket.ok || !ticket.signedUrl || !ticket.docId || !ticket.path) {
      setBusy(null)
      setError(ticket.error ?? 'Could not start the upload')
      return
    }

    setBusy('Uploading…')
    try {
      const res = await fetch(ticket.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type, 'x-upsert': 'false' },
        body: file,
      })
      if (!res.ok) {
        setBusy(null)
        setError(`Upload failed (${res.status}). Try again.`)
        return
      }
    } catch {
      setBusy(null)
      setError('Upload failed. Check your connection and try again.')
      return
    }

    setBusy('Filing…')
    const fin = await finalizeTcUpload({
      docId: ticket.docId,
      cycleId,
      path: ticket.path,
      originalName: file.name,
      contentType: file.type,
      checklistItemId: itemId === 'none' ? null : itemId,
    })
    if (!fin.ok) {
      setBusy(null)
      setError(fin.error ?? 'Could not file the document')
      return
    }
    window.location.reload()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            PDF, JPG, or PNG up to 50 MB. The file lands on this cycle and in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tc-upload-file">File</Label>
            <Input
              ref={inputRef}
              id="tc-upload-file"
              type="file"
              accept={ACCEPT}
              className="cursor-pointer file:mr-3 file:text-sm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
          </div>

          {checklistItems.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Checklist item (optional)</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {checklistItems.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={!!busy}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={!file || !!busy}>
            {busy ?? 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
