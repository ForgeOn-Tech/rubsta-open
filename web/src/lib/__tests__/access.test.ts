import { describe, expect, it } from "vitest";

import { isListedEmail, listedEmails } from "@/lib/access";

const ADMINS = "draws@rubstaopen.local, Organiser@Example.com";

describe("listedEmails", () => {
  it("lists each email once, in lower case, without blanks", () => {
    expect(listedEmails(" Ump@Example.com,,ump@example.com, second@example.com ")).toEqual([
      "ump@example.com",
      "second@example.com",
    ]);
  });

  it("is empty for an empty list", () => {
    expect(listedEmails("")).toEqual([]);
  });
});

describe("isListedEmail", () => {
  it("matches a listed email regardless of case and spacing", () => {
    expect(isListedEmail("organiser@example.com", ADMINS)).toBe(true);
    expect(isListedEmail(" DRAWS@rubstaopen.local ", ADMINS)).toBe(true);
  });

  it("rejects an email that is not listed", () => {
    expect(isListedEmail("player@example.com", ADMINS)).toBe(false);
  });

  it("rejects everyone when the list is empty", () => {
    expect(isListedEmail("organiser@example.com", "")).toBe(false);
  });

  it("rejects a blank email even when the list has empty items", () => {
    expect(isListedEmail("", "organiser@example.com,,")).toBe(false);
  });

  it("does not admit the demo account unless it is listed", () => {
    expect(isListedEmail("demo@rubstaopen.local", ADMINS)).toBe(false);
    expect(isListedEmail("demo@rubstaopen.local", "demo@rubstaopen.local")).toBe(true);
  });
});
