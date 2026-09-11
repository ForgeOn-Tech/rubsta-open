import { describe, expect, it } from "vitest";

import { isEntriesAdmin } from "@/lib/access";

const ADMINS = "draws@rubstaopen.local, Organiser@Example.com";

describe("isEntriesAdmin", () => {
  it("matches a listed email regardless of case and spacing", () => {
    expect(isEntriesAdmin("organiser@example.com", ADMINS)).toBe(true);
    expect(isEntriesAdmin(" DRAWS@rubstaopen.local ", ADMINS)).toBe(true);
  });

  it("rejects an email that is not listed", () => {
    expect(isEntriesAdmin("player@example.com", ADMINS)).toBe(false);
  });

  it("rejects everyone when the list is empty", () => {
    expect(isEntriesAdmin("organiser@example.com", "")).toBe(false);
  });

  it("rejects a blank email even when the list has empty items", () => {
    expect(isEntriesAdmin("", "organiser@example.com,,")).toBe(false);
  });
});
