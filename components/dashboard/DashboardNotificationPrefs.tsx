'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'
import type { NotificationPreferences } from '@/app/actions/profile'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = { initialPrefs: NotificationPreferences }

export default function DashboardNotificationPrefs({ initialPrefs }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailEnabled: initialPrefs?.emailEnabled ?? true,
    savedSearchFrequency: initialPrefs?.savedSearchFrequency ?? 'daily',
    priceDropAlerts: initialPrefs?.priceDropAlerts ?? true,
    statusChangeAlerts: initialPrefs?.statusChangeAlerts ?? true,
    openHouseReminders: initialPrefs?.openHouseReminders ?? true,
    marketDigestFrequency: initialPrefs?.marketDigestFrequency ?? 'weekly',
    blogUpdates: initialPrefs?.blogUpdates ?? false,
  })

  const update = useCallback((patch: Partial<NotificationPreferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      startTransition(async () => {
        const err = await updateProfile({ notificationPreferences: next })
        if (!err.error) {
          setSaved(true)
          router.refresh()
          setTimeout(() => setSaved(false), 2000)
        }
      })
      return next
    })
  }, [router])

  return (
    <div className="mt-6 space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      {saved && (
        <p className="text-sm font-medium text-success" role="status">Saved</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <Label className="font-medium text-foreground">Email notifications</Label>
        <Switch
          checked={prefs.emailEnabled ?? true}
          onCheckedChange={(checked) => update({ emailEnabled: checked })}
        />
      </div>
      <div>
        <Label className="font-medium text-foreground">Saved search matches</Label>
        <Select value={prefs.savedSearchFrequency ?? 'daily'} onValueChange={(v) => update({ savedSearchFrequency: v as 'instant' | 'daily' | 'weekly' })}>
          <SelectTrigger className="mt-1 w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label className="text-muted-foreground">Price drop alerts on saved homes</Label>
        <Switch
          checked={prefs.priceDropAlerts ?? true}
          onCheckedChange={(checked) => update({ priceDropAlerts: checked })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label className="text-muted-foreground">Status change alerts (pending/sold)</Label>
        <Switch
          checked={prefs.statusChangeAlerts ?? true}
          onCheckedChange={(checked) => update({ statusChangeAlerts: checked })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label className="text-muted-foreground">Open house reminders</Label>
        <Switch
          checked={prefs.openHouseReminders ?? true}
          onCheckedChange={(checked) => update({ openHouseReminders: checked })}
        />
      </div>
      <div>
        <Label className="font-medium text-foreground">Market digest</Label>
        <Select value={prefs.marketDigestFrequency ?? 'weekly'} onValueChange={(v) => update({ marketDigestFrequency: v as 'weekly' | 'monthly' | 'off' })}>
          <SelectTrigger className="mt-1 w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label className="text-muted-foreground">Blog / content updates</Label>
        <Switch
          checked={prefs.blogUpdates ?? false}
          onCheckedChange={(checked) => update({ blogUpdates: checked })}
        />
      </div>
      {pending && <p className="text-sm text-muted-foreground">Saving…</p>}
    </div>
  )
}
