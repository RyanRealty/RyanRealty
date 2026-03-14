# Admin access and first-time login

## How admin access works

- **Login:** Admin uses **Log in with Google** only. No passwords are stored.
- **Roles:** When a user signs in, their **email** is looked up in `admin_roles`. They get the role assigned to that email (superuser, broker, or report_viewer). No approval step—if their email is in the list, they have access.

## Pre-assigned roles (from Print Lookup Details)

- **Matt Ryan** (matt@ryan-realty.com) → **superuser** — full admin access.
- **Rebecca Peterson Ryser** → **broker** — linked to broker profile "Rebecca Peterson Ryser"; email: `RebeccaPeterson@Ryan-Realty.com`.
- **Paul Michael Stevenson** → **broker** — linked to broker profile "Paul Michael Stevenson"; email: `Paul@Ryan-Realty.com`.

## First-time login for Paul and Rebecca

1. Rebecca and Paul use **RebeccaPeterson@Ryan-Realty.com** and **Paul@Ryan-Realty.com** (or the Google account that matches) when signing in.
2. When they go to the site and choose **Log in with Google**, they will already have the **broker** role and access to admin (Dashboard and "My profile" / Brokers).
3. No separate "invite" or approval is required—their emails are already in Admin → Users with the broker role and correct broker profile linked.

## Changing roles or adding users

- **Admin → Users:** Add an email and choose role (report_viewer, broker, or superuser). For broker, select the broker profile. Only the designated superuser can be set as superuser (see `lib/admin.ts`).
- Remove a user with **Remove** (superuser cannot be removed).
