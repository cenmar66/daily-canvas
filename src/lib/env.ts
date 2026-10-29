// Central place for environment variables so a missing one fails loudly.
/** Exactly what's set in Vercel (the setup check inspects these). */
export const SUPABASE_URL_RAW = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_KEY_RAW = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

// A wrong setting must not break the build or crash pages: fall back to a harmless
// placeholder so the app still deploys and the login page can explain what to fix.
const isUrl = (v: string) => /^https?:\/\/[^\s/]+/.test(v);
export const SUPABASE_URL = isUrl(SUPABASE_URL_RAW) ? SUPABASE_URL_RAW.replace(/\/+$/, "") : "https://not-configured.invalid";
export const SUPABASE_PUBLISHABLE_KEY = SUPABASE_KEY_RAW || "not-configured";

/**
 * The email(s) allowed into the app (server-side only). Forgiving about how the
 * value was typed in Vercel: quotes, a pasted "ALLOWED_EMAIL=" prefix, spaces,
 * capitals, and several addresses separated by commas all work.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .replace(/^\s*ALLOWED_EMAIL\s*=\s*/i, "")
    .split(/[,;\s]+/)
    .map((e) => e.replace(/^["'<]+|["'>]+$/g, "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/** The first allowed email ("" when none is set). */
export function allowedEmail(): string {
  return allowedEmails()[0] ?? "";
}

export function isAllowed(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return !!e && allowedEmails().includes(e);
}

/** "cenmar@example.com" -> "c•••@e•••.com": enough to spot a typo, not enough to reveal the address. */
export function maskEmail(email: string): string {
  const [user, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const name = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}•••@${name.slice(0, 1)}•••${tld}`;
}
