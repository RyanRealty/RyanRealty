'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { BrokerRow } from '@/app/actions/brokers'
import { updateBroker, deleteBroker } from '@/app/actions/brokers'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { BrokerFormMessage } from '../AdminBrokerForm'

type Props = {
  broker: BrokerRow
  photoUrl: string
  onPhotoUrlChange: (url: string) => void
  /** Read-only here: submitted as-is on Save. Owned and mutated by the BrokerVideoStudio sibling (passed in as `children`). */
  introVideoUrl: string
  setMessage: (msg: BrokerFormMessage) => void
  /** Headshot + intro-video studio sections, rendered in original document position between the "Years of experience" field and the "Photo URL / Email" grid. */
  children?: ReactNode
}

/**
 * Broker profile CRUD (concern 1 of 3, split out of the former AdminBrokerForm god-component).
 * Owns display fields, review/social/external-ID links, active/sort-order flags, and the
 * updateBroker/deleteBroker server-action calls. Does NOT own photo_url or intro_video_url state
 * (those are bridged from the parent AdminBrokerForm because the headshot/video studio siblings
 * mutate them as side effects of their own uploads/generations) but it does render the manual
 * "Photo URL" override field and submits both values on save.
 */
export default function BrokerProfileForm({
  broker,
  photoUrl,
  onPhotoUrlChange,
  introVideoUrl,
  setMessage,
  children,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    display_name: broker.display_name,
    title: broker.title,
    license_number: broker.license_number ?? '',
    bio: broker.bio ?? '',
    email: broker.email ?? '',
    phone: broker.phone ?? '',
    google_review_url: broker.google_review_url ?? '',
    zillow_review_url: broker.zillow_review_url ?? '',
    sort_order: broker.sort_order,
    is_active: broker.is_active,
    tagline: broker.tagline ?? '',
    specialties: (broker.specialties ?? []).join(', '),
    designations: (broker.designations ?? []).join(', '),
    years_experience: broker.years_experience ?? '',
    social_instagram: broker.social_instagram ?? '',
    social_facebook: broker.social_facebook ?? '',
    social_linkedin: broker.social_linkedin ?? '',
    social_youtube: broker.social_youtube ?? '',
    social_tiktok: broker.social_tiktok ?? '',
    social_x: broker.social_x ?? '',
    mls_id: broker.mls_id ?? '',
    zillow_id: broker.zillow_id ?? '',
    realtor_id: broker.realtor_id ?? '',
    yelp_id: broker.yelp_id ?? '',
    google_business_id: broker.google_business_id ?? '',
  })

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const specialties = form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const designations = form.designations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const yearsNum = typeof form.years_experience === 'number' ? form.years_experience : parseInt(String(form.years_experience), 10)
      const result = await updateBroker(broker.id, {
        display_name: form.display_name.trim() || undefined,
        title: form.title.trim() || undefined,
        license_number: form.license_number.trim() || null,
        bio: form.bio.trim() || null,
        photo_url: photoUrl.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        google_review_url: form.google_review_url.trim() || null,
        zillow_review_url: form.zillow_review_url.trim() || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
        tagline: form.tagline.trim() || null,
        specialties: specialties.length > 0 ? specialties : null,
        designations: designations.length > 0 ? designations : null,
        years_experience: Number.isFinite(yearsNum) && yearsNum > 0 ? yearsNum : null,
        social_instagram: form.social_instagram.trim() || null,
        social_facebook: form.social_facebook.trim() || null,
        social_linkedin: form.social_linkedin.trim() || null,
        social_youtube: form.social_youtube.trim() || null,
        social_tiktok: form.social_tiktok.trim() || null,
        social_x: form.social_x.trim() || null,
        mls_id: form.mls_id.trim() || null,
        zillow_id: form.zillow_id.trim() || null,
        realtor_id: form.realtor_id.trim() || null,
        yelp_id: form.yelp_id.trim() || null,
        google_business_id: form.google_business_id.trim() || null,
        intro_video_url: introVideoUrl.trim() || null,
      })
      if (result.ok) {
        setMessage({ type: 'ok', text: 'Broker updated.' })
        router.refresh()
        return
      }
      const errText = result.error ?? ''
      const friendly = /failed to fetch|load failed|networkerror/i.test(errText)
        ? 'Network error. Check your connection and that the dev server is running (npm run dev).'
        : errText
      setMessage({ type: 'err', text: friendly })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const friendly = /failed to fetch|load failed|networkerror/i.test(msg)
        ? 'Network error. Check your connection and that the dev server is running (npm run dev).'
        : msg
      setMessage({ type: 'err', text: friendly })
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove broker "${broker.display_name}"? This cannot be undone.`)) return
    setMessage(null)
    setLoading(true)
    const result = await deleteBroker(broker.id)
    setLoading(false)
    if (result.ok) router.push('/admin/brokers')
    else setMessage({ type: 'err', text: result.error })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Display name <span className="text-destructive">*</span></span>
          <Input
            type="text"
            required
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Title <span className="text-destructive">*</span></span>
          <Input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Principal Broker, Broker"
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
      </div>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Oregon license number <span className="text-destructive">*</span></span>
        <p className="mt-0.5 text-xs text-muted-foreground">Required for advertising compliance (Oregon Real Estate Agency).</p>
        <Input
          type="text"
          required
          value={form.license_number}
          onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
          placeholder="e.g. 201206613"
          className="mt-1 block w-full max-w-xs rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Tagline</span>
        <Input
          type="text"
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          placeholder="Short tagline for agent hero"
          className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Bio</span>
        <Textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Specialties</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Comma-separated, e.g. First-time buyers, Luxury, Land</p>
          <Input
            type="text"
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            placeholder="First-time buyers, Luxury, Land"
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Designations</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Comma-separated, e.g. CRS, GRI</p>
          <Input
            type="text"
            value={form.designations}
            onChange={(e) => setForm((f) => ({ ...f, designations: e.target.value }))}
            placeholder="CRS, GRI"
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
      </div>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Years of experience</span>
        <Input
          type="number"
          min={0}
          value={form.years_experience === '' ? '' : form.years_experience}
          onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value === '' ? '' : Number(e.target.value) }))}
          placeholder="e.g. 10"
          className="mt-1 block w-24 rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Label>
      {children}
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Photo URL</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Or paste a URL to use an external image.</p>
          <Input
            type="url"
            value={photoUrl}
            onChange={(e) => onPhotoUrlChange(e.target.value)}
            placeholder="https://..."
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Email</span>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </Label>
      </div>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Phone</span>
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1 block w-full max-w-xs rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </Label>
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Review links</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add your Google and Zillow review page URLs so they appear on your public profile.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Google reviews URL</span>
            <Input
              type="url"
              value={form.google_review_url}
              onChange={(e) => setForm((f) => ({ ...f, google_review_url: e.target.value }))}
              placeholder="https://g.page/... or Google Business profile link"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Zillow reviews URL</span>
            <Input
              type="url"
              value={form.zillow_review_url}
              onChange={(e) => setForm((f) => ({ ...f, zillow_review_url: e.target.value }))}
              placeholder="https://www.zillow.com/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Social links</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Profile URLs for Instagram, Facebook, LinkedIn, YouTube, TikTok. Shown on public agent page when set.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Instagram</span>
            <Input
              type="url"
              value={form.social_instagram}
              onChange={(e) => setForm((f) => ({ ...f, social_instagram: e.target.value }))}
              placeholder="https://instagram.com/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Facebook</span>
            <Input
              type="url"
              value={form.social_facebook}
              onChange={(e) => setForm((f) => ({ ...f, social_facebook: e.target.value }))}
              placeholder="https://facebook.com/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">LinkedIn</span>
            <Input
              type="url"
              value={form.social_linkedin}
              onChange={(e) => setForm((f) => ({ ...f, social_linkedin: e.target.value }))}
              placeholder="https://linkedin.com/in/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">YouTube</span>
            <Input
              type="url"
              value={form.social_youtube}
              onChange={(e) => setForm((f) => ({ ...f, social_youtube: e.target.value }))}
              placeholder="https://youtube.com/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">TikTok</span>
            <Input
              type="url"
              value={form.social_tiktok}
              onChange={(e) => setForm((f) => ({ ...f, social_tiktok: e.target.value }))}
              placeholder="https://tiktok.com/@..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">X</span>
            <Input
              type="url"
              value={form.social_x}
              onChange={(e) => setForm((f) => ({ ...f, social_x: e.target.value }))}
              placeholder="https://x.com/..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">External profile IDs</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Used for linking broker pages to external profile sources.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">MLS ID</span>
            <Input
              type="text"
              value={form.mls_id}
              onChange={(e) => setForm((f) => ({ ...f, mls_id: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Zillow ID</span>
            <Input
              type="text"
              value={form.zillow_id}
              onChange={(e) => setForm((f) => ({ ...f, zillow_id: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Realtor.com ID</span>
            <Input
              type="text"
              value={form.realtor_id}
              onChange={(e) => setForm((f) => ({ ...f, realtor_id: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Yelp ID</span>
            <Input
              type="text"
              value={form.yelp_id}
              onChange={(e) => setForm((f) => ({ ...f, yelp_id: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
          <Label className="block">
            <span className="text-sm font-medium text-muted-foreground">Google Business ID</span>
            <Input
              type="text"
              value={form.google_business_id}
              onChange={(e) => setForm((f) => ({ ...f, google_business_id: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
        <Label className="flex items-center gap-2">
          <Input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-border text-success focus:ring-accent"
          />
          <span className="text-sm font-medium text-muted-foreground">Active (visible on team page)</span>
        </Label>
        <Label className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort order</span>
          <Input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            className="w-20 rounded-lg border border-border px-2 py-1.5 text-foreground"
          />
        </Label>
      </div>
      {/* flex-wrap: four shrink-0 actions in a non-wrapping row made this page
          the widest thing in the admin at 375px (scrollWidth 496 > 375,
          measured 2026-08-07). The row wraps now; nothing else changed. */}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => handleSubmit()}
          disabled={loading}
          className="rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-success-foreground shadow-sm hover:bg-success/85 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </Button>
        <a
          href={`/team/${broker.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          View agent page
        </a>
        {/* Was a second link to /team/{slug} — the same place "View agent page"
            already goes — while the label promised the roster. /team is the
            roster, and the broker list page already links it. */}
        <a
          href="/team"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          View team page
        </a>
        <Button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className="rounded-lg border border-destructive/30 bg-card px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Remove broker
        </Button>
      </div>
    </>
  )
}
