import { describe, expect, it } from "vitest";

import { checkStreamUrl, streamEmbedUrl } from "@/lib/stream";

const EMBED = "https://www.youtube.com/embed/dQw4w9WgXcQ";

describe("streamEmbedUrl", () => {
  it("reads a watch, live, short or embed link", () => {
    expect(streamEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(EMBED);
    expect(streamEmbedUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(EMBED);
    expect(streamEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(EMBED);
    expect(streamEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90s")).toBe(EMBED);
  });

  it("refuses another site, plain http and anything that is not a video link", () => {
    expect(streamEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(streamEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(streamEmbedUrl("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(streamEmbedUrl("https://www.youtube.com/results?search_query=tennis")).toBeNull();
    expect(streamEmbedUrl("not a url")).toBeNull();
  });

  it("has nothing to show when no link is set", () => {
    expect(streamEmbedUrl(null)).toBeNull();
    expect(streamEmbedUrl("  ")).toBeNull();
  });
});

describe("checkStreamUrl", () => {
  it("accepts a YouTube link and an empty box, and explains a bad link", () => {
    expect(checkStreamUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ ok: true });
    expect(checkStreamUrl("")).toEqual({ ok: true });
    expect(checkStreamUrl("https://vimeo.com/12345")).toMatchObject({ ok: false });
  });
});
