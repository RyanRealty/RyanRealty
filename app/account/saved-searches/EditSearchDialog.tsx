'use client'

/**
 * EditSearchDialog, the per-row edit surface for /account/saved-searches
 * (saved-search master goal W3). Edits name, alert cadence, and the core
 * filters (city, price range, beds, baths, property type). Every key the
 * dialog does not expose (keywords, sqft, year built, feature flags, poly,
 * and the rest of FILTER_KEYS) is preserved untouched on save, so editing
 * the price never drops a keyword or map polygon.
 *
 * Persists through updateSavedSearch (name + filters, which re-normalizes
 * via normalizeSavedSearchFilters and re-warms the result cache server-side)
 * and setSavedSearchCadence (notification frequency).
 */
import { useState, useTransition } from 'react'
import { setSavedSearchCadence, updateSavedSearch } from '@/app/actions/saved-searches'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import { SAVED_SEARCH_CADENCES, type SavedSearchCadence } from '@/lib/saved-search-cadence'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export type RowState = {
  name: string
  paused: boolean
  cadence: SavedSearchCadence
  filters: Record<string, unknown>
}

const BED_BATH_OPTIONS = ['any', '1', '2', '3', '4', '5'] as const

function numberDraft(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function minCountDraft(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : 'any'
}

export function EditSearchDialog({
  search,
  state,
  onSaved,
}: {
  search: SavedSearchRow
  state: RowState
  onSaved: (next: RowState) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draftName, setDraftName] = useState(state.name)
  const [draftCadence, setDraftCadence] = useState<SavedSearchCadence>(state.cadence)
  const [draftCity, setDraftCity] = useState('')
  const [draftMinPrice, setDraftMinPrice] = useState('')
  const [draftMaxPrice, setDraftMaxPrice] = useState('')
  const [draftBeds, setDraftBeds] = useState('any')
  const [draftBaths, setDraftBaths] = useState('any')
  const [draftPropertyType, setDraftPropertyType] = useState('all')
  const [dialogError, setDialogError] = useState('')

  function openWithCurrentValues(nextOpen: boolean) {
    if (nextOpen) {
      const filters = state.filters
      setDraftName(state.name)
      setDraftCadence(state.cadence)
      setDraftCity(typeof filters.city === 'string' ? filters.city : '')
      setDraftMinPrice(numberDraft(filters.minPrice))
      setDraftMaxPrice(numberDraft(filters.maxPrice))
      setDraftBeds(minCountDraft(filters.beds))
      setDraftBaths(minCountDraft(filters.baths))
      setDraftPropertyType(
        typeof filters.propertyType === 'string' && filters.propertyType.trim()
          ? filters.propertyType
          : 'all',
      )
      setDialogError('')
    }
    setOpen(nextOpen)
  }

  function handleSave() {
    const nextName = draftName.trim() || state.name
    const min = draftMinPrice.trim() ? Number(draftMinPrice) : undefined
    const max = draftMaxPrice.trim() ? Number(draftMaxPrice) : undefined
    if (min !== undefined && !Number.isFinite(min)) {
      setDialogError('Enter a valid minimum price.')
      return
    }
    if (max !== undefined && !Number.isFinite(max)) {
      setDialogError('Enter a valid maximum price.')
      return
    }
    if (min !== undefined && max !== undefined && min > max) {
      setDialogError('Minimum price must be at or below the maximum.')
      return
    }
    setDialogError('')

    // Merge the dialog fields over the EXISTING filters so every key the dialog
    // does not expose survives the edit untouched.
    const nextFilters: Record<string, unknown> = { ...state.filters }
    const setOrDrop = (key: string, value: unknown) => {
      if (value === undefined) delete nextFilters[key]
      else nextFilters[key] = value
    }
    setOrDrop('city', draftCity.trim() || undefined)
    setOrDrop('minPrice', min)
    setOrDrop('maxPrice', max)
    setOrDrop('beds', draftBeds === 'any' ? undefined : Number(draftBeds))
    setOrDrop('baths', draftBaths === 'any' ? undefined : Number(draftBaths))
    setOrDrop('propertyType', draftPropertyType === 'all' ? undefined : draftPropertyType)

    startTransition(async () => {
      const result = await updateSavedSearch(search.id, { name: nextName, filters: nextFilters })
      if (result.error) {
        setDialogError(result.error)
        return
      }
      if (draftCadence !== state.cadence) {
        const cadenceResult = await setSavedSearchCadence(search.id, draftCadence)
        if (cadenceResult.error) {
          // Filters saved but cadence did not. Surface it, keep the dialog open.
          setDialogError(cadenceResult.error)
          onSaved({ ...state, name: nextName, filters: nextFilters })
          return
        }
      }
      onSaved({ ...state, name: nextName, cadence: draftCadence, filters: nextFilters })
      setOpen(false)
    })
  }

  const nameId = `edit-name-${search.id}`
  const cityId = `edit-city-${search.id}`
  const minId = `edit-min-${search.id}`
  const maxId = `edit-max-${search.id}`

  return (
    <Dialog open={open} onOpenChange={openWithCurrentValues}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit saved search</DialogTitle>
          <DialogDescription>
            Change the name, how often we email you, or the filters we match against.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={draftName}
              maxLength={120}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>How often we email</Label>
            <Select
              value={draftCadence}
              onValueChange={(v) => setDraftCadence(v as SavedSearchCadence)}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVED_SEARCH_CADENCES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={cityId}>City</Label>
            <Input
              id={cityId}
              value={draftCity}
              placeholder="e.g. Bend"
              maxLength={80}
              onChange={(e) => setDraftCity(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={minId}>Min price</Label>
              <Input
                id={minId}
                type="number"
                inputMode="numeric"
                min={0}
                value={draftMinPrice}
                placeholder="No minimum"
                onChange={(e) => setDraftMinPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={maxId}>Max price</Label>
              <Input
                id={maxId}
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
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
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
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
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
            <Label>Home type</Label>
            <Select value={draftPropertyType} onValueChange={setDraftPropertyType} disabled={pending}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
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
            <p className="text-sm text-destructive" role="alert">
              {dialogError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
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
