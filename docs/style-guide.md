# Style guide

The look is a **Taskmaster-style studio**: red curtains, sepia paper, gold picture frames, a typewriter font. Everything should feel like a slightly theatrical, hand-made game show, not a web app. When adding something new, find the closest existing piece below and copy it.

All styling lives in `src/styles.css` (no CSS framework, no CSS-in-JS). The colours are tokens on `:root`. Use the token, not a new hex value.

## 1. The materials

Think of the UI as five physical materials. Every element is made of one of them.

| Material | Used for | Recipe |
|---|---|---|
| **Curtain** (backdrop) | Page background everywhere | `--bg-image` under a dark red tint; `--burgundy-deep` as the fallback colour. Already on `body`; don't paint over it. |
| **Paper** | Buttons, inputs, cards, labels, notices | `background: var(--paper)`, `color: var(--ink)`, `border: 2px solid var(--gold-dark)`, drop shadow |
| **Gold** | The main action, the active choice, the stamp | `--gold-gradient` fill + `--gold-edge` border (see §3) |
| **Gold frame** | Every photo or video on the stage | `border-image: url("./assets/frame.png")` (the `.frame` / `.review .pic` recipe) |
| **Ink on curtain** | Headings and text sitting straight on the backdrop | `--gold-bright` headings, `--fg` body, `--muted` secondary |

Rule of thumb: text never sits on a flat grey or white box. If it needs a surface, it's **paper**. If it's the thing to press, it's **gold**.

## 2. Colour tokens

| Token | Value | Use |
|---|---|---|
| `--burgundy-deep` | `#2a0807` | Fallback backdrop colour |
| `--burgundy` | `#580f0d` | Accent text **on paper**: slot headings, stage-label step name, captions, progress bars |
| `--gold` | `#d9b24c` | `h2`, the `&`, QR borders, preview borders, range sliders |
| `--gold-bright` | `#f3d37a` | `h1`, the big join code, phone headers, "now playing" |
| `--gold-dark` | `#8a6a1f` | The 2px border on every paper element |
| `--gold-edge` | `#7a5a14` | Border of gold buttons; the stamp's ink |
| `--gold-gradient` | `#f3d37a → #d9b24c → #b8902f` | Fill of gold buttons (`.big`, `.active`) |
| `--paper` | `#efe6d2` | Surfaces |
| `--ink` | `#2b1d12` | Text on paper |
| `--fg` | `#f6ecd6` | Body text on the curtain |
| `--muted` | `#c9b48f` | Secondary text on the curtain, labels, link buttons |
| `--ok` | `#9be08a` | Reserved; not used yet. Prefer the gold stamp for "done". |

Colours in use that don't have a token yet. Reuse these exact values, and promote them to tokens if you touch them:

- `#7a6a55`: muted text **on paper** (`.status`, `button .muted`)
- `#6b5a44`: hint text inside a paper slot (`.slot-hint`)
- `#8b7a63`: input placeholder
- `#ff9c8a`: error text (`.error`), always on the curtain
- `#1a0f08`: the dark mat behind framed media

Contrast note: `--muted` is for the dark backdrop only. On paper, use `#7a6a55` / `#6b5a44` instead.

## 3. Components

### Buttons
- **Default** is paper: typewriter font, 2px `--gold-dark` border, 6px radius, a `0 3px 0` hard shadow that "presses in" on `:active` (`translateY(2px)`). Already styled on the bare `button` element, so a plain `<button>` needs no class.
- **Primary** (`.big`): the one main action on a screen (Start a session, Join, Submit). Full-width gold gradient, uppercase, bold. **One per screen.**
- **Selected / active** (`button.active`): the same gold as the primary button, for what's currently on screen or playing (stage steps, tabs, the current track, the backup stage controls). One shared rule, `button.big, button.active`, supplies the gold; adding `active` to any button is all it takes.
- **Link** (`.link`): no chrome, `--muted`, underlined. For quiet or escape actions: Leave session, Disconnect, End session, Back to players, Reset.
- **Icon button** (`.picker .x`, `.picker .lock`): a small paper square next to a row. Always give it an `aria-label`.
- **Disabled**: `opacity: 0.45`, `not-allowed` cursor. Prefer disabling to hiding when the button's position matters (see §5).

### Inputs
Paper background, `--gold-dark` border, 6px radius, full width. Wrap them in a `<label>`: labels are a grid with `--muted` text above the field. Game-code inputs use the typewriter font with wide letter spacing (`0.3em`), uppercase, `maxLength={4}`, `placeholder="ABCD"`, plus a 📷 scan button beside them in a `.row`.

### Cards and panels
- **Player tile** (`.tile`): an index card, 3px radius, **slightly rotated** (`-1deg`, `1.2deg`, `-0.4deg` by position). On hover it straightens, grows 4% and gets a gold ring.
- **Slot** (`.slot`): the phone's paper panel. The heading is `--burgundy`, the hints are `#6b5a44`.
- **Floating label** (`.stage-label`, `.review-name`, `.review-loading`, `.sound-hint`): a paper strip over the stage, typewriter font, centred, with a drop shadow.

### Stamp
`.stamp` is a gold rubber stamp tilted `-4deg`: uppercase, bold, 3px `--gold-edge` border, a translucent gold fill. It's the **one** visual for "done" (✓ Submitted). Don't invent a second "success" style.

### Framed media
Photos and videos on the stage are **always** in the gold frame (`frame.png` as a 9-slice `border-image`). The frame hugs the media's real aspect ratio (`--ratio`, set on load) and grows to the largest size that fits. Never crop the media (`object-fit: contain`). On phones, previews get a simpler 3px `--gold` border instead.

### QR codes
White background, 6px `--gold` border (`--paper` border for the host QR, so the two can't be confused), with a typewriter caption underneath ("Players scan here" / "Host scans here").

## 4. Type

- **Typewriter** (`var(--typewriter)`, Veteran Typewriter): all headings, buttons, captions, labels on the stage, codes and "now playing". This is the show's voice.
- **System sans** (`system-ui`): body text, hints, form labels, errors. It keeps long text readable.
- Headings: `h1` in `--gold-bright` with a `0 2px 0` shadow; `h2` in `--gold`. Normal weight, slight letter spacing (`0.04em`).
- Uppercase + letter spacing is for **short labels only**: the stamp, statuses, the stage step name, primary buttons.
- Codes are huge and spaced out: `5.5rem`, `0.3em` tracking, a gold glow. They have to be readable from the back of the room.
- Numbers that change in place (durations, counts) use `font-variant-numeric: tabular-nums`.

## 5. The three screens

Each screen has its own rules. Know which one you're designing for.

### Stage (`/`: the TV)
- Seen from across a room. Size things in **viewport units** (`vmin`, `vh`, `clamp()`), not px, so they scale with the TV.
- During a reveal the **media is the whole show**: full screen, framed, with nothing but the small paper label at the bottom.
- No visible controls. The backup `.stage-controls` bar only fades in while the mouse moves, and the cursor hides when idle. Keyboard shortcuts mirror the host remote.
- Never show browser media controls on the stage.

### Player phone (`/play`)
- One column, `max-width: 480px`, `gap: 1rem`. Big tap targets (the default button padding is the minimum).
- Always tell the player what state they're in, in plain words ("Not submitted yet", "Submitted and locked").
- Keep the main action (`.big`) near their thumb, and put quiet exits (`.link`) at the bottom.

### Host remote (`/host`)
- Same phone column, but it's a **control panel**: every control keeps its position on every view. Disable controls that don't apply; don't remove them (see the comment in `HostRemote.tsx`).
- `.steps` grids (`.two`, `.three`) for big side-by-side buttons; `.active` shows what the stage is currently showing.
- Header: `🎮 Host remote · CODE` in the typewriter font.

## 6. Motion

- **Hang**: framed media drops in like a picture being hung, with a small overshoot and settle (`@keyframes hang`, ~0.6–0.7s, `cubic-bezier(0.2, 0.9, 0.3, 1.15)`). Stagger pairs by 0.25s.
- **Press**: buttons move down 2px on press and brighten slightly on hover.
- **Fades**: 0.15–0.25s for things appearing and disappearing (controls, photos once loaded).
- Show things only once they're ready. Photos stay invisible until they've loaded, and the review waits for every photo, then reveals them all together.
- Every animation has a `prefers-reduced-motion: reduce` opt-out.

## 7. Icons and copy

**Icons are emoji and Unicode symbols, not an icon library.** Reuse the existing set so each one keeps its meaning:

| Symbol | Meaning |
|---|---|
| 🎮 | Host remote |
| 📺 / 🎵 | Screen tab / Jukebox |
| 📷 | Scan a QR code |
| ◫ | Side by side, review everyone |
| ▶ ⏸ ↺ | Play, pause, restart |
| ← | Back |
| ✕ / × | Close / remove |
| ✓ | Submitted |
| 🔒 🔓 | Locked / may resubmit |
| 🔇 | Sound blocked |
| … | In progress (`Joining…`, `sending…`) |

**Copy voice:**
- Short, friendly and plain; talk to the person ("your video", "Ask the host if you need to change it").
- Sentence case for buttons and headings ("Start a session", "Choose file"). Uppercase only comes from CSS on short labels.
- In-progress labels end in a real ellipsis `…` (not `...`): `Connecting…`, `Submitting…`.
- Errors say what happened and what to do next: "Upload failed. Try again.", "No session found for code ABCD."
- Ask before destructive actions with `confirm()`, and name the consequence ("Remove Sam and their video and photos? They can then rejoin fresh.").

## 8. Writing CSS here

- Add rules to `src/styles.css` under the section they belong to (`main screen: lobby`, `reveal stage`, `phones`, `jukebox`, `review`…), and give a new section a `/* ---- name ---- */` header.
- Plain, short, lowercase-hyphen class names tied to what the thing *is* (`.stamp`, `.slot`, `.tile`), not what it looks like.
- A one-line comment explains *why*, when a rule is doing something clever (the frame sizing, the rotated tiles).
- Use tokens for colour. A new colour needs a reason, and it becomes a token.
- Layout with `display: grid` / `flex` and `gap`; avoid margins between siblings.
- Check each change at phone width (~375px), on a laptop, and on a TV-sized window.
