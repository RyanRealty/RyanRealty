'use client'

/**
 * TemplatePickerNav — thin client bridge that wires TemplatePicker to Next.js
 * navigation. When a template is selected it pushes ?tpl=<key> (for email) or
 * ?smsTpl=<key> (for SMS) into the URL, which triggers a server re-render with
 * the resolved template body — exactly the same behaviour as the old <Select
 * name="tpl"> + Load form did, but now with a searchable command palette.
 *
 * Preserves the other search param (tpl or smsTpl) when updating one param,
 * so switching an SMS template doesn't clear the selected email template.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { TemplatePicker, type PickerTemplate } from '@/components/admin/crm/TemplatePicker'

export function TemplatePickerNav({
  templates,
  channel,
  currentKey,
  className,
}: {
  templates: PickerTemplate[]
  channel: 'email' | 'sms'
  currentKey: string | null | undefined
  className?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSelect(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    const paramName = channel === 'email' ? 'tpl' : 'smsTpl'
    if (key === 'blank') {
      params.delete(paramName)
    } else {
      params.set(paramName, key)
    }
    // Preserve the other param so switching SMS doesn't clear the email tpl.
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <TemplatePicker
      templates={templates}
      channel={channel}
      currentKey={currentKey}
      onSelect={handleSelect}
      className={className}
    />
  )
}
