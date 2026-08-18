// يومياتنا — shared config & constants
export const FN   = "https://vfyzedlyveukjaukcekq.supabase.co/functions/v1/journal";
export const FN2  = "https://vfyzedlyveukjaukcekq.supabase.co/functions/v1/journal2";
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

export const TZ_OFFSET_MIN = 180; // Asia/Riyadh, for display date math

// accent presets (override a handful of tokens). 'default' keeps the built-in palette.
export const ACCENTS = {
  default: { name: "ذهبي",  vars: {} },
  sunset:  { name: "غروب",  vars: { "--sun": "#FF9A3C", "--coral": "#FF5E5B", "--her": "#FF6FA5", "--him": "#7C5CFF", "--lilac": "#C79BFF" } },
  ocean:   { name: "بحر",   vars: { "--sun": "#38C0ED", "--coral": "#2D9CDB", "--mint": "#3FD9A0", "--him": "#2D5BFF", "--her": "#00B8A9" } },
  rose:    { name: "وردي",  vars: { "--sun": "#FFB0C7", "--coral": "#FF5D8F", "--her": "#FF5D8F", "--him": "#9B7EDE", "--lilac": "#E0A9FF" } },
  forest:  { name: "غابة",  vars: { "--sun": "#A9C74A", "--mint": "#4CAF7D", "--coral": "#E07A3F", "--olive": "#5E7524", "--him": "#3E8E7E" } },
  berry:   { name: "توت",   vars: { "--sun": "#FF6B9D", "--coral": "#C9184A", "--her": "#FF4D6D", "--him": "#7B2CBF", "--lilac": "#E0AAFF" } },
  night:   { name: "ليل",   vars: { "--sun": "#8AB4F8", "--coral": "#F28B82", "--mint": "#81C995", "--him": "#8AB4F8", "--her": "#C58AF9", "--lilac": "#C58AF9" } },
};
