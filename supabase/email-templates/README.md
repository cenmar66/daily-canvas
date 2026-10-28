# Sign-in email templates

Supabase's standard sign-in email only has a link. On a phone, the link opens the
default browser (e.g. Chrome), not Safari or the Home Screen app. These templates
add the 6-digit code, which can be typed into the sign-in page instead.

In Supabase → Authentication → Emails, paste:

- `magic-link.html` into **Magic Link** (returning sign-ins)
- `confirm-signup.html` into **Confirm signup** (the very first sign-in)

Set the subject of both to "Your Daily Canvas sign-in code", then save each one.
