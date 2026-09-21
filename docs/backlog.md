# Backlog: bugs and enhancements

Status: nothing here is fixed yet. Notes under each item are initial diagnosis or design thoughts, not decisions.

## Bugs

### B1. QR scan button says the browser lacks camera permission (Join and Host pages)
- **Symptom:** tapping 📷 on `/play` and `/host` shows "Couldn't access the camera. Check your browser's camera permission." The photo and video buttons work.
- **Likely cause:** the photo and video buttons use `<input type="file" capture>`, which hands off to the OS camera and needs no page permission or secure context. The QR scanner uses `getUserMedia`, which requires **https** (or localhost) and the browser's camera permission for the site. Testing over `http://<LAN-IP>:5173` would fail exactly this way. In-app browsers (Messenger, etc.) and a previously denied permission can also cause it.
- **To check first:** which URL and browser was the phone using? If it was plain http, test on the deployed https site or a tunnel before changing code.
- **Code:** `src/QrScannerModal.tsx` (the catch replaces every error with the same message).
- **Fix ideas:** show the real error (`NotAllowedError` vs. no `navigator.mediaDevices` on insecure origins vs. `NotFoundError`) and give a clear message for each; hide or disable 📷 when `!window.isSecureContext`; note the fallback (type the code).

### B2. A connected player shows "(away)"
- **Status: resolved by removal.** The `connected` flag and the "(away)" label were dropped entirely (no more `onDisconnect` handler); players can rejoin freely, so presence tracking isn't needed. Notes below are kept for history.
- **Symptom:** a player who is still actively connected shows "(away)" on the main screen.
- **Likely cause:** `joinSession` registers `onDisconnect(...connected).set(false)`, but nothing sets `connected` back to `true` after a reconnect. Any network blip, phone sleep or tab backgrounding flips it to false permanently, and a page refresh that resumes a stored session doesn't call `joinSession` again.
- **Code:** `src/session.ts` (`joinSession`), `src/MainScreen.tsx` (`Tile`).
- **Fix idea:** keep a `.info/connected` listener while a player is on the play page. On every (re)connect, register the `onDisconnect` handler and then set `connected: true`. Also do this on resume. Consider ignoring brief `false` values on the display, or dropping "away" entirely if it isn't useful.

### B3. Video controls must never show on the main screen
- **Status: built (not yet verified live).** The main-screen `<video>` has no controls. The host remote's video panel has Pause/Play, Restart and Back to After, driven by `display.playing` / `display.restartAt`. If Chrome blocks autoplay-with-sound (e.g. after a page refresh with no click), the video starts muted and a hint asks for one click on the main screen to unmute. No rules change needed.
- **Symptom:** the `<video>` on the main screen shows browser controls. The host controls playback from their phone.
- **Code:** `src/MainScreen.tsx` (`Video` component uses `controls`).
- **Fix idea:** remove `controls`. The main-screen player then needs commands from the host remote, so extend the `display` state, for example `videoPlaying: boolean` (and possibly a seek or restart command), and add Play/Pause/Restart buttons to `HostRemote`. The main screen reacts to those values. Watch the rules (`display` is already writable by the controller).
- **Dependency:** Chrome blocks autoplay with sound unless the page has had a user gesture. Today the fallback is a "Play video" overlay button clicked on the main screen, which is the opposite of what we want. Options: a one-time "Click to enable sound" on the main screen at session start (any click unlocks it), or play muted and unmute after the first gesture. Decide this when implementing B3.

## Enhancements

### E1. Side-by-side Before/After view
- **Status: built (not yet verified live).** New `both` step: the host remote shows "Show before & after side by side" on After, and "Watch the video" works from either view. Each frame is sized to fit its half of the screen.
- Add a button (on the host remote, shown once After has been revealed) that shows Before and After next to each other on the main screen.
- **Design:** add a `"both"` step to `Step` (`src/types.ts`); the main screen renders two images in a row, each scaled to fit its half; `HostRemote` adds "Show side by side" while on `after` (and a way back to the individual view, and on to the video).
- Decide the button flow: Before → After → (Side by side) → Video, with "Video" reachable from both `after` and `both`.
- **Files:** `src/types.ts`, `src/MainScreen.tsx` (`Stage`), `src/HostRemote.tsx`.

### E2. Photos and video should fill the main screen
- **Problem:** the images and video use `max-width` / `max-height`, which never scales small images up, and the label and padding eat space.
- **Fix idea:** make the media fill the viewport (`width: 100vw; height: 100vh; object-fit: contain`), overlay the name and step label at low profile so it doesn't take layout space, and check the side-by-side layout from E1 the same way. Consider a full-screen request so browser chrome doesn't take space (Fullscreen API needs a user gesture on the main screen, so pair it with the click in B3 if we add one).
- **Files:** `src/styles.css` (`.stage`, `.stage img`, `.stage video`, `.stage-label`), `src/MainScreen.tsx` (`Stage`).

### E3. Larger player QR code, plus a host QR code until a host connects
- **Status: built (not yet verified live).** Player QR is 300px; the host QR (150px, labelled "Host scans here") shows only while no host remote is connected and reappears after Reset. It opens `/host?code=<CODE>` with the code pre-filled; the host still taps Connect (no auto-connect, on purpose, until the PIN in E4 exists).
- **Player QR:** make it twice as big (currently `size={150}` in `src/MainScreen.tsx`, so 300). Check the lobby header layout still works at that size on a laptop and TV (the 5rem join code sits beside it), and that it stays scannable from across a room.
- **Host QR:** show a second QR code that opens `/host?code=<CODE>` while `session.controllerUid` is unset, and hide it once a host has connected. `HostPage` already reads `?code=` and pre-fills it, but the host still has to tap Connect. Consider auto-connecting when the code comes from the URL. Caveat: while it's displayed, any player could scan it and claim the host slot (see the host-claim gap in the deploy notes), so hiding it as soon as a host connects matters, and a short PIN would close the gap properly.
- **Design:** label the two codes clearly ("Players scan here" / "Host scan here") and make them visually distinct, so nobody scans the wrong one. When Reset is clicked, the host QR should reappear.
- **Files:** `src/MainScreen.tsx`, `src/styles.css` (`.lobby header`), possibly `src/HostPage.tsx` (auto-connect).

### E4. Host PIN, so players can't claim the host remote
- **Problem:** the first phone to open `/host` (or scan the host QR from E3) claims the host slot. A player could take it. Reset on the main screen is only a recovery.
- **Key point:** a PIN shown on the main screen protects nothing, because players see it. The host must choose it privately on the PC.
- **Flow:**
  1. "Start a session" on the main screen gets a PIN field (4–6 digits, chosen by the host, never displayed).
  2. `createSession` stores it at `pins/<code>`, with `.read: false` in `database.rules.json`, writable only by the session's `hostUid`.
  3. `/host` asks for the code plus the PIN. The phone writes the attempt to a write-only path, `pinAttempts/<code>/<uid>` (`.read: false`, writable only by that uid), then writes `controllerUid`.
  4. The `controllerUid` rule requires `pinAttempts/<code>/<auth.uid>` to equal `pins/<code>`, in addition to the existing claim-once check (see the rule sketch below).
  5. Reset clears `controllerUid` only; the same PIN works for the next phone. Clean up the `pins` and `pinAttempts` nodes with the session.
- **Rule sketch (untested):**
  ```json
  "controllerUid": {
    ".write": "auth != null && !data.exists() && newData.val() === auth.uid && root.child('pinAttempts').child($code).child(auth.uid).val() === root.child('pins').child($code).val()"
  }
  ```
- **Limits:** the rules can't rate-limit guesses, so a script could brute-force a 4-digit PIN (10,000 tries). That's acceptable for a party game; use 6 digits for more margin. Existing sessions without a PIN need a decision (require one for all new sessions, and treat a missing PIN as "no claim allowed").
- **Alternative considered:** approve-on-PC (the phone requests, the main screen shows "Approve?"). No secret to manage, but it needs someone at the PC and interrupts the flow more.
- **Related:** E3 (host QR). Do E4 with or before E3 so the host QR isn't shown without protection.
- **Files:** `src/MainScreen.tsx`, `src/session.ts` (`createSession`, `claimController`), `src/HostPage.tsx`, `database.rules.json` (redeploy rules), `src/types.ts`.

### E5. Sound effects
- Add Taskmaster-style audio to the main screen: a sting when a photo is revealed, a different one for the After reveal, and maybe a drumroll or theme when the video starts.
- **Constraint:** Chrome blocks audio until the page has had a user gesture, so the main screen needs a one-time click (for example "Click to enable sound"). Share that click with the autoplay decision in B3 (video with sound) and the full-screen request in E2.
- **Design:** an on/off toggle (mute) on the main screen; short, small files in `src/assets/` (there's already `~/Downloads/Taskmaster.mp3` and `.ogg` locally; check licensing before shipping any show audio); play from `Stage` when `display.step` changes, using `useEffect` keyed on step.
- **Files:** `src/MainScreen.tsx`, a new `src/sound.ts`, `src/assets/`.

### E6. Title-card intro
- A short animated title card ("Before & After" typed out on the typewriter, then fading to the lobby) on the main screen, and possibly a mini card before each player's reveal ("Sam's Before & After").
- **Design:** CSS/JS typewriter effect using the existing Veteran Typewriter font, over the background image; show once per session start (and optionally per player reveal); skippable; respect `prefers-reduced-motion`.
- **Related:** E5 (a typing sound and a sting fit here), E2 (fullscreen).
- **Files:** `src/MainScreen.tsx`, `src/styles.css`.

## Suggested order
B3 (needs the autoplay decision, and E1/E2 touch the same `Stage` code) → E2 → E1 → B2 → B1 (B1 first if it turns out to be a real bug rather than an http test).
