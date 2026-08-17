# يومياتنا · a private world for two

A neo-brutalist, playful, **private companion app** for **Saeed & Yasmin** — not just a place to
record the past, but a living space for the relationship: a shared feed, real-time chat, daily
rituals, shared planning, spiritual companionship, on-device AI search, and a garden that grows
with you. Arabic, RTL, with gentle faith touches.

## Open it
- **Unlock keyword:** `20041998` → then tap **سعيد** or **ياسمين** (the device remembers you).
- Serve the folder and visit it:
  ```bash
  python -m http.server 8000     # → http://localhost:8000
  ```
  It talks to a live Supabase backend, so both partners share the same world on any device.

## What's inside
- **البيت (feed)** — shared moments: text, **multi-photo carousels**, **video**, voice notes,
  a song per moment, moods, reactions & love-notes; a "today" strip (daily question + countdown)
  and **"on this day"** flashbacks.
- **همس (chat)** — real-time private chat: text / voice / images, **typing indicator**, **read
  receipts**, unread badge, push on new messages.
- **حياتنا (hub)** →
  - **حكايتنا** timeline · **إنجازاتنا** milestones (days-together, streaks, badges)
  - **طقوسنا** rituals — daily question (revealed once both answer), mood check-ins + calendar,
    gratitude, countdowns
  - **رسائل الغد** — time-capsule letters sealed until a future date
  - **التقويم** — shared calendar/events with reminders · **قوائمنا** — collaborative live lists
  - **روحانياتنا** — shared **tasbeeh** (live), **khatmah** tracker, du'a wall (آمين), Hijri date
  - **حديقتنا** — a living garden that grows with your moments/streak/days
  - **أغنياتنا** — a shared playlist · **بحث** — on-device semantic search + monthly recap + PDF book
- **أنا (me)** — identity, anniversary, notifications, themes (light/dark + 7 accents),
  JSON backup, and an **app-lock** (PIN / biometric).
- **Live presence** across the app ("ياسمين متصلة"), **Web Push** notifications, installable **PWA**
  with offline shell + home-screen shortcuts.

## Privacy-first AI
Semantic **search** and the monthly **recap/letter** run **on-device** (transformers.js / WebLLM,
WebGPU where available). Your text never leaves the device for inference — only the resulting
embedding vector is stored (in your own Supabase, via pgvector).

## Architecture
Build-free **vanilla ES modules** (deploys as a static site, e.g. GitHub Pages). Two Supabase
**edge functions** are the only things that touch the database:
- **`journal`** — core (auth, feed, moments, chat, rituals, plan, media signing, scheduled push).
- **`journal2`** — feature actions (spiritual, playlist, embeddings/search) — shares the same token.

Security: tables are **RLS-locked** (`jn_*` only), the anon key is inert against the DB, auth is a
shared passcode → a signed identity token, media lives in a **private** bucket served via
short-lived signed URLs, and `SECURITY DEFINER` functions are restricted to the service role.
Scheduled notifications (letter unlocks, event/countdown reminders) run via **`pg_cron` + `pg_net`**.

```
index.html · css/style.css · manifest.webmanifest · sw.js
js/  config api store sound ui media realtime push theme appllock
     app  chat rituals letters plan lists spiritual playlist ai garden
```

## Notes
- Set your **anniversary date** in **أنا** to power the days-together counter, garden, and milestones.
- Either partner can post/react as either — a shared world by design; deletes are soft (recoverable).
- Back up anytime with **⬇ نزّلا JSON** in **أنا**.
- **iOS push**: add the app to the home screen first, then enable notifications.
