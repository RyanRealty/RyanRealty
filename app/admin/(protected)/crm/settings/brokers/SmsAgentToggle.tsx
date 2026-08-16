'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setCrmBrokerSmsAgentAction } from '@/app/actions/crm-brokers'
import { Switch } from '@/components/admin/v2'

type Props = {
  crmSlug: string
  brokerName: string
  initialEnabled: boolean
  envEnabled: boolean
}

export function SmsAgentToggle({ crmSlug, brokerName, initialEnabled, envEnabled }: Props) {
  const [checked, setChecked] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setChecked(initialEnabled)
  }, [initialEnabled])

  function handleChange(next: boolean) {
    setChecked(next)
    startTransition(async () => {
      const result = await setCrmBrokerSmsAgentAction(crmSlug, next)
      if (result.ok) {
        router.refresh()
      } else {
        setChecked((prev) => !prev)
        toast.error(result.error)
      }
    })
  }

  const stateText = pending ? 'Saving…' : checked ? (envEnabled ? 'On' : 'On, env off') : 'Off'

  return (
    <Switch
      className="min-h-11"
      checked={checked}
      disabled={pending}
      onChange={(e) => handleChange(e.target.checked)}
      label={`${checked ? 'Turn off' : 'Turn on'} SMS agent for ${brokerName}`}
      labelHidden
      stateText={stateText}
    />
  )
}
