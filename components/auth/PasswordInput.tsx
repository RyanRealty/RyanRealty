'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import type { ComponentProps } from 'react'

/**
 * Password field with a show/hide toggle. Typing a password blind on a
 * phone keyboard with no way to check it produces mistyped passwords and a
 * sign-in failure the visitor can't diagnose (design-audit P3, shared by
 * LoginForm and SignupForm).
 */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={`${props.className ?? ''} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={visible ? ViewOffSlashIcon : EyeIcon} className="h-4 w-4" />
      </button>
    </div>
  )
}
