# Build Step 12: Admin Backend

Scope: Admin backend, content management, admin access & URL, default superuser, AI writing assistant, roles & permissions, user management, sync status dashboard.

Build the complete admin backend at /admin:

## TASK 1: Admin Layout & Auth
Create src/app/(admin)/layout.tsx:
- Protected by middleware: checks session exists AND profile.admin_role is not null
- If not authenticated: redirect to /admin/login
- If authenticated but no admin_role: show "Access Denied" page
- Navy sidebar (persistent, collapsible to icons on smaller screens)
- Top bar: admin name, role badge, notification bell, logout button
- Main content area right of sidebar

Create src/app/(admin)/login/page.tsx:
- Separate login page styled for admin (not the public site login)
- Email/password only (no social auth for admin)
- Ryan Realty logo, "Admin Portal" heading
- After login: check admin_role, redirect to /admin or show access denied

## TASK 2: First-Run Setup Wizard
Create src/app/(admin)/setup/page.tsx:
- Only accessible when settings table has no 'setup_complete' key
- Step 1: Create admin account — Full name, Email, Password (creates Supabase Auth user, assigns super_admin role)
- Step 2: Brokerage basics — Brokerage name (default "Ryan Realty"), primary color, logo upload (optional, skip for now)
- Step 3: Confirmation — "You're all set! Welcome to your admin dashboard."
- On completion: insert settings record { key: 'setup_complete', value: true }
- Middleware checks: if setup not complete AND user is visiting /admin (not /admin/setup), redirect to /admin/setup

## TASK 3: Admin Dashboard (Home Screen)
Create src/app/(admin)/page.tsx:
- 4 KPI cards at top: Active Listings (from DB count), New Leads Today (from FUB or user_activities), Site Visitors Today (from GA4 realtime if available, or page view count), Pending Tasks (content queue count)
- Recent Activity feed: last 10 admin actions from audit log
- Quick Actions grid: "Run Delta Sync", "Create Blog Post", "Generate Market Report", "View Leads", "Compose Email"
- Alerts section: sync errors, content pending approval, high-intent leads

## TASK 4: Admin Sidebar Navigation
Create src/components/admin/AdminSidebar.tsx:
- Implement the full navigation from Section 31:
  - Dashboard
  - Listings (All Listings, My Listings, Enhanced Listings, Sync Status)
  - Communities & Locations (Communities, Neighborhoods, Cities, Boundary Manager)
  - People (My Leads, All Users, Anonymous Visitors, Broker Team)
  - Content (Blog Posts, AI Content Queue, AI Video Queue, Social Posts, Site Content)
  - Email (Compose, Campaigns, Drafts, Templates)
  - Reports (Market Reports, Broker Performance, Lead Analytics, Site Analytics, Listing Performance)
  - Media (Media Library, Video Library)
  - Settings (Brokerage Profile, Social Accounts, Integrations, SEO Settings, Notification Defaults, Redirect Manager, Background Jobs, Audit Log)
- Each item has an icon (use lucide-react icons)
- Active item highlighted
- Collapsible sub-items
- Role-based visibility: hide items the current role can't access (per the Permissions Matrix)

## TASK 5: Sync Status Dashboard
Create src/app/(admin)/listings/sync/page.tsx:
- Implement the FULL sync dashboard from Section 7.11:
- Section 1 — Current Sync Status: status indicator (Running green pulse/Paused yellow/Errored red/Idle gray), progress bar (during initial sync), speed (records/min), timing (started, elapsed, remaining), controls (Start Initial Sync, Pause, Resume, Force Full Resync, Run Delta Now buttons)
- Section 2 — Database Summary: total listings by status (Active/Pending/Closed/Final/Withdrawn), total properties, total photos, total communities, total cities, total agents, last sync timestamp
- Section 3 — Delta Sync History: table of last 50 runs (start time, duration, records processed, new listings, price changes, status changes, errors, API calls). Click row for details.
- Section 4 — Sync Health Metrics: avg delta duration, avg records per delta, API calls today, rate limit events, errors today, finalized today
- Section 5 — Error Log: expandable list with listing key, error message, timestamp, retry count. Filter by date/type. Bulk retry/dismiss.
- Section 6 — Rate Limit Monitor: current count/limit gauge, time until reset
- All data fetched from sync_checkpoints and job_runs tables
- Auto-refresh every 10 seconds while sync is running (use Supabase Realtime or polling)
- Buttons call the admin sync API routes created in the data pipeline step

## TASK 6: Listings Management
Create src/app/(admin)/listings/page.tsx:
- Table view of all listings: photo thumbnail, address, price, status, beds/baths, community, DOM, last synced
- Search bar: search by address, MLS number, listing key
- Filters: status, community, city, price range, date range
- Sort by any column
- Bulk actions: feature/unfeature, export CSV
- Click row: opens listing detail view in admin with edit capabilities
- Pagination: 50 per page

Create src/app/(admin)/listings/[id]/page.tsx:
- Full listing view in admin context
- All fields displayed and editable where appropriate (description supplements, featured flag, manual notes)
- Photo management: reorder, set hero, delete
- Sync info: last synced, raw API data viewer (collapsible JSON)
- Engagement stats: views, saves, shares, inquiries
- "View on Site" link to public listing page
- "Re-sync This Listing" button

## TASK 7: Communities CRUD
Create src/app/(admin)/communities/page.tsx:
- Table of all communities: name, city, listing count, median price, is_resort, hero image thumbnail
- "Add Community" button
- Click row to edit

Create src/app/(admin)/communities/[id]/page.tsx:
- Full edit form with tabs:
  - Details: name, slug (auto-generated, editable), city, description (rich text with AI Assist button), is_resort toggle
  - Media: hero image upload/change, additional images
  - Resort Content: only visible if is_resort=true. Amenities, golf details, HOA info, lifestyle description — all with AI Assist buttons
  - Boundary: KML file upload or Google Places polygon viewer. GeoJSON preview on map.
  - SEO: custom title, description, canonical override
- Save button, delete button (with confirm)
- "View on Site" link

## TASK 8: Cities & Neighborhoods CRUD
Create src/app/(admin)/cities/page.tsx and src/app/(admin)/cities/[id]/page.tsx:
- Same CRUD pattern as communities
- Fields: name, slug, state, description (AI Assist), hero image, boundary GeoJSON, population, elevation, county, SEO fields

Create src/app/(admin)/neighborhoods/page.tsx and src/app/(admin)/neighborhoods/[id]/page.tsx:
- Same pattern, with parent city selector dropdown

## TASK 9: User & Broker Management
Create src/app/(admin)/people/users/page.tsx:
- Table of all registered users: name, email, role, signup date, last login, saved count, activity count
- Search and filter
- Click row to view user detail with activity timeline

Create src/app/(admin)/people/brokers/page.tsx:
- Table of all brokers: headshot, name, role, listing count, sold count, review rating, status (active/inactive)
- "Add Broker" button — opens the invite flow:
  - Form: first name, last name, email, role dropdown (Broker Admin, Broker, Viewer)
  - "Send Invite" — creates profile record, sends Resend invitation email with unique signup link
- Click row to edit broker profile

Create src/app/(admin)/people/brokers/[id]/page.tsx:
- Full broker profile editor with tabs per Section 31:
  - Profile tab: name, email, phone, license, MLS ID, title, designations, years experience, specialties (tag input), service areas (community multi-select), tagline
  - Bio tab: rich text editor with AI Assist button. "Why work with me" with AI Assist.
  - Media tab: headshot upload with crop tool (1:1 square aspect ratio), additional photos gallery (drag-and-drop upload, reorder, delete), video uploads (MP4 upload or YouTube/Vimeo URL paste). All stored in Supabase Storage under /brokers/{broker_id}/
  - Social tab: Instagram, Facebook, LinkedIn, X, YouTube, TikTok URLs
  - External Profiles tab: Zillow Agent ID, Realtor.com profile ID, Yelp Business ID, Google Business Profile ID
  - Signature tab: preview of auto-generated email signature
- Role changer (dropdown, super_admin only)
- Deactivate/reactivate toggle
- "View on Site" link to public broker page

## TASK 10: Blog Post Management
Create src/app/(admin)/content/blog/page.tsx:
- Table: title, status (draft/published), author, category, published date, view count
- "New Post" button
- Filter by status, category, author

Create src/app/(admin)/content/blog/[id]/page.tsx:
- Full blog editor:
  - Title input
  - Slug (auto-generated from title, editable)
  - Rich text content editor (use a lightweight rich text editor like TipTap or similar) with AI Assist button
  - Excerpt (auto-generated from first 160 chars, editable) with AI Assist
  - Hero image upload or Unsplash search
  - Category dropdown
  - Tags input (multi-tag)
  - Author selector (broker dropdown)
  - SEO: custom title, description
  - Status: Draft / Published toggle
  - Published date (auto-set on publish, editable for scheduling)
- "Generate with AI" button: opens panel where admin enters a topic/prompt, AI generates full blog post in brand tone
- Preview button: opens the post as it would appear on the public site

## TASK 11: Content Queue
Create src/app/(admin)/content/queue/page.tsx:
- All AI-generated content pending review
- Each item: type (blog post, social post, listing description, community description), preview, generated date
- Actions: Approve (publishes), Edit (opens editor), Reject (deletes), Regenerate (AI tries again)
- Filter by content type

## TASK 12: Site Content Editor
Create src/app/(admin)/content/site/page.tsx:
- Editable sections: Homepage hero text, homepage section headings, About page content, Footer content
- Each section: current text displayed, "Edit" button opens inline editor with AI Assist
- Preview button shows changes before saving
- All content stored in settings table as key-value pairs

## TASK 13: Settings Pages
Create settings pages under src/app/(admin)/settings/:
- brokerage/page.tsx: name, logo upload, colors, contact info, address, phone, email, business hours
- integrations/page.tsx: status indicators for all integrations (Spark API connected/error, FUB connected, Resend configured, etc). API key fields (masked, with "Update" button). Test connection buttons.
- seo/page.tsx: default meta title template, default meta description template, robots.txt editor, sitemap settings
- audit-log/page.tsx: chronological list of all admin actions (user, action, entity, timestamp). Filter by user, action type, date range.
- background-jobs/page.tsx: list of all Inngest functions with status (active/paused), last run time, next scheduled run, error count. Manual trigger buttons.

## TASK 14: Audit Logging
Create src/lib/audit.ts:
- Function: logAuditEvent(userId: string, action: string, entityType: string, entityId: string, details?: Record<string, any>)
- Inserts into an audit_log table (create migration if not exists): id, user_id, action, entity_type, entity_id, details jsonb, created_at
- Call this function on every admin write operation (create, update, delete)

All admin pages must check the user's admin_role and enforce the Permissions Matrix from Section 31. Use a reusable hook or utility: canAccess(role: string, feature: string): boolean.

TypeScript strict. No any types. Use design system components. Follow brand colors. Admin uses navy sidebar with white/cream content area.
