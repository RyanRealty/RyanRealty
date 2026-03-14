export default function DashboardNotificationsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The notification center will show system-generated alerts: sync failures, API auth failures, hot leads crossing threshold, content queue backup, data quality issues, and weekly summaries. Notifications can be delivered in-app, by email, or SMS with per-type toggles.
      </p>
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">No notifications yet. Alert wiring (sync failure, API health, etc.) is coming in a follow-up.</p>
      </div>
    </div>
  )
}
