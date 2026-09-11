import { describe, expect, it } from "vitest";

import { isAdmin } from "@/lib/access";

const ADMINS = "draws@rubstaopen.local, Organiser@Example.com";

describe("isAdmin", () => {
  it("matches a listed email regardless of case and spacing", () => {
    expect(isAdmin("organiser@example.com", ADMINS)).toBe(true);
    expect(isAdmin(" DRAWS@rubstaopen.local ", ADMINS)).toBe(true);
  });

  it("rejects an email that is not listed", () => {
    expect(isAdmin("player@example.com", ADMINS)).toBe(false);
  });

  it("rejects everyone when the list is empty", () => {
    expect(isAdmin("organiser@example.com", "")).toBe(false);
  });

  it("rejects a blank email even when the list has empty items", () => {
    expect(isAdmin("", "organiser@example.com,,")).toBe(false);
  });

  it("does not admit the demo account unless it is listed", () => {
    expect(isAdmin("demo@rubstaopen.local", ADMINS)).toBe(false);
    expect(isAdmin("demo@rubstaopen.local", "demo@rubstaopen.local")).toBe(true);
  });
});
