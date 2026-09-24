# Broker onboarding: Google Workspace is the switch

Matt 2026-09-24: "as we add a new broker into Google and they start getting emails from that domain, it's just going to automatically pick them up, automatically file them, automatically create a login for them in the CRM, and all that stuff. It's going to just be fully automated."

His calls the same day: read Google's user list; every active person is a broker (their own files and leads) except shared inboxes; he gets a text for every change. Requirement R-198 (a new broker productive on day one, no hardcoded maps).

## What happens when a person is added in Google Workspace

Within the hour (`/api/cron/workspace-brokers-sync`, minute 17; `lib/data/brokers/workspace-sync.ts`):

1. The Directory is read (Admin SDK, `admin.directory.user.readonly`, the same service account and domain-wide delegation the Gmail sync uses; verified working 2026-09-24).
2. A person with no broker row gets one in `public.brokers`: `crm_slug` (first name, then first name + last initial, then full name), `display_name` (their Google name), `email`, `crm_active` true, `routing_eligible` false, `is_active` false. And a broker login in `admin_roles` (`role` broker, `broker_id`).
3. Matt gets a text naming who was added.

From then on, with no deploy:

- **Sign-in.** They sign in with Google and land in the admin as a broker: their own files, leads, mail and tasks.
- **Mail.** Their mailbox joins the 15-minute Gmail sync and the Vault mail sweep (`getCrmMailboxes()`), and the review walk files their whole mailbox history to deals.
- **Sending.** CRM email they send goes from their own mailbox (`mailboxForSlug()`), never another broker's.
- **Files.** They see Vault files whose broker is their Google name (`lib/brokers/directory.ts`, `dealVisibleToBroker`).
- **Leads.** Leads, conversations and tasks can be assigned to them. A lead assigned to them stays theirs.

Two things stay Matt's call, one switch each: the paid lead rotation (`routing_eligible`, `/admin/crm/settings/brokers`) and the public team page (`is_active`, `/admin/brokers/edit`, after the profile and headshot are filled in). A phone desk and the broker text-agent line need a Twilio number and are set up by hand.

## Shared inboxes

`admin@`, `marketing@` and the usual role addresses (`info@`, `office@`, `transactions@` ...; `SHARED_LOCAL_PARTS` in `lib/brokers/workspace.ts`) are never brokers. Anything else that is not a person: remove its login on the team page (`/admin/crm/settings/team`); the sync records that (`public.workspace_directory`, status `removed`) and never adds it back. Giving the login back by hand clears it.

## When someone leaves

Suspended, archived or deleted in Google: within the hour the login is removed, `crm_active` and `routing_eligible` go false, their mailbox is no longer read, and Matt gets a text. The superuser is never touched. Removal for being absent from Google happens only when the whole Directory was read.

## The directory in code

`lib/brokers/directory.ts` answers the synchronous questions (which files a broker sees, whose mailbox a message came from, may a lead be assigned to this slug). The three founders are seeded there and keep the names their files carry (Rebecca's profile says "Rebecca Ryser Peterson"; her files say "Rebecca Peterson"). Everyone else is loaded from `public.brokers` by `ensureBrokerDirectory()` (`lib/data/brokers/directory.ts`), which every admin request (`getAdminContext`) and every mail cron awaits; it rereads the table at most every five minutes. Until it has loaded, an unknown broker maps to nothing: no files, rather than someone else's.

`?dry=1` on the cron route plans without writing. On 2026-09-24 the plan was: no change (Matt, Paul, Rebecca already set up; admin@ and marketing@ skipped).

**Not covered yet:** a file a new broker opens in SkySlope before the Vault cutover arrives with no broker name (SkySlope agent GUIDs are mapped only for the founders, `SKYSLOPE_BROKER_BY_GUID8`); Matt sees it and assigns the broker from the file header. `?agent=<slug>` attribution links know the founders only (`lib/agent-attribution.ts`).
