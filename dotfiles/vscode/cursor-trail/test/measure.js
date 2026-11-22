/* Measurement helpers for the mock harness (test/harness.html).
 * runMeasure() replays the reference jump and returns the same metrics that were measured
 * from the reference footage, next to the reference numbers, so the look can be tuned. */
(function () {
  var BG = [15, 15, 12], CARET = [230, 59, 62];
  var OLD = { x: 305, y: 247 }, HEAD = { x: 401.5, y: 537.7 };
  var REF = {
    tail_s: [263.7, 194.4, 134.9, 91.6, 53.7, 31.9, 2.1],
    widths_f1: '39/27/19/10', widths_f2: '34/22/9/-', widths_f3: '27/9/-/-', widths_f4: '19/-/-/-', widths_f5: '13/-/-/-',
    axis_f1: { 34: 239, 62: 234, 91: 233, 120: 209, 149: 177, 177: 146, 206: 106, 235: 71, 264: 32 },
    perp_f1: { '-9': 63, '-6': 109, '-3': 193, '0': 204, '3': 128, '6': 71, '9': 46, '12': 32, '15': 19, '18': 12, '21': 4 },
    halo_r10: [91, 87, 83, 71, 58, 40, 19], halo_r16: [55, 55, 50, 44, 34, 27, 9], halo_r24: [24, 22, 20, 18, 15, 12, 6], halo_r32: [10, 9, 8, 7, 5, 3, 1],
    block_rgb_f1: [255, 101, 99]
  };

  function inCaret(x, y) { return x >= HEAD.x - 5 && x <= HEAD.x + 5 && y >= HEAD.y - 9.75 && y <= HEAD.y + 9.75; }

  // composite the overlay canvas over the mock page (dark bg, red caret block at HEAD)
  function composite(T) {
    var cv = T.canvas, img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), d = img.data;
    var w = cv.width, h = cv.height, R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x), p = i * 4, a = d[p + 3] / 255, bg = inCaret(x, y) ? CARET : BG;
      R[i] = d[p] * a + bg[0] * (1 - a); G[i] = d[p + 1] * a + bg[1] * (1 - a); B[i] = d[p + 2] * a + bg[2] * (1 - a);
    }
    return { R: R, G: G, B: B, w: w, h: h };
  }

  function metrics(c, ux, uy) {
    var nx = -uy, ny = ux, w = c.w, h = c.h, out = {};
    function dR(x, y) { var v = c.R[y * w + x] - (inCaret(x, y) ? CARET[0] : BG[0]); return v < 0 ? 0 : v; }
    var tail = 0, pts = [];
    for (var y = 225; y < 600; y++) for (var x = 250; x < 520; x++) {
      var D = dR(x, y);
      if (D > 40) { var px = x - HEAD.x, py = y - HEAD.y, s = px * ux + py * uy, ww = px * nx + py * ny; pts.push([s, ww, D]); if (s > tail) tail = s; }
    }
    out.tail_s = +tail.toFixed(1);
    var ws = [];
    [40, 100, 160, 220].forEach(function (sc) {
      var mn = 1e9, mx = -1e9, n = 0;
      pts.forEach(function (p) { if (Math.abs(p[0] - sc) < 4) { n++; if (p[1] < mn) mn = p[1]; if (p[1] > mx) mx = p[1]; } });
      ws.push(n > 3 ? Math.round(mx - mn) : '-');
    });
    out.widths = ws.join('/');
    out.pts = pts.length; out._tail = tail;
    return out;
  }
  function axisProfile(c, ux, uy, tail) {
    var res = {};
    for (var i = 0; i < 10; i++) {
      var sc = 5 + (tail - 5) * i / 9, sum = 0, n = 0;
      for (var y = 225; y < 600; y++) for (var x = 250; x < 520; x++) {
        var px = x - HEAD.x, py = y - HEAD.y, s = px * ux + py * uy, ww = px * -uy + py * ux;
        if (Math.abs(s - sc) < 3 && Math.abs(ww) < 2) { var v = c.R[y * c.w + x] - (inCaret(x, y) ? CARET[0] : BG[0]); sum += v < 0 ? 0 : v; n++; }
      }
      res[Math.round(sc)] = n ? Math.round(sum / n) : 0;
    }
    return res;
  }
  function perpProfile(c, ux, uy, sc0) {
    var res = {};
    for (var wv = -21; wv <= 21; wv += 3) {
      var sum = 0, n = 0;
      for (var y = 225; y < 600; y++) for (var x = 250; x < 520; x++) {
        var px = x - HEAD.x, py = y - HEAD.y, s = px * ux + py * uy, ww = px * -uy + py * ux;
        if (Math.abs(s - sc0) < 3 && Math.abs(ww - wv) < 1.5) { var v = c.R[y * c.w + x] - BG[0]; sum += v < 0 ? 0 : v; n++; }
      }
      res[wv] = n ? Math.round(sum / n) : 0;
    }
    return res;
  }
  function haloAt(c, rv) {
    var sum = 0, n = 0;
    for (var y = 225; y < 600; y++) for (var x = 250; x < 520; x++) {
      var r = Math.hypot(x - HEAD.x, y - HEAD.y);
      if (Math.abs(r - rv) < 1.5 && ((x - HEAD.x) > 6 || (y - HEAD.y) > 14)) { var v = c.R[y * c.w + x] - (inCaret(x, y) ? CARET[0] : BG[0]); sum += v; n++; }
    }
    return n ? +(sum / n).toFixed(1) : 0;
  }
  function blockRGB(c) {
    var vals = [[], [], []];
    for (var y = 530; y < 546; y++) for (var x = 398; x < 406; x++) { var i = y * c.w + x; vals[0].push(c.R[i]); vals[1].push(c.G[i]); vals[2].push(c.B[i]); }
    return vals.map(function (a) { a.sort(function (p, q) { return p - q; }); return Math.round(a[a.length >> 1]); });
  }

  window.runMeasure = function (overrides) {
    var T = window.cursorTrail; T.manual(true);
    if (overrides) for (var k in overrides) T.config[k] = overrides[k];
    T.reset(); window.placeCaretCenter(OLD.x, OLD.y); window.focusEditor(); T.tick(0);
    window.placeCaretCenter(HEAD.x, HEAD.y); T.tick(1000);
    var ax = OLD.x - HEAD.x, ay = OLD.y - HEAD.y, L = Math.hypot(ax, ay), ux = ax / L, uy = ay / L;
    var rows = [], f1 = null;
    for (var f = 0; f < 7; f++) {
      T.tick(1000 + 5 + f * 33.333);
      var c = composite(T), m = metrics(c, ux, uy);
      var row = { f: 21 + f, tail_s: m.tail_s, widths: m.widths, r10: haloAt(c, 10), r16: haloAt(c, 16), r24: haloAt(c, 24), r32: haloAt(c, 32), block: blockRGB(c) };
      if (f === 0) f1 = { axis: axisProfile(c, ux, uy, m._tail), perp: perpProfile(c, ux, uy, m._tail * 0.5) };
      rows.push(row);
    }
    return { cfg: T.config, rows: rows, f1: f1, ref: REF };
  };

  // which target does each kind of focus resolve to?
  window.runKinds = function () {
    var T = window.cursorTrail, out = {};
    T.manual(true);
    window.placeCaretCenter(450, 120); window.focusEditor(); var t = T.resolveTarget(); out.editor = t && { kind: t.kind, rect: t.rect };
    window.focusRow(3); t = T.resolveTarget(); out.row = t && { kind: t.kind, rect: t.rect, row: t.row };
    window.focusTerminal(); t = T.resolveTarget(); out.terminal = t && { kind: t.kind, rect: t.rect };
    window.focusInput(); t = T.resolveTarget(); out.input = t && { kind: t.kind, rect: t.rect };
    return out;
  };

  // Holding a key: the head steps `rows` rows every `gap` ms for `steps` steps, rendered at 60 Hz,
  // then stops. Returns [ms, headY, mode, trailLength] samples so collapses between steps show up.
  window.runHold = function (o) {
    o = o || {};
    var steps = o.steps || 40, rowH = 19.5 * (o.rows || 1), gap = o.gap || 33.333, frame = 16.667, tail = (o.tail === undefined ? 900 : o.tail);
    var T = window.cursorTrail; T.manual(true); T.reset();
    var x0 = 600, y = 100; window.placeCaretCenter(x0, y); window.focusEditor(); T.tick(0);
    var t0 = 1000, next = t0, moved = 0, log = [], n = 0;
    for (var t = t0; t <= t0 + steps * gap + tail; t += frame) {
      if (moved < steps && t >= next) { y += rowH; window.placeCaretCenter(x0, y); moved++; next += gap; }
      T.tick(t);
      var d = T.debug();
      if (n++ % (o.every || 3) === 0) log.push([Math.round(t - t0), Math.round(y), d ? d.mode : '-', d ? Math.round(d.length) : 0]);
    }
    return log;
  };

  // the reference vertical jump, frozen at reference frame 21+f for a screenshot
  window.runJump = function (f) {
    var T = window.cursorTrail; T.manual(true); T.reset();
    window.placeCaretCenter(OLD.x, OLD.y); window.focusEditor(); T.tick(0);
    window.placeCaretCenter(HEAD.x, HEAD.y); T.tick(1000); T.tick(1000 + 5 + f * 33.333);
    return !!T.state.anim;
  };

  // editor -> sidebar row switch, left frozen at frame `f` (33 ms steps) for a screenshot
  window.runSwitch = function (f, toKind) {
    var T = window.cursorTrail; T.manual(true); T.reset();
    window.placeCaretCenter(560, 140); window.focusEditor(); T.tick(0);
    if (toKind === 'terminal') window.focusTerminal(); else window.focusRow(5);
    T.tick(5000);
    T.tick(5000 + 19 + f * 33.333);
    return { anim: !!T.state.anim, kind: T.state.last && T.state.last.kind };
  };
})();
