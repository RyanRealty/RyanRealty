'use client'

/**
 * RenameRowDialog — the "Rename {noun}" dialog for ConfigTableEditor
 * (P11C-2 split). Same split reason as AddRowDialog.tsx: ci:admin-ui rule C
 * fails a file with more than one primary-variant v2 <Button>, so this
 * file's "Save" submit lives on its own, away from the island's "+ Add
 * {noun}" primary.
 *
 * Field state (label) and the actual rename() call stay in the parent — this
 * component is a controlled shell.
 */
import { Button, Dialog, TextField } from '@/components/admin/v2'

export function RenameRowDialog({
  open,
  onClose,
  pending,
  noun,
  label,
  onLabelChange,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  /** Singular noun for copy, e.g. 'stage', 'segment', 'area'. */
  noun: string
  label: string
  onLabelChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Rename ${noun}`}
      description="The key stays the same. Only the display label changes."
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            Save
          </Button>
        </>
      }
    >
      <TextField label="Label" value={label} onChange={(e) => onLabelChange(e.target.value)} autoFocus />
    </Dialog>
  )
}
