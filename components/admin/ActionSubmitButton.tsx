'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonVariant = React.ComponentProps<typeof Button>['variant']

/**
 * One-click submit button for the dashboard action rows. Reads the enclosing
 * <form>'s pending state via useFormStatus so a broker gets immediate feedback
 * (and can't double-fire a client-facing send) without a bespoke client store.
 * Must be rendered INSIDE a <form action={serverAction}>.
 */
export function ActionSubmitButton({
  children,
  pendingLabel = 'Sending…',
  variant = 'default',
  className,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode
  pendingLabel?: string
  variant?: ButtonVariant
  className?: string
  disabled?: boolean
  /** Accessible name — the visible label ("Send"/"Done") is ambiguous out of
   *  reading order, so each row passes who/what this acts on. */
  ariaLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={cn('min-h-11 shrink-0', className)}
    >
      {pending ? pendingLabel : children}
    </Button>
  )
}
