# 2026-10-15 (Cursor, appointment PT timezone)

Surface: Cursor cloud. Branch `cursor/appointment-pt-timezone-1d6c`.

## Landed
Appointment times store true UTC instants and display in America/Los_Angeles.
A 10am PT booking at 17:00Z prints 10am in the invite and on the calendar.
Admin datetime-local writes go through `zonedInstant`. Vault all-day rows
9-43 and 46-51 shifted from midnight UTC to midnight PT. Id 52 not touched.
No emails sent.

## Next
PR auto-merge, production READY, live URL check.

## Held
Do not email Leslie or anyone else.

Skills read: crm-up-to-snuff, DATABASE_FOR_AI_AGENTS.md (crm_appointments).
