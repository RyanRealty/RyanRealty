'use client'

/**
 * Homepage hero media island for /admin/site-pages.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every prop, handler, state transition, server action,
 * conditional and visible string is byte-identical to the shadcn version.
 *
 * What changed, and why each swap is the primitive's own job rather than a
 * restyle at the call site:
 *  - the three shadcn controls become v2 primitives: Input+Label -> TextField
 *    (the field owns its <label htmlFor>, so the association the old pair had is
 *    kept and the two helper sentences become the field's `hint`, which is what
 *    finally wires them to aria-describedby), Button -> the v2 Button.
 *  - the two upload buttons keep their SECONDARY rank as variant="quiet" (they
 *    were variant="outline"); "Save hero media" stays the one primary action in
 *    the file, which is also ci:admin-ui rule C.
 *  - every colour now reads from var(--a-*). The hand-rolled focus ring and
 *    hover:opacity classes are gone because .av2-input and .av2-btn carry
 *    focus-visible, hover and pressed states for real — dropping them here
 *    ADDS the pressed feedback the old inline classes never had.
 *  - the four hand-written ids (hero-video-file / hero-image-file /
 *    hero-video-url / hero-image-url) are gone: they existed only to pair each
 *    Label with its Input inside this file, nothing under __tests__/ or
 *    scripts/ referenced them (grepped), and TextField generates the pair with
 *    useId().
 */

import { useState } from 'react'
import {
  updateBrokerageHeroMedia,
  uploadBrokerageHeroImage,
  uploadBrokerageHeroVideo,
} from '@/app/actions/brokerage'
import { Button, TextField } from '@/components/admin/v2'

/** The section card: a hairline-held surface one step up from the page. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-surface)' } as const

/** The two upload wells: hairline only, no fill, so they read inside the card. */
const WELL_STYLE = { borderColor: 'var(--a-border)' } as const

type Props = {
  initialHeroVideoUrl: string | null
  initialHeroImageUrl: string | null
}

export default function HeroMediaForm({ initialHeroVideoUrl, initialHeroImageUrl }: Props) {
  const [heroVideoUrl, setHeroVideoUrl] = useState(initialHeroVideoUrl?.trim() || '')
  const [heroImageUrl, setHeroImageUrl] = useState(initialHeroImageUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageHeroMedia(
        heroVideoUrl.trim() || null,
        heroImageUrl.trim() || null
      )
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Hero video and image URLs saved. Homepage will update shortly.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadHeroVideo(formData: FormData) {
    setMessage(null)
    setUploadingVideo(true)
    try {
      const result = await uploadBrokerageHeroVideo(formData)
      if (result.ok && result.url) {
        setHeroVideoUrl(result.url)
        setMessage({ type: 'ok', text: 'Hero video uploaded and linked.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to upload video' })
      }
    } finally {
      setUploadingVideo(false)
    }
  }

  async function handleUploadHeroImage(formData: FormData) {
    setMessage(null)
    setUploadingImage(true)
    try {
      const result = await uploadBrokerageHeroImage(formData)
      if (result.ok && result.url) {
        setHeroImageUrl(result.url)
        setMessage({ type: 'ok', text: 'Hero image uploaded and linked.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to upload image' })
      }
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="rounded-lg border p-6" style={CARD_STYLE}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--a-text)' }}>Homepage hero</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--a-text-2)' }}>
        Optional background video or image for the homepage hero. When a video URL is set, it plays
        behind the search bar (autoplay, muted, loop). When the video URL is empty, only the image
        shows. If both video and image URLs are empty, the site uses a default Bend landscape photo
        from Unsplash. Use a direct link to an MP4 file for video.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form action={handleUploadHeroVideo} className="space-y-2 rounded-lg border p-3" style={WELL_STYLE}>
          <TextField
            label="Upload hero video"
            name="file"
            type="file"
            accept="video/mp4,video/webm"
            required
          />
          <Button type="submit" disabled={uploadingVideo} variant="quiet">
            {uploadingVideo ? 'Uploading…' : 'Upload video'}
          </Button>
        </form>
        <form action={handleUploadHeroImage} className="space-y-2 rounded-lg border p-3" style={WELL_STYLE}>
          <TextField
            label="Upload hero image"
            name="file"
            type="file"
            accept="image/*"
            required
          />
          <Button type="submit" disabled={uploadingImage} variant="quiet">
            {uploadingImage ? 'Uploading…' : 'Upload image'}
          </Button>
        </form>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <TextField
          label="Hero video URL"
          hint="Direct link to an MP4 file. Leave blank to use the image only."
          type="url"
          value={heroVideoUrl}
          onChange={(e) => setHeroVideoUrl(e.target.value)}
          placeholder="https://…/hero.mp4"
        />

        <TextField
          label="Hero image URL (fallback or poster)"
          hint="Shown when no video is set, or as poster/fallback while video loads."
          type="url"
          value={heroImageUrl}
          onChange={(e) => setHeroImageUrl(e.target.value)}
          placeholder="https://…/hero.jpg"
        />

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save hero media'}
        </Button>
      </form>

      {message && (
        <p
          className="mt-4 text-sm"
          style={{ color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)' }}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
