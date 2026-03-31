'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { updatePlaceContentField } from '@/app/actions/place-content'
import { generatePlaceContentSingle } from '@/app/actions/generate-place-content-single'
import type { PlaceContentRow } from '@/app/actions/place-content'

type Props = {
  content: PlaceContentRow
  userId: string
}

const CONTENT_FIELDS: { key: keyof PlaceContentRow; label: string; rows: number }[] = [
  { key: 'overview', label: 'Overview', rows: 8 },
  { key: 'history', label: 'History and Character', rows: 6 },
  { key: 'lifestyle', label: 'Lifestyle', rows: 6 },
  { key: 'schools', label: 'Schools and Education', rows: 6 },
  { key: 'outdoor_recreation', label: 'Outdoor Recreation', rows: 6 },
  { key: 'dining', label: 'Dining and Food', rows: 6 },
  { key: 'shopping', label: 'Shopping and Services', rows: 4 },
  { key: 'arts_culture', label: 'Arts and Culture', rows: 4 },
  { key: 'transportation', label: 'Transportation', rows: 4 },
  { key: 'healthcare', label: 'Healthcare', rows: 4 },
  { key: 'events_festivals', label: 'Events and Festivals', rows: 4 },
  { key: 'family_life', label: 'Family Life', rows: 4 },
  { key: 'real_estate_overview', label: 'Real Estate Overview', rows: 6 },
]

export default function PlaceContentEditor({ content, userId }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      CONTENT_FIELDS.map((f) => [f.key, (content[f.key] as string) ?? ''])
    )
  )
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setDirty((prev) => new Set(prev).add(key))
  }

  function handleSave(key: string) {
    startTransition(async () => {
      const value = values[key]?.trim() || null
      const { error } = await updatePlaceContentField(
        content.place_type,
        content.place_key,
        key,
        value,
        userId
      )
      if (error) {
        toast.error(`Failed to save ${key}: ${error}`)
      } else {
        toast.success(`Saved ${key}`)
        setDirty((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    })
  }

  function handleSaveAll() {
    const dirtyKeys = Array.from(dirty)
    if (dirtyKeys.length === 0) {
      toast('No changes to save')
      return
    }
    startTransition(async () => {
      let savedCount = 0
      for (const key of dirtyKeys) {
        const value = values[key]?.trim() || null
        const { error } = await updatePlaceContentField(
          content.place_type,
          content.place_key,
          key,
          value,
          userId
        )
        if (error) {
          toast.error(`Failed to save ${key}: ${error}`)
        } else {
          savedCount++
        }
      }
      if (savedCount > 0) {
        toast.success(`Saved ${savedCount} section${savedCount > 1 ? 's' : ''}`)
        setDirty(new Set())
      }
    })
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {content.generated_at && (
            <Badge variant="outline" className="text-xs">
              Generated {new Date(content.generated_at).toLocaleDateString()}
              {content.generated_by && ` by ${content.generated_by}`}
            </Badge>
          )}
          {content.last_edited_at && (
            <Badge variant="secondary" className="text-xs">
              Last edited {new Date(content.last_edited_at).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                toast.info('Regenerating all content...')
                const { error } = await generatePlaceContentSingle({
                  placeType: content.place_type,
                  placeKey: content.place_key,
                  placeName: content.place_name,
                  cityName: content.city_name,
                })
                if (error) {
                  toast.error(`Failed: ${error}`)
                } else {
                  toast.success('Content regenerated')
                  router.refresh()
                }
              })
            }}
          >
            {isPending ? 'Working...' : 'Regenerate all'}
          </Button>
          {dirty.size > 0 && (
            <Button onClick={handleSaveAll} disabled={isPending} size="sm">
              {isPending ? 'Saving...' : `Save ${dirty.size} change${dirty.size > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {CONTENT_FIELDS.map((field) => (
        <Card key={field.key}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                {field.label}
                {dirty.has(field.key) && (
                  <span className="ml-2 text-xs text-warning">unsaved</span>
                )}
              </Label>
              {dirty.has(field.key) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave(field.key)}
                  disabled={isPending}
                >
                  Save
                </Button>
              )}
            </div>
            <Textarea
              className="mt-2"
              rows={field.rows}
              value={values[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()} content...`}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
