/* =====================================================================
   BUDGET LEDGER — vanilla JS
   Sections: 1) State & storage  2) Helpers  3) Rendering
             4) Actions          5) Event wiring  6) Init
   ===================================================================== */

/* ---------- 1) State & storage ---------- */
const KEY = 'budgetLedger.v1';
const pad = n => String(n).padStart(2, '0');
const nowInput = () => {                                    // "YYYY-MM-DDTHH:mm" in local time
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const monthOf = d => d.slice(0, 7);                         // "2026-11"

function safeLoad() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

const state = Object.assign({
  theme: 'dark', accent: 'emerald', currency: 'BDT',
  month: monthOf(nowInput()),       // month currently being viewed
  budgets: {},                      // { "2026-11": 30000 } — one limit per month
  expenses: []                      // { id, desc, amount, date }
}, safeLoad());

/* ---------- 2) Helpers ---------- */
const $ = id => document.getElementById(id);
const fmt = n => '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const monthExpenses = () => state.expenses.filter(e => monthOf(e.date) === state.month)
                                          .sort((a, b) => b.date.localeCompare(a.date)); // newest first
const monthName = m => new Date(m + '-01T00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const prettyDate = d => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const shiftMonth = (m, by) => { const d = new Date(m + '-01T00:00'); d.setMonth(d.getMonth() + by); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

/* ---------- 3) Rendering ---------- */
let newId = null;   // id of the expense that should play the slide-in animation

function render() {
  const items = monthExpenses();
  const spent = items.reduce((s, e) => s + e.amount, 0);
  const budget = state.budgets[state.month] || 0;
  const left = budget - spent;
  const leftPct = budget > 0 ? Math.max(0, Math.min(100, (left / budget) * 100)) : 0;
  const usedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  $('remaining').textContent = (left < 0 ? '−' : '') + fmt(Math.abs(left));
  $('remaining').style.color = left < 0 ? 'var(--bad)' : 'var(--num)';   // matches the silk/accent; red only when over budget
  $('remLabel').textContent = left < 0 ? `Over budget in ${monthName(state.month)}` : `Remaining in ${monthName(state.month)}`;
  $('budget').textContent = fmt(budget);
  $('spent').textContent = fmt(spent);
  $('pct').textContent = budget ? usedPct + '%' : '—';
  $('barFill').style.width = leftPct + '%';
  $('barWrap').setAttribute('aria-valuenow', Math.round(leftPct));
  $('month').value = state.month;
  $('listTitle').textContent = `Expenses (${items.length})`;

  const list = $('list');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="empty">No expenses in this month yet. Add your first one above.</div>';
    return;
  }
  items.forEach(e => {
    const el = document.createElement('div');
    el.className = 'item' + (e.id === newId ? ' enter' : '');
    el.innerHTML = `<div><div class="row">
        <span class="dot"></span>
        <span class="meta"><b></b><small>${prettyDate(e.date)}</small></span>
        <span class="amt">${fmt(e.amount)}</span>
        <button class="icon-btn del" aria-label="Delete expense" title="Delete">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
      </div></div>`;
    el.querySelector('b').textContent = e.desc;             // textContent => safe from HTML injection
    el.querySelector('.del').onclick = () => removeExpense(e.id, el);
    list.appendChild(el);
  });
  newId = null;
}

/* ---------- 4) Actions ---------- */
function addExpense(amount, desc, date) {
  const exp = { id: uid(), desc, amount, date };
  state.expenses.push(exp);
  state.month = monthOf(date);      // jump to the entry's month so the user sees it
  newId = exp.id;
  save(); render();
}

function removeExpense(id, el) {
  el.classList.add('leaving');                              // collapse + fade
  setTimeout(() => {
    state.expenses = state.expenses.filter(e => e.id !== id);
    save(); render();                                       // top bar recalculates here
  }, 350);
}

function confirmBox(title, text, okLabel, onOk) {
  $('cTitle').textContent = title; $('cText').textContent = text; $('cOk').textContent = okLabel;
  $('cOk').onclick = () => { $('confirmDlg').close(); onOk(); };
  $('confirmDlg').showModal();
}

function setTheme(t) { state.theme = t; document.documentElement.dataset.theme = t; save(); }
function setAccent(a) { state.accent = a; document.documentElement.dataset.accent = a; markSwatches(); save(); }
function markSwatches() {
  document.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-pressed', b.dataset.a === state.accent));
}
function clearMonth() {
  if (!monthExpenses().length) return;
  confirmBox('Clear all expenses?', `This deletes every expense in ${monthName(state.month)}. It can't be undone.`, 'Clear all', () => {
    state.expenses = state.expenses.filter(e => monthOf(e.date) !== state.month);
    save(); render();
  });
}

/* ---------- 5) Event wiring ---------- */
$('form').addEventListener('submit', ev => {
  ev.preventDefault();
  const amount = parseFloat($('amount').value);
  const desc = $('desc').value.trim();
  const when = $('when').value || nowInput();
  // Validation: both fields required, amount must be positive
  const badAmt = !(amount > 0), badDesc = !desc;
  ['amount', 'desc'].forEach(id => $(id).classList.remove('invalid'));
  void $('amount').offsetWidth;                              // restart shake animation
  if (badAmt) $('amount').classList.add('invalid');
  if (badDesc) $('desc').classList.add('invalid');
  $('err').textContent = badAmt || badDesc
    ? `Enter ${badAmt && badDesc ? 'an amount and a description' : badAmt ? 'an amount greater than 0' : 'a description'}.` : '';
  if (badAmt || badDesc) return;

  addExpense(Math.round(amount * 100) / 100, desc, when);
  $('amount').value = ''; $('desc').value = ''; $('when').value = nowInput();
  $('amount').focus();
});
['amount', 'desc'].forEach(id => $(id).addEventListener('input', () => { $(id).classList.remove('invalid'); $('err').textContent = ''; }));

$('month').addEventListener('change', e => { if (e.target.value) { state.month = e.target.value; save(); render(); } });
$('themeBtn').onclick = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
$('settingsBtn').onclick = () => { markSwatches(); $('settingsDlg').showModal(); };
document.querySelectorAll('.sw').forEach(b => b.onclick = () => setAccent(b.dataset.a));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());

// Opens the budget dialog. `firstTime` swaps in a friendlier prompt for months with no budget yet.
function openBudgetDialog(firstTime) {
  $('budgetMonth').textContent = firstTime
    ? `Set your spending limit for ${monthName(state.month)} to start tracking. You can change it any time.`
    : `Limit for ${monthName(state.month)}`;
  $('budgetInput').value = state.budgets[state.month] || '';
  $('budgetErr').textContent = '';
  $('budgetDlg').showModal(); $('budgetInput').focus();
}
$('editBudget').onclick = () => openBudgetDialog(false);
$('budgetForm').addEventListener('submit', ev => {
  ev.preventDefault();                                       // we close the dialog ourselves, only after a valid save
  const v = parseFloat($('budgetInput').value);
  if (!(v > 0)) { $('budgetErr').textContent = 'Enter a budget greater than 0.'; return; }
  state.budgets[state.month] = Math.round(v * 100) / 100;
  save(); render();
  $('budgetDlg').close();
});
$('budgetInput').addEventListener('input', () => { $('budgetErr').textContent = ''; });

$('clearAll').onclick = clearMonth;

// Month reset: earlier months stay stored (archived) and remain viewable via the month picker.
$('nextMonth').onclick = () => {
  const next = shiftMonth(state.month, 1);
  if (state.budgets[next] === undefined) state.budgets[next] = state.budgets[state.month] || 0; // carry budget over
  state.month = next; save(); render();
  $('settingsDlg').close();
};
$('clearMonth').onclick = () => { $('settingsDlg').close(); clearMonth(); };

/* ---------- 6) Init ---------- */
$('when').value = nowInput();
render();

// First run (or a new month with no budget yet): ask for the monthly budget right away.
if (!state.budgets[state.month]) openBudgetDialog(true);


/* ---------- 7b) Fallback silk (Canvas 2D) — used only if WebGL2 is unavailable ----------
   Layered, softly translucent sine ribbons in the current accent color.
   Re-colors automatically when the accent or theme changes. */
function silkFallback() {
  const cv = $('silk'), ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAYERS = 7;
  let w, h, t = 0, colors = null, colorKey = '';

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw();                                       // static frame only
  }
  const hex = v => { v = v.trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
  function readColors() {                                     // cache until accent/theme changes
    const root = document.documentElement, key = root.dataset.accent + root.dataset.theme;
    if (key === colorKey) return;
    const cs = getComputedStyle(root);
    colors = { a: hex(cs.getPropertyValue('--accent')), b: hex(cs.getPropertyValue('--accent-2')), light: root.dataset.theme === 'light' };
    colorKey = key;
  }

  function draw() {
    readColors();
    const { a, b, light } = colors, k = light ? 0.55 : 1;      // softer in light mode
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < LAYERS; i++) {
      const base = h * (0.18 + i * 0.12);                      // vertical position of this ribbon
      const amp = 38 + i * 9;
      const speed = 0.00035 + i * 0.00006;
      const path = new Path2D();
      path.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) {
        const y = base
          + Math.sin(x * 0.0035 + t * speed * 2 + i * 1.4) * amp
          + Math.sin(x * 0.0085 - t * speed * 1.3 + i * 2.1) * amp * 0.45
          + Math.sin(x * 0.0016 + t * speed + i) * amp * 0.8;
        path.lineTo(x, y);
      }
      path.lineTo(w, h); path.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, base + 260);   // silk fades downward
      g.addColorStop(0, `rgba(${b[0]},${b[1]},${b[2]},${0.20 * k})`);
      g.addColorStop(0.45, `rgba(${a[0]},${a[1]},${a[2]},${0.10 * k})`);
      g.addColorStop(1, `rgba(${a[0]},${a[1]},${a[2]},0)`);
      ctx.fillStyle = g; ctx.fill(path);
      ctx.lineWidth = 1.4;                                      // bright sheen along each fold
      ctx.strokeStyle = `rgba(${b[0]},${b[1]},${b[2]},${0.30 * k})`;
      ctx.stroke(path);
    }
  }

  function loop(now) { t = now; draw(); requestAnimationFrame(loop); }

  addEventListener('resize', resize);
  new MutationObserver(() => { colorKey = ''; if (reduce) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });
  resize();
  if (!reduce) requestAnimationFrame(loop);
}

/* ---------- 7) Flowing silk background (WebGL2 shader) ----------
   A domain-warped noise field is lit like a satin surface: soft folds, glossy
   highlights, deep shadows and a fine film grain, tinted with the accent color.
   Rendered at about half resolution (it is smooth by design) at full display rate. */
(function silk() {
  const cv = $('silk');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return silkFallback();

  const VERT = `#version 300 es
  void main() {                                   // full-screen triangle, no buffers needed
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uT; uniform float uLight;
  uniform vec3 uDark, uMid, uHi;
  out vec4 o;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {                              // layered noise = organic folds
    float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { s += a * noise(p); p = m * p; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = (frag / uRes.y) * 2.2;
    float t = uT * 0.03;

    // Two rounds of domain warping give the swirling, marbled silk shape
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t, 0.0)));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
    vec2 w = p + 3.5 * r;

    // Height + finite differences => surface normal for satin lighting
    float e = 0.02;
    float h = fbm(w), hx = fbm(w + vec2(e, 0.0)), hy = fbm(w + vec2(0.0, e));
    vec3 n = normalize(vec3((h - hx) / e * 0.9, (h - hy) / e * 0.9, 1.0));
    vec3 L = normalize(vec3(-0.5, 0.6, 0.7));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);

    float tone = smoothstep(0.25, 0.75, h);
    vec3 col = mix(uDark, uMid, tone) * (0.25 + 1.1 * diff) + uHi * spec * 0.55;
    col *= 0.7 + 0.55 * smoothstep(0.2, 0.8, q.x);              // large dark pockets
    col *= 1.0 - 0.35 * length(frag / uRes - 0.5);               // soft vignette

    if (uLight > 0.5) {                                          // light theme: pale paper with a faint silk tint
      float s = clamp(tone * 0.6 + spec * 0.6 + diff * 0.2, 0.0, 1.0);
      col = mix(vec3(0.94, 0.96, 0.99), uMid * 1.2, s * 0.4);
    }
    col += (hash(floor(frag) + floor(uT * 12.0) * 7.0) - 0.5) * 0.035; // film grain
    o = vec4(col, 1.0);
  }`;

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs) return silkFallback2D();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return silkFallback2D();
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), t: U('uT'), light: U('uLight'), dark: U('uDark'), mid: U('uMid'), hi: U('uHi') };

  // A failed WebGL canvas can't switch to 2D, so swap in a fresh canvas first
  function silkFallback2D() {
    const fresh = cv.cloneNode(false); cv.replaceWith(fresh); silkFallback();
  }

  const hex = v => { v = v.trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255); };
  function setColors() {                                          // accent + theme -> shader uniforms
    const root = document.documentElement, cs = getComputedStyle(root);
    const a = hex(cs.getPropertyValue('--accent')), b = hex(cs.getPropertyValue('--accent-2'));
    gl.uniform3f(u.dark, a[0] * 0.10, a[1] * 0.10, a[2] * 0.10);
    gl.uniform3f(u.mid, a[0] * 0.65, a[1] * 0.65, a[2] * 0.65);
    gl.uniform3f(u.hi, b[0], b[1], b[2]);
    gl.uniform1f(u.light, root.dataset.theme === 'light' ? 1 : 0);
  }
  let scale = 0.5;                                                // render scale (smooth by design; auto-lowered if slow)
  function resize() {
    cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(u.res, cv.width, cv.height);
    frame(lastT);
  }

  let lastT = 12, prev = 0, slow = 0;
  function frame(t) { lastT = t; gl.uniform1f(u.t, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function loop(now) {
    requestAnimationFrame(loop);                                  // full display rate (60 fps) for smooth motion
    const dt = now - prev; prev = now;
    // If frames keep taking too long, lower the render resolution a step so motion stays fluid
    if (dt > 24 && dt < 200) { if (++slow > 40 && scale > 0.3) { scale = Math.max(0.3, scale - 0.1); slow = 0; resize(); } }
    else if (slow > 0) slow--;
    frame(now / 1000 + 12);
  }

  addEventListener('resize', resize);
  new MutationObserver(() => { setColors(); if (reduce) frame(lastT); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });
  setColors(); resize();
  if (!reduce) requestAnimationFrame(loop);                       // reduced motion: single still frame
})();


/* ---------- 8) Offline support / installability ----------
   Registers the service worker (only works over http(s), e.g. GitHub Pages — not file://). */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
