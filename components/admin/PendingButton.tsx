'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

/**
 * A submit button that reflects the form action's in-flight state (admin rebuild
 * §4.2). Drop it inside any `<form action={serverAction}>` and the button disables
 * + shows a spinner + a "pending" label while the action runs — so a slow action
 * (a 30–60s CMA build, a multi-second send) never looks like "nothing happened",
 * and can't be double-fired. The RC2 pattern, reusable.
 */

/**
 * The public `variant` union is the shadcn one and stays that way — this is a
 * shared button with live callers, so the prop contract does not move. Each
 * member maps onto the admin v2 language's three: one action colour (primary),
 * one recessive (quiet), one destructive (danger). The v2 Button carries hover,
 * pressed and focus itself, so nothing here re-declares them.
 */
const V2_VARIANT = {
  default: 'primary',
  outline: 'quiet',
  ghost: 'quiet',
  secondary: 'quiet',
  destructive: 'danger',
} as const

export function PendingButton({
  children,
  pendingLabel,
  disabled,
  className,
  size = 'sm',
  variant,
}: {
  children: React.ReactNode
  pendingLabel: string
  disabled?: boolean
  className?: string
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
}) {
  const { pending } = useFormStatus()
  return (
    // `size` keeps its place in the signature; v2 has one button metric plus the
    // 44px touch metric (--a-touch), so only 'lg' still changes the height.
    <Button
      type="submit"
      variant={V2_VARIANT[variant ?? 'default']}
      touch={size === 'lg'}
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(className)}
    >
      {pending ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  )
}
