// يومياتنا — generative game content.
// Instead of a fixed list that repeats within a week, each prompt is composed from
// parts, so the pools run to thousands of combinations. Everything drawn is
// remembered per-device, so nothing comes back until its pool is genuinely spent.

const SEEN_KEY = (pool) => "yn_seen_" + pool;
const CAP = 400;   // keep the "already seen" memory bounded

function seen(pool) { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(pool)) || "[]")); } catch { return new Set(); } }
function remember(pool, key) {
  const s = seen(pool); s.add(key);
  const arr = [...s].slice(-CAP);
  try { localStorage.setItem(SEEN_KEY(pool), JSON.stringify(arr)); } catch {}
}
export function resetSeen(pool) { try { localStorage.removeItem(SEEN_KEY(pool)); } catch {} }
export function seenCount(pool) { return seen(pool).size; }

// deterministic hash so a "daily" item is the same on both phones
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }

// Draw an unseen item from a generator. gen(i) must build a candidate from an index.
function draw(pool, gen, total, { seed = null, remember: mark = true } = {}) {
  const s = seen(pool);
  const start = seed != null ? hash(String(seed)) % total : Math.floor(Math.random() * total);
  for (let step = 0; step < total; step++) {
    const cand = gen((start + step) % total);
    const key = typeof cand === "string" ? cand : cand.key || JSON.stringify(cand);
    if (!s.has(key)) { if (mark) remember(pool, key); return cand; }
  }
  resetSeen(pool);                       // the whole pool has been used — begin again
  const cand = gen(start);
  if (mark) remember(pool, typeof cand === "string" ? cand : cand.key || JSON.stringify(cand));
  return cand;
}

/* ============================ parts ============================ */
// Used across several generators, so a small change here widens every pool.
const TIMES = ["اليوم", "هذا الأسبوع", "هذا الشهر", "مؤخرًا", "من زمان", "أول ما تعرّفنا", "في آخر سفرة لنا", "في أصعب يوم مرّ علينا"];
const FEELINGS = ["الطمأنينة", "الفخر", "الامتنان", "الاشتياق", "الفرح", "الأمان", "الدفء", "السكينة", "الحماس", "الرضا"];
const SMALL_THINGS = ["كوب القهوة الصباحي", "رسالة قبل النوم", "ضحكة بلا سبب", "مشوار بعد المغرب", "أكلة تطبخها لنا", "أغنية تشغّلها فجأة", "صمتٌ مريح بيننا", "دعوة بظهر الغيب", "لمسة يد عابرة", "تصبيرة وقت التعب"];
const FUTURES = ["بيتنا بعد خمس سنين", "أول رحلة نخطط لها", "عادة نبدأها معًا", "مشروع صغير نبنيه", "شيء نتعلّمه سوا", "مكان نشيخ فيه معًا", "عيدٌ نقضيه بطريقتنا", "ورد نزرعه في بيتنا"];
const PLACES = ["البحر", "الجبل", "بيت جدّتنا", "شارع نمشي فيه دائمًا", "مقهى نحبّه", "الحرم", "سطح بيتنا", "طريق طويل بالسيارة"];
const QUALITIES = ["صبرك", "لطفك", "كرمك", "هدوءك", "ضحكتك", "حرصك عليّ", "طريقتك في الاعتذار", "قدرتك على المسامحة", "اهتمامك بالتفاصيل", "إيمانك"];
const ACTS = ["نمشي", "نطبخ", "نقرأ", "نصلّي", "نضحك", "نسافر", "نرتّب البيت", "نشرب القهوة", "نسمع أغانينا", "نتصدّق"];

const pick = (arr, i) => arr[i % arr.length];

/* ==================== أوراق الحديث ==================== */
const CONVO_TEMPLATES = [
  (a) => `متى آخر مرة شعرتَ فيها بـ${a.f} بسببي؟`,
  (a) => `ما الشيء الصغير الذي أفعله ويعني لك الكثير — مثل ${a.s}؟`,
  (a) => `كيف تتخيّل ${a.fu}؟`,
  (a) => `لو كان لنا يومٌ كامل في ${a.p}، كيف نقضيه؟`,
  (a) => `ما أكثر ما تحبّه في ${a.q}؟`,
  (a) => `${a.t}، ما اللحظة التي تمنّيت لو تطول؟`,
  (a) => `لو كان علينا أن ${a.ac} كل يوم، ماذا سيتغيّر فينا؟`,
  (a) => `ما الذي جعلك تشعر بـ${a.f} ${a.t}؟`,
  (a) => `أي عادة صغيرة مثل ${a.s} تتمنّى أن تبقى معنا للأبد؟`,
  (a) => `ما الدعوة التي تدعوها لي حين تتذكّرني في ${a.p}؟`,
  (a) => `ما الشيء الذي لم أخبرك به عن ${a.fu} وتودّ لو تعرفه؟`,
  (a) => `كيف أعرف أنك تحتاجني دون أن تقول؟`,
  (a) => `لو وصفتَ ${a.q} بكلمة واحدة، ما هي؟`,
  (a) => `${a.t}، ما الذي جعلك تشعر بالفخر بنا؟`,
];
export function convoCard(opts) {
  const total = CONVO_TEMPLATES.length * TIMES.length * FEELINGS.length;
  return draw("convo", (i) => {
    const t = CONVO_TEMPLATES[i % CONVO_TEMPLATES.length];
    const j = Math.floor(i / CONVO_TEMPLATES.length);
    return t({ t: pick(TIMES, j), f: pick(FEELINGS, j + 1), s: pick(SMALL_THINGS, j + 2), fu: pick(FUTURES, j + 3), p: pick(PLACES, j + 4), q: pick(QUALITIES, j + 5), ac: pick(ACTS, j + 6) });
  }, total, opts);
}

/* ==================== لو خيّروك ==================== */
const WYR_A = ["نعيش سنة في " , "نقضي شهرًا في ", "نصحو كل صباح في ", "نبني بيتنا قرب "];
const WYR_PLACES = ["بيتٍ على البحر", "بيتٍ وسط بستان", "مدينةٍ لا تنام", "قريةٍ هادئة", "جبلٍ بارد", "حيٍّ قديم فيه ذكرياتنا", "بيتٍ قريب من الحرم"];
const WYR_EXP = ["نتعلّم لغة جديدة معًا", "نحفظ جزءًا من القرآن معًا", "نبدأ مشروعًا صغيرًا معًا", "نتقن الطبخ معًا", "نمشي كل مساء معًا", "نكتب مذكّراتنا كل ليلة", "نصوّر لحظاتنا فيديو كل أسبوع", "نتصدّق كل أسبوع بشيء يسير"];
const WYR_GIFT = ["هدية بسيطة كل أسبوع", "هدية كبيرة مرة في السنة", "رسالة مكتوبة بخط اليد كل شهر", "مفاجأة لا تعرف موعدها"];
export function wouldYouRather(opts) {
  const total = WYR_PLACES.length * WYR_PLACES.length + WYR_EXP.length * WYR_EXP.length + WYR_GIFT.length * WYR_GIFT.length;
  return draw("wyr", (i) => {
    const zone = i % 3;
    const k = Math.floor(i / 3);
    if (zone === 0) {
      const a = pick(WYR_PLACES, k), b = pick(WYR_PLACES, k + 1 + (k % 3));
      return { a: pick(WYR_A, k) + a, b: pick(WYR_A, k) + b, key: "p" + a + b };
    }
    if (zone === 1) {
      const a = pick(WYR_EXP, k), b = pick(WYR_EXP, k + 1 + (k % 5));
      return { a, b, key: "e" + a + b };
    }
    const a = pick(WYR_GIFT, k), b = pick(WYR_GIFT, k + 1 + (k % 2));
    return { a, b, key: "g" + a + b };
  }, Math.max(total, 60), opts);
}

/* ==================== هذا أو ذاك ==================== */
const TOT_PAIRS = [
  ["قهوة", "شاي"], ["بحر", "جبل"], ["ليل", "نهار"], ["صيف", "شتاء"], ["سفر", "بيت"],
  ["مطعم", "طبخ البيت"], ["فيلم", "مسلسل"], ["مدينة", "قرية"], ["حلو", "حادق"], ["مطر", "شمس"],
  ["كتاب", "بودكاست"], ["نوم بدري", "سهر"], ["ذهب", "فضة"], ["ورد", "شوكولاتة"], ["مغامرة", "هدوء"],
  ["مفاجأة", "تخطيط"], ["دراجة", "مشي"], ["مكة", "المدينة"], ["ضحك", "دلع"], ["رسالة", "مكالمة"],
  ["صباح هادئ", "مساء صاخب"], ["صورة", "فيديو"], ["عطر خفيف", "عطر ثقيل"], ["بيت كبير", "بيت دافئ"],
  ["خطة مرتبة", "يوم عفوي"], ["شتاء بمطر", "شتاء بشمس"], ["قعدة أهل", "قعدة ثنائية"], ["حلا بارد", "حلا ساخن"],
];
export function thisOrThat(opts) {
  return draw("tot", (i) => { const p = TOT_PAIRS[i % TOT_PAIRS.length]; return { a: p[0], b: p[1], key: p.join("|") }; }, TOT_PAIRS.length, opts);
}

/* ==================== عجلة السهرة ==================== */
const DATE_VERB = ["نطبخ", "نجرّب", "نرتّب", "نخطّط لـ", "نتعلّم", "نشاهد", "نمشي في", "نقرأ"];
const DATE_OBJ = ["أكلة جديدة", "حلا بسيط", "ألبوم صورنا", "سفرتنا القادمة", "شيء جديد سوا", "فيلم قديم نحبه", "شارع لم نمشِ فيه", "صفحات من كتاب واحد", "قائمة أمنياتنا", "ركن في البيت نغيّره"];
const DATE_TWIST = ["على ضوء الشموع 🕯️", "بلا جوّالات 📵", "مع أغانينا 🎵", "على السطح 🌙", "مع قهوة الليل ☕", "ونحن نضحك بلا سبب 😄", "ونختمها بدعاء 🤲", "بمفاجأة صغيرة 🎁"];
export function dateIdea(opts) {
  const total = DATE_VERB.length * DATE_OBJ.length * DATE_TWIST.length;
  return draw("date", (i) => {
    const v = pick(DATE_VERB, i), o = pick(DATE_OBJ, Math.floor(i / DATE_VERB.length)), t = pick(DATE_TWIST, Math.floor(i / (DATE_VERB.length * DATE_OBJ.length)));
    return v + " " + o + " " + t;
  }, total, opts);
}

/* ==================== كم تعرفني؟ ==================== */
const KNOW_SUBJ = ["أكلتي المفضّلة", "لوني المفضّل", "أكثر ما يفرّحني", "أكثر ما يزعّلني", "مشروبي الثابت", "وقتي المفضّل في اليوم", "أغنيتي هذه الأيام", "حلمي الذي أكرّره", "خوفي الصغير", "أكثر عادة عندي تضحكك", "أول ما ألاحظه في الناس", "ما يريّحني حين أتعب", "المكان الذي أرتاح فيه", "الهدية التي تسعدني", "الكلمة التي أحب سماعها"];
export function knowMe(opts) {
  const frames = ["ما ", "خمّن: ما ", "بدون تفكير — ما "];
  const total = KNOW_SUBJ.length * frames.length;
  return draw("knowme", (i) => pick(frames, Math.floor(i / KNOW_SUBJ.length)) + pick(KNOW_SUBJ, i) + "؟", total, opts);
}

/* ==================== تحدّي الأسبوع ==================== */
const CH_TITLE = ["أسبوع الامتنان", "أسبوع الكلمة الحلوة", "أسبوع بلا شكوى", "أسبوع الدعاء", "أسبوع الذكرى", "أسبوع الاهتمام", "أسبوع الحضور", "أسبوع الأحلام", "أسبوع الصدقة", "أسبوع الهدوء"];
const CH_BODY = [
  (s) => `كل يوم قبل النوم، قولا لبعضكما شيئًا واحدًا شكرتما الله عليه.`,
  (s) => `أرسلا لبعضكما رسالة دلع كل صباح — بدون تكرار كلمة.`,
  (s) => `سبعة أيام نحاول ألّا نتذمّر، ونحوّل كل ملاحظة إلى طلبٍ لطيف.`,
  (s) => `كل ليلة ادعُ لشريكك بدعوة من قلبك، واحكها بصوت.`,
  (s) => `شاركا كل يوم ذكرى صغيرة جمعتكما ونسيتماها.`,
  (s) => `كل يوم افعلا لبعضكما شيئًا صغيرًا بلا طلب — مثل ${s}.`,
  (s) => `نصف ساعة كل مساء بلا جوّالات: حديثٌ وعيون فقط.`,
  (s) => `كل يوم احكيا عن حلمٍ لكما، وخطوة صغيرة نحوه.`,
  (s) => `تصدّقا كل يوم بشيء يسير، ولو بابتسامة.`,
  (s) => `اجعلا صوتكما أهدأ هذا الأسبوع، وجرّبا الصمت الجميل.`,
];
export function weeklyChallenge(opts) {
  const total = CH_TITLE.length * CH_BODY.length;
  return draw("challenge", (i) => {
    const t = pick(CH_TITLE, i), b = pick(CH_BODY, Math.floor(i / CH_TITLE.length));
    return { t, d: b(pick(SMALL_THINGS, i)), key: t + "|" + Math.floor(i / CH_TITLE.length) };
  }, total, opts);
}

/* ==================== بادرة اليوم (sweet line) ==================== */
const SWEET_OPEN = [{ m: "لأنك", f: "لأنكِ" }, { m: "يا من", f: "يا من" }, { m: "أنت", f: "أنتِ" }];
const SWEET_BODY = [
  { m: "سكني وطمأنينتي", f: "سكني وطمأنينتي" },
  { m: "أجمل ما اخترت", f: "أجمل ما اخترت" },
  { m: "دعوةٌ استجاب الله لها", f: "دعوةٌ استجاب الله لها" },
  { m: "بيتي الذي أعود إليه", f: "بيتي الذي أعود إليه" },
  { m: "راحتي بعد كل تعب", f: "راحتي بعد كل تعب" },
  { m: "نعمةٌ أشكر الله عليها", f: "نعمةٌ أشكر الله عليها" },
  { m: "أحلى ما في يومي", f: "أحلى ما في يومي" },
  { m: "سببٌ لابتسامتي", f: "سببٌ لابتسامتي" },
];
const SWEET_END = ["صباحك خير 🤍", "الحمد لله على وجودك 🌙", "أحبّك في الله 💛", "بارك الله لي فيك 🤲", "كل يوم أحبّك أكثر 🌹", "قلبي يطمئن بك ✨"];
export function sweetLine(forFem, opts) {
  const total = SWEET_OPEN.length * SWEET_BODY.length * SWEET_END.length;
  return draw("sweet", (i) => {
    const o = pick(SWEET_OPEN, i), b = pick(SWEET_BODY, Math.floor(i / SWEET_OPEN.length)), e = pick(SWEET_END, Math.floor(i / (SWEET_OPEN.length * SWEET_BODY.length)));
    const txt = (forFem ? o.f : o.m) + " " + (forFem ? b.f : b.m) + "… " + e;
    return { text: txt, key: i % total };
  }, total, opts).text;
}

/* ==================== لقطة اليوم (creative prompt) ==================== */
const SHOT_VERB = ["صوّرا", "التقطا صورةً لـ", "سجّلا صوتكما وأنتما تصفان"];
const SHOT_OBJ = ["شيئًا جعلكما تبتسمان اليوم", "أصغر تفصيلٍ أحببتماه", "السماء الآن من نافذتكما", "ركنًا في بيتكما تحبّانه", "كوب قهوتكما", "شيئًا يذكّركما ببعضكما", "لونًا يشبه يومكما", "أثرًا تركه أحدكما للآخر"];
export function shotPrompt(opts) {
  const total = SHOT_VERB.length * SHOT_OBJ.length;
  return draw("shot", (i) => pick(SHOT_VERB, i) + " " + pick(SHOT_OBJ, Math.floor(i / SHOT_VERB.length)) + " 📸", total, opts);
}

/* ==================== خلوة الأسبوع (faith reflection) ==================== */
const KHALWA_SOURCES = [
  { theme: "المودّة والرحمة", source: "﴿وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً﴾ — الروم ٢١" },
  { theme: "حُسن الخُلق", source: "«خيركم خيركم لأهله» — رواه الترمذي" },
  { theme: "العفو والصفح", source: "﴿وَلْيَعْفُوا وَلْيَصْفَحُوا﴾ — النور ٢٢" },
  { theme: "الدعاء لبعضنا", source: "«دعوةٌ بظهر الغيب مستجابة» — رواه مسلم" },
  { theme: "الرفق بالأهل", source: "«واستوصوا بالنساء خيرًا» — متفق عليه" },
  { theme: "الشكر", source: "«لا يشكر اللهَ من لا يشكر الناس» — رواه أبو داود" },
  { theme: "السكينة", source: "﴿لِتَسْكُنُوا إِلَيْهَا﴾ — الروم ٢١" },
  { theme: "النيّة في الإنفاق", source: "«وما أنفقتَ تبتغي به وجه الله» — متفق عليه" },
  { theme: "الصبر الجميل", source: "﴿وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ﴾ — النحل ١٢٧" },
  { theme: "ستر البيوت", source: "«من ستر مسلمًا ستره الله» — متفق عليه" },
];
const KHALWA_Q = [
  "متى شعرتَ بهذا المعنى بيننا آخر مرة؟",
  "ما الذي يبعدنا عنه حين ننشغل؟",
  "كيف نجعله عادةً لا موقفًا؟",
  "أي موقفٍ قريب يذكّرك به؟",
  "ما الخطوة الصغيرة التي تقرّبنا منه؟",
];
const KHALWA_ACT = [
  "عبّرا لبعضكما عن امتنانٍ صادق قبل النوم.",
  "اختارا لطفًا صغيرًا تفعلانه بلا طلب.",
  "سامحا بعضكما عن أمرٍ صغير وابدآ صفحةً جديدة.",
  "ادعُ كلٌّ منكما للآخر في سجوده.",
  "خصّصا نصف ساعة هادئة بلا جوّالات.",
  "تصدّقا معًا بشيءٍ يسير بنيّة بركة بيتكما.",
  "اكتبا ثلاثة أشياء تشكران الله عليها في زواجكما.",
];
export function khalwa(opts) {
  const total = KHALWA_SOURCES.length * KHALWA_Q.length * KHALWA_ACT.length;
  return draw("khalwa", (i) => {
    const s = pick(KHALWA_SOURCES, i);
    const q = pick(KHALWA_Q, Math.floor(i / KHALWA_SOURCES.length));
    const a = pick(KHALWA_ACT, Math.floor(i / (KHALWA_SOURCES.length * KHALWA_Q.length)));
    return { theme: s.theme, source: s.source, prompt: q, action: a, key: i % total };
  }, total, opts);
}

/* ==================== دعوة لشريكك ==================== */
const DUA_OPEN = ["اللهم", "ربِّ", "اللهم يا ودود"];
const DUA_BODY = [
  "بارك لنا في بعضنا واجمع بيننا في خير",
  "اجعل حبّنا في رضاك وطاعتك",
  "احفظ لي شريكي وأقرّ بنا أعيننا",
  "اجعلنا لبعضنا سكنًا ومودّةً ورحمة",
  "أصلح لنا ديننا وبارك لنا في بيتنا",
  "اشرح صدورنا ويسّر أمورنا",
  "اجعلنا من الشاكرين الصابرين",
  "اهدنا واهدِ بنا",
  "اجمعنا في الفردوس الأعلى",
  "ارزقنا ذرّيةً طيّبة تقرّ بها أعيننا",
];
export function duaForSpouse(opts) {
  const total = DUA_OPEN.length * DUA_BODY.length;
  return draw("dua", (i) => pick(DUA_OPEN, i) + " " + pick(DUA_BODY, Math.floor(i / DUA_OPEN.length)) + ".", total, opts);
}
