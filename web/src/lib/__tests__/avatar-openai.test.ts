// @vitest-environment node
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import { generateAvatar, prepareAvatarPhoto } from "../avatar-openai";

it("decodes uploads, strips metadata and rejects non-image data", async () => {
  const source = await sharp({ create: { width: 32, height: 32, channels: 3, background: "green" } }).jpeg().toBuffer();
  const normalized = await prepareAvatarPhoto(source);
  expect((await sharp(normalized).metadata()).format).toBe("jpeg");
  await expect(prepareAvatarPhoto(Buffer.from("not an image"))).rejects.toThrow();
});

it("sends a server-authenticated edit request and validates the image result", async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "green" } }).png().toBuffer();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: png.toString("base64") }] }));
  const result = await generateAvatar(new Uint8Array([1]), "test-key", fetcher);
  expect((await sharp(Buffer.from(result, "base64")).metadata()).width).toBe(1024);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/images/edits");
  expect(options.headers.Authorization).toBe("Bearer test-key");
  expect(options.body.get("image[]")).toBeInstanceOf(File);
  expect(options.body.get("n")).toBe("1");
});

it("does not retry a provider failure or return its sensitive response", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("private provider details", { status: 429 }));
  await expect(generateAvatar(new Uint8Array([1]), "key", fetcher)).rejects.toThrow("Avatar provider unavailable");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
