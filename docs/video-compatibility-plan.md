# Video compatibility plan

**Status:** not implemented. Current behavior: the phone's original file is uploaded as-is and played directly by the main screen.

**Trigger to revisit:** a submitted video won't play on the main screen (Chrome on Windows or Mac). The likely cause is an iPhone HEVC `.mov` on a Windows PC without HEVC hardware decode or the "HEVC Video Extensions" package.

**Preferred option if we need to act: #1 (server-side transcode).**

## Background

- Android phones almost always record H.264 MP4, which plays everywhere.
- iPhones record HEVC by default. Chrome on Mac usually plays it; Chrome on Windows depends on the GPU and installed codec packs.
- Safari sometimes converts HEVC to H.264 when a video is picked through a file input. This is unverified for video, so don't rely on it.
- Relevant code: `src/media.ts` (`submitMedia` uploads to `sessions/{code}/{uid}/video-{ts}` and writes the URL to `media/{uid}/video`), `src/MainScreen.tsx` (`Video` component), `src/HostRemote.tsx` (the "Watch the video" button is gated on `media.video`), `storage.rules`.

## Option 1: Transcode on the server (recommended)

A Cloud Function converts every uploaded video to H.264/AAC MP4. The app plays only the converted file.

**Requirements:** Firebase Blaze plan. Cost at party scale is pennies.

**Steps**
1. `firebase init functions` (TypeScript, Node 20). Add `ffmpeg-static` and `fluent-ffmpeg` (or `@ffmpeg-installer/ffmpeg`).
2. Storage-triggered function (`onObjectFinalized`, v2) for paths matching `sessions/{code}/{uid}/video-{ts}` that don't already end in `-web.mp4`:
   - Download to `/tmp`, then run `ffmpeg -i in -c:v libx264 -preset veryfast -crf 23 -vf "scale='min(1280,iw)':-2" -pix_fmt yuv420p -c:a aac -movflags +faststart out.mp4`.
   - Upload as `video-{ts}-web.mp4` with `contentType: video/mp4`, then get a download URL (make one with a download token via `metadata.firebaseStorageDownloadTokens`, or use a signed URL).
   - Write `sessions/{code}/media/{uid}/video` = converted URL and `videoStatus` = `ready` using the Admin SDK (bypasses RTDB rules). On failure, write `videoStatus` = `error`.
3. Function config: memory 2GiB, timeout 540s, `maxInstances` ~5. Set the region to match the bucket.
4. Client changes:
   - `submitMedia` for video: after upload, write `videoStatus: "processing"` to `media/{uid}` and do **not** write `video` (the function does that). Add `videoStatus` to the `Media` type.
   - Phone slot: show "Processing…" while `videoStatus === "processing"`, an error with a retry when `error`, and preview once `ready`.
   - `MainScreen` tile chip: "Video ✓" only when ready. `HostRemote`: disable "Watch the video" until ready and show "video processing…".
5. `storage.rules`: allow the client to write only the `video-{ts}` pattern (as now); the function writes `-web.mp4` through the Admin SDK, so no rule change is needed. `database.rules.json` needs `videoStatus` to be writable by the uid owner only if the client sets `processing`. `media/$uid` already allows this.
6. Optional: delete the original upload after a successful transcode to save storage.
7. Test: HEVC `.mov` from an iPhone, an Android MP4, a portrait video, a 2-minute video, a corrupt file. Measure the latency.

**Alternative:** Google Transcoder API (managed, no ffmpeg bundling). It has more setup (job templates, output bucket, Pub/Sub notification) but doesn't need function memory tuning.

**Trade-offs:** adds a processing wait (about 10–60s per clip), adds a backend and cost, but is the only option that is device- and browser-independent.

## Option 2: Record in the browser instead of the native camera

Replace the video file input with `getUserMedia` + `MediaRecorder`. iOS Safari (14.3+) produces H.264/AAC MP4; Android Chrome produces WebM (VP8/9) or MP4; Chrome desktop plays all of these.

**Steps**
1. New `VideoRecorder` component (full-screen overlay like `QrScannerModal`): request camera and mic (`facingMode: environment`), preview live, Record / Stop, and a max-duration cap (e.g. 60s).
2. Pick a MIME type with `MediaRecorder.isTypeSupported` in preference order `video/mp4;codecs=avc1`, `video/webm;codecs=vp9`, `video/webm`. Use the blob's actual type as the upload `contentType`; keep the `video-{ts}` file name (rules only check `video/.*`).
3. Set a `videoBitsPerSecond` (~2.5 Mbps) to keep uploads small and bound memory.
4. Keep "Choose file" as a best-effort fallback for library videos.
5. Requires https, and needs permission-denied and no-camera handling.

**Trade-offs:** no backend and no cost, but lower quality, no native camera features, memory limits on long clips, and codec output varies by browser version. The browser must stay in the foreground while recording (iOS interrupts on lock or app switch).

## Option 3: Convert on the phone (WebCodecs / ffmpeg.wasm)

Re-encode to H.264 in the browser before upload. **Not recommended:** slow (roughly real-time or worse on a phone), battery-hungry, memory-limited on long clips, and ffmpeg.wasm adds a ~30MB download and needs cross-origin isolation headers. WebCodecs is faster but has no HEVC-decode guarantee on all devices and needs custom demux/mux code. Only consider it if Blaze is off the table *and* option 2 proves unacceptable.

## Option 4: Do nothing, add a graceful fallback

Cheapest. Detect playback failure on the main screen and let the host move on.

**Steps**
1. In `MainScreen`'s `Video`, handle the `error` event and `canPlayType` mismatches; show "This video can't play on this screen" with the player's name.
2. Expose the failure to the host (e.g. write `display.videoError: true`), so the host phone shows "Video can't be played — skip" and a link to open/download the file.
3. Give the phone a link to view the video, so the group can gather around the phone as a last resort.

**Trade-offs:** no infrastructure, but it fails at exactly the wrong moment, and only some clips.

## Decision guide

| Situation | Choose |
| --- | --- |
| Blaze OK, want it to always work | 1 |
| No billing, willing to lose native camera quality | 2 (+ 4 as a safety net) |
| Just seeing whether it's actually a problem | 4 |
| — | 3 is a last resort |
