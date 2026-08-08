'use client'

/**
 * AddRowDialog — the "Add {noun}" dialog for ConfigTableEditor (P11C-2 split).
 *
 * Split out of ConfigTableEditor.tsx so its submit Button lives in its own
 * file: ci:admin-ui rule C fails a file containing more than one primary-
 * variant v2 <Button> (primary is the DEFAULT variant, i.e. no `variant`
 * prop). ConfigTableEditor.tsx already carries the island's one primary
 * ("+ Add {noun}"); this dialog's "Add {noun}" submit is THIS file's one
 * primary.
 *
 * Field state (label/key) and the actual create() call stay in the parent —
 * this component is a controlled shell so the parent's run()/note/pending
 * plumbing, and its exact user-facing strings, stay in one place.
 */
import { Button, Dialog, TextField } from '@/components/admin/v2'

export function AddRowDialog({
  open,
  onClose,
  pending,
  noun,
  allowKeyInput,
  label,
  onLabelChange,
  keyValue,
  onKeyChange,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  /** Singular noun for copy, e.g. 'stage', 'segment', 'area'. */
  noun: string
  allowKeyInput: boolean
  label: string
  onLabelChange: (value: string) => void
  keyValue: string
  onKeyChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add ${noun}`}
      description={`Give it a label. ${allowKeyInput ? 'The key defaults to the label unless you set one.' : ''}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            Add {noun}
          </Button>
        </>
      }
    >
      <TextField
        label="Label"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder={`New ${noun}`}
        autoFocus
      />
      {allowKeyInput ? (
        <TextField
          label="Key (optional)"
          value={keyValue}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="Defaults to the label"
          style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)' }}
        />
      ) : null}
    </Dialog>
  )
}
