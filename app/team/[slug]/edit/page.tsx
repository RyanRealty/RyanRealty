/**
 * /team/[slug]/edit - broker self-service profile, on the v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then the existing save form (capture contract
 * unchanged). No sales Sheet.
 *
 * VISITOR OBJECTIVE: A Ryan Realty broker updates their own public profile
 * (bio, phone, tagline, socials) without asking an admin.
 * MACHINE OBJECTIVE: Keep the team trust surfaces accurate at zero admin
 * cost. Noindex, auth-gated. Never part of the visitor graph.
 * EXITS: /team/[slug]
 *
 * THE PAGE CONTRACT: generateMetadata robots noindex nofollow,
 * requireBrokerSelfServiceSlug, updateCurrentBrokerProfile fields unchanged.
 *
 * D11: no virtue names. No invented quote. Admin-simple on this surface.
 */

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
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return {
    title: 'Edit Broker Profile',
    description: 'Broker self service profile editing',
    alternates: { canonical: `${getCanonicalSiteUrl()}/team/${encodeURIComponent(slug)}/edit` },
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

  const publicHref = `/team/${encodeURIComponent(slug)}`

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="utility" />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Team', href: '/team' },
            { label: 'Edit profile' },
          ]}
        />

        <V3Quiet
          id="edit-profile"
          heading="Edit your profile"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'Update your public bio, contact phone, and social links.',
            },
            { label: 'View public profile', href: publicHref },
          ]}
        />

        <form action={saveAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" name="tagline" defaultValue={broker.tagline ?? ''} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={broker.phone ?? ''} />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" defaultValue={broker.bio ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_instagram">Instagram</Label>
            <Input id="social_instagram" name="social_instagram" defaultValue={broker.social_instagram ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_facebook">Facebook</Label>
            <Input id="social_facebook" name="social_facebook" defaultValue={broker.social_facebook ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_linkedin">LinkedIn</Label>
            <Input id="social_linkedin" name="social_linkedin" defaultValue={broker.social_linkedin ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_youtube">YouTube</Label>
            <Input id="social_youtube" name="social_youtube" defaultValue={broker.social_youtube ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_tiktok">TikTok</Label>
            <Input id="social_tiktok" name="social_tiktok" defaultValue={broker.social_tiktok ?? ''} />
          </div>
          <div>
            <Label htmlFor="social_x">X</Label>
            <Input id="social_x" name="social_x" defaultValue={broker.social_x ?? ''} />
          </div>
          <Button type="submit">Save profile</Button>
        </form>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
