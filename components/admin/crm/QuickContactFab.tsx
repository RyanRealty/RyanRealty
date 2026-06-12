'use client'

/**
 * Sticky + button on the CRM person page — one thumb-tap to contact the lead.
 * Expands to Call / Text / Email / Note. Sits above the mobile tab bar.
 */
import { useState } from 'react'
import { Mail, MessageSquare, Phone, Plus, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function QuickContactFab(props: { phone: string | null; email: string | null }) {
  const [open, setOpen] = useState(false)
  const tel = props.phone ? `tel:+1${props.phone.replace(/\D/g, '').slice(-10)}` : null

  const jump = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 lg:bottom-8 lg:right-8">
      {open ? (
        <div className="flex flex-col items-end gap-2">
          {tel ? (
            <Button asChild size="sm" className="shadow-lg">
              <a href={tel}><Phone className="h-4 w-4" aria-hidden /> Call</a>
            </Button>
          ) : null}
          {props.phone ? (
            <Button size="sm" className="shadow-lg" onClick={() => jump('send-text')}>
              <MessageSquare className="h-4 w-4" aria-hidden /> Text
            </Button>
          ) : null}
          {props.email ? (
            <Button size="sm" className="shadow-lg" onClick={() => jump('send-email')}>
              <Mail className="h-4 w-4" aria-hidden /> Email
            </Button>
          ) : null}
          <Button size="sm" className="shadow-lg" onClick={() => jump('add-note')}>
            <StickyNote className="h-4 w-4" aria-hidden /> Note
          </Button>
        </div>
      ) : null}
      <Button
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close contact actions' : 'Contact this lead'}
        aria-expanded={open}
        className="h-14 w-14 rounded-full shadow-lg"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <Plus className="h-6 w-6" aria-hidden />}
      </Button>
    </div>
  )
}
