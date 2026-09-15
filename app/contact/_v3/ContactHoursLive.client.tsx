'use client'

/**
 * Taste / live hours: the reach control's published-hours chip can be emptied
 * so take-route-shots can record hours-empty. Empty still paints the hours
 * product — it does not delete the line or invent a reply time.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function ContactHoursLive({ children }: { children: ReactNode }) {
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('taste_state') === 'hours-empty') {
      setEmpty(true)
    }
  }, [])

  return (
    <div className="contact-hours-live">
      <div className="contact-ask__taste contact-hours-live__taste">
        <Button type="button" variant="ghost" data-taste="hours-empty" onClick={() => setEmpty(true)}>
          Show empty hours
        </Button>
      </div>
      {empty ? (
        <p className="v3-onduty">
          <span className="v3-onduty__dot" aria-hidden="true" />
          <span className="v3-onduty__label">Hours not published</span>
        </p>
      ) : (
        children
      )}
    </div>
  )
}
