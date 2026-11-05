import { describe, expect, it } from "vitest";
import { explainGoogleError } from "@/lib/canvas/google-errors";

describe("Google connection problems in plain words", () => {
  it.each([
    ["redirect_uri_mismatch", /cenmar\.org\/api\/google\/callback/],
    ["access_denied", /click Allow/],
    ["scope_missing", /tick every box/],
    ["invalid_client", /GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET/],
    ["ENCRYPTION_KEY is missing or too short.", /Add ENCRYPTION_KEY/],
    ["Google Calendar API has not been used in project 123 before or it is disabled.", /enable Google Calendar API/],
    ["expired", /another tab/],
  ])("%s", (raw, expected) => {
    expect(explainGoogleError(raw)).toMatch(expected);
  });
  it("passes anything unknown through unchanged", () => {
    expect(explainGoogleError("Something odd")).toBe("Something odd");
  });
});
