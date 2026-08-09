'use client'

/**
 * Site logo island for /admin/site-pages.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every prop, handler, state transition, server action,
 * conditional and visible string is byte-identical to the shadcn version.
 *
 * The swaps that are more than a colour rename:
 *  - Input+Label -> TextField. The old <Label> carried NO htmlFor and did not
 *    wrap its control, so "Logo URL" and "Or upload image" were floating text a
 *    screen reader never tied to anything. TextField owns the pair, so the two
 *    fields gain an accessible name they never had; the visible strings are
 *    unchanged.
 *  - each form becomes .av2-inline-form, the language's label-above-plus-button
 *    row. It is the same flex-wrap row the shadcn markup hand-rolled.
 *  - "Save URL" is the file's ONE primary action (ci:admin-ui rule C) and
 *    "Upload & set" drops to variant="quiet". Ranking follows the sibling
 *    HeroMediaForm, where the upload was already the secondary button.
 *  - the preview frame moves to var(--a-inset), the language's well, sitting on
 *    the card's var(--a-surface) so the two never collapse into one another.
 *  - hover:opacity / hover:bg-primary go away because .av2-btn carries real
 *    hover AND pressed states; the second upload button's hover:bg-primary was
 *    a no-op (same colour as its rest state) and is now a live affordance.
 */

import Image from 'next/image'
import { useState } from 'react'
import { updateBrokerageLogoUrl, uploadBrokerageLogo } from '@/app/actions/brokerage'
import { Button, TextField } from '@/components/admin/v2'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

/** The section card: a hairline-held surface one step up from the page. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-surface)' } as const

/** The preview well: one step DOWN from the card, so the frame stays readable. */
const WELL_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-inset)' } as const

type Props = {
  initialLogoUrl: string | null
}

/** Default logo path; use relative path so Next.js Image never fetches localhost (avoids private-IP error). */
const DEFAULT_LOGO_PATH = '/logo.png'

export default function SiteLogoForm({ initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const displayUrl = logoUrl || DEFAULT_LOGO_PATH

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageLogoUrl(logoUrl.trim() || null)
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Logo URL saved. It may take a moment to appear on the site.' })
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Failed to save' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    if (!formData.get('file')) {
      setMessage({ type: 'err', text: 'Please choose an image file.' })
      return
    }
    setUploading(true)
    try {
      const result = await uploadBrokerageLogo(formData)
      if (result.ok && result.url) {
        setLogoUrl(result.url)
        setMessage({ type: 'ok', text: 'Logo uploaded and set. It may take a moment to appear on the site.' })
        form.reset()
      } else {
        setMessage({ type: 'err', text: result.error ?? 'Upload failed' })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border p-6" style={CARD_STYLE}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--a-text)' }}>Site logo</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--a-text-2)' }}>
        Shown in the header on all pages. Use a PNG or SVG with transparent background for best results. Recommended height ~48px.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="flex h-14 items-center rounded-lg border px-4" style={WELL_STYLE}>
          <Image
            src={displayUrl}
            alt="Logo preview"
            width={160}
            height={48}
            className="h-10 w-auto max-h-12 object-contain object-left"
            onError={() => setMessage({ type: 'err', text: 'Preview failed to load. Check the URL or upload a new image.' })}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <form onSubmit={handleSaveUrl} className="av2-inline-form">
            <TextField
              label="Logo URL"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={siteUrl ? `${siteUrl}/logo.png` : DEFAULT_LOGO_PATH}
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save URL'}
            </Button>
          </form>

          <form onSubmit={handleUpload} className="av2-inline-form">
            <TextField
              label="Or upload image"
              type="file"
              name="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
            />
            <Button type="submit" disabled={uploading} variant="quiet">
              {uploading ? 'Uploading…' : 'Upload & set'}
            </Button>
          </form>
        </div>
      </div>

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
