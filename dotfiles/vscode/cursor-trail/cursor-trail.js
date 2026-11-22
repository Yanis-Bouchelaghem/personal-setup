/*!
 * cursor-trail.js - focus-following cursor trail for VS Code (injected script).
 *
 * Load it through the "Custom CSS and JS Loader" extension (vscode_custom_css.imports).
 * Original implementation. The look (wedge with a pointy tail, ease-out catch-up, soft glow
 * on the head) was measured from reference footage, not copied from any plugin's source.
 *
 * What it follows (screen space, so it works across editor groups, the sidebar, the
 * terminal and input boxes):
 *   - text editor caret      .monaco-editor .cursors-layer > .cursor
 *   - sidebar / tree / lists .monaco-list-row.focused (marker at the row's label)
 *   - terminal               textarea.xterm-helper-textarea (xterm parks it on the cursor cell)
 *   - plain inputs           input / textarea (marker at the field's left edge)
 *   - webviews               any extension panel or editor in an iframe: the trail lands on the middle of
 *                            the side it came from, then two light streaks run round the border and meet
 *
 * Override settings (no edit needed) with either:
 *   window.CURSOR_TRAIL_CONFIG = {...}                       (before this script runs)
 *   localStorage.setItem('cursorTrail.config', '{"duration":200}')  (DevTools console)
 * Runtime handle: window.cursorTrail  (enable, disable, config, destroy ...)
 */
(function () {
  'use strict';
  var G = window;
  if (G.cursorTrail && typeof G.cursorTrail.destroy === 'function') {
    try { G.cursorTrail.destroy(); } catch (e) { /* ignore */ }
  }

  var DEFAULTS = {
    enabled: true,
    color: 'auto',          // 'auto' = brightened caret colour, or any CSS colour ('#ff6b6b')
    duration: 260,          // ms for the tail to catch the head (ease-out)
    easePower: 2,           // 2 = quad ease-out (matches the reference timing)
    minDistance: 16,        // px; moves shorter than this never trail (typing, h/l)
    chainMs: 140,           // moves closer together than this are one continuous path (held keys)
    streamMaxLength: 150,   // px; longest trail kept while the cursor is still moving (~8 lines)
    streamCatchup: 50,      // ms; how fast the tail is pulled in when over that length
    headWidth: 15,          // px, streak width at the head
    tailWidth: 6,           // px, streak width floor along the tail
    taperPower: 2,          // how quickly the width falls from head to floor (convex)
    tipFraction: 0.12,      // last share of the length that closes to a point
    solidFraction: 0.34,    // share of the length (from the head) that stays fully bright
    glowRadius: 9,          // px (sigma) of the soft halo around the streak
    glowStrength: 1.0,      // halo opacity
    coreBlur: 2,            // px (sigma) edge softness of the streak itself
    headAlpha: 0.9,         // opacity of the brightened head cell while moving
    headGlowInflate: 9,     // px the head halo extends beyond the caret cell
    headGlowAlpha: 0.42,    // head halo opacity
    haloFade: 1.3,          // halo envelope = 1 - x^haloFade (lower = fades sooner)
    holdFraction: 0.5,      // head brightening holds until this point of the animation ...
    glowEnd: 0.93,          // ... and is gone by this point
    brighten: 0.17,         // 'auto' colour: mix toward white
    brightenScale: 1.08,    // 'auto' colour: overall gain
    followSidebar: true,
    followTerminal: true,
    followInputs: true,
    followPanes: true,      // webviews (extension panels): their content is a separate document, so only the pane is marked
    paneWash: true,         // soft wash across the whole pane the cursor arrived in
    paneWashAlpha: 0.035,
    paneMarkerHeight: 24,   // px, head length along the pane's side
    paneWave: true,         // two light streaks run round the pane's border and meet on the far side
    waveMs: 300,            // ms for the streaks to meet and fade
    waveDelay: 0.35,        // share of `duration` to wait, so they start as the trail lands
    waveLength: 0.09,       // streak length, as a share of the pane's perimeter
    waveWidth: 1.2,         // px, streak width at the head
    waveAlpha: 0.4,
    rowPulse: true,         // soft wash across the focused sidebar row
    rowPulseAlpha: 0.16,
    markerWidth: 8,         // px, head width used for rows / inputs
    zIndex: 2147483000,
    pixelRatio: null        // null = devicePixelRatio
  };

  function loadConfig() {
    var c = {}, k;
    for (k in DEFAULTS) c[k] = DEFAULTS[k];
    try { var o = G.CURSOR_TRAIL_CONFIG; if (o) for (k in o) c[k] = o[k]; } catch (e) { /* ignore */ }
    try {
      var s = G.localStorage && G.localStorage.getItem('cursorTrail.config');
      if (s) { var j = JSON.parse(s); for (k in j) c[k] = j[k]; }
    } catch (e) { /* ignore */ }
    return c;
  }
  var cfg = loadConfig();

  // ---------------------------------------------------------------- colour helpers
  var cc = document.createElement('canvas').getContext('2d');
  function parseColor(str) {
    cc.fillStyle = '#000000';
    cc.fillStyle = str;
    var v = cc.fillStyle;
    if (v.charAt(0) === '#') {
      return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16), 1];
    }
    var m = v.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
  }
  function brighten(c) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      out.push(Math.min(255, Math.round((c[i] + (255 - c[i]) * cfg.brighten) * cfg.brightenScale)));
    }
    return out;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // ---------------------------------------------------------------- state
  var state = {
    last: null,          // { c:{x,y}, rect, kind, row }
    anim: null,          // { t0, start:{x,y}, head }
    wave: null,          // { rect, side, ts, col }: the streaks running round a pane
    pane: null,          // { el, side }: the pane the cursor is in, and the side it came in by
    caretColor: null,
    color: [255, 255, 255],
    dirty: false,
    clock: function () { return performance.now(); },
    manual: false,
    raf: 0,
    editorCache: { ae: null, cursor: null }
  };

  // ---------------------------------------------------------------- canvas overlay
  var canvas = document.createElement('canvas');
  canvas.id = 'cursor-trail-overlay';
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:' + cfg.zIndex + ';';
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = cfg.pixelRatio || G.devicePixelRatio || 1;
    W = G.innerWidth; H = G.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }
  function mount() {
    (document.body || document.documentElement).appendChild(canvas);
    resize();
  }

  // ---------------------------------------------------------------- focus target
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function pickCaret(editor) {
    var list = editor.querySelectorAll('.cursors-layer > .cursor');
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].style.visibility !== 'hidden') return list[i];
    }
    return list[0];
  }

  function sampleCaretColor(el) {
    try {
      var cs = getComputedStyle(el);
      var c = parseColor(cs.backgroundColor);
      if (c[3] < 0.1) c = parseColor(cs.borderTopColor);
      if (c[3] >= 0.1) state.caretColor = c;
    } catch (e) { /* ignore */ }
  }

  // The side of a pane the cursor came from: the one nearest to where it was.
  function entrySide(r) {
    var p = state.last && state.last.c;
    if (!p) return 'left';
    var dx = p.x < r.x ? r.x - p.x : p.x > r.x + r.w ? p.x - r.x - r.w : 0;
    var dy = p.y < r.y ? r.y - p.y : p.y > r.y + r.h ? p.y - r.y - r.h : 0;
    if (dx === 0 && dy === 0) return 'left';
    if (dx >= dy) return p.x < r.x ? 'left' : 'right';
    return p.y < r.y ? 'top' : 'bottom';
  }

  function resolveTarget() {
    var ae = document.activeElement;
    if (!ae || ae === document.body || ae === document.documentElement) return null;
    var cl = ae.classList, r;

    // 1. text editor caret
    if (cl && (cl.contains('native-edit-context') || cl.contains('inputarea') || cl.contains('ime-text-area'))) {
      var cache = state.editorCache, cur;
      if (cache.ae === ae && cache.cursor && cache.cursor.isConnected) {
        cur = cache.cursor;
      } else {
        var ed = ae.closest('.monaco-editor');
        cur = ed ? pickCaret(ed) : null;
        cache.ae = ae; cache.cursor = cur;
      }
      if (cur) {
        r = rectOf(cur);
        if (r.w >= 0 && r.h > 0) {
          if (r.w < 6) { r.x -= (6 - r.w) / 2; r.w = 6; }   // line cursors are thin
          return { kind: 'caret', rect: r, el: cur };
        }
      }
      return null;
    }

    // 2. terminal cursor cell
    if (cfg.followTerminal && cl && cl.contains('xterm-helper-textarea')) {
      r = rectOf(ae);
      if (r.w > 0 && r.h > 0) return { kind: 'term', rect: r, el: ae };
      return null;
    }

    // 3. lists / trees (explorer, search, scm, outline, quick pick ...)
    if (cfg.followSidebar) {
      var list = ae.closest ? ae.closest('.monaco-list') : null;
      if (list) {
        var row = list.querySelector('.monaco-list-row.focused') || list.querySelector('.monaco-list-row.selected');
        if (row) {
          var rr = rectOf(row);
          if (rr.h > 0 && rr.w > 0) {
            var label = row.querySelector('.monaco-icon-label, .monaco-highlighted-label, .label-name');
            var lx = label ? label.getBoundingClientRect().left : rr.x + 24;
            return {
              kind: 'row',
              rect: { x: lx, y: rr.y, w: cfg.markerWidth, h: rr.h },
              row: rr, el: row
            };
          }
        }
        return null;
      }
    }

    // 4. plain inputs (search box, quick input, find widget ...)
    if (cfg.followInputs && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      r = rectOf(ae);
      if (r.w > 0 && r.h > 0) {
        return { kind: 'input', rect: { x: r.x + 6, y: r.y, w: cfg.markerWidth, h: r.h }, el: ae };
      }
    }

    // 5. webviews: focus inside one leaves document.activeElement on its iframe, and the page
    // inside cannot be read, so the head lands on the middle of the pane's side facing where the
    // cursor came from. Any extension works.
    if (cfg.followPanes && ae.tagName === 'IFRAME') {
      r = rectOf(ae);
      if (r.w > 0 && r.h > 0) {
        if (!state.pane || state.pane.el !== ae) state.pane = { el: ae, side: entrySide(r) };
        var side = state.pane.side, len = Math.min(side === 'left' || side === 'right' ? r.h : r.w, cfg.paneMarkerHeight);
        var m = cfg.markerWidth, gap = 4, hr;
        if (side === 'left') hr = { x: r.x + gap, y: r.y + (r.h - len) / 2, w: m, h: len };
        else if (side === 'right') hr = { x: r.x + r.w - gap - m, y: r.y + (r.h - len) / 2, w: m, h: len };
        else if (side === 'top') hr = { x: r.x + (r.w - len) / 2, y: r.y + gap, w: len, h: m };
        else hr = { x: r.x + (r.w - len) / 2, y: r.y + r.h - gap - m, w: len, h: m };
        return { kind: 'pane', rect: hr, row: r, el: ae, side: side };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- animation model
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // The trail is a polyline of the places the head has been: pts[0] is the tail, the last
  // point is the live head. The tail only ever moves along that path.
  function pathLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  }
  function advanceTail(pts, d) {
    while (d > 0 && pts.length >= 2) {
      var p0 = pts[0], p1 = pts[1], seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (seg <= d) { d -= seg; pts.shift(); }
      else {
        var f = d / seg;
        pts[0] = { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
        d = 0;
      }
    }
  }
  // samples along the path, head -> tail, each with the unit direction (head -> tail)
  function samplePath(pts) {
    var seq = [], i;
    for (i = pts.length - 1; i >= 0; i--) seq.push(pts[i]);
    var cum = [0], L = 0;
    for (i = 1; i < seq.length; i++) { L += Math.hypot(seq[i].x - seq[i - 1].x, seq[i].y - seq[i - 1].y); cum.push(L); }
    if (L < 1) return null;
    var K = Math.max(12, Math.min(48, Math.ceil(L / 8))), out = [], j = 0;
    for (var k = 0; k <= K; k++) {
      var s = L * k / K;
      while (j < seq.length - 2 && cum[j + 1] < s) j++;
      var seg = (cum[j + 1] - cum[j]) || 1, f = (s - cum[j]) / seg;
      out.push({
        x: seq[j].x + (seq[j + 1].x - seq[j].x) * f, y: seq[j].y + (seq[j + 1].y - seq[j].y) * f,
        dx: (seq[j + 1].x - seq[j].x) / seg, dy: (seq[j + 1].y - seq[j].y) / seg
      });
    }
    return { s: out, L: L };
  }

  // Moves the tail for this frame. While the cursor keeps moving ("hold") the tail stays put,
  // so the trail grows along the real path (capped). Once it has been still for chainMs the
  // ease-out catch-up runs from wherever the tail is. Returns false when the trail is over.
  function advance(a, now) {
    var dt = Math.min(100, Math.max(0, now - a.lastFrame));
    a.lastFrame = now;
    var R = pathLen(a.pts);
    if (a.mode === 'hold') {
      if (now - a.lastMove >= cfg.chainMs) { a.mode = 'release'; a.ts = now; a.Rb = R; }
      else if (R > cfg.streamMaxLength) {
        advanceTail(a.pts, (R - cfg.streamMaxLength) * (1 - Math.exp(-dt / cfg.streamCatchup)));
      }
    }
    if (a.mode === 'release') {
      var x = clamp01((now - a.ts) / cfg.duration);
      var target = a.Rb * Math.pow(1 - x, cfg.easePower);
      if (R > target) advanceTail(a.pts, R - target);
      if (x >= 1) return false;
    }
    return a.pts.length >= 2;
  }

  function resolveColor(t) {
    if (cfg.color !== 'auto') return parseColor(cfg.color);
    if (t.kind === 'caret') sampleCaretColor(t.el);
    var base = state.caretColor;
    if (!base) {
      var v = '';
      try { v = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editorCursor-foreground').trim(); } catch (e) { /* ignore */ }
      base = parseColor(v || '#ffffff');
    }
    return brighten(base);
  }

  function step(now, t) {
    if (!t || t.kind !== 'pane') state.pane = null;
    if (!t) return;
    var c = { x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2 };
    var last = state.last, a = state.anim;
    if (last && cfg.enabled) {
      var d = Math.hypot(c.x - last.c.x, c.y - last.c.y);
      if (d >= cfg.minDistance) {
        if (!a) {
          a = state.anim = {
            pts: [{ x: last.c.x, y: last.c.y }, { x: c.x, y: c.y }],
            mode: 'release', ts: now, Rb: d, lastMove: now, lastFrame: now, head: null
          };
        } else {
          // still moving? then this extends the same path instead of starting a new trail
          var chained = (now - a.lastMove) < cfg.chainMs;
          a.pts.push({ x: c.x, y: c.y });
          if (chained) a.mode = 'hold';
          else { a.mode = 'release'; a.ts = now; a.Rb = pathLen(a.pts); }
          a.lastMove = now;
        }
        state.color = resolveColor(t);
      }
    }
    // arriving in a pane (or another one): send the streaks round its border
    if (cfg.paneWave && cfg.enabled && t.kind === 'pane' && (!last || last.kind !== 'pane' || last.el !== t.el)) {
      state.wave = { rect: t.row, side: t.side, ts: now + cfg.waveDelay * cfg.duration, col: resolveColor(t) };
    }
    state.last = { c: c, rect: t.rect, kind: t.kind, row: t.row, el: t.el };
    if (a) {
      a.head = state.last;
      a.pts[a.pts.length - 1] = { x: c.x, y: c.y };   // the head end follows the live cursor
    }
  }

  // ---------------------------------------------------------------- drawing
  function render(now) {
    var a = state.anim;
    if (!a) {
      if (state.dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); state.dirty = false; }
      return;
    }
    // glow envelopes run on the catch-up clock; while the cursor is still moving they stay at full
    var x = a.mode === 'hold' ? 0 : clamp01((now - a.ts) / cfg.duration);

    var hold = cfg.holdFraction, gEnd = cfg.glowEnd;
    var g = x < hold ? 1 : clamp01((gEnd - x) / (gEnd - hold));    // head brightening envelope
    var gh = clamp01(1 - Math.pow(x, cfg.haloFade));                 // halo envelope (fades from the start)
    var gt = x < 0.6 ? 1 : clamp01((0.82 - x) / 0.22);               // streak envelope
    var head = a.head, hc = head.c, T = a.pts[0], col = state.color;
    var dx = T.x - hc.x, dy = T.y - hc.y, len = Math.hypot(dx, dy);   // chord, used for the fade

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // sidebar rows get a soft wash across the whole row, a webview across the whole pane
    if (head.row && ((head.kind === 'row' && cfg.rowPulse) || (head.kind === 'pane' && cfg.paneWash))) {
      ctx.fillStyle = rgba(col, (head.kind === 'pane' ? cfg.paneWashAlpha : cfg.rowPulseAlpha) * g);
      ctx.fillRect(head.row.x, head.row.y, head.row.w, head.row.h);
    }

    var poly = null, grad = null, sp = samplePath(a.pts);
    if (sp) {
      var S = sp.s, K = S.length - 1, left = [], right = [];
      for (var i = 0; i <= K; i++) {
        var uu = i / K, q = S[i];
        var half = (cfg.tailWidth + (cfg.headWidth - cfg.tailWidth) * Math.pow(1 - uu, cfg.taperPower)) / 2;
        if (uu > 1 - cfg.tipFraction) half *= (1 - uu) / cfg.tipFraction;   // close to a point
        var nx = -q.dy, ny = q.dx;
        left.push([q.x + nx * half, q.y + ny * half]);
        right.push([q.x - nx * half, q.y - ny * half]);
      }
      poly = left.concat(right.reverse());
      if (len >= 1) {
        grad = ctx.createLinearGradient(hc.x, hc.y, T.x, T.y);
        grad.addColorStop(0, rgba(col, gt));
        grad.addColorStop(Math.min(0.999, cfg.solidFraction), rgba(col, gt));
        grad.addColorStop(1, rgba(col, 0));
      } else {
        grad = rgba(col, gt);
      }
    }
    function fillPoly(style) {
      if (!poly) return;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (var j = 1; j < poly.length; j++) ctx.lineTo(poly[j][0], poly[j][1]);
      ctx.closePath(); ctx.fillStyle = style; ctx.fill();
    }

    // pass 1: wide soft halo (streak + head)
    ctx.filter = 'blur(' + cfg.glowRadius + 'px)';
    ctx.globalAlpha = cfg.glowStrength;
    fillPoly(grad);
    // a pane has no text cell to light up: its trail just ends, so no head block there
    var infl = cfg.headGlowInflate, hr = head.rect, cell = head.kind !== 'pane';
    if (cell) {
      ctx.globalAlpha = cfg.headGlowAlpha * gh;
      ctx.fillStyle = rgba(col, 1);
      ctx.fillRect(hr.x - infl, hr.y - infl, hr.w + 2 * infl, hr.h + 2 * infl);
    }

    // pass 2: the streak with slightly soft edges
    ctx.filter = 'blur(' + cfg.coreBlur + 'px)';
    ctx.globalAlpha = 1;
    fillPoly(grad);

    // pass 3: brightened head cell, crisp
    ctx.filter = 'none';
    if (cell) {
      ctx.globalAlpha = cfg.headAlpha * g;
      ctx.fillStyle = rgba(col, 1);
      ctx.fillRect(hr.x, hr.y, hr.w, hr.h);
    }

    ctx.restore();
    state.dirty = true;
  }

  // Two streaks leave the middle of the side the cursor arrived by, one each way round the
  // pane's border, and meet at the middle of the far side, where they melt away. Drawn over the
  // trail on its own clock. No blur filters: a few plain strokes per frame, the glow is a wider,
  // fainter stroke under the same line.
  function pointOnRect(r, s) {   // s: distance clockwise from the top-left corner
    var P = 2 * (r.w + r.h), w = r.w, h = r.h;
    s = ((s % P) + P) % P;
    if (s <= w) return { x: r.x + s, y: r.y };
    s -= w; if (s <= h) return { x: r.x + w, y: r.y + s };
    s -= h; if (s <= w) return { x: r.x + w - s, y: r.y + h };
    s -= w; return { x: r.x, y: r.y + h - s };
  }
  function sideStart(r, side) {  // the middle of a side, as a distance clockwise from the top-left
    return side === 'top' ? r.w / 2 : side === 'right' ? r.w + r.h / 2
      : side === 'bottom' ? r.w + r.h + r.w / 2 : 2 * r.w + r.h + r.h / 2;
  }
  var WAVE_SEGMENTS = 10;
  // The distances (from s0, going `dir`) to sample a streak at: evenly spaced, plus the pane's
  // corners, so the streak turns them instead of cutting across.
  function streakStops(r, s0, dir, from, to) {
    var P = 2 * (r.w + r.h), stops = [], k, d, c;
    for (k = 0; k <= WAVE_SEGMENTS; k++) stops.push(from + (to - from) * k / WAVE_SEGMENTS);
    var corners = [0, r.w, r.w + r.h, 2 * r.w + r.h];
    for (k = 0; k < 4; k++) {
      c = corners[k];
      d = (((dir * (c - s0)) % P) + P) % P;
      if (d > from + 1 && d < to - 1) stops.push(d);
    }
    return stops.sort(function (a, b) { return a - b; });
  }
  function drawStreak(r, s0, dir, from, to, col, env) {
    var stops = streakStops(r, s0, dir, from, to), i, u, a, wd, prev, next;
    for (var pass = 0; pass < 2; pass++) {                 // glow under, line over
      prev = pointOnRect(r, s0 + dir * stops[0]);
      for (i = 1; i < stops.length; i++) {
        u = (stops[i] - from) / (to - from);               // 0 = tail, 1 = head
        next = pointOnRect(r, s0 + dir * stops[i]);
        a = cfg.waveAlpha * env * Math.pow(u, 1.6);
        wd = 0.5 + (cfg.waveWidth - 0.5) * u;
        ctx.strokeStyle = rgba(col, pass === 0 ? a * 0.18 : a);
        ctx.lineWidth = pass === 0 ? wd * 3 : wd;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(next.x, next.y); ctx.stroke();
        prev = next;
      }
    }
  }
  function drawWave(now) {
    var wv = state.wave, el = now - wv.ts;
    if (el < 0) return;                                    // the trail is still on its way
    var x = clamp01(el / cfg.waveMs);
    if (x >= 1) { state.wave = null; state.dirty = true; return; }
    var r = { x: wv.rect.x + 1, y: wv.rect.y + 1, w: Math.max(2, wv.rect.w - 2), h: Math.max(2, wv.rect.h - 2) };
    var P = 2 * (r.w + r.h), half = P / 2, L = P * cfg.waveLength;
    var travel = (half + L) * (0.5 - 0.5 * Math.cos(Math.PI * x));   // eases in and out
    var head = Math.min(half, travel), tail = Math.max(0, travel - L);
    var env = x < 0.9 ? 1 : clamp01((1 - x) / 0.1), col = wv.col, s0 = sideStart(r, wv.side);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.lineCap = 'butt';                                  // round caps would double up where segments meet
    if (head - tail > 1) {
      drawStreak(r, s0, 1, tail, head, col, env);
      drawStreak(r, s0, -1, tail, head, col, env);
    }
    // where they meet: a small soft bloom as they arrive, gone as the tails catch up
    var bloom = Math.pow(head / half, 8) * (1 - clamp01((travel - half) / L)) * cfg.waveAlpha * env;
    if (bloom > 0.01) {
      var m = pointOnRect(r, s0 + half), g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 10);
      g.addColorStop(0, rgba(col, 0.4 * bloom)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(m.x - 10, m.y - 10, 20, 20);
    }
    ctx.restore();
    state.dirty = true;
  }

  // ---------------------------------------------------------------- loop / lifecycle
  function tick(now) {
    if (now === undefined) now = state.clock();
    var t = cfg.enabled ? resolveTarget() : null;
    step(now, t);
    if (state.anim && !advance(state.anim, now)) state.anim = null;
    render(now);
    if (state.wave) drawWave(now);
  }
  function frame() {
    state.raf = requestAnimationFrame(frame);
    tick();
  }
  function start() { if (!state.raf && !state.manual) state.raf = requestAnimationFrame(frame); }
  function stop() { if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; } }

  function onResize() { resize(); }
  G.addEventListener('resize', onResize);

  var api = {
    version: '0.3.0',
    config: cfg,
    state: state,
    tick: tick,
    debug: function () {
      var a = state.anim;
      return a ? { mode: a.mode, length: pathLen(a.pts), points: a.pts.length } : null;
    },
    resolveTarget: resolveTarget,
    enable: function () { cfg.enabled = true; },
    disable: function () { cfg.enabled = false; state.anim = null; state.wave = null; state.dirty = true; render(0); },
    // test hooks: drive the clock by hand
    manual: function (on) { state.manual = !!on; if (on) stop(); else start(); },
    reset: function () { state.last = null; state.anim = null; state.wave = null; state.dirty = true; render(0); },
    canvas: canvas,
    destroy: function () {
      stop(); G.removeEventListener('resize', onResize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      delete G.cursorTrail;
    }
  };
  G.cursorTrail = api;

  if (document.body) { mount(); start(); }
  else document.addEventListener('DOMContentLoaded', function () { mount(); start(); });
})();
