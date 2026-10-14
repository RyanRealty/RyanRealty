'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/identity/consent-prompt'

/** Footer control: opens the cookie banner's second layer. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="link"
      className={cn('h-auto min-h-11 px-0', className)}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
      }}
    >
      Cookie settings
    </Button>
  )
}
