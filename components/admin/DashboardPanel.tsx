'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"

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
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <Button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-foreground hover:bg-muted"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-muted-foreground" aria-hidden>
          {open ? '\u25BC' : '\u25B6'}
        </span>
      </Button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </section>
  )
}
