# Build Step 13: Email System (Resend + Templates)

Scope: Notification architecture, email deliverability, broker tools, FUB integration.

Build the complete email system:

## TASK 1: Resend Client Setup
Create src/lib/resend.ts:
- Import Resend from 'resend'
- Export configured client using RESEND_API_KEY
- Export sendEmail function that wraps resend.emails.send with error handling and Sentry capture
- Export sendBatchEmails for bulk sends
- Default from address: "Ryan Realty <noreply@mail.ryan-realty.com>" (configurable via settings)

## TASK 2: Email Templates (React Email Components)
Create src/lib/email-templates/ directory with these templates using @react-email/components:

welcome.tsx:
- Ryan Realty branded header (logo, navy bar)
- "Welcome to Ryan Realty, [FirstName]!"
- Brief intro about what they can do: save homes, set up search alerts, get market reports
- CTA button: "Start Browsing Homes" (accent color, links to /search)
- Footer: brokerage info, unsubscribe link, Equal Housing logo

saved-search-match.tsx:
- Branded header
- "[X] New Homes Match Your Search"
- Search name and filter summary
- Listing cards (up to 5): photo, price, beds/baths/sqft, address, "View Home" button
- If more than 5: "View All [X] Matches" button
- Footer with manage preferences link and unsubscribe

price-drop.tsx:
- Branded header
- "Price Drop on [Address]"
- Listing photo
- Old price (strikethrough) → New price, savings amount
- "View Updated Listing" button
- Footer

status-change.tsx:
- Branded header
- "[Address] is Now [Pending/Sold]"
- Listing photo with status badge overlay
- If Pending: "This home is under contract. Want to see similar homes?"
- If Sold: "This home sold for $[price]. See what's still available."
- CTA: "Find Similar Homes" linking to search with similar filters
- Footer

open-house-reminder.tsx:
- Branded header
- "Open House Tomorrow: [Address]" (or "Open House in 1 Hour")
- Listing photo, address, date/time
- "Add to Calendar" link
- "Get Directions" link (Google Maps)
- Agent info
- Footer

market-digest.tsx:
- Branded header
- "Your Weekly Market Update"
- Market stats for user's preferred areas: median price with trend, new listings this week, price drops this week
- Top 3 new listings matching their interests
- "View Full Market Report" button
- Footer

shared-collection.tsx:
- Branded header
- "[SenderName] shared some homes with you"
- Personal message (if provided)
- Listing cards (up to 6)
- "View Full Collection" button
- Footer

cma-report.tsx:
- Branded header
- "Your Home Value Report for [Address]"
- Summary: estimated value with range
- "Download Full Report" button (links to PDF)
- Agent info and contact CTA
- Footer

broker-lead-alert.tsx (internal, to brokers):
- Simple, clean format
- "New Lead: [LeadName]"
- Lead details: name, email, phone, source, what they did (saved listing, downloaded CMA, submitted form)
- Listing context if relevant
- "View in Follow Up Boss" link
- "View on Site" link to admin

password-reset.tsx:
- Branded header
- "Reset Your Password"
- Reset link button
- "If you didn't request this, ignore this email."
- Footer

Every template must:
- Be responsive (looks good on desktop and mobile email clients)
- Use inline styles (email clients don't support external CSS)
- Include preheader text (the preview text shown in inbox)
- Include unsubscribe link in footer (CAN-SPAM compliance)
- Include physical mailing address in footer (CAN-SPAM compliance)

## TASK 3: Notification Processor (Inngest Function)
Create inngest/functions/processNotifications.ts:
- Inngest function id: "notifications/process-queue"
- Triggered on cron: every 30 seconds
- Step 1: Query notification_queue where status = 'pending'
- Step 2: Group by user and notification_type
- Step 3: For each user, check their notification_preferences:
  - If frequency is 'instant': process now
  - If frequency is 'daily': check if last_notified_at was more than 24 hours ago. If yes, batch all pending into one email. If no, skip.
  - If frequency is 'weekly': same logic with 7-day window
- Step 4: For instant notifications, send individual emails via Resend
- Step 5: For batched (daily/weekly), combine multiple notifications into a single digest email
- Step 6: Update notification_queue records: status = 'sent', sent_at = now()
- Step 7: On error: update status = 'error', error = message, increment retry count. Retry up to 3 times.
- Deduplicate: don't send multiple notifications about the same listing to the same user within the same batch window

## TASK 4: Email Compose (Admin)
Create src/app/(admin)/email/compose/page.tsx:
- Full email composition interface:
  - To: recipient selector — search FUB contacts by name/email, or select from recent leads, or "All leads in [tag/stage]"
  - Subject line input with AI Assist button
  - Template selector: dropdown of pre-built templates, or "Blank" for freeform
  - Rich text email body editor with AI Assist button
  - Listing picker: search and insert listing cards into the email body
  - Page picker: insert link to any page on the site (listing, community, report)
  - Preview button: shows rendered email as recipient would see it (desktop and mobile previews)
  - "Send Now" button and "Schedule Send" with date/time picker and "Save Draft" button
- AI Email Composition Assistant:
  - "Write with AI" button opens panel
  - Content presets: Introduce Listings, Follow Up, Market Update, Open House Invite, Price Drop Alert, Just Sold Announcement, Neighborhood Guide, Holiday/Seasonal
  - Tone presets: Professional, Friendly, Concise, Enthusiastic, Empathetic, Luxury
  - Context: auto-includes selected listings, recipient name, agent name
  - AI generates full email body and subject line suggestions
  - "Use This" inserts into editor
- On send: record in email_campaigns table, track email_sent event

## TASK 5: Email Campaign History
Create src/app/(admin)/email/campaigns/page.tsx:
- Table of sent campaigns: subject, date sent, recipient count, open rate, click rate, status
- Click row for detailed stats: opens, clicks (by link), bounces, unsubscribes
- Stats updated via Resend webhooks

## TASK 6: Resend Webhook Handler
Create src/app/api/webhooks/resend/route.ts:
- Receives Resend webhook events: delivered, opened, clicked, bounced, complained, unsubscribed
- On open/click: update email_campaigns stats, report to FUB
- On bounce: flag user email in profiles table
- On unsubscribe: update user's notification_preferences to all-off
- Verify webhook signature for security

Register all new Inngest functions in inngest/functions/index.ts.

TypeScript strict. No any types.
