'use client'

/**
 * AlertEditDialog — per-row edit surface for a guest listing alert or a
 * signed-in saved search inside the admin Subscriptions hub. Edits the name,
 * cadence, and the core filters (city, extra cities, price range, beds, baths,
 * property type). Every filter key the dialog does not expose (keywords, sqft,
 * amenity flags, map polygon, ...) is preserved untouched on save — the server
 * action merges + re-normalizes through the canonical filter model and keeps
 * the guest table's filters_hash in sync.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAlertSubscriptionAction } from '@/app/actions/subscriptions-admin'
import type { AdminAlertSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const BED_BATH_OPTIONS = ['any', '1', '2', '3', '4', '5'] as const

function numberDraft(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function minCountDraft(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : 'any'
}

function citiesDraft(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(', ') : ''
}

export default function AlertEditDialog({
  row,
  onClose,
  onSaved,
}: {
  /** The row being edited. The dialog is mounted only while open. */
  row: AdminAlertSubscriptionRow
  onClose: () => void
  onSaved: () => void
}) {
  const filters = (row.filters ?? {}) as Record<string, unknown>
  const [pending, startTransition] = useTransition()
  const [draftName, setDraftName] = useState(row.name ?? '')
  const [draftFrequency, setDraftFrequency] = useState<'daily' | 'weekly'>(
    row.frequency.trim().toLowerCase() === 'weekly' ? 'weekly' : 'daily',
  )
  const [draftCity, setDraftCity] = useState(typeof filters.city === 'string' ? filters.city : '')
  const [draftCities, setDraftCities] = useState(citiesDraft(filters.cities))
  const [draftMinPrice, setDraftMinPrice] = useState(numberDraft(filters.minPrice))
  const [draftMaxPrice, setDraftMaxPrice] = useState(numberDraft(filters.maxPrice))
  const [draftBeds, setDraftBeds] = useState(minCountDraft(filters.beds))
  const [draftBaths, setDraftBaths] = useState(minCountDraft(filters.baths))
  const [draftPropertyType, setDraftPropertyType] = useState(
    typeof filters.propertyType === 'string' && filters.propertyType.trim() ? filters.propertyType : 'all',
  )
  const [dialogError, setDialogError] = useState('')

  const noun = row.kind === 'guest' ? 'alert' : 'saved search'

  function handleSave() {
    const min = draftMinPrice.trim() ? Number(draftMinPrice) : undefined
    const max = draftMaxPrice.trim() ? Number(draftMaxPrice) : undefined
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      setDialogError('Enter a valid minimum price.')
      return
    }
    if (max !== undefined && (!Number.isFinite(max) || max < 0)) {
      setDialogError('Enter a valid maximum price.')
      return
    }
    if (min !== undefined && max !== undefined && min > max) {
      setDialogError('Minimum price must be at or below the maximum.')
      return
    }
    setDialogError('')

    // Merge the dialog fields over the EXISTING filters so every key the
    // dialog does not expose survives the edit untouched.
    const nextFilters: Record<string, unknown> = { ...filters }
    const setOrDrop = (key: string, value: unknown) => {
      if (value === undefined) delete nextFilters[key]
      else nextFilters[key] = value
    }
    const cities = draftCities.split(',').map((c) => c.trim()).filter(Boolean)
    setOrDrop('city', draftCity.trim() || undefined)
    setOrDrop('cities', cities.length > 0 ? cities : undefined)
    setOrDrop('minPrice', min)
    setOrDrop('maxPrice', max)
    setOrDrop('beds', draftBeds === 'any' ? undefined : Number(draftBeds))
    setOrDrop('baths', draftBaths === 'any' ? undefined : Number(draftBaths))
    setOrDrop('propertyType', draftPropertyType === 'all' ? undefined : draftPropertyType)

    startTransition(async () => {
      const res = await updateAlertSubscriptionAction(row.kind, row.id, {
        name: draftName.trim() || (row.name ?? undefined),
        frequency: draftFrequency,
        filters: nextFilters,
      })
      if (!res.data) {
        setDialogError(res.error ?? 'Could not save those changes')
        return
      }
      toast.success(`Saved the ${noun}`)
      onSaved()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {noun}</DialogTitle>
          <DialogDescription>
            {row.email ? `Alerts for ${row.email}. ` : ''}Filters you do not change here are kept as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="alert-edit-name">Name</Label>
            <Input
              id="alert-edit-name"
              value={draftName}
              maxLength={120}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Email frequency</Label>
            <Select value={draftFrequency} onValueChange={(v) => setDraftFrequency(v as 'daily' | 'weekly')} disabled={pending}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="alert-edit-city">City</Label>
            <Input
              id="alert-edit-city"
              value={draftCity}
              placeholder="e.g. Bend"
              maxLength={80}
              onChange={(e) => setDraftCity(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="alert-edit-cities">Additional cities</Label>
            <Input
              id="alert-edit-cities"
              value={draftCities}
              placeholder="Comma-separated, e.g. Redmond, Sisters"
              maxLength={200}
              onChange={(e) => setDraftCities(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="alert-edit-min">Min price</Label>
              <Input
                id="alert-edit-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={draftMinPrice}
                placeholder="No minimum"
                onChange={(e) => setDraftMinPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alert-edit-max">Max price</Label>
              <Input
                id="alert-edit-max"
                type="number"
                inputMode="numeric"
                min={0}
                value={draftMaxPrice}
                placeholder="No maximum"
                onChange={(e) => setDraftMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Beds</Label>
              <Select value={draftBeds} onValueChange={setDraftBeds} disabled={pending}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BED_BATH_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'any' ? 'Any' : `${option}+`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Baths</Label>
              <Select value={draftBaths} onValueChange={setDraftBaths} disabled={pending}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BED_BATH_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'any' ? 'Any' : `${option}+`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Property type</Label>
            <Select value={draftPropertyType} onValueChange={setDraftPropertyType} disabled={pending}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(({ value, label }) => (
                  <SelectItem key={value || 'all'} value={value || 'all'}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dialogError && (
            <p className="text-sm text-destructive" role="alert">{dialogError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
