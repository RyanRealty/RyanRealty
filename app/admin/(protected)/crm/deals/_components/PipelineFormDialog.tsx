'use client'

/**
 * PipelineFormDialog + DeletePipelineDialog — the Add/Rename and Delete
 * dialogs for §9 Manage Pipelines.
 *
 * Split out of ManagePipelines.tsx in 11F: that file's own "+ Add Pipeline"
 * trigger is its one primary-variant v2 <Button> (ci:admin-ui rule C caps a
 * file at one) — same reason ConfigTableEditor's Add/Rename dialogs live in
 * their own files rather than beside the "+ Add" row.
 */

import { Button, ConfirmDialog, Dialog, TextField } from '@/components/admin/v2'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'

export function PipelineFormDialog({
  open,
  adding,
  renaming,
  name,
  onNameChange,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  adding: boolean
  renaming: BoardPipeline | null
  name: string
  onNameChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
  pending: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={adding ? 'Add pipeline' : `Rename ${renaming?.name ?? ''}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || !name.trim()} onClick={onSubmit}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <TextField
        label="Pipeline name"
        value={name}
        autoFocus
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
      />
    </Dialog>
  )
}

export function DeletePipelineDialog({
  pipeline,
  onClose,
  onConfirm,
  pending,
}: {
  pipeline: BoardPipeline | null
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <ConfirmDialog
      open={pipeline != null}
      onClose={onClose}
      title={`Delete ${pipeline?.name ?? ''}?`}
      description="A pipeline can only be deleted when it holds no deals. This also removes its stages."
      confirmLabel={pending ? 'Deleting…' : 'Delete'}
      onConfirm={onConfirm}
      busy={pending}
    />
  )
}
