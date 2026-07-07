'use client'

import { useTransition, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateProfile } from '@/app/actions/profile'
import type { NotificationPreferences } from '@/app/actions/profile'
import { setSavedSearchFrequencyForUser } from '@/app/actions/saved-searches'
import {
  getMyReportSubscriptionAction,
  setMyReportSubscriptionAction,
} from '@/app/actions/market-report-optin'
import { cn } from '@/lib/utils'
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
type Props = { initialPrefs: NotificationPreferences }

type ReportAreaOption = {
  slug: string
  label: string
}

type ReportFrequencyValue = 'weekly' | 'monthly' | 'quarterly'

const REPORT_FREQUENCY_OPTIONS: ReadonlyArray<{ value: ReportFrequencyValue, label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

/**
 * Market report emails — self-serve per-area subscription (saved-search master
 * goal, W3). Loads the current subscription + valid area options from the
 * server action on mount, then saves explicitly via the button so toggling
 * three areas is one write, not three.
 */
function MarketReportPrefs() {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [areaOptions, setAreaOptions] = useState<ReportAreaOption[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [frequency, setFrequency] = useState<ReportFrequencyValue>('monthly')
  const [isActive, setIsActive] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await getMyReportSubscriptionAction()
      if (cancelled) return
      if (result.error || !result.data) {
        setLoadState('error')
        return
      }
      setAreaOptions(result.data.areas)
      if (result.data.subscription) {
        setSelectedAreas(result.data.subscription.areas)
        setFrequency(result.data.subscription.frequency)
        setIsActive(result.data.subscription.isActive)
      }
      setLoadState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggleArea(slug: string) {
    setSelectedAreas((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    )
  }

  function save() {
    if (isActive && selectedAreas.length === 0) {
      toast.error('Pick at least one area to get market reports.')
      return
    }
    startTransition(async () => {
      const result = await setMyReportSubscriptionAction({
        areas: selectedAreas,
        frequency,
        isActive,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        setSelectedAreas(result.data.areas)
        setFrequency(result.data.frequency)
        setIsActive(result.data.isActive)
      }
      toast.success(
        isActive ? 'You are set up for market reports.' : 'Market report emails are off.',
      )
    })
  }

  return (
    <Card className="mt-6 gap-5 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="market-report-switch" className="font-medium text-foreground">
            Market report emails
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Local sales data and trends for the areas you choose.
          </p>
        </div>
        <Switch
          id="market-report-switch"
          checked={isActive}
          disabled={loadState !== 'ready' || pending}
          onCheckedChange={setIsActive}
        />
      </div>

      {loadState === 'loading' && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      )}

      {loadState === 'error' && (
        <p className="text-sm text-destructive" role="alert">
          We could not load your market report preferences. Refresh to try again.
        </p>
      )}

      {loadState === 'ready' && (
        <>
          <div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-foreground">Areas</Label>
              {selectedAreas.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {selectedAreas.length} selected
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {areaOptions.map((area) => {
                const selected = selectedAreas.includes(area.slug)
                return (
                  <Button
                    key={area.slug}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    disabled={pending}
                    onClick={() => toggleArea(area.slug)}
                    aria-pressed={selected}
                    className={cn('min-h-11 sm:min-h-8')}
                  >
                    {area.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="market-report-frequency" className="text-sm font-medium text-foreground">
              How often
            </Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as ReportFrequencyValue)}
              disabled={pending}
            >
              <SelectTrigger id="market-report-frequency" className="mt-1 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button type="button" onClick={save} disabled={pending} className="min-h-11 sm:min-h-9">
              {pending ? 'Saving...' : 'Save market report preferences'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

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

  // Changing the saved-search cadence fans the choice out to every saved search
  // the user owns (the per-row value the alert cron actually honors), then keeps
  // the profile mirror in sync so the displayed value and the create-time default
  // match. Without the fan-out this control wrote a global preference no cron read.
  const updateSavedSearchCadence = useCallback((value: 'instant' | 'daily' | 'weekly') => {
    setPrefs((p) => {
      const next = { ...p, savedSearchFrequency: value }
      startTransition(async () => {
        const [rowResult] = await Promise.all([
          setSavedSearchFrequencyForUser(value),
          updateProfile({ notificationPreferences: next }),
        ])
        if (!rowResult.error) {
          setSaved(true)
          router.refresh()
          setTimeout(() => setSaved(false), 2000)
        }
      })
      return next
    })
  }, [router])

  return (
    <>
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
        <Select value={prefs.savedSearchFrequency ?? 'daily'} onValueChange={(v) => updateSavedSearchCadence(v as 'instant' | 'daily' | 'weekly')}>
          <SelectTrigger className="mt-1 w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-muted-foreground">This applies to every search you have saved.</p>
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
    <MarketReportPrefs />
    </>
  )
}
