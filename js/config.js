// يومياتنا — shared config & constants
export const FN   = "https://vfyzedlyveukjaukcekq.supabase.co/functions/v1/journal";
export const FN2  = "https://vfyzedlyveukjaukcekq.supabase.co/functions/v1/journal2";
export const FN3  = "https://vfyzedlyveukjaukcekq.supabase.co/functions/v1/journal3";
export const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeXplZGx5dmV1a2phdWtjZWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDU5MjksImV4cCI6MjA4ODAyMTkyOX0.ojqZrTULclfbd_PrU0VCP7E0ylJGLskdi53BUEwiC-w";

// the two people
export const PEOPLE = {
  him: { key: "him", name: "سعيد",  initial: "س", cls: "him" },
  her: { key: "her", name: "ياسمين", initial: "ي", cls: "her" },
};
export const other = (p) => (p === "him" ? "her" : "him");

// moods (label, emoji)
export const MOODS = [
  ["فرح", "😄"], ["حبّ", "❤️"], ["شوق", "🌙"], ["سكينة", "☁️"],
  ["امتنان", "🤲"], ["مشاغب", "😜"], ["حنين", "🕊️"], ["أمل", "✨"],
  ["متعب بس ممنون", "🥲"],
];
export const moodEmoji = (m) => (MOODS.find((x) => x[0] === m) || [null, ""])[1];

// reactions palette
export const REACTIONS = ["❤️", "😍", "😂", "🥹", "🔥", "🌙", "🤲", "👏"];

// milestone badge metadata (Arabic titles + unlock hints)
export const BADGES = {
  first_moment:   { emoji: "🌱", title: "أول لحظة",     hint: "انشرا أول لحظة" },
  ten_moments:    { emoji: "📔", title: "١٠ لحظات",      hint: "١٠ لحظات بينكما" },
  fifty_moments:  { emoji: "📚", title: "٥٠ لحظة",       hint: "٥٠ لحظة بينكما" },
  hundred_moments:{ emoji: "🏆", title: "١٠٠ لحظة",      hint: "١٠٠ لحظة بينكما" },
  first_voice:    { emoji: "🎙️", title: "أول همسة صوتية", hint: "أول تسجيل صوتي" },
  first_song:     { emoji: "🎵", title: "أول أغنية",     hint: "أغنية للحظة" },
  first_month:    { emoji: "🌙", title: "شهرنا الأول",   hint: "٣٠ يومًا معًا" },
  hundred_days:   { emoji: "💯", title: "١٠٠ يوم",       hint: "١٠٠ يوم معًا" },
  one_year:       { emoji: "🎉", title: "سنةٌ كاملة",     hint: "٣٦٥ يومًا معًا" },
  streak_7:       { emoji: "🔥", title: "أسبوع بلا توقّف", hint: "٧ أيام متتالية" },
};

// rotating gentle du'a / faith lines
export const DUA = [
  "اللهم اجعل ما بيننا في رضاك.",
  "اللهم بارك لهما، واجمع بينهما في خير.",
  "اللهم اجعل حبّنا طريقًا إليك.",
  "ربِّ اجعل أيّامنا سكينةً ومودّة.",
];

// du'a to pray FOR each other (kept neutral/plural so it fits either spouse)
export const DUA_FOR_SPOUSE = [
  "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ.",
  "اللهم بارك لنا في بعضنا، واجمع بيننا في خير.",
  "اللهم اجعل حبّنا في رضاك، وطاعتك، وجنّتك.",
  "اللهم احفظ لي شريكي، وأقرّ بنا أعيننا.",
  "اللهم اجعلنا لبعضنا سكنًا ومودّةً ورحمة.",
  "اللهم أصلح لنا ديننا، وبارك لنا في بيتنا ورزقنا.",
  "اللهم اشرح صدورنا، ويسّر أمورنا، واملأ قلوبنا رضا.",
  "اللهم اجعلنا من الذين إذا أُعطوا شكروا، وإذا ابتُلوا صبروا.",
  "اللهم اهدنا واهدِ بنا، واجعلنا سببًا لمن اهتدى.",
  "اللهم اجمعنا في الفردوس الأعلى كما جمعتنا في الدنيا.",
];

export const TZ_OFFSET_MIN = 180; // Asia/Riyadh, for display date math
