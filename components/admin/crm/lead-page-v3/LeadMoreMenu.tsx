'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog, Dialog, Menu, SelectField, TextField, Button } from '@/components/admin/v2'
import { deleteCrmPersonAction, logCrmCallAction } from '@/app/actions/crm-person-detail'
import { draftReviewAskAction } from '@/app/actions/crm-review-ask'

const CALL_OUTCOMES = ['Spoke with lead', 'Left voicemail', 'No answer', 'Wrong number', 'Do not contact', 'Other']

export function LeadMoreMenu(props: { personId: number; toolsHref: string; canDraftReviewAsk?: boolean }) {
  const router = useRouter()
  const [logOpen, setLogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0])
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <>
      <Menu
        label="More"
        items={[
          {
            label: 'Add address',
            onSelect: () => {
              const params = new URLSearchParams(window.location.search)
              params.set('edit', 'address')
              if (!params.get('v') && !params.get('lead-page-v3')) params.set('v', '3')
              router.push(`${window.location.pathname}?${params.toString()}#details`)
            },
          },
          { label: 'Log call', onSelect: () => setLogOpen(true) },
          ...(props.canDraftReviewAsk
            ? [
                {
                  // Drafts a Google review ask into Drafts. Never sends.
                  label: 'Draft review ask',
                  disabled: pending,
                  onSelect: () =>
                    start(async () => {
                      const r = await draftReviewAskAction([props.personId])
                      if (!r.ok) toast.error(r.error)
                      else if (r.drafted === 0) toast.error(`Not drafted: ${r.skipped[0]?.reason ?? 'skipped'}.`)
                      else {
                        toast.success('Review ask drafted. It is waiting in Drafts and has not been sent.')
                        router.refresh()
                      }
                    }),
                },
              ]
            : []),
          { label: 'Classic tools', href: props.toolsHref },
          { label: 'Delete', danger: true, onSelect: () => setDeleteOpen(true) },
        ]}
        trigger={<span>⋯</span>}
      />
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} title="Log call" description="Creates a call row on this timeline. Does not dial.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SelectField label="Outcome" value={outcome} onChange={(e) => setOutcome(e.currentTarget.value)}>
            {CALL_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </SelectField>
          <TextField label="Minutes" value={minutes} onChange={(e) => setMinutes(e.currentTarget.value)} />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData()
                fd.set('personId', String(props.personId))
                fd.set('outcome', outcome)
                fd.set('minutes', minutes)
                fd.set('notes', notes)
                const r = await logCrmCallAction(fd)
                if (r.ok) {
                  setLogOpen(false)
                  setNotes('')
                  router.refresh()
                } else toast.error(r.error ?? 'Could not log the call')
              })
            }
          >
            Save call
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this person?"
        description="This cannot be undone. This contact and their timeline are removed from every list and report."
        confirmLabel="Delete person"
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        <form ref={formRef} action={deleteCrmPersonAction}>
          <input type="hidden" name="personId" value={props.personId} />
        </form>
      </ConfirmDialog>
    </>
  )
}
