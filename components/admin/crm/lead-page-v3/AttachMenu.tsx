'use client'

import { useState } from 'react'
import { Button } from '@/components/admin/v2'
import { ATTACH_MENU_ITEMS, type AttachMenuItemId } from './attach-menu'

export function AttachMenu(props: { onPick: (id: AttachMenuItemId) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Button type="button" variant="quiet" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        Attach
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Attach"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            zIndex: 20,
            width: 260,
            marginBottom: 6,
            padding: 6,
            background: 'var(--a-surface)',
            border: '1px solid var(--a-border)',
            borderRadius: 10,
            boxShadow: 'var(--a-shadow-overlay)',
          }}
        >
          {ATTACH_MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                props.onPick(item.id)
              }}
              style={{
                display: 'flex',
                width: '100%',
                gap: 10,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--a-text)',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>{item.label}</span>
              {item.hint ? (
                <small style={{ marginLeft: 'auto', color: 'var(--a-text-2)' }}>{item.hint}</small>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
