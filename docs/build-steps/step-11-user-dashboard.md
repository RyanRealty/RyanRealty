# Build Step 11: User Dashboard

Scope: User accounts, dashboards, saved homes/searches, notification preferences, design system, tracking.

Build the complete user dashboard at /dashboard:

## TASK 1: Dashboard Layout
Create src/app/(dashboard)/layout.tsx:
- Protected route: middleware redirects to /login if not authenticated
- Left sidebar navigation (collapsible on mobile):
  - Overview (dashboard home)
  - Saved Homes
  - Saved Searches
  - My Collections
  - Viewing History
  - Notifications
  - Settings & Preferences
- Top bar: "Welcome back, [FirstName]" with avatar, notification bell with unread count
- Main content area to the right of sidebar

## TASK 2: Dashboard Overview
Create src/app/(dashboard)/page.tsx:
- Personalized feed based on user activity:
  - "New Matches" — listings matching saved searches since last visit (count badge)
  - "Price Drops on Saved Homes" — any saved listing with a price decrease
  - "Status Changes" — any saved listing that went Pending or Sold
  - "Recommended for You" — listings similar to ones they've viewed/saved (same communities, similar price/beds)
- Each section shows listing cards in a horizontal scroll
- If no activity: "Save some homes or create a search to see personalized updates here."
- Quick stats: X Saved Homes, X Saved Searches, X New Matches This Week

## TASK 3: Saved Homes Page
Create src/app/(dashboard)/saved/page.tsx:
- Fetch all saved_listings for this user with full listing data
- Display as grid of ListingCard components
- Collections: user can organize saves into named collections (default: "All Saved")
  - Tab bar at top showing collection names with counts
  - "Create Collection" button — modal with name input
  - Drag-and-drop or checkbox-select to move listings between collections
- Sort: Date Saved (newest), Price Low-High, Price High-Low
- Each card shows: saved date, any price/status changes since saved (highlighted badge)
- "Remove" button (X) on each card — confirm dialog before removing
- Empty state: "You haven't saved any homes yet. Start browsing!" with link to /search
- Track saved_homes_view event

## TASK 4: Saved Searches Page
Create src/app/(dashboard)/searches/page.tsx:
- Fetch all saved_searches for this user
- Each saved search displayed as a card:
  - Search name (editable inline)
  - Filter summary: "3+ Beds, $400K-$800K, Bend, Active"
  - New match count since last notification (badge)
  - Notification frequency: dropdown to change (Instant, Daily, Weekly, Paused)
  - "View Results" button — links to /search with filters pre-applied
  - "Edit Filters" button — links to /search with filters loaded for editing
  - "Pause" toggle — stops notifications but keeps the search
  - "Delete" button — confirm dialog
- "Create New Search" button — links to /search
- Empty state: "Set up a search and we'll notify you when new homes match."
- Track saved_searches_view event

## TASK 5: Collections Page
Create src/app/(dashboard)/collections/page.tsx:
- List all collections with: name, listing count, cover photo (first listing's hero), created date
- Click collection: shows its listings as a grid
- Share collection: generates a shareable link (/shared/[slug]) and sends via the share system
- Each shared collection page is public (no auth required to view) and shows the listings with the personal message
- Create/edit/delete collections
- Track collection_view, collection_share events

## TASK 6: Viewing History Page
Create src/app/(dashboard)/history/page.tsx:
- Fetch user_activities where activity_type = 'view_listing' for this user
- Display as a chronological list grouped by date
- Each entry: listing card (compact), timestamp, "View Again" link
- Clear history button
- "Listings matching your browsing patterns" section at the top with 4 recommended listings
- Limited to last 100 views
- Track history_view event

## TASK 7: Notification Preferences Page
Create src/app/(dashboard)/notifications/page.tsx:
- Master email toggle: "Email Notifications" on/off
- Per-category toggles:
  - Saved search matches: frequency selector (Instant, Daily, Weekly)
  - Price drop alerts on saved homes: on/off
  - Status change alerts on saved homes: on/off
  - Open house reminders: on/off
  - Market digest: frequency selector (Weekly, Monthly, Off)
  - Blog / content updates: on/off
- Push notification toggle (if PWA push is enabled)
- "Unsubscribe from all" link at bottom (required by CAN-SPAM)
- All preferences stored in profiles.notification_preferences jsonb
- Changes save automatically (debounced, with "Saved" confirmation toast)
- Track notification_preferences_update event

## TASK 8: Settings Page
Create src/app/(dashboard)/settings/page.tsx:
- Profile section: first name, last name, email (read-only, linked to auth), phone, avatar upload
- Buyer preferences section:
  - Preferred cities (multi-select)
  - Preferred communities (multi-select)
  - Budget range (min/max)
  - Bedroom preference
  - Bathroom preference
  - Must-haves: checkboxes (Garage, Pool, Waterfront, Mountain View, Single Level, New Construction)
  - Move-in timeline: dropdown (ASAP, 1-3 months, 3-6 months, 6-12 months, Just Browsing)
  - These preferences stored in profiles.buyer_preferences jsonb
  - Used for personalized recommendations and FUB lead context
- Password change section (if using email auth, not social)
- Delete account section: "Delete My Account" button with confirm dialog, explanation of what happens (data is anonymized, saved items removed, FUB contact retained per broker relationship)
- All changes save with explicit "Save" button and success toast
- Track settings_update event

## TASK 9: Auth Modal & Pages
Create src/app/(auth)/login/page.tsx:
- Social auth buttons: "Continue with Google", "Continue with Apple", "Continue with Facebook" (large, full-width buttons)
- Divider: "or"
- Email/password form: email input, password input, "Sign In" button
- "Forgot Password?" link
- "Don't have an account? Sign Up" link
- Branded: Ryan Realty logo, navy/cream colors
- After successful auth: redirect to the page they were trying to access (or /dashboard)
- Track login event with method (google, apple, facebook, email)

Create src/app/(auth)/signup/page.tsx:
- Social auth buttons (same as login)
- Divider: "or"
- Email signup form: first name, last name, email, password (with strength indicator), confirm password
- "Create Account" button
- "Already have an account? Sign In" link
- On successful signup:
  - Create profile record in profiles table
  - Push Registration event to FUB
  - Track sign_up event with method
  - Redirect to /dashboard with welcome message

Create src/app/(auth)/forgot-password/page.tsx:
- Email input + "Send Reset Link" button
- Uses Supabase Auth resetPasswordForEmail
- Success state: "Check your email for a reset link"

Create src/components/auth/AuthModal.tsx (client component):
- Reusable modal version of the login/signup flow
- Used when a non-authenticated user tries to save, RSVP, or contact
- Tabs: "Sign In" / "Create Account"
- Same forms as the full pages but in modal layout
- After auth: modal closes and the original action completes automatically (the save goes through, the RSVP submits, etc.)
- This is critical for frictionless lead capture

Create loading.tsx for all dashboard routes.
Create error.tsx for all dashboard routes.

TypeScript strict. No any types. Use design system components. Follow brand colors exactly.
