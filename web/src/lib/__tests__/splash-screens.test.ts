import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SPLASH_SCREENS, splashImagePath, splashStartupImages } from "@/lib/splash-screens";

const PUBLIC_DIR = path.resolve(__dirname, "../../../public");

describe("splashStartupImages", () => {
  it("matches one iPhone screen exactly, in portrait", () => {
    const [image] = splashStartupImages([{ width: 393, height: 852, ratio: 3 }]);
    expect(image).toEqual({
      url: "/splash/1179x2556.png",
      media:
        "(device-width: 393px) and (device-height: 852px)" +
        " and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    });
  });

  it("returns nothing for no screens", () => {
    expect(splashStartupImages([])).toEqual([]);
  });
});

describe("SPLASH_SCREENS", () => {
  it("lists each screen once", () => {
    const keys = SPLASH_SCREENS.map((screen) => `${screen.width}x${screen.height}@${screen.ratio}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a rendered image in public/ for every screen", () => {
    for (const screen of SPLASH_SCREENS) {
      expect(existsSync(path.join(PUBLIC_DIR, splashImagePath(screen)))).toBe(true);
    }
  });
});
