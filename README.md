# Before & After

Players join with a 4-letter code (or QR) on their phone. A session has two games that share the same players; the host switches between them (host phone: top of the Screen tab; main screen: "Switch to…" in the lobby), and players' phones always show the active one:

- **Before & After**: each player records a **video**; its first and last frames become their **before** and **after**. The host (not a player) drives the main screen from their phone at `/host` using the same code: before → after → (pause to discuss) → video.
- **Photos**: each player submits one **photo**. The host shows them one at a time (Previous / Next) or everyone at once.

In both games a submission locks until the host unlocks that player. Each game lives in `src/games/<id>/`; `src/games/index.ts` lists what a game provides to the shared screens.

- `/` — main screen (shared display). `/play` — players' phones. `/host` — host remote.
- Firebase: Anonymous Auth, Realtime Database (session state), Storage (media).

## Setup
1. Firebase console: create a project; enable **Authentication → Anonymous**, **Realtime Database**, **Storage**; add a Web app.
2. `cp .env.example .env` and fill it in.
3. `firebase use --add` (select the project), then `firebase deploy --only database,storage` to publish the rules.
4. `npm install && npm run dev`. Phones need to reach the dev server: set `VITE_PUBLIC_URL` to an https tunnel/LAN URL.
5. `npm run deploy` to ship to Hosting.

## Downloading everything
The main screen's **Download all photos & videos** button (hidden until the host taps "Show download button on the main screen" on their phone) zips every submitted file in the browser (one folder per player). Because it fetches the files with JavaScript, the Storage bucket needs a one-time CORS setting. In [Google Cloud Shell](https://console.cloud.google.com/?cloudshell=true) (project `before-and-after-6a096`):

```sh
echo '[{"origin":["https://before-and-after-6a096.web.app","https://before-and-after-6a096.firebaseapp.com","http://localhost:5173"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://before-and-after-6a096.firebasestorage.app --cors-file=cors.json
```

(`cors.json` in this repo has the same content.) Players who were removed from the session are not included.

## Jukebox
Music is **never uploaded or committed**: the main-screen PC reads MP3s straight from a local folder. On the main screen (Chrome/Edge), click **🎵 Choose music folder** once and pick the folder (subfolders are included). The song list is shared with the host phone's **🎵 Jukebox** tab, which has Play/Pause, a Repeat toggle, volume, and tap-to-play. A song plays once (then stops) or repeats until you pause or pick another; it never advances by itself. Music pauses automatically while a video plays. Chrome remembers the folder but may ask for one click to re-grant access after a refresh ("Reconnect music folder"). Avoid picking `Downloads` or your whole home folder itself — Chrome refuses those; a dedicated folder like `C:\Music\BeforeAndAfter` works.
