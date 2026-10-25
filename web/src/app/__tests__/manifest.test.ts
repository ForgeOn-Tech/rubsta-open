import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

const PUBLIC_DIR = path.resolve(__dirname, "../../../public");

describe("manifest", () => {
  it("opens the player home as a standalone app", () => {
    const result = manifest();
    expect(result.start_url).toBe("/home");
    expect(result.display).toBe("standalone");
  });

  it("offers the 192 and 512 icons browsers need to install, plus a maskable one", () => {
    const icons = manifest().icons ?? [];
    const sizes = icons.filter((icon) => icon.purpose === "any").map((icon) => icon.sizes);
    expect(sizes).toEqual(["192x192", "512x512"]);
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("points every icon at a file in public/", () => {
    for (const icon of manifest().icons ?? []) {
      expect(existsSync(path.join(PUBLIC_DIR, icon.src))).toBe(true);
    }
  });
});
