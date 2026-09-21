# Before & After

Players join with a 4-letter code (or QR) on their phone and submit a **before** photo, an **after** photo, and a **video** of what happened in between. The main screen shows the player list; the host (not a player) drives it from their phone at `/host` using the same code: before → after → (pause to discuss) → video.

- `/` — main screen (shared display). `/play` — players' phones. `/host` — host remote.
- Firebase: Anonymous Auth, Realtime Database (session state), Storage (media).

## Setup
1. Firebase console: create a project; enable **Authentication → Anonymous**, **Realtime Database**, **Storage**; add a Web app.
2. `cp .env.example .env` and fill it in.
3. `firebase use --add` (select the project), then `firebase deploy --only database,storage` to publish the rules.
4. `npm install && npm run dev`. Phones need to reach the dev server: set `VITE_PUBLIC_URL` to an https tunnel/LAN URL.
5. `npm run deploy` to ship to Hosting.

## Downloading everything
The main screen's **Download all photos & videos** button zips every submitted file in the browser (one folder per player). Because it fetches the files with JavaScript, the Storage bucket needs a one-time CORS setting. In [Google Cloud Shell](https://console.cloud.google.com/?cloudshell=true) (project `before-and-after-6a096`):

```sh
echo '[{"origin":["https://before-and-after-6a096.web.app","https://before-and-after-6a096.firebaseapp.com","http://localhost:5173"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://before-and-after-6a096.firebasestorage.app --cors-file=cors.json
```

(`cors.json` in this repo has the same content.) Players who were removed from the session are not included.
