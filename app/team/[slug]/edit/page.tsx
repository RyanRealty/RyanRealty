import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getCurrentBrokerForSelfService,
  requireBrokerSelfServiceSlug,
  updateCurrentBrokerProfile,
} from '@/app/actions/broker-self'

type Props = { params: Promise<{ slug: string }> }
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return {
    title: 'Edit Broker Profile',
    description: 'Broker self service profile editing',
    alternates: { canonical: `${siteUrl}/team/${encodeURIComponent(slug)}/edit` },
    robots: { index: false, follow: false },
  }
}

export default async function BrokerSelfEditPage({ params }: Props) {
  const { slug } = await params
  await requireBrokerSelfServiceSlug(slug)
  const broker = await getCurrentBrokerForSelfService()
  if (!broker) redirect('/admin/access-denied')

  async function saveAction(formData: FormData) {
    'use server'
    const result = await updateCurrentBrokerProfile({
      bio: String(formData.get('bio') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      tagline: String(formData.get('tagline') ?? ''),
      social_instagram: String(formData.get('social_instagram') ?? ''),
      social_facebook: String(formData.get('social_facebook') ?? ''),
      social_linkedin: String(formData.get('social_linkedin') ?? ''),
      social_youtube: String(formData.get('social_youtube') ?? ''),
      social_tiktok: String(formData.get('social_tiktok') ?? ''),
      social_x: String(formData.get('social_x') ?? ''),
    })
    if (!result.ok) throw new Error(result.error ?? 'Failed to save profile')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* heading-display-ok: internal broker self-service tool, noindex */}
      <h1 className="text-3xl font-semibold text-foreground">Edit your profile</h1>
      <p className="mt-2 text-muted-foreground">Update your public bio, contact phone, and social links.</p>
      <form action={saveAction} className="mt-8 space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="grid gap-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" name="tagline" defaultValue={broker.tagline ?? ''} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={broker.phone ?? ''} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" name="bio" defaultValue={broker.bio ?? ''} className="min-h-[180px]" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="social_instagram">Instagram</Label>
            <Input id="social_instagram" name="social_instagram" defaultValue={broker.social_instagram ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="social_facebook">Facebook</Label>
            <Input id="social_facebook" name="social_facebook" defaultValue={broker.social_facebook ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="social_linkedin">LinkedIn</Label>
            <Input id="social_linkedin" name="social_linkedin" defaultValue={broker.social_linkedin ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="social_youtube">YouTube</Label>
            <Input id="social_youtube" name="social_youtube" defaultValue={broker.social_youtube ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="social_tiktok">TikTok</Label>
            <Input id="social_tiktok" name="social_tiktok" defaultValue={broker.social_tiktok ?? ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="social_x">X</Label>
            <Input id="social_x" name="social_x" defaultValue={broker.social_x ?? ''} />
          </div>
        </div>
        <Button type="submit">Save profile</Button>
      </form>
    </main>
  )
}
