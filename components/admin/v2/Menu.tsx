'use client'

import './admin-v2.css'
import { useEffect, useRef, useState } from 'react'

/**
 * Menu — a small overflow menu anchored to its trigger (11F).
 *
 * WHY THIS EXISTS. The v2 barrel had no menu, so three files in one folder
 * invented three: a hand-rolled role="menu" panel, a native <details>/<summary>,
 * and a native <select> standing in for an action list. All three behave
 * differently under Escape and outside-click, and none of them is what a
 * keyboard user expects. One primitive, one behaviour.
 *
 * A menu is for ACTIONS on the thing you clicked from. It is not a form
 * control: if the user is choosing a value, use SelectField or ToolbarSelect,
 * which the platform already makes accessible.
 *
 * Behaviour: click-outside closes, Escape closes and returns focus to the
 * trigger, and the trigger carries aria-haspopup + aria-expanded. Items are
 * plain buttons in a role="menu" so a screen reader announces the set.
 */
export interface AdminMenuItem {
  label: string
  onSelect: () => void
  /** Destructive actions render in the danger token. */
  danger?: boolean
  disabled?: boolean
}

export function Menu({
  label,
  items,
  trigger,
  align = 'end',
}: {
  /** Accessible name for the trigger, e.g. "Conversation actions". */
  label: string
  items: AdminMenuItem[]
  /** Trigger contents — usually an icon. */
  trigger: React.ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="av2-menu">
      <button
        ref={triggerRef}
        type="button"
        className="av2-iconbtn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <div className="av2-menu__panel" role="menu" aria-label={label} data-align={align}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={it.danger ? 'av2-menu__item av2-menu__item--danger' : 'av2-menu__item'}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
