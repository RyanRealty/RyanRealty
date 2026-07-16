'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * A submit button that reflects the form action's in-flight state (admin rebuild
 * §4.2). Drop it inside any `<form action={serverAction}>` and the button disables
 * + shows a spinner + a "pending" label while the action runs — so a slow action
 * (a 30–60s CMA build, a multi-second send) never looks like "nothing happened",
 * and can't be double-fired. The RC2 pattern, reusable.
 */
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
    <Button type="submit" size={size} variant={variant} disabled={disabled || pending} aria-busy={pending} className={cn(className)}>
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
