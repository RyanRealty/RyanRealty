---
title: Manage who can sign in to the admin
area: Admin
routes:
  - /admin/users
summary: Grant, change, or remove admin access, and what each role can see.
---

Admin access is controlled from the Users page. Sign-in is with Google, so access is tied to a person's email address.

## The three roles

- **Superuser** sees everything: all brokers' books, analytics, system settings, and this Users page.
- **Broker** sees the daily working surface scoped to their own book: dashboard, contacts, inbox, deals, listings, and their own profile.
- **Report viewer** sees reports only. Useful for a bookkeeper or a partner who needs numbers, not the CRM.

## Grant someone access

1. Go to **Admin, then Users**. Only a superuser can open this page.
2. Enter the person's email address, the same one they use with Google.
3. Pick their role.
4. If the role is broker, link them to their broker profile so their book scopes correctly.
5. Save. They can sign in immediately with Google using that email.

## Change or remove access

- To change a role, enter the same email with the new role and save. The newest entry wins.
- To remove access, delete their row from the roles list. They lose access on their next page load.

## Good to know

- The page also lists registered site users, the people who created accounts on the public website. Those are customers, not admins, and they have no admin access.
- There is no password to manage. If someone loses access to their Google account, removing their row here is the kill switch.
