/* Stark Calculator — script.js | Made by Shuhratbek */
"use strict";

/* ================================================================
   1. SOZLAMALAR — tezlik, o'lcham, ranglarni shu yerdan o'zgartiring
   ================================================================ */
const CONFIG = {
  background: { gridSize: 20, neighbors: 5, driftRadius: 40, rgb: "156,217,249" },
};

/* ================================================================
   2. FON ANIMATSIYASI (nuqtalar + ularni bog'lovchi chiziqlar)
   ================================================================ */
function startNetworkBackground(canvas) {
  const ctx = canvas.getContext("2d");
  const { gridSize, neighbors, driftRadius, rgb } = CONFIG.background;
  let width, height, points = [];
  const mouse = { x: 0, y: 0 };

  // Ikki nuqta orasidagi masofaning KVADRATI (ildiz olmaymiz — tezroq)
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function build() {
    width = canvas.width = innerWidth;
    height = canvas.height = innerHeight;
    mouse.x = width / 2; mouse.y = height / 2;
    points = [];

    // Ekranni to'rga bo'lib, har katakka bitta tasodifiy nuqta qo'yamiz
    const cellW = width / gridSize, cellH = height / gridSize;
    for (let x = 0; x < width; x += cellW) {
      for (let y = 0; y < height; y += cellH) {
        const px = x + Math.random() * cellW, py = y + Math.random() * cellH;
        points.push({
          originX: px, originY: py, x: px, y: py,
          radius: 2 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,   // har nuqta o'z vaqtida harakatlanadi
          speed: 0.4 + Math.random() * 0.8,
        });
      }
    }
    // Har bir nuqta uchun eng yaqin N ta qo'shnini topamiz
    for (const p of points) {
      p.near = points.filter(q => q !== p)
                     .sort((a, b) => dist2(p, a) - dist2(p, b))
                     .slice(0, neighbors);
    }
  }

  // Kursorga yaqin nuqtalar yorqinroq: [masofa², chiziq alfa, nuqta alfa]
  function brightness(d) {
    if (d < 4000)  return [0.3, 0.6];
    if (d < 20000) return [0.1, 0.3];
    if (d < 40000) return [0.03, 0.12];
    return [0.015, 0.06];
  }

  function frame(ms) {
    const t = ms / 1000;
    ctx.clearRect(0, 0, width, height);

    // 1) Nuqtalarni asl joyi atrofida sekin aylantiramiz
    for (const p of points) {
      p.x = p.originX + Math.cos(t * p.speed + p.phase) * driftRadius;
      p.y = p.originY + Math.sin(t * p.speed * 1.1 + p.phase) * driftRadius;
    }
    // 2) Chiziqlar va nuqtalarni chizamiz
    for (const p of points) {
      const [lineA, dotA] = brightness(dist2(mouse, p));
      ctx.strokeStyle = `rgba(${rgb},${lineA})`;
      for (const q of p.near) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${rgb},${dotA})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  addEventListener("pointermove", e => { mouse.x = e.pageX; mouse.y = e.pageY; });
  addEventListener("resize", build);
  build();
  requestAnimationFrame(frame);
}

/* ================================================================
   3-B. KATTA IRON MAN'NI TAYYORLASH
   ================================================================ */
function prepareHero(svg) {
  // 1) Har bir shaklga pathLength=1 beramiz: uzun-qisqa bo'lishidan qat'i nazar
  //    hammasi bir xil tezlikda "chizilib" chiqadi (CSS'dagi dasharray "1" shunga tayanadi)
  svg.querySelectorAll("polygon, polyline, circle:not(.glow)").forEach(shape => {
    shape.setAttribute("pathLength", "1");
    shape.classList.add("draw");
  });

  // 2) Arc reactor tishlari: markaz atrofida 16 ta qisqa chiziq (kod bilan hosil qilinadi)
  const NS = "http://www.w3.org/2000/svg";
  const ticks = svg.querySelector("#ticks");
  const cx = 953, cy = 852, rInner = 58, rOuter = 76, count = 16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", cx + rInner * cos); line.setAttribute("y1", cy + rInner * sin);
    line.setAttribute("x2", cx + rOuter * cos); line.setAttribute("y2", cy + rOuter * sin);
    ticks.appendChild(line);
  }
}

/* ================================================================
   3-C. ROBOT — natijani "aytadi": og'zi qimirlaydi, gap pufakchada chiqadi
   ================================================================ */
const talkEl = document.getElementById("talk");
const bubbleEl = document.getElementById("bubble");
const GREETING = "Hello! I'm J.A.R.V.I.S. Shall we calculate?";
let talkTimer = null;

function robotSay(text, animate = true) {
  bubbleEl.textContent = text;
  clearTimeout(talkTimer);
  talkEl.classList.toggle("talking", animate);
  if (animate) {   // og'iz gap uzunligiga qarab qimirlaydi (ko'pi bilan 2.5 soniya)
    talkTimer = setTimeout(() => talkEl.classList.remove("talking"), Math.min(2500, 400 + text.length * 80));
  }
}

/* ================================================================
   4. CALCULATOR
   Holat (state) bitta obyektda saqlanadi, ekran render() bilan yangilanadi.
   ================================================================ */
const KEY_LAYOUT = [
  ["C", "fn"], ["(", "fn"], [")", "fn"], ["⌫", "fn"],
  ["7"], ["8"], ["9"], ["÷", "op"],
  ["4"], ["5"], ["6"], ["×", "op"],
  ["1"], ["2"], ["3"], ["−", "op"],
  ["0"], ["."], ["%", "op"], ["+", "op"],
  ["=", "arc"],
];
const OPERATORS = ["+", "−", "×", "÷"];

const state = {
  expression: "",       // foydalanuvchi yozgan ifoda, masalan "12+3×4"
  history: "",          // "=" bosilgandan keyin tepada ko'rinadigan eski ifoda
  error: "",            // xato matni (bo'sh bo'lsa xato yo'q)
  justEvaluated: false, // natija chiqqandan keyin raqam bosilsa — yangi hisob boshlanadi
};

const exprEl = document.getElementById("expr");
const resultEl = document.getElementById("result");

/* ---------- Yordamchi funksiyalar ---------- */
const lastChar = () => state.expression.slice(-1);
const isOperator = ch => OPERATORS.includes(ch);
const isDigit = ch => /\d/.test(ch);
const endsWithValue = () => isDigit(lastChar()) || lastChar() === ")" || lastChar() === "%";
const currentNumber = () => state.expression.match(/[\d.]*$/)[0];   // oxirgi yozilayotgan son

function isBalanced(expr) {            // "(" va ")" soni mosligini tekshiradi
  let open = 0;
  for (const ch of expr) {
    if (ch === "(") open++;
    if (ch === ")" && --open < 0) return false;
  }
  return open === 0;
}

/* ---------- Hisoblash (xatolarni tekshirish bilan) ---------- */
// Natija: { value } yoki { error }
function evaluate(expr) {
  if (!expr) return { error: "Empty expression" };
  if (isOperator(expr.slice(-1))) return { error: "Incomplete expression" };
  if (!isBalanced(expr)) return { error: "Brackets don't match" };

  // Chiroyli belgilarni JavaScript belgilariga almashtiramiz
  const js = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/%/g, "/100");

  // Xavfsizlik: faqat raqam va matematik belgilarga ruxsat
  if (!/^[\d+\-*/().\s]+$/.test(js)) return { error: "Invalid character" };

  try {
    const value = Function(`"use strict"; return (${js});`)();
    if (!Number.isFinite(value)) return { error: "Cannot divide by zero" };
    return { value: Number(value.toPrecision(12)) };   // 0.1+0.2 kabi xatolarni yaxlitlaydi
  } catch {
    return { error: "Invalid expression" };
  }
}

/* ---------- Tugmalarni qayta ishlash ---------- */
function addDigit(d) {
  if (state.justEvaluated) { state.expression = ""; state.justEvaluated = false; }
  // "007" yozib bo'lmaydi (JS strict rejimda xato beradi) — nolni almashtiramiz
  if (currentNumber() === "0") state.expression = state.expression.slice(0, -1);
  state.expression += d;
}

function addDot() {
  if (state.justEvaluated) { state.expression = ""; state.justEvaluated = false; }
  if (currentNumber().includes(".")) return;           // bir sonda ikkita nuqta bo'lmasin
  state.expression += currentNumber() === "" ? "0." : ".";
}

function addOperator(op) {
  state.justEvaluated = false;                          // natijadan davom ettirish mumkin
  const last = lastChar();
  if (state.expression === "" || last === "(") {        // boshida faqat manfiy ishora
    if (op === "−") state.expression += op;
    return;
  }
  if (isOperator(last)) state.expression = state.expression.slice(0, -1); // operatorni almashtirish
  state.expression += op;
}

function addPercent() {
  if (endsWithValue() && lastChar() !== "%") state.expression += "%";
}

function addParen(p) {
  state.justEvaluated = false;
  if (p === "(") {
    if (endsWithValue()) state.expression += "×";       // 2( → 2×(
    state.expression += "(";
  } else {
    const opened = (state.expression.match(/\(/g) || []).length;
    const closed = (state.expression.match(/\)/g) || []).length;
    if (opened > closed && endsWithValue()) state.expression += ")";
  }
}

function calculate() {
  const result = evaluate(state.expression);
  if (result.error) { state.error = result.error; robotSay(result.error); return; }
  state.history = state.expression + " =";
  const text = String(result.value);
  // Juda katta sonlar ("1e+21") keyingi hisobga yaramaydi — tozalaymiz
  state.expression = text.includes("e") ? "" : text.replace("-", "−");
  state.justEvaluated = true;
  robotSay("Answer: " + state.expression);          // robot natijani aytadi
}

function pressKey(key) {
  state.error = "";                                     // har bosishda eski xato yo'qoladi
  if (isDigit(key)) addDigit(key);
  else if (key === ".") addDot();
  else if (isOperator(key)) addOperator(key);
  else if (key === "%") addPercent();
  else if (key === "(" || key === ")") addParen(key);
  else if (key === "⌫") { state.expression = state.expression.slice(0, -1); state.justEvaluated = false; }
  else if (key === "C") { state.expression = ""; state.history = ""; state.justEvaluated = false; robotSay(GREETING, false); }
  else if (key === "=") calculate();
  render();
}

/* ---------- Ekranni yangilash ---------- */
function render() {
  exprEl.textContent = state.history;
  resultEl.classList.toggle("error", Boolean(state.error));
  resultEl.textContent = state.error || state.expression || "0";
  resultEl.style.fontSize = !state.error && state.expression.length > 14 ? "22px" : "";
}

/* ---------- Tugmalarni yaratish va klaviatura ---------- */
function buildKeypad(container) {
  for (const [label, kind] of KEY_LAYOUT) {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (kind) btn.classList.add(kind);
    btn.dataset.key = label;
    container.appendChild(btn);
  }
  // Har bir tugmaga alohida emas, konteynerga bitta listener (event delegation)
  container.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (btn) pressKey(btn.dataset.key);
  });
}

const KEYBOARD_MAP = { "*": "×", "/": "÷", "-": "−", Enter: "=", Backspace: "⌫", Escape: "C" };
addEventListener("keydown", e => {
  const key = KEYBOARD_MAP[e.key] || e.key;
  if (/^[\d+.()%=−×÷⌫C]$/.test(key)) { e.preventDefault(); pressKey(key); }
});

/* ================================================================
   5. ISHGA TUSHIRISH
   ================================================================ */
startNetworkBackground(document.getElementById("bg"));
prepareHero(document.getElementById("hero"));
buildKeypad(document.getElementById("keys"));
render();
