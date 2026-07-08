/**
 * Declarative guided-tour registry for the admin help system.
 *
 * Adding a tour for a new page:
 *   1. Add `data-tour="some-id"` attributes to the elements you want to
 *      highlight (stable selectors — never class-name selectors).
 *   2. Append a Tour object here with the route(s) it applies to.
 *   That is the whole job. HelpProvider filters steps whose selector matches
 *   nothing (or matches only hidden elements) at runtime, so a tour never
 *   crashes when a section is missing for the current role or viewport.
 *
 * Copy rules: plain English for a broker, sentence case, no jargon,
 * no em-dashes, no semicolons, no exclamation marks.
 */

export type TourStep = { selector: string; title: string; body: string }

export type Tour = {
  id: string
  label: string
  /** Pathnames this tour applies to. Strings match exactly, RegExps test the pathname. */
  routes: (string | RegExp)[]
  steps: TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: 'broker-dashboard-orientation',
    label: 'Your morning view',
    routes: ['/admin/broker-dashboard'],
    steps: [
      {
        selector: '[data-tour="dash-header"]',
        title: 'Start your day here',
        body: 'This is your morning view. Everything that needs your attention today is on this one page. If you see an Everyone and Just me toggle, use it to switch between the whole team and your own book.',
      },
      {
        selector: '[data-tour="dash-kpis"]',
        title: 'Your numbers at a glance',
        body: 'Five live counts: new leads from the last 30 days, follow-ups waiting on you, tasks coming due, calendar items in the next 30 days, and deals in progress. Hover the small info icon on any card for how the number is calculated.',
      },
      {
        selector: '[data-tour="dash-activity-mobile"]',
        title: 'Recent activity',
        body: 'On your phone the dashboard leads with the live feed: new leads, email activity, and website visitors. Tap any person to open their full record.',
      },
      {
        selector: '[data-tour="dash-recent-activity"]',
        title: 'Who did something recently',
        body: 'The most recent activity across your contacts. Click a name to open that person. View all people takes you to the full contacts list.',
      },
      {
        selector: '[data-tour="dash-needs-action"]',
        title: 'Needs your action',
        body: 'Automated follow-ups pause here until you approve them. Press Send to fire the message exactly as previewed, or open the person first if something is blocked or missing.',
      },
      {
        selector: '[data-tour="dash-delivery"]',
        title: 'Are the emails landing',
        body: 'Listing alerts and market reports that look wrong show up here: overdue sends, bounces, and subscribers who never open. Each row says what to do about it and links straight to the person.',
      },
      {
        selector: '[data-tour="dash-deals"]',
        title: 'Active deals',
        body: 'Your transactions in progress with a checklist progress bar and the days until closing. Click a deal to open its full transaction page.',
      },
      {
        selector: '[data-tour="dash-calendar"]',
        title: 'Your calendar',
        body: 'Closings, contract dates, task deadlines, appointments, and synced Google Calendar events for the month, all in one place.',
      },
      {
        selector: '[data-tour="dash-tasks"]',
        title: 'Tasks due',
        body: 'Tasks due today or coming up. Click the person under a task to open their record. All tasks opens the full task list.',
      },
      {
        selector: '[data-tour="dash-clients"]',
        title: 'Clients who need a touch',
        body: 'Active clients sorted so the people you have not talked to in the longest rise to the top. An amber time stamp means it has been more than a week.',
      },
    ],
  },
  {
    id: 'crm-contacts-orientation',
    label: 'Find anyone in your contacts',
    routes: ['/admin/crm'],
    steps: [
      {
        selector: '[data-tour="crm-search"]',
        title: 'Search everything',
        body: 'Type a name, email, or phone number. The list filters as you type across your entire book.',
      },
      {
        selector: '[data-tour="crm-sidebar"]',
        title: 'Lists and stages',
        body: 'All People shows everyone you can see. Below it are smart lists, saved filters that update themselves as people change. Click one to filter the table.',
      },
      {
        selector: '[data-tour="crm-add-person"]',
        title: 'Add a person',
        body: 'The person icon with a plus adds a new contact by hand. You can also add contacts from the New contact page in the CRM menu.',
      },
      {
        selector: '[data-tour="crm-toolbar"]',
        title: 'Columns, scope, and filters',
        body: 'Columns picks which fields the table shows. The scope control switches between brokers. Filters opens the panel where you narrow by stage, tag, source, and more.',
      },
      {
        selector: '[data-tour="crm-table"]',
        title: 'Open a person',
        body: 'Click any row to open that person. Their page has everything: contact info, conversation history, alerts, tasks, and next steps. Use the checkboxes to select several people for a bulk action.',
      },
    ],
  },
  {
    id: 'subscriptions-orientation',
    label: 'Alerts and reports: who gets what',
    routes: ['/admin/crm/subscriptions'],
    steps: [
      {
        selector: '[data-tour="subs-tabs"]',
        title: 'Alerts, reports, and delivery',
        body: 'Listing alerts go to people who asked to hear about new homes. Saved searches belong to signed-in site users. Market reports are the recurring area reports your clients receive. The Delivery tab shows what actually went out, who opened it, and what needs a fix.',
      },
      {
        selector: '[data-tour="subs-filters"]',
        title: 'Find a subscription',
        body: 'Search by name or email, then narrow by status (active or paused) and how often the email goes out.',
      },
      {
        selector: '[data-tour="subs-table"]',
        title: 'Each row is one subscription',
        body: 'You can see what the person is subscribed to, whether it is active, and how they engage: sends, opens, and clicks. The three-dot menu on a row lets you edit the filters, preview the email, pause, resume, or delete.',
      },
    ],
  },
  {
    id: 'person-page-orientation',
    label: 'Everything about one person',
    routes: [/^\/admin\/console\/leads\/\d+$/, /^\/admin\/crm\/\d+$/],
    steps: [
      {
        selector: '[data-tour="person-profile"]',
        title: 'Who they are',
        body: 'Contact details, stage, assigned broker, source, tags, and background notes. Most fields are editable in place. Click a phone or email to reach out.',
      },
      {
        selector: '[data-tour="person-timeline"]',
        title: 'Everything that ever happened',
        body: 'The full history with this person: texts, emails, calls, notes, and website visits, newest first. The compose box at the top sends a real email or text from right here.',
      },
      {
        selector: '[data-tour="person-right-rail"]',
        title: 'Follow-ups, tasks, and their home',
        body: 'Automated follow-up plans, open tasks, appointments, and deals for this person. If they own a home you will see it here with a one-click path to a market analysis.',
      },
      {
        selector: '[data-tour="person-website-activity"]',
        title: 'What they get and what they watch',
        body: 'Newsletter status, listing alerts, market report subscriptions, saved searches, and the homes they viewed on the site. This is where you set up alerts and reports for them.',
      },
    ],
  },
  {
    id: 'inbox-orientation',
    label: 'Work your inbox',
    routes: ['/admin/crm/inbox'],
    steps: [
      {
        selector: '[data-tour="inbox-compose"]',
        title: 'Start a new message',
        body: 'Compose starts a fresh text or email to any contact without leaving the inbox.',
      },
      {
        selector: '[data-tour="inbox-folders"]',
        title: 'Your folders',
        body: 'My Inbox holds conversations assigned to you. Company holds everything else. Inside each: Inbox for open conversations, Sent, Drafts, and Closed for the ones you are done with.',
      },
      {
        selector: '[data-tour="inbox-threads"]',
        title: 'The conversation list',
        body: 'Every conversation in the folder, newest activity first. Unread ones are highlighted. Click one to read it, or use the checkboxes to close or assign several at once.',
      },
      {
        selector: '[data-tour="inbox-reading"]',
        title: 'Read and reply',
        body: 'The full thread with reply boxes for text and email underneath. Send and Close replies and files the conversation in one step. The panel on the right shows who you are talking to.',
      },
    ],
  },
]

function routeMatches(route: string | RegExp, pathname: string): boolean {
  if (typeof route === 'string') return route === pathname
  return route.test(pathname)
}

/** Tours whose route list matches the given pathname. */
export function toursForPathname(pathname: string): Tour[] {
  return TOURS.filter((t) => t.routes.some((r) => routeMatches(r, pathname)))
}
