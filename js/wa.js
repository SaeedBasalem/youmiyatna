// يومياتنا — reading a WhatsApp export.
//
// Exports are not one format. iOS brackets the stamp and Android trails it
// with a dash; Arabic phones write ٢٠٢٤ and ص/م and pepper the line with
// invisible bidi marks; the day and the month swap places depending on where
// the phone was bought. Everything below exists because one of those wrecks
// the file otherwise.
//
// Nothing here talks to the network. The file is read on their own phone, and
// only the rows this returns ever leave it.

// ---- normalisation: make every dialect look like one ----
// Arabic-Indic and extended Arabic-Indic digits become ASCII so a single
// regex can read every locale's stamp; bidi controls are invisible anyway and
// only ever break matching.
const AR_DIGITS = /[٠-٩۰-۹]/g;
const BIDI = /[‎‏‪-‮⁦-⁩؜]/g;
const digit = (c) => String.fromCharCode(((c.charCodeAt(0) - 0x0660) % 16 % 10) + 48);

export function normalize(s) {
  return String(s ?? "")
    .replace(/^﻿/, "")
    .replace(BIDI, "")
    .replace(AR_DIGITS, digit)
    .replace(/[   ]/g, " ")
    .replace(/\r\n?/g, "\n");
}

// [20/5/2024, 9:05:12 ص] name: body      ← iOS
// 20/5/2024, 9:05 ص - name: body         ← Android
// 2024-05-20, 09:05 - name: body         ← some Android locales
const HEAD = /^\[?\s*(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{2,4})\s*[,،]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|ص|م)?\s*\]?\s*(?:[-–—]\s+)?(.*)$/i;
// a sender is short and has no colon of its own; anything else is the system
// talking ("تم تغيير رقم الهاتف", the encryption notice, someone joining)
const SENDER = /^([^:\n]{1,60}?):\s([\s\S]*)$/;

const ATTACH_IOS = /<\s*(?:attached|تم إرفاق|مرفق|مُرفق)\s*:\s*([^>]+?)\s*>/i;
const ATTACH_AND = /^(.*?\.[A-Za-z0-9]{2,5})\s*\((?:file attached|ملف مرفق|ملف مُرفق)\)\s*$/i;
const OMITTED = /(<\s*Media omitted\s*>|<\s*الوسائط مستبعدة\s*>|تم استبعاد الوسائط|(?:image|video|audio|sticker|GIF|document|contact card|Contact card) omitted|صورة ملغاة)/i;

const EXT_KIND = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", heic: "image", gif: "image",
  mp4: "video", mov: "video", "3gp": "video", mkv: "video",
  opus: "audio", m4a: "audio", mp3: "audio", ogg: "audio", aac: "audio", wav: "audio",
  pdf: "doc", docx: "doc", doc: "doc", xlsx: "doc", txt: "doc", vcf: "contact", webp_sticker: "sticker",
};
export const kindOfName = (name) => EXT_KIND[String(name).split(".").pop().toLowerCase()] || "doc";

// ---- the stamp ----
function readHead(line) {
  const m = HEAD.exec(line);
  if (!m) return null;
  return {
    a: Number(m[1]), b: Number(m[2]), c: Number(m[3]),
    h: Number(m[4]), mi: Number(m[5]), s: Number(m[6] || 0),
    ap: (m[7] || "").toLowerCase(), rest: m[8] ?? "",
  };
}

// Day/month order cannot be read from one line. It can be read from a whole
// file: the first number passing 12 anywhere settles it, and when neither ever
// does (a chat that lived inside the first twelve days of months) the Saudi
// reading is the right default.
export function detectOrder(heads) {
  for (const x of heads) { if (x.a > 12 && x.a < 32) return "dmy"; }
  for (const x of heads) { if (x.b > 12 && x.b < 32) return "mdy"; }
  return "dmy";
}

function toStamp(x, order) {
  let y, mo, d;
  if (String(x.a).length === 4) { y = x.a; mo = x.b; d = x.c; }
  else if (order === "mdy") { mo = x.a; d = x.b; y = x.c; }
  else { d = x.a; mo = x.b; y = x.c; }
  if (y < 100) y += 2000;
  if (!(y >= 2000 && y <= 2100) || !(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return null;
  let h = x.h;
  if (x.ap === "pm" || x.ap === "م") { if (h < 12) h += 12; }
  else if (x.ap === "am" || x.ap === "ص") { if (h === 12) h = 0; }
  if (h > 23 || x.mi > 59) return null;
  const p2 = (n) => String(n).padStart(2, "0");
  // the export carries no zone: the numbers are the clock on their phone,
  // which is Riyadh, so the instant is that wall time minus three hours
  const ms = Date.UTC(y, mo - 1, d, h, x.mi, x.s) - 3 * 3600 * 1000;
  if (!Number.isFinite(ms)) return null;
  return { ms, day: y + "-" + p2(mo) + "-" + p2(d), mo, dy: d };
}

// ---- the file ----
export function parseChat(raw, opts = {}) {
  const text = normalize(raw);
  const lines = text.split("\n");
  const heads = [];
  for (const line of lines) { const x = readHead(line); if (x) heads.push(x); }
  const order = opts.order || detectOrder(heads);

  const messages = [];
  let cur = null;
  const push = () => { if (cur) { cur.body = cur.body.replace(/\s+$/, ""); messages.push(cur); cur = null; } };

  for (const line of lines) {
    const x = readHead(line);
    if (!x) {                                   // a continuation of the last one
      if (cur) cur.body += "\n" + line;
      continue;
    }
    const at = toStamp(x, order);
    if (!at) { if (cur) cur.body += "\n" + line; continue; }
    push();
    const sm = SENDER.exec(x.rest);
    cur = sm
      ? { who: sm[1].trim(), body: sm[2], at, system: false }
      : { who: null, body: x.rest, at, system: true };
  }
  push();

  // attachments, after the body is whole — an iOS attachment marker can sit on
  // its own line under the stamp
  for (const m of messages) {
    const b = m.body;
    let name = null;
    const i = ATTACH_IOS.exec(b);
    const a = ATTACH_AND.exec(b.trim());
    if (i) { name = i[1].trim(); m.body = b.replace(ATTACH_IOS, "").trim(); }
    else if (a) { name = a[1].trim(); m.body = ""; }
    if (name) { m.media = name; m.mediaKind = kindOfName(name); }
    else if (OMITTED.test(b)) {
      m.omitted = true;
      // the marker is WhatsApp talking, not either of them: keep it out of
      // the bubble unless they wrote something around it
      const rest = b.replace(OMITTED, "").trim();
      m.body = rest;
    }
  }

  const senders = new Map();
  for (const m of messages) {
    if (m.system || !m.who) continue;
    senders.set(m.who, (senders.get(m.who) || 0) + 1);
  }
  const real = messages.filter((m) => !m.system);
  return {
    order, messages,
    senders: [...senders.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
    stats: {
      total: messages.length,
      system: messages.length - real.length,
      media: messages.filter((m) => m.media).length,
      omitted: messages.filter((m) => m.omitted).length,
      first: real.length ? real[0].at.ms : null,
      last: real.length ? real[real.length - 1].at.ms : null,
      sample: real.slice(0, 3).map((m) => ({ who: m.who, day: m.at.day, body: m.body.slice(0, 60) })),
    },
  };
}

// ---- rows ----
// A key that is the same every time the same export is read, so importing the
// file twice adds nothing the second time, and an import that died halfway can
// simply be run again.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h.toString(36);
}
function keyOf(ms, author, body, media) {
  return ms.toString(36) + "-" + (author || "x") + "-" + fnv1a(body) + fnv1a(String(body.length) + "|" + (media || ""));
}

// `mapping` is {senderName: "him"|"her"|null}. A sender mapped to null is left
// out entirely — a group export can hold people who are not the two of them.
export function toRows(parsed, mapping, opts = {}) {
  const rows = [];
  const seen = new Map();
  for (const m of parsed.messages) {
    if (m.system || !m.who) continue;
    const author = mapping[m.who];
    if (author !== "him" && author !== "her") continue;
    const body = (m.body || "").trim();
    // a message whose only content was a picture WhatsApp did not export is
    // still a thing that happened: keep the row so the day reads truthfully
    if (!body && !m.media && !m.omitted && !opts.keepEmpty) continue;
    let dedupe = keyOf(m.at.ms, author, body, m.media);
    // two identical lines in the same second are two memories, not one
    const n = (seen.get(dedupe) || 0) + 1;
    seen.set(dedupe, n);
    if (n > 1) dedupe += "#" + n;
    rows.push({
      source: "whatsapp", author, body,
      sent_at: new Date(m.at.ms).toISOString(),
      day: m.at.day, mo: m.at.mo, dy: m.at.dy,
      dedupe,
      media: m.media || null,
      meta: m.media ? { kind: m.mediaKind, name: String(m.media).slice(0, 120) } : (m.omitted ? { omitted: true } : {}),
    });
  }
  return rows;
}
