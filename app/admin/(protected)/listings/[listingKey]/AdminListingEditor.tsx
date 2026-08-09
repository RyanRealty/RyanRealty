'use client'

/**
 * AdminListingEditor — the MLS-adjacent override island on a listing's admin
 * page: manual price/status/remarks overrides, the media-suppression gate, and
 * photo management (add, reorder, set hero, delete).
 *
 * 11F admin-v2: migrated to the LOCKED admin language
 * (design_system/admin/ADMIN_UI.md). The shadcn Card/Table/Input/Textarea/
 * Label/Checkbox/Button are gone, and so is every shadcn semantic color class —
 * those resolve to the PUBLIC brand palette the admin's amnesia blacklists, so
 * swapping only the imports would have left a broker's override screen wearing
 * the marketing site's colors. Color and type now come from var(--a-*).
 *
 * NOTHING about what this writes changed: same server actions, same field set,
 * same parsePrice/trim normalization, same confirm gates, same strings, same
 * optimistic reorder. The photo table is <ReportGrid> (the admin's one tabular
 * reader) with an av2-cardlist phone fallback carrying the same four actions —
 * the card list owns its breakpoint in the CLASS, never `md:hidden` plus an
 * inline display.
 *
 * ci:admin-ui rule C allows ONE primary v2 <Button> per file. "Save listing" —
 * the click that actually writes the overrides — keeps it. Add photo, the
 * suppression toggles and the per-row photo actions are quiet or danger.
 */

import { useMemo, useState, useTransition, type CSSProperties } from 'react'
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
import {
  Button,
  ReportGrid,
  SectionHead,
  TextAreaField,
  TextField,
  ToolbarCheck,
  type ReportColumn,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

type Props = {
  initialData: AdminListingEditable
}

type Message = { type: 'ok' | 'err'; text: string } | null

const DESCRIPTION: CSSProperties = {
  margin: '2px 0 0',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
}

const PHOTO_COLUMNS: ReportColumn[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'caption', label: 'Caption' },
  { key: 'order', label: 'Order', numeric: true },
  { key: 'hero', label: 'Hero' },
  { key: 'actions', label: 'Actions' },
]

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

  /** The four per-photo actions, identical on the phone card and the grid row. */
  function photoActions(photoId: string, index: number, isHero: boolean | null | undefined) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          variant="quiet"
          onClick={() => movePhoto(photoId, 'up')}
          disabled={index === 0 || isPending}
        >
          Up
        </Button>
        <Button
          variant="quiet"
          onClick={() => movePhoto(photoId, 'down')}
          disabled={index === photos.length - 1 || isPending}
        >
          Down
        </Button>
        <Button variant="quiet" onClick={() => setHero(photoId)} disabled={isHero || isPending}>
          Set hero
        </Button>
        <Button variant="danger" onClick={() => deletePhoto(photoId)} disabled={isPending}>
          Delete
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionHead>Admin listing controls</SectionHead>
        <p style={DESCRIPTION}>
          Manage manual listing overrides, remarks, and display preferences.
        </p>

        <div className="av2-pane" style={{ marginTop: 12, gap: 16 }}>
          <div className="av2-editgrid">
            <TextField
              label="List price"
              value={listPrice}
              onChange={(event) => setListPrice(event.target.value)}
              placeholder="e.g. 675000"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <TextField
              label="Standard status"
              value={standardStatus}
              onChange={(event) => setStandardStatus(event.target.value)}
              placeholder="Active, Pending, Closed..."
            />
          </div>

          <TextField
            label="Marketing headline"
            value={marketingHeadline}
            onChange={(event) => setMarketingHeadline(event.target.value)}
            placeholder="Optional headline override"
          />

          <TextAreaField
            label="Public remarks"
            value={publicRemarks}
            onChange={(event) => setPublicRemarks(event.target.value)}
            rows={6}
          />

          <TextAreaField
            label="Admin notes (internal)"
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            rows={4}
          />

          <ToolbarCheck
            label="Featured listing override"
            labelStyle={{ minHeight: 44, alignSelf: 'flex-start' }}
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={saveListingEdits} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save listing'}
            </Button>
          </div>
          {message && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--a-text-sm)',
                color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
              }}
            >
              {message.text}
            </p>
          )}
        </div>
      </section>

      {/* P1-4: Media suppression toggle — owner photo-removal mechanism */}
      <section>
        <SectionHead>Media suppression</SectionHead>
        <p style={DESCRIPTION}>
          When enabled, all owner photos are removed from the public site immediately. This is the durable, sync-proof gate described in the listing media suppression reference.
        </p>

        <div
          className="av2-pane"
          style={{
            marginTop: 12,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
              {mediaSuppressed ? 'Photos suppressed — hidden from public site' : 'Photos visible on public site'}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {mediaSuppressed
                ? 'Owner requested removal. The listing still appears in search but all photos return empty.'
                : 'No suppression active. Photos display normally.'}
            </p>
          </div>
          <div style={{ display: 'flex', flexShrink: 0, gap: 8 }}>
            {mediaSuppressed ? (
              <Button
                variant="quiet"
                disabled={isPending}
                onClick={() => toggleMediaSuppressed(false)}
              >
                {isPending ? 'Updating…' : 'Remove suppression'}
              </Button>
            ) : (
              <Button
                variant="danger"
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
      </section>

      <section>
        <SectionHead>Photo management</SectionHead>
        <p style={DESCRIPTION}>Add, reorder, set hero, and remove listing photos.</p>

        <div className="av2-pane" style={{ marginTop: 12, gap: 16 }}>
          <div className="av2-editgrid">
            <TextField
              label="Photo URL"
              value={newPhotoUrl}
              onChange={(event) => setNewPhotoUrl(event.target.value)}
              placeholder="https://..."
            />
            <TextField
              label="Caption"
              value={newPhotoCaption}
              onChange={(event) => setNewPhotoCaption(event.target.value)}
              placeholder="Optional caption"
            />
          </div>
          <div style={{ display: 'flex' }}>
            <Button variant="quiet" onClick={addPhoto} disabled={isPending || !newPhotoUrl.trim()}>
              Add photo
            </Button>
          </div>

          {/* Photo cards — phones (stacked, thumb-friendly actions). The layout
              lives in av2-cardlist, never md:hidden plus an inline display. */}
          <div className="av2-cardlist">
            {photos.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: '32px 0',
                  textAlign: 'center',
                  fontSize: 'var(--a-text-sm)',
                  color: 'var(--a-text-2)',
                }}
              >
                No listing photos found.
              </p>
            ) : (
              photos.map((photo, index) => (
                <div key={photo.id} className="av2-pane" style={{ gap: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <a
                      href={photo.cdn_url || photo.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ flexShrink: 0 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.cdn_url || photo.photo_url}
                        alt="Listing photo"
                        className="h-16 w-24 rounded object-cover"
                      />
                    </a>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'var(--a-text-sm)',
                          color: 'var(--a-text)',
                        }}
                      >
                        {photo.caption ?? '—'}
                      </p>
                      <p
                        className="a-num"
                        style={{ margin: '4px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                      >
                        Order {index + 1} · {heroPhotoId === photo.id ? 'Hero' : 'Not hero'}
                      </p>
                    </div>
                  </div>
                  {photoActions(photo.id, index, photo.is_hero)}
                </div>
              ))
            )}
          </div>

          {/* Photo grid — desktop; hidden below md, where the card list takes over */}
          <div className="hidden md:block">
            <ReportGrid
              label="Listing photos"
              columns={PHOTO_COLUMNS}
              template="112px minmax(160px, 1.6fr) 72px 72px minmax(260px, 1.2fr)"
              minWidth={820}
              rows={photos.map((photo, index) => ({
                key: photo.id,
                cells: [
                  <a key="preview" href={photo.cdn_url || photo.photo_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.cdn_url || photo.photo_url}
                      alt="Listing photo"
                      className="h-14 w-20 rounded object-cover"
                    />
                  </a>,
                  <span key="caption" style={{ color: 'var(--a-text-2)' }}>
                    {photo.caption ?? '—'}
                  </span>,
                  <span key="order" style={{ color: 'var(--a-text-2)' }}>
                    {index + 1}
                  </span>,
                  <span key="hero" style={{ color: 'var(--a-text)' }}>
                    {heroPhotoId === photo.id ? 'Yes' : 'No'}
                  </span>,
                  <span key="actions">{photoActions(photo.id, index, photo.is_hero)}</span>,
                ],
              }))}
              empty="No listing photos found."
            />
          </div>
        </div>
      </section>
    </div>
  )
}
