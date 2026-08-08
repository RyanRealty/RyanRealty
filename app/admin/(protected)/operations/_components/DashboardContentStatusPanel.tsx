// Admin v2 migration of components/admin/DashboardContentStatusPanel.tsx —
// presentation only. Data, props and copy are unchanged; the shadcn <Card>
// grid becomes SectionHead + av2-pane, and the shadcn <Button asChild><Link>
// becomes a <Link> styled with the av2-btn classes (the admin v2 Button has
// no asChild/anchor rendering — every other migrated admin page renders a
// nav "button" this same way, e.g. app/admin/(protected)/brokers/page.tsx).
import Link from 'next/link'
import type { DashboardContentStatus } from '@/app/actions/dashboard'
import { SectionHead } from '@/components/admin/v2'

type Props = {
  data: DashboardContentStatus | null
  error: string | null
}

export default function DashboardContentStatusPanel({ data, error }: Props) {
  if (error) {
    return <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{error}</p>
  }
  if (!data) {
    return (
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Unable to load content status.
      </p>
    )
  }

  const items: { title: string; value: number; caption: string }[] = [
    {
      title: 'Published guides',
      value: data.publishedGuides,
      caption: 'Rows in guides with status published',
    },
    {
      title: 'Published blog posts',
      value: data.publishedBlogPosts,
      caption: 'Rows in blog_posts with status published',
    },
    {
      title: 'Communities with description',
      value: data.communitiesWithDescription,
      caption: 'Rows in communities with a non-null description',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.title}>
            <SectionHead>{item.title}</SectionHead>
            <div className="av2-pane">
              <p className="a-num font-semibold" style={{ fontSize: 'var(--a-text-num)', color: 'var(--a-text)' }}>
                {item.value.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{item.caption}</p>
            </div>
          </div>
        ))}
      </div>
      <Link href="/admin/guides" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
        Open guides admin
      </Link>
    </div>
  )
}
