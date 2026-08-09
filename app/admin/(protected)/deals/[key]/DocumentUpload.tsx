'use client'

// @no-parity — internal admin tool (TC deal document upload)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — createTcUploadUrl, the
// signed-URL PUT with its exact headers, finalizeTcUpload, every busy caption
// ('Preparing…', 'Uploading…', 'Filing…'), every error string and the reload
// are carried over unchanged.
//
// ONE behaviour convergence, stated rather than hidden: the shadcn Cancel
// button called setOpen(false) directly, which bypassed onOpenChange and so was
// the ONE close path that did NOT reset the staged file — Esc, the backdrop and
// the X all reset. The v2 Dialog routes every dismissal through onClose, so all
// four now reset. That is the majority behaviour, and the alternative it
// removes is a broker cancelling, reopening, and finding a document still
// staged against a transaction folder.
//
// The file input's explicit id="tc-upload-file" is gone because TextField owns
// the label/control pairing (useId + htmlFor); passing an id through would
// override the input's generated id while the label kept pointing at the old
// one, silently breaking the association. Verified first that nothing under
// __tests__/ or scripts/ pins that id.
import { useRef, useState } from 'react'
import { Button, Dialog, SelectField, TextField } from '@/components/admin/v2'
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

  const close = () => {
    setOpen(false)
    reset()
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
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Upload document
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Upload a document"
        description="PDF, JPG, or PNG up to 50 MB. The file lands on this cycle and in the audit trail."
        footer={
          <>
            <Button variant="quiet" onClick={close} disabled={!!busy}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={!file || !!busy}>
              {busy ?? 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            ref={inputRef}
            label="File"
            type="file"
            accept={ACCEPT}
            // av2-input is restated on purpose: TextField spreads rest AFTER
            // its own className, so passing only the file-button utilities
            // would strip the control's entire skin. Every class here is
            // non-colour.
            className="av2-input cursor-pointer file:mr-3 file:text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
          />

          {checklistItems.length > 0 ? (
            <SelectField
              label="Checklist item (optional)"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="none">Not assigned</option>
              {checklistItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          {error ? (
            <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-danger)' }}>{error}</p>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
