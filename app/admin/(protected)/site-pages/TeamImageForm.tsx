'use client'

/**
 * Team image (social proof) island for /admin/site-pages.
 *
 * 11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every prop, handler, state transition, server action,
 * conditional and visible string is byte-identical to the shadcn version.
 *
 * The swaps that are more than a colour rename:
 *  - Input+Label -> TextField. The old <Label> carried no htmlFor and did not
 *    wrap its control, so both fields were unnamed to a screen reader; the
 *    field primitive owns the pair now. Visible strings unchanged.
 *  - each form becomes .av2-inline-form, the language's label-above-plus-button
 *    row — the same flex-wrap row the shadcn markup hand-rolled.
 *  - "Save URL" is the file's ONE primary action (ci:admin-ui rule C) and
 *    "Upload & set" drops to variant="quiet", matching the sibling
 *    HeroMediaForm where the upload was already the secondary button.
 *  - the preview frame's forced light backdrop (a palette colour plus a
 *    dark-mode override) becomes var(--a-inset), the language's well. The
 *    visual lock is explicit that a component needing its own dark case means
 *    the TOKEN is wrong, so the well is used rather than re-pinning a light
 *    fill; it sits on the card's var(--a-surface), one step apart from it.
 */

import Image from 'next/image'
import { useState } from 'react'
import { updateBrokerageTeamImageUrl, uploadBrokerageTeamImage } from '@/app/actions/brokerage'
import { Button, TextField } from '@/components/admin/v2'

/** The section card: a hairline-held surface one step up from the page. */
const CARD_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-surface)' } as const

/** The preview well: one step DOWN from the card, so the frame stays readable. */
const WELL_STYLE = { borderColor: 'var(--a-border)', background: 'var(--a-inset)' } as const

type Props = {
  initialTeamImageUrl: string | null
}

export default function TeamImageForm({ initialTeamImageUrl }: Props) {
  const [teamImageUrl, setTeamImageUrl] = useState(initialTeamImageUrl?.trim() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const result = await updateBrokerageTeamImageUrl(teamImageUrl.trim() || null)
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Team image URL saved. Homepage will update shortly.' })
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
      const result = await uploadBrokerageTeamImage(formData)
      if (result.ok && result.url) {
        setTeamImageUrl(result.url)
        setMessage({ type: 'ok', text: 'Team image uploaded and set. Homepage will update shortly.' })
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
      <h2 className="text-lg font-semibold" style={{ color: 'var(--a-text)' }}>Team image (social proof)</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--a-text-2)' }}>
        Image shown in the homepage testimonials block next to reviews. Upload a PNG (e.g. with transparent
        background) or paste a URL. You can change it anytime here.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        {teamImageUrl && (
          <div className="relative h-24 w-32 overflow-hidden rounded-md border" style={WELL_STYLE}>
            <Image
              src={teamImageUrl}
              alt="Team image preview"
              fill
              className="object-contain object-center"
              unoptimized
              onError={() => setMessage({ type: 'err', text: 'Preview failed to load. Check the URL or upload a new image.' })}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <form onSubmit={handleSaveUrl} className="av2-inline-form">
            <TextField
              label="Team image URL"
              type="url"
              value={teamImageUrl}
              onChange={(e) => setTeamImageUrl(e.target.value)}
              placeholder="https://…/team.png"
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save URL'}
            </Button>
          </form>

          <form onSubmit={handleUpload} className="av2-inline-form">
            <TextField
              label="Or upload image (saved to Supabase)"
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
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
