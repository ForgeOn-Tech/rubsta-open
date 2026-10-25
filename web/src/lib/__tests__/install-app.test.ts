import { describe, expect, it } from "vitest";

import { installMode, isIos } from "@/lib/install-app";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

describe("isIos", () => {
  it("knows an iPhone, and an iPad that reports a Mac user agent", () => {
    expect(isIos(IPHONE, 5)).toBe(true);
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
  });

  it("does not take a Mac without a touch screen, or Android, for iOS", () => {
    expect(isIos(IPAD_AS_MAC, 0)).toBe(false);
    expect(isIos(ANDROID, 5)).toBe(false);
  });
});

describe("installMode", () => {
  it("offers nothing once the app runs from the home screen", () => {
    expect(installMode({ standalone: true, canPrompt: true, ios: true })).toBe("installed");
  });

  it("uses the browser's install dialog when it offers one", () => {
    expect(installMode({ standalone: false, canPrompt: true, ios: false })).toBe("prompt");
  });

  it("shows the Share-menu steps on iOS", () => {
    expect(installMode({ standalone: false, canPrompt: false, ios: true })).toBe("ios-steps");
  });

  it("shows nothing where the browser cannot install the app", () => {
    expect(installMode({ standalone: false, canPrompt: false, ios: false })).toBe("unavailable");
  });
});
