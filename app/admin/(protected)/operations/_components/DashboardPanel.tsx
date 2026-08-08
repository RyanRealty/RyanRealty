'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/admin/v2'

const STORAGE_KEY = 'admin_dashboard_panels'

function getStoredOpenState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

function setStoredOpenState(panelId: string, open: boolean) {
  if (typeof window === 'undefined') return
  try {
    const prev = getStoredOpenState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, [panelId]: open }))
  } catch {
    // ignore
  }
}

type Props = {
  id: string
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function DashboardPanel({ id, title, children, defaultOpen = true }: Props) {
  const [open, setOpenState] = useState(defaultOpen)

  useEffect(() => {
    const stored = getStoredOpenState()
    if (stored[id] !== undefined) setOpenState(stored[id])
  }, [id])

  function toggle() {
    const next = !open
    setOpenState(next)
    setStoredOpenState(id, next)
  }

  return (
    <section
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-bg)',
      }}
    >
      <Button
        variant="quiet"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--a-s3)',
          textAlign: 'left',
          fontSize: 'var(--a-text-md)',
          fontWeight: 600,
          color: 'var(--a-text)',
          padding: 'var(--a-s3) var(--a-s4)',
          minHeight: 'auto',
          border: 'none',
          background: 'transparent',
          borderRadius: 'var(--a-r-lg)',
        }}
      >
        <span>{title}</span>
        <span style={{ color: 'var(--a-text-2)' }} aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </Button>
      {open && (
        <div style={{ borderTop: '1px solid var(--a-border)', padding: 'var(--a-s4)' }}>
          {children}
        </div>
      )}
    </section>
  )
}
