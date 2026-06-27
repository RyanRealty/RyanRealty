'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  addAdminListingPhoto,
  deleteAdminListingPhoto,
  getAdminListingEditableData,
  reorderAdminListingPhotos,
  setAdminListingHeroPhoto,
  updateAdminListingEditableData,
  updateAdminListingMediaSuppressed,
  type AdminListingEditable,
} from '@/app/actions/admin-listing-detail'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  initialData: AdminListingEditable
}

type Message = { type: 'ok' | 'err'; text: string } | null

export default function AdminListingEditor({ initialData }: Props) {
  const [listPrice, setListPrice] = useState(initialData.listPrice?.toString() ?? '')
  const [standardStatus, setStandardStatus] = useState(initialData.standardStatus ?? '')
  const [publicRemarks, setPublicRemarks] = useState(initialData.publicRemarks ?? '')
  const [adminNotes, setAdminNotes] = useState(initialData.adminNotes ?? '')
  const [marketingHeadline, setMarketingHeadline] = useState(initialData.marketingHeadline ?? '')
  const [featured, setFeatured] = useState(initialData.featured)
  // P1-4: media suppression toggle state
  const [mediaSuppressed, setMediaSuppressed] = useState(initialData.mediaSuppressed)
  const [photos, setPhotos] = useState(initialData.photos)
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [newPhotoCaption, setNewPhotoCaption] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const [isPending, startTransition] = useTransition()

  const heroPhotoId = useMemo(
    () => photos.find((photo) => photo.is_hero)?.id ?? null,
    [photos]
  )

  async function refreshPhotosFromServer() {
    const refreshed = await getAdminListingEditableData(initialData.listingKey)
    if (refreshed) {
      setPhotos(refreshed.photos)
    }
  }

  function parsePrice(value: string): number | null {
    const parsed = Number(value.replace(/,/g, '').trim())
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return Math.round(parsed)
  }

  function saveListingEdits() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateAdminListingEditableData({
        listingKey: initialData.listingKey,
        listPrice: parsePrice(listPrice),
        standardStatus: standardStatus.trim() || null,
        publicRemarks: publicRemarks.trim() || null,
        adminNotes: adminNotes.trim() || null,
        marketingHeadline: marketingHeadline.trim() || null,
        featured,
      })

      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setMessage({ type: 'ok', text: 'Listing changes saved.' })
    })
  }

  function toggleMediaSuppressed(next: boolean) {
    setMessage(null)
    startTransition(async () => {
      const result = await updateAdminListingMediaSuppressed({
        listingKey: initialData.listingKey,
        mediaSuppressed: next,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setMediaSuppressed(next)
      setMessage({
        type: 'ok',
        text: next
          ? 'Media suppressed. Owner photos are now hidden from the public site.'
          : 'Media suppression removed. Owner photos are visible on the public site.',
      })
    })
  }

  function addPhoto() {
    setMessage(null)
    startTransition(async () => {
      const result = await addAdminListingPhoto({
        listingKey: initialData.listingKey,
        photoUrl: newPhotoUrl.trim(),
        caption: newPhotoCaption.trim() || null,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      await refreshPhotosFromServer()
      setNewPhotoUrl('')
      setNewPhotoCaption('')
      setMessage({ type: 'ok', text: 'Photo added.' })
    })
  }

  function deletePhoto(photoId: string) {
    const confirmed = window.confirm('Delete this photo?')
    if (!confirmed) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteAdminListingPhoto({
        listingKey: initialData.listingKey,
        photoId,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      await refreshPhotosFromServer()
      setMessage({ type: 'ok', text: 'Photo removed.' })
    })
  }

  function setHero(photoId: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await setAdminListingHeroPhoto({
        listingKey: initialData.listingKey,
        photoId,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      await refreshPhotosFromServer()
      setMessage({ type: 'ok', text: 'Hero photo updated.' })
    })
  }

  function movePhoto(photoId: string, direction: 'up' | 'down') {
    const index = photos.findIndex((photo) => photo.id === photoId)
    if (index < 0) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= photos.length) return

    const next = [...photos]
    const currentRow = next[index]
    next[index] = next[target]
    next[target] = currentRow
    const normalized = next.map((row, idx) => ({ ...row, sort_order: idx }))
    setPhotos(normalized)

    startTransition(async () => {
      const result = await reorderAdminListingPhotos({
        listingKey: initialData.listingKey,
        orderedPhotoIds: normalized.map((photo) => photo.id),
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin listing controls</CardTitle>
          <CardDescription>
            Manage manual listing overrides, remarks, and display preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="list-price">List price</Label>
              <Input
                id="list-price"
                value={listPrice}
                onChange={(event) => setListPrice(event.target.value)}
                placeholder="e.g. 675000"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="standard-status">Standard status</Label>
              <Input
                id="standard-status"
                value={standardStatus}
                onChange={(event) => setStandardStatus(event.target.value)}
                placeholder="Active, Pending, Closed..."
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="marketing-headline">Marketing headline</Label>
            <Input
              id="marketing-headline"
              value={marketingHeadline}
              onChange={(event) => setMarketingHeadline(event.target.value)}
              placeholder="Optional headline override"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="public-remarks">Public remarks</Label>
            <Textarea
              id="public-remarks"
              value={publicRemarks}
              onChange={(event) => setPublicRemarks(event.target.value)}
              rows={6}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="admin-notes">Admin notes (internal)</Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="featured-flag"
              checked={featured}
              onCheckedChange={(checked) => setFeatured(checked === true)}
            />
            <Label htmlFor="featured-flag">Featured listing override</Label>
          </div>

          <div className="flex gap-3">
            <Button type="button" onClick={saveListingEdits} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save listing'}
            </Button>
          </div>
          {message && (
            <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'}>
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* P1-4: Media suppression toggle — owner photo-removal mechanism */}
      <Card>
        <CardHeader>
          <CardTitle>Media suppression</CardTitle>
          <CardDescription>
            When enabled, all owner photos are removed from the public site immediately. This is the durable, sync-proof gate described in the listing media suppression reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start gap-4 rounded-lg border border-border p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {mediaSuppressed ? 'Photos suppressed — hidden from public site' : 'Photos visible on public site'}
              </p>
              <p className="text-sm text-muted-foreground">
                {mediaSuppressed
                  ? 'Owner requested removal. The listing still appears in search but all photos return empty.'
                  : 'No suppression active. Photos display normally.'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {mediaSuppressed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => toggleMediaSuppressed(false)}
                >
                  {isPending ? 'Updating…' : 'Remove suppression'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm('Suppress all media for this listing? Photos will be hidden from the public site immediately.')) {
                      toggleMediaSuppressed(true)
                    }
                  }}
                >
                  {isPending ? 'Updating…' : 'Suppress media'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photo management</CardTitle>
          <CardDescription>
            Add, reorder, set hero, and remove listing photos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="new-photo-url">Photo URL</Label>
              <Input
                id="new-photo-url"
                value={newPhotoUrl}
                onChange={(event) => setNewPhotoUrl(event.target.value)}
                placeholder="https://..."
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="new-photo-caption">Caption</Label>
              <Input
                id="new-photo-caption"
                value={newPhotoCaption}
                onChange={(event) => setNewPhotoCaption(event.target.value)}
                placeholder="Optional caption"
                className="mt-2"
              />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={addPhoto} disabled={isPending || !newPhotoUrl.trim()}>
            Add photo
          </Button>

          {/* Photo cards — phones (stacked, thumb-friendly actions) */}
          <div className="space-y-2 md:hidden">
            {photos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No listing photos found.
                </CardContent>
              </Card>
            ) : (
              photos.map((photo, index) => (
                <Card key={photo.id}>
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-start gap-3">
                      <a
                        href={photo.cdn_url || photo.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.cdn_url || photo.photo_url}
                          alt="Listing photo"
                          className="h-16 w-24 rounded object-cover"
                        />
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{photo.caption ?? '—'}</p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          Order {index + 1} · {heroPhotoId === photo.id ? 'Hero' : 'Not hero'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo.id, 'up')}
                        disabled={index === 0 || isPending}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo.id, 'down')}
                        disabled={index === photos.length - 1 || isPending}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setHero(photo.id)}
                        disabled={photo.is_hero || isPending}
                      >
                        Set hero
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => deletePhoto(photo.id)}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Photo table — desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Caption</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Hero</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {photos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No listing photos found.
                  </TableCell>
                </TableRow>
              )}
              {photos.map((photo, index) => (
                <TableRow key={photo.id}>
                  <TableCell>
                    <a href={photo.cdn_url || photo.photo_url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.cdn_url || photo.photo_url}
                        alt="Listing photo"
                        className="h-14 w-20 rounded object-cover"
                      />
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{photo.caption ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    {heroPhotoId === photo.id ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo.id, 'up')}
                        disabled={index === 0 || isPending}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo.id, 'down')}
                        disabled={index === photos.length - 1 || isPending}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setHero(photo.id)}
                        disabled={photo.is_hero || isPending}
                      >
                        Set hero
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => deletePhoto(photo.id)}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
