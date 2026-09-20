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
