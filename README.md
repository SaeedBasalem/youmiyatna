# يومياتنا · Our Diary

A private, playful journal book for two — **Saeed & Yasmin**. Written to be a
calm night-sky book you open, flip through with a real page-turn sound, and fill
with your own moments.

## How it works
The site is **fully client-side**. There is no server: the book lives as **JSON**
in your browser (`localStorage`), and can be exported / imported as `data.json`.

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `css/style.css` | Theme, book shape, animations |
| `js/app.js` | All logic (JSON storage, page flip, sound, add-memory) |
| `data/seed.json` | First-run content (the dedication) |

## Opening it
- **Unlock keyword:** `20011998`
- Open `index.html` directly, or serve the folder (recommended) and visit it:
  ```bash
  python -m http.server 8000   # then open http://localhost:8000
  ```
  Serving over `http://` lets `data/seed.json` load on first run; opening the raw
  file still works via a built-in fallback.

## Features in this first update
- 🎨 Refined night-sky palette, gold accents, leather-cover lock screen
- 📖 3D page-turn animation with a generated **paper-flip sound** (mute with 🔇)
- ✨ **Playful add-memory** flow — mood picker, photo, and a sparkle burst
- 💾 **Export / Import** the whole journal as `data.json` (backup or move devices)

## Notes
Data is per-browser. To carry memories to another device, use **⬇ export** then
**⬆ import** the `data.json` file.
