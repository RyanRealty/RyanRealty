'use client'

// @no-parity — internal admin tool (TC checklist status transitions)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Every transition, its label, the reject
// prompt, the alert and the reload are carried over unchanged.
//
// The shadcn DropdownMenu became the v2 Menu, which is what a list of ACTIONS
// is (Menu.tsx: choosing a VALUE is SelectField's job — these five entries are
// verbs, two of them with side effects, so this is a menu). The Badge trigger
// became a StateWord, which is the language's one way to print a status: text
// plus colour, never colour alone.
//
// Two notes on what did NOT survive verbatim:
//   - The DropdownMenuSeparator before "Mark optional" is gone. v2's Menu has
//     no separator item and inventing one in the primitive for a single caller
//     is not this unit's call — the five labels still read as a list.
//   - `min-w-fit` on the trigger is load-bearing, not decoration: Menu's
//     trigger carries .av2-iconbtn, which hard-sets width to 30/44px for an
//     ICON. min-width beats width in CSS's own constraint resolution, so the
//     text trigger sizes to its content without an !important and without an
//     inline style that would then outrank .av2-iconbtn:hover.
import { useTransition } from 'react'
import { Menu, StateWord, type AdminState } from '@/components/admin/v2'
import { setTcChecklistStatus, type TcChecklistStatus } from '@/app/actions/tc'

const LABEL: Record<TcChecklistStatus, string> = {
  required: 'Required',
  optional: 'Optional',
  in_review: 'In review',
  completed: 'Completed',
  na: 'N/A',
}

const TRANSITIONS: Array<{ to: TcChecklistStatus; label: string; reject?: boolean }> = [
  { to: 'in_review', label: 'Submit for review' },
  { to: 'completed', label: 'Accept · mark completed' },
  { to: 'required', label: 'Reject · back to required', reject: true },
  { to: 'optional', label: 'Mark optional' },
  { to: 'na', label: 'Mark N/A' },
]

/** The shadcn Badge variants, one for one: success on completed, destructive on
 *  a required item with nothing filed against it, warning in review, plain
 *  outline for everything else. */
function stateOf(status: TcChecklistStatus, docCount: number): AdminState {
  if (status === 'completed') return 'ok'
  if (status === 'required' && docCount === 0) return 'down'
  if (status === 'in_review') return 'slow'
  return 'waiting'
}

export function ChecklistStatusControl({
  itemId,
  status,
  docCount,
}: {
  itemId: string
  status: TcChecklistStatus
  docCount: number
}) {
  const [pending, startTransition] = useTransition()

  const apply = (to: TcChecklistStatus, reject?: boolean) => {
    if (to === status) return
    let note: string | undefined
    if (reject) {
      const r = window.prompt('Reason for sending back (optional):', '')
      if (r === null) return
      note = r || undefined
    }
    startTransition(async () => {
      const res = await setTcChecklistStatus(itemId, to, note)
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  const state = stateOf(status, docCount)
  const count = docCount ? ` · ${docCount}` : ''

  // In flight the trigger was `disabled` and the badge dimmed to '…'. v2's Menu
  // has no disabled trigger, and a menu that opens onto five inert rows is a
  // worse answer than no menu, so the control renders as the same dimmed,
  // non-interactive pill it always did until the reload lands.
  if (pending) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
        <StateWord state={state}>…</StateWord>
        {count}
        <span aria-hidden>▾</span>
      </span>
    )
  }

  return (
    <Menu
      label="Change status"
      align="end"
      triggerClassName="min-w-fit gap-1.5"
      trigger={
        <>
          <StateWord state={state}>{LABEL[status] ?? status}</StateWord>
          {count}
          <span aria-hidden>▾</span>
        </>
      }
      items={TRANSITIONS.map((t) => ({
        label: `${t.label}${t.to === status ? ' ✓' : ''}`,
        disabled: t.to === status,
        danger: t.reject,
        onSelect: () => apply(t.to, t.reject),
      }))}
    />
  )
}
