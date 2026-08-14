# يومياتنا · a private world for two

A neo-brutalist, playful, private space for **Saeed & Yasmin** — a shared feed of moments,
a story timeline with "on this day", a milestones dashboard (days-together, streaks, badges),
reactions & love-notes, and rich media (photos with doodles/stickers, voice notes, a song per
moment). Arabic, RTL, with gentle faith touches.

## Open it
- **Unlock keyword:** `20041998` → then tap **سعيد** or **ياسمين** (the device remembers you).
- Serve the folder and visit it:
  ```bash
  python -m http.server 8000     # → http://localhost:8000
  ```
  It talks to a live Supabase backend, so both partners share the same world on any device.

## How it's built
Build-free **vanilla ES modules** — deploys as a static site (e.g. GitHub Pages) with no pipeline.

| Path | Purpose |
|------|---------|
| `index.html` | shell (fonts + module entry) |
| `css/style.css` | neo-brutalist design system (tokens, components, views) |
| `js/config.js` | constants (endpoint, people, moods, badges, du'a) |
| `js/api.js` | the only network module → the `journal` edge-function gate |
| `js/store.js` | identity, token, prefs, light cache |
| `js/sound.js` | in-browser Web-Audio sound design (no asset files) |
| `js/ui.js` | DOM builder + shared components + confetti/sparkle |
| `js/media.js` | photo downscale (EXIF-stripping), doodle/sticker editor, voice recorder |
| `js/app.js` | hash router + all views + compose |
| `sw.js` · `manifest.webmanifest` | installable PWA + offline shell (network-first) |

## Backend (Supabase)
All data lives in a Supabase project behind an **edge-function gate** (`journal`): the tables are
RLS-locked and only the function (service role) touches them. Auth is the shared passcode →
a signed identity token; media lives in a **private** bucket served via short-lived signed URLs.
The frontend never talks to the database directly.

## Notes
- Set your **anniversary date** in the **أنا** tab to light up the days-together counter and the
  time-based badges. (It's kept separate from the passcode.)
- Either partner can post/react as either — it's a shared world by design; deletes are soft
  (recoverable), never permanent.
- Back up anytime with **⬇ نزّلا JSON** in the **أنا** tab.
