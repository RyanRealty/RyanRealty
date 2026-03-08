export default function DashboardNotificationsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        The notification center will show system-generated alerts: sync failures, API auth failures, hot leads crossing threshold, content queue backup, data quality issues, and weekly summaries. Notifications can be delivered in-app, by email, or SMS with per-type toggles.
      </p>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-500">No notifications yet. Alert wiring (sync failure, API health, etc.) is coming in a follow-up.</p>
      </div>
    </div>
  )
}
