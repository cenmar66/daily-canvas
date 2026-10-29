# Integrations

Status at a glance:

| Integration | Status | What works |
|---|---|---|
| Google Calendar | Built; needs your Google OAuth client to be configured | See events from chosen calendars; create an event only when you ask; edit or delete a Google event only after a confirm |
| Google Tasks | Built; needs the same Google client | Two-way sync of tasks you link: title, notes, due date (date only), done / not done; optional import of new items |
| ClickUp | Built; needs your ClickUp API token and `0002_clickup.sql` | Brings in today's ClickUp tasks; two-way for linked tasks: title, due date (date only), done; "Add to ClickUp" from any task |
| Sunsama | No direct connection (no public API) | Works through Google Calendar time blocks and the Google Tasks bridge |
| Gmail | Not built (not authorised) | Emails/Calls is a manual tracker |
| Push notifications when the app is closed | Not built | Reminders work while the app is open/installed and running |

None of these have been tested against live Google or ClickUp accounts from the build environment (no credentials there). The logic is covered by unit tests and the routes by typecheck/build; do the manual steps in [TESTING.md](TESTING.md) after setup.

## Google Cloud setup (about 15 minutes)

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project, e.g. "Daily Canvas".
2. **APIs & Services → Library**: enable **Google Calendar API** and **Google Tasks API**.
3. **OAuth consent screen**: User type **External**. App name "The Daily Canvas", your email as support and developer contact. Scopes: add
   - `.../auth/calendar.calendarlist.readonly`
   - `.../auth/calendar.events`
   - `.../auth/tasks`
   - `openid`, `email`
   Add yourself under **Test users**.
   > In "Testing" status Google expires refresh tokens after 7 days, so you'd have to reconnect weekly. For lasting access, click **Publish app** ("In production"). As a personal app with sensitive scopes you'll see an "unverified app" warning when connecting; that's expected for your own app and you can continue past it.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Authorised redirect URIs:
   - `https://YOUR-DOMAIN/api/google/callback`
   - `http://localhost:3000/api/google/callback` (local development)
5. Copy the client ID and secret into Vercel → Project → Settings → Environment Variables as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `ENCRYPTION_KEY` must already be set (Write.ai uses it too). Redeploy.
6. In the planner: Settings → Integrations → **Connect Google Calendar**, then pick calendars. For the bridge, **Allow Google Tasks access**, then choose or create a list.

## Google Calendar

- **Scopes**: `calendar.calendarlist.readonly` (to list your calendars) and `calendar.events` (read events; create/edit/delete only on request). No access to calendar settings or sharing.
- **Reading**: the selected calendars (default: primary) are read for a window around the day you're viewing, refreshed every 5 minutes and when you change days. Recurring events are expanded by Google (`singleEvents=true`). All-day and multi-day events show on each day; timed events are placed by your planner timezone, so DST and travel are handled.
- **Duplicates**: rows are keyed by `calendarId:eventId` (plus the date for multi-day events).
- **Cancelled events and invitations you declined** are hidden.
- **Offline**: the last fetched events stay visible, marked as from Google.
- **Creating**: from an appointment ("Move to Google Calendar") or Quick Add ("Also put it on my Google Calendar"), always after a confirm. Event ids are derived from the request, so a retried request can't create a second copy.
- **Editing/deleting**: tap a Google event in Appointments. Changes are sent only after you confirm. Checking off an appointment never touches Google.
- **Expired or revoked access**: the planner refreshes tokens automatically. If Google refuses (revoked, password change, 7-day testing expiry), the tokens are deleted and Settings shows "Reconnect"; everything else keeps working.
- **Disconnect**: revokes the grant at Google and deletes the stored tokens. Planner data stays.

## Google Tasks bridge

- Link a task in its details ("Sync with Google Tasks"), then press **Sync Google Tasks now** in Settings.
- **Export**: linked tasks without a Google id are created in the chosen list.
- **Two-way**: on each sync, for every link the server compares the task's `version` and Google's `updated` stamp with the values stored after the last sync:
  - only ours changed → update Google
  - only Google's changed → update ours (and log a completed/reopened event)
  - both changed to the same thing → just update the markers
  - both changed differently → **conflict**: nothing is overwritten; Settings lets you keep yours or Google's
- **Loop prevention**: after every write both markers are stored, so our own writes never bounce back; imports use deterministic ids so importing twice can't duplicate.
- **Never deletes**: a task deleted in Google marks the link "broken"; your task stays.
- **Import** (optional): new, unfinished items in the list appear in your chosen section on today's page, linked.
- **Field limits**: Google Tasks stores due **dates** only (no time), has no priority, sections, subtasks of ours, or estimates. Those stay local.

## Sunsama

Checked against Sunsama's published help docs (not assumed):

- Sunsama doesn't publish a public API, so there is no direct connection, and The Daily Canvas never scrapes it or uses private endpoints.
- **Calendar time blocks**: when you timebox a task in Sunsama it becomes an event on the Google Calendar you set as "Default for tasks" in Sunsama. Select that calendar in Settings and the blocks show in Appointments (labelled "time block" when they look like Sunsama's; that label is a heuristic based on the calendar/event text). They show times, not Sunsama's task details.
- **Google Tasks**: Sunsama's Google Tasks integration lets you drag tasks in from its Google Tasks panel (manual import). Completing an imported task in Sunsama marks it complete in Google Tasks; the next Daily Canvas sync then ticks it off here. Sunsama notes Google's API doesn't carry due times or stars.

Setup: in Sunsama, connect Google Calendar (choose the calendar for timeboxing) and Google Tasks (same Google account). In The Daily Canvas, select that calendar and the same Tasks list.

What doesn't flow: Sunsama channels, objectives, time estimates, notes made only inside Sunsama, and anything not mirrored to Google.

Future: [`src/lib/canvas/integrations.ts`](../src/lib/canvas/integrations.ts) defines a `TaskAdapter` interface; an official Sunsama API can be added as another `provider` in `canvas_task_links` without changing the planner.

Sources: Sunsama help center (Google Tasks integration, timeboxing and "Choosing your calendar" pages) and Sunsama's public roadmap, checked October 2026.

## ClickUp

Uses ClickUp's public REST API (v2) with your **personal API token**. Not tested against a live ClickUp account from the build environment.

**Setup**
1. Supabase → SQL Editor → run [`supabase/migrations/0002_clickup.sql`](../supabase/migrations/0002_clickup.sql) (safe to re-run).
2. `ENCRYPTION_KEY` must be set in Vercel (the token is AES-GCM encrypted before it is stored).
3. ClickUp → avatar → Settings → **Apps** → **API Token** → Generate/Copy (starts with `pk_`).
4. Planner → Settings → **ClickUp** → paste the token → Connect. Choose the workspace (if you have several), which tasks to bring in, from where, which section, and the list for "Add to ClickUp".

**What happens**
- **Bringing in**: on opening the app, every 5 minutes while it's in view, and on "Sync ClickUp now", open ClickUp tasks that match your rule appear on today's page (default: assigned to you and due today or earlier; also "due today or earlier (anyone's)" or "everything assigned to me"), from the whole workspace, one space, or one list. Subtasks and closed/archived tasks are skipped. Ids are deterministic, so a task is never brought in twice.
- **Two-way for linked tasks**: title, due date (date only; sent as midday in your time zone) and done / not done. Completing uses the list's *closed* status (what ClickUp's checkmark does); reopening uses the list's first *open* status. Custom statuses in between are left alone.
- **Notes**: copied from the ClickUp description once when a task is brought in; never sent back (ClickUp descriptions can carry formatting that plain notes would flatten). "Add to ClickUp" sends the notes once as the new task's description.
- **Add to ClickUp**: turn it on in a task's details; it's created in your chosen list, assigned to you.
- **Same safety rules as Google Tasks**: change markers on both sides (`version` here, `date_updated` there) prevent loops; nothing is ever deleted on either side (a task deleted or archived in ClickUp marks the link "broken" and keeps yours); a task changed in both places since the last sync becomes a conflict you settle in Settings → ClickUp.
- **Disconnect** forgets the token. To revoke it completely, regenerate it in ClickUp → Settings → Apps.
- **Limits**: ClickUp allows about 100 API requests a minute per token; one sync uses a handful. Up to 500 matching tasks and 80 linked tasks are checked per sync.

## Integration health

Settings → Integrations shows last calendar refresh, last Tasks sync, the last error, and an activity log (`canvas_sync_audit`): connect, disconnect, create/update/delete event, list creation, each sync with counts.
