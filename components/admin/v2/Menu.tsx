'use client'

import './admin-v2.css'
import Link from 'next/link'
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
  /**
   * Where this item NAVIGATES. Supply it whenever the item's job is "go here" —
   * the item then renders a real <a>, so middle-click and Cmd/Ctrl-click open a
   * new tab. A button that calls router.push() looks identical and silently
   * takes that away, which is how the BPO card's "Open in CRM" lost it during
   * the 11F migration. Opening a record in a background tab is ordinary broker
   * workflow, not a power-user trick.
   */
  href?: string
  /**
   * Opens the href in a new tab. Set this instead of calling window.open from
   * onSelect: window.open only reacts to a LEFT click, so it silently drops
   * middle-click, Cmd/Ctrl-click and the right-click "open in new tab" menu —
   * the CMA card's "Open report" lost all three that way during 11F.
   */
  target?: '_blank'
  /** What this item DOES. Omit when the item only navigates via `href`. */
  onSelect?: () => void
  /** Destructive actions render in the danger token. */
  danger?: boolean
  disabled?: boolean
}

export function Menu({
  label,
  items,
  trigger,
  align = 'end',
  tooltip = false,
  triggerClassName,
}: {
  /** Accessible name for the trigger, e.g. "Conversation actions". */
  label: string
  items: AdminMenuItem[]
  /** Trigger contents — usually an icon. */
  trigger: React.ReactNode
  align?: 'start' | 'end'
  /** Native hover tooltip on the trigger. The controls flattened onto Menu often
   *  carried title=; the hand-rolled trigger dropped it while keeping the
   *  accessible name, so the tooltip silently disappeared. */
  tooltip?: boolean
  /** Extra classes for the trigger. It was hardcoded to `av2-iconbtn`, so a
   *  caller whose control had its own chrome — the solid circular add "+" that
   *  every other rail section still uses — could not keep it. */
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Which item to land on when the panel opens: 'first' for ArrowDown/click,
  // 'last' for ArrowUp. Null means "do not move focus" (mouse click).
  const [landOn, setLandOn] = useState<'first' | 'last' | null>(null)

  // Items are <button> when they act and <a> when they navigate, so query the
  // shared role rather than a tag, and read `disabled` off the buttons only.
  const enabledItems = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(
      (el) => !(el instanceof HTMLButtonElement && el.disabled),
    )

  // Move focus into the panel once it exists in the DOM.
  useEffect(() => {
    if (!open || !landOn) return
    const items = enabledItems()
    if (!items.length) return
    ;(landOn === 'first' ? items[0] : items[items.length - 1]).focus()
    setLandOn(null)
  }, [open, landOn])

  function moveFocus(dir: 1 | -1) {
    const items = enabledItems()
    if (!items.length) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    // From the trigger (i === -1) ArrowDown enters at the top, ArrowUp at the end.
    const next = i === -1 ? (dir === 1 ? 0 : items.length - 1) : (i + dir + items.length) % items.length
    items[next].focus()
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
    else if (e.key === 'Home') { e.preventDefault(); enabledItems()[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); const it = enabledItems(); it[it.length - 1]?.focus() }
  }

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
        className={['av2-iconbtn', triggerClassName ?? ''].filter(Boolean).join(' ')}
        aria-label={label}
        title={tooltip ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          setLandOn(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setLandOn('first') }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setLandOn('last') }
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="av2-menu__panel"
          role="menu"
          aria-label={label}
          data-align={align}
          onKeyDown={onPanelKeyDown}
        >
          {items.map((it) => {
            const cls = it.danger ? 'av2-menu__item av2-menu__item--danger' : 'av2-menu__item'
            // A navigating item is an ANCHOR so the browser's own open-in-new-tab
            // affordances keep working; only an acting item is a button.
            return it.href && !it.disabled ? (
              <Link
                key={it.label}
                href={it.href}
                role="menuitem"
                className={cls}
                target={it.target}
                // noopener/noreferrer on every new-tab link: the opened page
                // must never get a handle back to the admin via window.opener.
                rel={it.target === '_blank' ? 'noopener noreferrer' : undefined}
                onClick={() => {
                  setOpen(false)
                  it.onSelect?.()
                }}
              >
                {it.label}
              </Link>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={cls}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onSelect?.()
                }}
              >
                {it.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
