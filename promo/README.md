# Rubsta Open · energetic promo edits

- `exports/rubsta-open-main.mp4`: 32-second main film, 19 scenes.
- `exports/rubsta-open-sponsor.mp4`: 24-second sponsor film, 11 scenes.

Vertical 720 × 1280 at 30 fps, H.264 video and stereo AAC audio. No voiceover. Large on-screen copy carries the story. Original 150 BPM electronic music includes kick, snare, hats, bass, arpeggios, pads and transition sweeps. Audio is normalized to -14 LUFS with a -1 dBTP ceiling.

Editing includes beat-aligned hard cuts, punch zooms, horizontal whip reveals, alternating split-screen strips, diagonal wipes, moving photo crops and kinetic text. The final sponsor call to action holds longer for readability. The existing Manvir action photograph is used; no new footage or external media was needed.

`index.html` provides music-synced playback, scrubbing and downloads. Serve the repository over HTTP and open `/promo/`.

Fan interfaces are illustrative previews, and sponsor placements represent proposed opportunities. Assessment copy avoids unspecified tests, pricing or deliverables. Confirm event-day offerings and partnership packages before publishing.

Edit timing, text and graphics in `film.js`; edit the instrumental in `music.cjs`. Run `node promo/render.cjs` from the repository root to regenerate both exports, music tracks, edit lists and review stills. Requires existing `web/node_modules/playwright`, installed Chromium, FFmpeg and FFprobe. No speech engine, external service, or network access is used beyond a loopback preview server.
