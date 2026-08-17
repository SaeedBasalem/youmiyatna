// يومياتنا — حديقتنا: a living garden that grows with your moments/streak/days.
import { h, clear, arNum } from "./ui.js";
import { api } from "./api.js";

const esc = (s) => String(s);
function flower(x, y, c) {
  return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 15}" stroke="#14110C" stroke-width="2.5"/>` +
    `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#14110C" stroke-width="2.5"/>` +
    `<circle cx="${x}" cy="${y}" r="2.2" fill="#14110C"/></g>`;
}
function butterfly(x, y) {
  return `<g><circle cx="${x - 4}" cy="${y}" r="4.2" fill="#FF7EB6" stroke="#14110C" stroke-width="2"/>` +
    `<circle cx="${x + 4}" cy="${y}" r="4.2" fill="#B79CFF" stroke="#14110C" stroke-width="2"/>` +
    `<line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}" stroke="#14110C" stroke-width="2"/></g>`;
}
function gardenSVG(p) {
  const W = 340, H = 300, groundY = H - 46, tx = W / 2;
  let rays = "";
  const nRays = Math.min(14, 5 + Math.floor(p.streak));
  for (let i = 0; i < nRays; i++) { const a = (i / nRays) * Math.PI * 2; rays += `<line x1="${(52 + Math.cos(a) * 26).toFixed(1)}" y1="${(52 + Math.sin(a) * 26).toFixed(1)}" x2="${(52 + Math.cos(a) * 40).toFixed(1)}" y2="${(52 + Math.sin(a) * 40).toFixed(1)}" stroke="#14110C" stroke-width="3"/>`; }
  const s = p.treeScale, trunkH = 66 * s, trunkW = 18 * s, folR = 46 * s;
  const trunk = `<rect x="${(tx - trunkW / 2).toFixed(1)}" y="${(groundY - trunkH).toFixed(1)}" width="${trunkW.toFixed(1)}" height="${trunkH.toFixed(1)}" rx="6" fill="#8B5E34" stroke="#14110C" stroke-width="3"/>`;
  const foliage =
    `<circle cx="${(tx - folR * 0.7).toFixed(1)}" cy="${(groundY - trunkH - folR * 0.15).toFixed(1)}" r="${(folR * 0.72).toFixed(1)}" fill="#4CAF7D" stroke="#14110C" stroke-width="3"/>` +
    `<circle cx="${(tx + folR * 0.7).toFixed(1)}" cy="${(groundY - trunkH - folR * 0.15).toFixed(1)}" r="${(folR * 0.72).toFixed(1)}" fill="#4CAF7D" stroke="#14110C" stroke-width="3"/>` +
    `<circle cx="${tx}" cy="${(groundY - trunkH - folR * 0.55).toFixed(1)}" r="${folR.toFixed(1)}" fill="#38D9A9" stroke="#14110C" stroke-width="3"/>`;
  const colors = ["#FF6B4A", "#FF7EB6", "#FFC93C", "#B79CFF", "#4DA3FF"];
  let flowers = "";
  for (let i = 0; i < p.flowers; i++) { const fx = (18 + Math.random() * (W - 36)).toFixed(1); const fy = (groundY + 6 + Math.random() * 26).toFixed(1); flowers += flower(fx, fy, colors[i % colors.length]); }
  let bf = "";
  for (let i = 0; i < p.butterflies; i++) bf += butterfly((34 + Math.random() * (W - 68)).toFixed(1), (56 + Math.random() * 110).toFixed(1));
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="garden-svg" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="52" cy="52" r="22" fill="#FFC93C" stroke="#14110C" stroke-width="3"/>${rays}` +
    `<rect x="0" y="${groundY}" width="${W}" height="${H - groundY}" fill="#A9C74A" stroke="#14110C" stroke-width="3"/>` +
    `${trunk}${foliage}${flowers}${bf}</svg>`;
}

export async function viewGarden(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "حديقتنا")));
  const wrap = h("div", { class: "garden" }, h("div", { class: "empty", style: { padding: "20px" } }, "تنمو حديقتكما…"));
  content.appendChild(wrap);
  const ms = await api.milestones();
  const d = ms.ok ? ms.data : {};
  const days = d.days_together || 0, moments = d.totals?.moments || 0, notes = d.totals?.notes || 0, streak = d.streak_longest || 0;
  const p = {
    days, moments, streak, notes,
    treeScale: Math.max(0.5, Math.min(1.7, 0.5 + days / 300)),
    flowers: Math.min(26, moments),
    butterflies: Math.min(7, Math.floor(notes / 2)),
  };
  const stage = days < 7 ? ["بذرة", "🌱"] : days < 30 ? ["شتلة", "🌿"] : days < 180 ? ["شجرة", "🌳"] : ["بستان مزهر", "🏡"];
  clear(wrap);
  const scene = h("div", { class: "panel garden-scene" });
  scene.innerHTML = gardenSVG(p);
  wrap.appendChild(scene);
  wrap.appendChild(h("div", { class: "garden-stage" }, stage[1] + " حديقتكما الآن: " + stage[0]));
  wrap.appendChild(h("div", { class: "garden-legend" },
    legend("🌳", "الشجرة تكبر بأيّامكما — " + arNum(days) + " يومًا"),
    legend("🌸", "زهرة لكل لحظة — " + arNum(moments)),
    legend("🦋", "فراشة لكل همستين — " + arNum(notes) + " همسة"),
    legend("☀️", "الشمس أدفأ بسلسلتكما — " + arNum(streak))));
  wrap.appendChild(h("div", { class: "empty", style: { padding: "14px", marginTop: "8px" } }, h("div", { class: "dua" }, "اللهم بارك في كل بذرةٍ نزرعها معًا 🤲")));
}
function legend(emoji, text) { return h("div", { class: "gl-row" }, h("span", { class: "gl-emoji" }, emoji), h("span", {}, text)); }
