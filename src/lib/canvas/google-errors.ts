// Plain-language reasons for Google connection problems, with what to do about each.
// Used by Settings for errors from the sign-in round trip and from Calendar/Tasks calls.

const RULES: [RegExp, string][] = [
  [/access_denied/i, "Google access wasn't granted: you cancelled, or your Google Workspace blocked the app. Try again and click Allow on Google's screen."],
  [/scope_missing|insufficient.*(scope|permission)|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i, "Google connected, but calendar access wasn't granted. Connect again and tick every box on Google's permission screen (Google lets you untick them)."],
  [/^expired$/i, "The connection started in another tab or took too long. Try again from this page."],
  [/redirect_uri_mismatch/i, "Google doesn't recognise this address. In Google Cloud → Credentials → your OAuth client, add https://cenmar.org/api/google/callback and https://www.cenmar.org/api/google/callback under Authorized redirect URIs, save, wait a minute, then try again."],
  [/invalid_client|unauthorized_client|client.*(not found|deleted)/i, "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in Vercel doesn't match your Google OAuth client. Copy both again from Google Cloud → Credentials, update them in Vercel, redeploy, then try again."],
  [/invalid_grant/i, "Google's one-time sign-in code expired before it was used. Try connecting again."],
  [/ENCRYPTION_KEY/i, "ENCRYPTION_KEY isn't set in Vercel, so the Google connection can't be stored safely. Add ENCRYPTION_KEY (any long random text, 32+ characters) for Production, redeploy, then connect again."],
  [/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i, "That Google API isn't turned on in your Google Cloud project. Open Google Cloud → APIs & Services → Library, enable Google Calendar API and Google Tasks API, wait a minute, then try again."],
  [/canvas_google_accounts|schema cache/i, "The Google connection table is missing in the database. Run supabase/migrations/0001_daily_canvas.sql in Supabase → SQL Editor."],
  [/GOOGLE_CLIENT_ID|isn't set up on the server/i, "Google isn't set up on the server yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel (Production), then redeploy."],
  [/no_code/i, "Google didn't send a sign-in code back. Try again."],
];

export function explainGoogleError(raw: string): string {
  const hit = RULES.find(([re]) => re.test(raw));
  return hit ? hit[1] : raw;
}
