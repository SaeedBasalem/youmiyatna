/* =========================================================
   يومياتنا — Our Diary  ·  local-first, JSON-backed
   Data is stored as JSON in localStorage and can be
   exported / imported as data.json.
   ========================================================= */

/* ---------- config ---------- */
const PASSWORD  = "20011998";           // كلمة الفتح
const DATA_KEY  = "youmiyatna_data";    // localStorage bucket for the JSON book
const GATE_KEY  = "youmiyatna_open";    // session unlock flag
const SEED_URL  = "data/seed.json";     // first-run content

// Fallback used when the seed file can't be fetched (e.g. opened via file://)
const DEFAULT_DATA = {
  meta:{ title:"يومياتنا", version:1 },
  dedication:"إلى ياسمين…\nكتبتُ هذه الصفحات كي لا تضيعَ لحظاتُنا بين الأيّام.\n\n— سعيد",
  reply:"",
  entries:[]
};

/* ---------- tiny helpers ---------- */
const $  = s => document.querySelector(s);
const loader = $("#loader");
function showLoader(v){ loader.classList.toggle("hidden", !v); }
let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200); }
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function uid(){ return "e"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ---------- data layer (JSON) ---------- */
let STATE = { dedication:"", reply:"", entries:[] };

function persist(){ localStorage.setItem(DATA_KEY, JSON.stringify(STATE)); }

async function loadData(){
  const raw = localStorage.getItem(DATA_KEY);
  if(raw){ try{ STATE = JSON.parse(raw); return; }catch(e){/* fall through */} }
  // first run — try the seed file, fall back to the embedded default
  try{
    const res = await fetch(SEED_URL, {cache:"no-store"});
    STATE = res.ok ? await res.json() : DEFAULT_DATA;
  }catch(e){ STATE = DEFAULT_DATA; }
  STATE.entries = STATE.entries || [];
  persist();
}

/* ---------- page-turn SOUND (Web Audio, no files) ---------- */
let AC=null, soundOn = localStorage.getItem("youmiyatna_sound")!=="off";
function audio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==="suspended") AC.resume(); return AC; }
function playPageSound(){
  if(!soundOn) return;
  const ctx=audio(); if(!ctx) return;
  const now=ctx.currentTime, dur=0.3;
  // filtered noise burst = the paper rustle
  const buf=ctx.createBuffer(1, Math.floor(ctx.sampleRate*dur), ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){ const t=i/d.length; d[i]=(Math.random()*2-1)*Math.pow(1-t,2.2); }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=2400; bp.Q.value=0.8;
  const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=800;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.42, now+0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
  src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(ctx.destination);
  src.start(now); src.stop(now+dur);
}
function toggleSound(){
  soundOn=!soundOn;
  localStorage.setItem("youmiyatna_sound", soundOn?"on":"off");
  const b=$("#soundBtn"); if(b) b.textContent = soundOn?"🔊":"🔇";
  if(soundOn) playPageSound();
  toast(soundOn?"الصوت مُفعّل":"الصوت صامت");
}

/* ---------- content model ---------- */
let pages=[]; let idx=0; let flipping=false;
const MOODS=[["فرح","😊"],["حبّ","❤️"],["شوق","🌙"],["سكينة","☁️"],["امتنان","🤲"],["ضحك","😄"],["حنين","🕊️"],["أمل","✨"]];
function moodEmoji(m){ const f=MOODS.find(x=>x[0]===m); return f?f[1]:""; }
function fmtDate(d){ try{ return new Date(d+"T00:00:00").toLocaleDateString("ar",{year:"numeric",month:"long",day:"numeric"}); }catch{ return d; } }

/* ---------- build the pages ---------- */
function buildPages(keepIdx){
  const prev = idx;
  pages=[];
  // 1) dedication
  pages.push(`<div class="page-inner">
    <div class="ded-title">الإهداء</div>
    <div class="ded-body">${esc(STATE.dedication)}</div>
    <div class="ornament">۞ ✦ ۞</div>
  </div>`);
  // 2) her reply
  const hasReply = STATE.reply && STATE.reply.trim();
  pages.push(`<div class="page-inner">
    <div class="ded-title">ردُّها</div>
    <div class="reply-note">مساحةٌ لكِ يا ياسمين — اكتبي ما في قلبكِ.</div>
    ${ hasReply
        ? `<div class="reply-display">${esc(STATE.reply)}</div><div class="ornament">✦</div><button class="btn" id="editReply" style="margin-top:14px">تعديل الرد</button>`
        : `<textarea id="replyBox" rows="7" placeholder="ابدئي هنا…"></textarea><button class="btn gold" id="saveReply" style="margin-top:12px">احفظي ردّكِ</button>` }
  </div>`);
  // 3) moments (or a gentle empty state)
  if(STATE.entries.length===0){
    pages.push(`<div class="page-inner"><div class="empty">
      <div class="em">🌙</div>
      <div>لا لحظاتٍ بعد…<br>اضغط <b style="color:var(--gold)">＋</b> لتكتبَا أوّلَ ذكرى.</div>
    </div></div>`);
  } else {
    for(const e of STATE.entries){
      const who = e.author==="her" ? {c:"her",n:"ياسمين"} : {c:"him",n:"سعيد"};
      pages.push(`<div class="page-inner">
        <div class="m-head">
          <span class="badge ${who.c}">✍ ${who.n}</span>
          <span class="m-date">${fmtDate(e.entry_date)}</span>
        </div>
        ${e.mood?`<div class="m-mood">${moodEmoji(e.mood)}</div>`:""}
        ${e.photo_url?`<img class="m-photo" src="${esc(e.photo_url)}" alt="" loading="lazy">`:""}
        <div class="m-body">${esc(e.body)}</div>
        <button class="m-del" data-id="${e.id}">حذف</button>
      </div>`);
    }
  }
  idx = keepIdx ? Math.min(prev, pages.length-1) : idx;
  if(idx>=pages.length) idx=pages.length-1;
  if(idx<0) idx=0;
  renderPage();
}

function renderPage(){
  const book=$("#book");
  const total=pages.length;
  book.innerHTML = `<div class="page settle" id="pg">
      <div class="spine"></div>
      ${pages[idx]}
      <div class="page-num">${idx+1} / ${total}</div>
    </div>`;
  $("#prevBtn").disabled = idx===0;
  $("#nextBtn").disabled = idx===total-1;
  // wire per-page controls
  const sr=$("#saveReply"); if(sr) sr.onclick=saveReply;
  const er=$("#editReply"); if(er) er.onclick=()=>{ STATE.reply=""; persist(); buildPages(true); };
  book.querySelectorAll(".m-del").forEach(b=>b.onclick=()=>delEntry(b.dataset.id));
}

/* ---------- the flip (3D + sound) ---------- */
function turn(dir){
  if(flipping) return;
  const ni=idx+dir;
  if(ni<0||ni>=pages.length) return;
  flipping=true;
  playPageSound();

  const book=$("#book");
  // clone the current page as the sheet that lifts away
  const flip=document.createElement("div");
  flip.className="page flip "+(dir>0?"forward":"back");
  flip.innerHTML=`<div class="spine"></div>${pages[idx]}`;
  // reveal the destination page underneath
  idx=ni; renderPage();
  book.appendChild(flip);
  requestAnimationFrame(()=>flip.classList.add("go"));
  setTimeout(()=>{ flip.remove(); flipping=false; }, 640);
}

/* ---------- actions ---------- */
function saveReply(){
  const v=$("#replyBox").value.trim();
  if(!v){ toast("اكتبي شيئًا أولًا"); return; }
  STATE.reply=v; persist(); buildPages(true); toast("حُفِظ ردّكِ 🌙");
}
function delEntry(id){
  if(!confirm("حذف هذه اللحظة؟")) return;
  STATE.entries=STATE.entries.filter(e=>e.id!==id);
  persist();
  if(idx>0) idx--;
  buildPages(true); toast("حُذِفت");
}

/* ---------- lock / gate ---------- */
function openBook(){ $("#lock").classList.add("hidden"); $("#bookWrap").classList.remove("hidden"); $("#tools").classList.remove("hidden"); }
function openLock(){ sessionStorage.removeItem(GATE_KEY); $("#bookWrap").classList.add("hidden"); $("#tools").classList.add("hidden"); $("#lock").classList.remove("hidden"); }

async function unlock(){
  audio(); // create the audio context on this user gesture
  const pass=$("#passInput").value.trim();
  const err=$("#lockErr"); err.textContent="";
  if(pass!==PASSWORD){
    err.textContent="كلمة الفتح غير صحيحة";
    $("#lock .cover").classList.remove("shake"); void $("#lock").offsetWidth;
    $("#lock .cover").classList.add("shake");
    return;
  }
  sessionStorage.setItem(GATE_KEY,"1");
  showLoader(true);
  await loadData();
  showLoader(false);
  playPageSound();
  openBook();
  buildPages();
}

/* ---------- add a moment (playful) ---------- */
let draft={author:"him",mood:"",photo:null};
function todayStr(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

function openAdd(){
  draft={author:"him",mood:"",photo:null};
  const moodsHtml=MOODS.map(m=>`<span class="mood" data-m="${m[0]}">${m[1]} ${m[0]}</span>`).join("");
  const bg=document.createElement("div"); bg.className="modal-bg"; bg.id="addBg";
  bg.innerHTML=`<div class="modal">
    <h3>لحظةٌ جديدة</h3>
    <div class="row">
      <div class="who sel-him" data-who="him">✍ سعيد</div>
      <div class="who" data-who="her">✍ ياسمين</div>
    </div>
    <label class="lbl">ماذا حدث؟</label>
    <textarea id="mBody" rows="5" placeholder="اكتب/اكتبي اللحظة…"></textarea>
    <label class="lbl">الحالة</label>
    <div class="moods" id="mMoods">${moodsHtml}</div>
    <label class="lbl">التاريخ</label>
    <input type="date" id="mDate" value="${todayStr()}">
    <label class="lbl">صورة (اختياري)</label>
    <input type="file" id="mPhoto" accept="image/*">
    <img class="photo-prev" id="mPrev">
    <div class="row" style="margin-top:20px">
      <button class="btn" id="mCancel" style="background:rgba(255,255,255,.06)">إلغاء</button>
      <button class="btn gold" id="mSave">أضِف</button>
    </div>
    <div class="err" id="mErr"></div>
  </div>`;
  document.body.appendChild(bg);
  bg.querySelectorAll(".who").forEach(el=>el.onclick=()=>{
    draft.author=el.dataset.who;
    bg.querySelectorAll(".who").forEach(w=>w.className="who");
    el.classList.add(draft.author==="him"?"sel-him":"sel-her");
  });
  bg.querySelectorAll(".mood").forEach(el=>el.onclick=()=>{
    const was=el.classList.contains("sel");
    bg.querySelectorAll(".mood").forEach(m=>m.classList.remove("sel"));
    if(!was){ el.classList.add("sel"); draft.mood=el.dataset.m; } else draft.mood="";
  });
  bg.querySelector("#mPhoto").onchange=ev=>{
    const f=ev.target.files[0]; if(!f) return;
    const rd=new FileReader(); rd.onload=()=>{ draft.photo=rd.result; const p=bg.querySelector("#mPrev"); p.src=rd.result; p.style.display="block"; }; rd.readAsDataURL(f);
  };
  bg.querySelector("#mCancel").onclick=()=>bg.remove();
  bg.addEventListener("click",e=>{ if(e.target===bg) bg.remove(); });
  bg.querySelector("#mSave").onclick=()=>saveMoment(bg);
}

function saveMoment(bg){
  const body=bg.querySelector("#mBody").value.trim();
  const date=bg.querySelector("#mDate").value||todayStr();
  const err=bg.querySelector("#mErr");
  if(!body && !draft.photo){ err.textContent="اكتب لحظة أو أضِف صورة"; return; }
  const entry={
    id:uid(), author:draft.author, body,
    mood:draft.mood||null, entry_date:date,
    photo_url:draft.photo||null, created_at:new Date().toISOString()
  };
  STATE.entries.push(entry);
  persist();
  bg.remove();
  buildPages();               // rebuild with the new page
  idx=pages.length-1;         // fly to the newest page
  renderPage();
  playPageSound();
  sparkle();
  toast("أُضيفت لحظتكما 🌙");
}
$("#addFab") && ($("#addFab").onclick=openAdd);

/* ---------- sparkle burst ---------- */
function sparkle(){
  const host=$("#spark"); if(!host) return;
  const marks=["✦","❤️","🌙","✨","💫","🤍"];
  const cx=innerWidth/2, cy=innerHeight/2;
  for(let i=0;i<20;i++){
    const s=document.createElement("span");
    s.className="sp"; s.textContent=marks[i%marks.length];
    const ang=Math.random()*Math.PI*2, dist=90+Math.random()*180;
    s.style.left=cx+"px"; s.style.top=cy+"px";
    s.style.setProperty("--dx",(Math.cos(ang)*dist).toFixed(0)+"px");
    s.style.setProperty("--dy",(Math.sin(ang)*dist).toFixed(0)+"px");
    s.style.setProperty("--rot",(Math.random()*540-270).toFixed(0)+"deg");
    s.style.fontSize=(16+Math.random()*16)+"px";
    host.appendChild(s);
    setTimeout(()=>s.remove(),1200);
  }
}

/* ---------- export / import the JSON book ---------- */
function exportJSON(){
  const blob=new Blob([JSON.stringify(STATE,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="data.json"; a.click();
  URL.revokeObjectURL(a.href);
  toast("تم تنزيل نسخة JSON 📄");
}
function importJSON(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
  inp.onchange=ev=>{
    const f=ev.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const obj=JSON.parse(rd.result);
      STATE={dedication:obj.dedication||"", reply:obj.reply||"", entries:obj.entries||[], meta:obj.meta};
      persist(); buildPages(); idx=0; renderPage(); toast("تم استيراد اليوميات ✓");
    }catch(e){ toast("ملف JSON غير صالح"); } };
    rd.readAsText(f);
  };
  inp.click();
}

/* ---------- starfield ---------- */
(function(){
  const c=$("#stars"), x=c.getContext("2d"); let stars=[],w,h;
  function size(){ w=c.width=innerWidth; h=c.height=innerHeight;
    const n=Math.min(160,Math.floor(w*h/9000)); stars=[];
    for(let i=0;i<n;i++)stars.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+.3,t:Math.random()*Math.PI*2,s:Math.random()*.02+.005});
  }
  function draw(){ x.clearRect(0,0,w,h);
    for(const st of stars){ st.t+=st.s; const a=.4+Math.sin(st.t)*.4;
      x.beginPath(); x.arc(st.x,st.y,st.r,0,7); x.fillStyle="rgba(220,232,255,"+a+")"; x.fill();
      if(st.r>1.2){ x.beginPath(); x.arc(st.x,st.y,st.r*2.4,0,7); x.fillStyle="rgba(160,190,255,"+a*.12+")"; x.fill(); }
    }
    requestAnimationFrame(draw);
  }
  addEventListener("resize",size); size(); draw();
})();

/* ---------- wiring ---------- */
$("#unlockBtn").onclick=unlock;
$("#passInput").addEventListener("keydown",e=>{ if(e.key==="Enter") unlock(); });
$("#prevBtn").onclick=()=>turn(-1);
$("#nextBtn").onclick=()=>turn(1);
$("#soundBtn").onclick=toggleSound;
$("#exportBtn").onclick=exportJSON;
$("#importBtn").onclick=importJSON;
$("#soundBtn").textContent = soundOn?"🔊":"🔇";

// swipe (RTL aware)
let sx=0;
document.addEventListener("touchstart",e=>sx=e.touches[0].clientX,{passive:true});
document.addEventListener("touchend",e=>{
  if($("#bookWrap").classList.contains("hidden")) return;
  const dx=e.changedTouches[0].clientX-sx;
  if(Math.abs(dx)<55) return;
  if(dx<0) turn(-1); else turn(1);
});
document.addEventListener("keydown",e=>{
  if($("#bookWrap").classList.contains("hidden")) return;
  if(e.key==="ArrowLeft") turn(1);
  if(e.key==="ArrowRight") turn(-1);
});

/* ---------- boot ---------- */
(async function(){
  if(sessionStorage.getItem(GATE_KEY)){
    await loadData();
    openBook();
    buildPages();
  } else {
    openLock();
  }
})();
