import { afterEach, describe, expect, it } from "vitest";
import { isAllowed, maskEmail } from "@/lib/env";

const set = (v: string) => (process.env.ALLOWED_EMAIL = v);
afterEach(() => delete process.env.ALLOWED_EMAIL);

describe("ALLOWED_EMAIL", () => {
  it("matches regardless of case and spaces", () => {
    set("  Cenmar@SparkleRestoration.com ");
    expect(isAllowed("cenmar@sparklerestoration.com")).toBe(true);
    expect(isAllowed("someone@else.com")).toBe(false);
  });
  it("forgives quotes and a pasted name= prefix", () => {
    set('ALLOWED_EMAIL="a@b.com"');
    expect(isAllowed("a@b.com")).toBe(true);
  });
  it("accepts several addresses", () => {
    set("a@b.com, c@d.org");
    expect(isAllowed("c@d.org")).toBe(true);
  });
  it("lets nobody in when unset", () => {
    expect(isAllowed("a@b.com")).toBe(false);
  });
  it("masks an address", () => {
    expect(maskEmail("cenmar@sparklerestoration.com")).toBe("c•••@s•••.com");
  });
});
