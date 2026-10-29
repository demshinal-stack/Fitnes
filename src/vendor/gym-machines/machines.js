/* Interactive gym-machine animations (vanilla JS, no deps).
 * Usage: GymMachines.mount(el, id, {height, mass, value, onChange})
 *   id: seated-leg-curl | seated-cable-row | cable-triceps-pushdown | hip-abduction | hip-adduction
 *   value: {weight, back, start}  (back/start only for seated-leg-curl)
 *   weights: optional stack in kg (overrides the default 10-100 step 5)
 *   rec: optional {weight, back, start} recommendation (overrides the height/mass estimate)
 * Returns {update({user, value, weights, rec}), get(), destroy()}.
 * Clicking the weight stack / backrest / start wheel calls opts.onPick(part) so the host can open its picker.
 */
(function (root) {
  'use strict';
  var W = 400, H = 300, FLOOR = 262, DUR = 4200;
  var Lb = { trunk: 72, ua: 42, fa: 38, th: 56, sh: 54, ft: 18, neck: 10, head: 13 };

  // ---------- math ----------
  function rad(a) { return a * Math.PI / 180; }
  function vec(a, l) { return [Math.cos(rad(a)) * l, -Math.sin(rad(a)) * l]; }
  function add(p, v) { return [p[0] + v[0], p[1] + v[1]]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp2(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
  function angOf(p, q) { return Math.atan2(-(q[1] - p[1]), q[0] - p[0]) * 180 / Math.PI; }
  function ik(r, t, l1, l2, bend) {
    var dx = t[0] - r[0], dy = t[1] - r[1], d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.3, d));
    var base = Math.atan2(dy, dx);
    var a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    var j = [r[0] + Math.cos(base + bend * a) * l1, r[1] + Math.sin(base + bend * a) * l1];
    var b2 = Math.atan2(t[1] - j[1], t[0] - j[0]);
    return [j, [j[0] + Math.cos(b2) * l2, j[1] + Math.sin(b2) * l2]];
  }
  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function progress(t) {
    if (t < 0.32) return ease(t / 0.32);
    if (t < 0.42) return 1;
    if (t < 0.86) return 1 - ease((t - 0.42) / 0.44);
    return 0;
  }

  // ---------- path helpers ----------
  function n(v) { return Math.round(v * 10) / 10; }
  function P() { var a = arguments, s = 'M' + n(a[0][0]) + ' ' + n(a[0][1]); for (var i = 1; i < a.length; i++) s += ' L' + n(a[i][0]) + ' ' + n(a[i][1]); return s; }
  function circ(c, r) { return 'M' + n(c[0] - r) + ' ' + n(c[1]) + ' a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0'; }
  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return 'M' + n(x + r) + ' ' + n(y) + ' H' + n(x + w - r) + ' Q' + n(x + w) + ' ' + n(y) + ' ' + n(x + w) + ' ' + n(y + r) +
      ' V' + n(y + h - r) + ' Q' + n(x + w) + ' ' + n(y + h) + ' ' + n(x + w - r) + ' ' + n(y + h) + ' H' + n(x + r) +
      ' Q' + n(x) + ' ' + n(y + h) + ' ' + n(x) + ' ' + n(y + h - r) + ' V' + n(y + r) + ' Q' + n(x) + ' ' + n(y) + ' ' + n(x + r) + ' ' + n(y) + ' Z';
  }
  function capsule(a, b, r) {
    var an = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(an) * r, ny = Math.cos(an) * r;
    return 'M' + n(a[0] + nx) + ' ' + n(a[1] + ny) + ' L' + n(b[0] + nx) + ' ' + n(b[1] + ny) + ' A' + r + ' ' + r + ' 0 0 0 ' + n(b[0] - nx) + ' ' + n(b[1] - ny) +
      ' L' + n(a[0] - nx) + ' ' + n(a[1] - ny) + ' A' + r + ' ' + r + ' 0 0 0 ' + n(a[0] + nx) + ' ' + n(a[1] + ny) + ' Z';
  }

  // ---------- rig ----------
  function solve(pose, Lx) {
    var L = Lx || Lb, J = { hip: pose.hip }, ta = pose.trunk;
    J.sho = add(J.hip, vec(ta, L.trunk));
    J.neck = add(J.sho, vec(ta, L.neck));
    J.head = add(J.neck, vec(ta, L.head + 2));
    if (pose.arm.ik) { var r = ik(J.sho, pose.arm.ik, L.ua, L.fa, pose.arm.bend); J.elb = r[0]; J.wri = r[1]; }
    else { J.elb = add(J.sho, vec(pose.arm.a[0], L.ua)); J.wri = add(J.elb, vec(pose.arm.a[1], L.fa)); }
    if (pose.leg.ik) { var q = ik(J.hip, pose.leg.ik, L.th, L.sh, pose.leg.bend); J.kne = q[0]; J.ank = q[1]; }
    else { J.kne = add(J.hip, vec(pose.leg.a[0], L.th)); J.ank = add(J.kne, vec(pose.leg.a[1], L.sh)); }
    var fa = pose.foot != null ? pose.foot : angOf(J.kne, J.ank) + 90;
    J.toe = add(J.ank, vec(fa, L.ft)); J.heel = add(J.ank, vec(fa + 180, 5));
    return J;
  }
  function unit(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  function sc(v, k) { return [v[0] * k, v[1] * k]; }
  // Side-view head of the girl: profile face (nose, chin), hair cap, full ponytail with a tie.
  // face = +1 when the face is on the clockwise side of the neck->head axis (e.g. upright, looking right).
  function headSide(neck, head, face) {
    var u = unit(neck, head), f = sc([-u[1], u[0]], face || 1), b = sc(f, -1);
    function at(df, du) { return add(add(head, sc(f, df)), sc(u, du)); }
    var tie = at(-10, 6), t1 = at(-16, 2), t2 = at(-18, -14), tip = at(-12, -31), t3 = at(-7, -14);
    var nose = at(13.5, 0.5), brow = at(11, 5), lip = at(11.5, -4), chin = at(8.5, -8.5), jaw = at(1, -10);
    function q(p) { return n(p[0]) + ' ' + n(p[1]); }
    return [
      ['fig', 'pony', 'M' + q(tie) + ' Q' + q(t1) + ' ' + q(t2) + ' Q' + q(at(-17, -27)) + ' ' + q(tip) + ' Q' + q(at(-9, -25)) + ' ' + q(t3) + ' Q' + q(at(-8, -2)) + ' ' + q(tie) + ' Z'],
      ['fig', 'hd', circ(at(1.5, 0.5), 10.5)],
      ['fig', 'hd', 'M' + q(brow) + ' L' + q(nose) + ' L' + q(at(11, -1.5)) + ' L' + q(lip) + ' Q' + q(at(10.5, -8)) + ' ' + q(chin) + ' L' + q(jaw) + ' L' + q(at(0, 0)) + ' Z'],
      ['fig', 'hair', 'M' + q(at(9, 7)) + ' Q' + q(at(4, 14)) + ' ' + q(at(-4, 11.5)) + ' Q' + q(at(-12, 7)) + ' ' + q(at(-10.5, -3)) + ' Q' + q(at(-7, -9)) + ' ' + q(at(-2, -8)) + ' Q' + q(at(-4, 0)) + ' ' + q(at(1, 2)) + ' Q' + q(at(6, 6)) + ' ' + q(at(9, 7)) + ' Z'],
      ['fig', 'tie', circ(tie, 2.4)]
    ];
  }
  // Front-view head: hair framing the face, hair falling to the shoulders, soft features.
  function headFront(c) {
    var x = c[0], y = c[1];
    return [
      ['fig', 'hair', 'M' + n(x - 13) + ' ' + n(y + 20) + ' Q' + n(x - 17) + ' ' + n(y - 4) + ' ' + n(x - 10) + ' ' + n(y - 13) + ' Q' + n(x) + ' ' + n(y - 20) + ' ' + n(x + 10) + ' ' + n(y - 13) + ' Q' + n(x + 17) + ' ' + n(y - 4) + ' ' + n(x + 13) + ' ' + n(y + 20) + ' Z'],
      ['fig', 'hd', 'M' + n(x - 9.5) + ' ' + n(y - 2) + ' Q' + n(x - 10) + ' ' + n(y + 10) + ' ' + n(x) + ' ' + n(y + 14) + ' Q' + n(x + 10) + ' ' + n(y + 10) + ' ' + n(x + 9.5) + ' ' + n(y - 2) + ' Q' + n(x) + ' ' + n(y - 12) + ' ' + n(x - 9.5) + ' ' + n(y - 2) + ' Z'],
      ['fig', 'hair', 'M' + n(x - 10) + ' ' + n(y - 1) + ' Q' + n(x - 3) + ' ' + n(y - 8) + ' ' + n(x + 10) + ' ' + n(y - 1) + ' Q' + n(x + 8) + ' ' + n(y - 13) + ' ' + n(x) + ' ' + n(y - 13) + ' Q' + n(x - 9) + ' ' + n(y - 13) + ' ' + n(x - 10) + ' ' + n(y - 1) + ' Z']
    ];
  }
  function figure(J, act) {
    act = act || [];
    function c(k) { return act.indexOf(k) >= 0 ? k + ' act' : k; }
    var u = unit(J.hip, J.sho), f = sc([-u[1], u[0]], J.face || 1);
    return [
      ['fig', c('th'), P(J.hip, J.kne)], ['fig', c('sh'), P(J.kne, J.ank)], ['fig', 'ft-o', P(J.heel, J.toe)], ['fig', 'ft', P(J.heel, J.toe)],
      ['fig', 'glute', circ(add(J.hip, sc(f, -2)), 11)], ['fig', c('tr'), P(J.hip, add(J.sho, sc(u, -2)))], ['fig', 'nk', P(J.sho, J.neck)]
    ].concat(headSide(J.neck, J.head, J.face), [
      ['fig', c('ua'), P(J.sho, J.elb)], ['fig', c('fa'), P(J.elb, J.wri)], ['fig', 'hand', circ(J.wri, 5)]
    ]);
  }

  // ---------- weight stack ----------
  // weights: array of kg values; sel/rec: indexes. Plates are drawn top = lightest.
  function stack(x, p, st, lift) {
    var s = [], w = 34, cnt = st.weights.length, ph = Math.min(9, 150 / cnt), base = FLOOR - 4;
    var top = base - cnt * ph;
    lift = lift == null ? 24 : lift;
    var selN = st.sel + 1, dy = -lift * p;
    s.push(['back', 'frame', rrect(x - 5, top - 46, w + 10, FLOOR - top + 46, 5)]);
    for (var i = 0; i < cnt; i++) {
      var moving = i < selN, y = top + i * ph + (moving ? dy : 0);
      var over = moving && st.rec != null && i > st.rec;
      s.push(['back', over ? 'plate over-plate' : moving ? 'plate act-plate' : 'plate', rrect(x, y, w, ph - 1.4, 1.5)]);
    }
    // pin under the selected plate
    var pinY = top + (selN - 1) * ph + ph / 2 + dy;
    s.push(['back', 'pin', circ([x + w + 4, pinY], 3)]);
    s.push(['back', 'rod', P([x + w / 2, top - 34 + dy], [x + w / 2, top + dy])]);
    // labels: selected + recommended
    s.push(['front', 'lbl-bg', rrect(x + w / 2 - 22, top - 66, 44, 18, 9)]);
    s.push(['front', 'lbl sel-lbl', { x: x + w / 2, y: top - 53, t: st.weights[st.sel] + ' кг', a: 'middle' }]);
    if (st.rec != null && st.sel > st.rec) s.push(['front', 'lbl warn', { x: x + w / 2, y: top - 72, t: '+' + (st.weights[st.sel] - st.weights[st.rec]) + ' кг', a: 'middle' }]);
    if (st.rec != null && st.rec !== st.sel) {
      var ry = top + st.rec * ph + ph / 2;
      s.push(['back', 'rec-mark', P([x - 9, ry], [x - 3, ry])]);
      s.push(['front', 'lbl rec-lbl', { x: x - 11, y: ry + 3, t: 'рек. ' + st.weights[st.rec], a: 'end' }]);
    }
    s.topY = top - 34 + dy; s.cx = x + w / 2;
    return s;
  }

  // ---------- exercises ----------
  var EX = {};

  // Neverest seated leg curl: stack behind the backrest, 6 backrest holes, 6 start positions.
  EX['seated-leg-curl'] = function (p, ctx) {
    var s = [], v = ctx.value, u = ctx.user;
    var thigh = 0.245 * u.height, shin = 0.246 * u.height;
    var L = Object.assign({}, Lb, { th: 56 + (thigh - 44.1) * 2.5, sh: 54 + (shin - 44.3) * 2.5 });
    var PV = [262, 186];
    function backX(k) { return PV[0] - 54.75 - (k - 1) * 5 - 14; }
    var bx = backX(v.back), hip = [bx + 14, 186];
    var startA = -12 - (v.start - 1) * 9, a = lerp(startA, -112, p);
    var knee = add(hip, [L.th, 0]);
    var pose = { hip: hip, trunk: 104, arm: { ik: [PV[0] - 26, 170], bend: 1 }, leg: { a: [0, a] } };
    var J = solve(pose, L);
    // stack behind the machine (left)
    var st = stack(22, p, ctx.stack);
    s = s.concat(st);
    s.push(['back', 'pulley', circ([st.cx, 40], 6)]);
    s.push(['back', 'cable', P([st.cx, st.topY], [st.cx, 40], [PV[0] - 4, 40], [PV[0] - 4, PV[1] - 14])]);
    s.push(['back', 'pulley', circ([PV[0] - 4, 40], 6)]);
    // frame
    s.push(['back', 'metal', P([96, FLOOR - 2], [282, FLOOR - 2])]);
    s.push(['back', 'metal', P([150, 206], [150, FLOOR - 2])]);
    s.push(['back', 'metal', P([PV[0], PV[1]], [PV[0], FLOOR - 2])]);
    // backrest rail with 6 holes + dimension
    var ry = 230, rx = function (k) { return 196 - (k - 1) * 11; };
    s.push(['back', 'rail', P([rx(6) - 7, ry], [rx(1) + 7, ry])]);
    for (var k = 1; k <= 6; k++) {
      var hx = rx(k), cls = k === v.back ? 'hole on' : 'hole';
      if (k === ctx.rec.back && k !== v.back) cls += ' rec';
      s.push(['mid', cls, circ([hx, ry], 2.2), 'back']);
      s.push(['front', 'lbl tiny' + (k === v.back ? ' on' : ''), { x: hx, y: ry + 12, t: String(k), a: 'middle' }]);
    }
    s.push(['front', 'lbl tiny dim', { x: rx(3.5), y: ry + 23, t: 'спинка · шаг ≈ 2 см', a: 'middle' }]);
    s.push(['back', 'metal-thin', P([bx - 2, 200], [bx - 2, 214], [rx(v.back), 214], [rx(v.back), ry - 4])]);
    s.push(['front', 'hit', rrect(rx(6) - 12, ry - 10, 82, 38, 6), 'back']);
    // backrest (moves with holes) + seat
    var ta = 104, off = [Math.cos(rad(ta + 90)) * 14, -Math.sin(rad(ta + 90)) * 14];
    var b0 = add(add(hip, off), vec(ta, -6)), b1 = add(add(hip, off), vec(ta, 92));
    s.push(['mid', 'pad tap', capsule(b0, b1, 8), 'back']);
    s.push(['mid', 'pad', rrect(bx + 2, 194, PV[0] - bx - 10, 13, 6)]);
    // thigh hold-down pad
    s.push(['back', 'metal-thin', P([PV[0] - 30, 166], [PV[0] - 30, 150], [PV[0] + 4, 150], [PV[0] + 4, 180])]);
    s.push(['front', 'pad', capsule([PV[0] - 44, 170], [PV[0] - 14, 170], 7)]);
    // glow + figure
    s.push(['mid', 'glow', capsule(add(hip, [10, 6]), add(knee, [-6, 6]), 9)]);
    s = s.concat(figure(J, ['th']));
    // lever + roller behind the calf (lever pivots on machine axis PV)
    var lever = L.sh - 6, rp = add(PV, vec(a, lever));
    var sd = Math.atan2(rp[1] - PV[1], rp[0] - PV[0]);
    var roll = add(rp, [Math.sin(sd) * 11, -Math.cos(sd) * 11]);
    s.push(['back', 'metal', P(PV, roll)]);
    // start-position wheel on the axis, 6 holes
    s.push(['front', 'wheel tap', circ(PV, 17), 'start']);
    for (var j = 1; j <= 6; j++) {
      var ha = 10 - (j - 1) * 20, hp = add(PV, vec(ha, 11)), lp = add(PV, vec(ha, 25));
      var c2 = j === v.start ? 'hole on' : 'hole';
      if (j === ctx.rec.start && j !== v.start) c2 += ' rec';
      s.push(['front', c2, circ(hp, 1.8), 'start']);
      s.push(['front', 'lbl tiny' + (j === v.start ? ' on' : ''), { x: lp[0], y: lp[1] + 3, t: String(j), a: 'middle' }]);
    }
    s.push(['front', 'pad', circ(roll, 9)]);
    s.push(['front', 'hit', circ(PV, 30), 'start']);
    // knee/axis alignment warning
    var miss = v.back - ctx.rec.back;
    if (miss !== 0) { s.push(['front', 'lbl warn', { x: 392, y: 70, t: 'колено не на оси рычага', a: 'end' }]);
      s.push(['front', 'lbl warn', { x: 392, y: 82, t: 'сдвиньте спинку ' + (miss > 0 ? 'вперёд' : 'назад') + ' на ' + Math.abs(miss) + ' отв. (к ' + ctx.rec.back + ')', a: 'end' }]); }
    return s;
  };

  EX['seated-cable-row'] = function (p, ctx) {
    var s = [], hip = [128, 200], tr = lerp(84, 96, p), w = lerp2([206, 158], [152, 176], p);
    var J = solve({ hip: hip, trunk: tr, arm: { ik: w, bend: 1 }, leg: { ik: [230, 236], bend: -1 }, foot: 72 });
    var st = stack(318, p, ctx.stack); s = s.concat(st);
    var pul = [268, 238];
    s.push(['back', 'metal', P([80, FLOOR - 2], [300, FLOOR - 2])]);
    s.push(['back', 'metal', P([128, 216], [128, FLOOR - 2])]);
    s.push(['mid', 'pad', rrect(84, 207, 100, 12, 6)]);
    s.push(['mid', 'pad', capsule([240, 254], [250, 214], 5)]);
    s.push(['back', 'pulley', circ(pul, 7)]);
    s.push(['back', 'pulley', circ([st.cx, 40], 6)]);
    s.push(['back', 'cable', P(J.wri, pul, [296, 252], [296, 40], [st.cx, 40], [st.cx, st.topY])]);
    s.push(['mid', 'glow', circ(add(J.sho, [-12, 22]), 15)]);
    s = s.concat(figure(J, ['ua']));
    s.push(['front', 'grip', P(add(J.wri, [0, -4]), add(J.wri, [0, 4]))]);
    return s;
  };

  EX['cable-triceps-pushdown'] = function (p, ctx) {
    var s = [], J = solve({ hip: [168, 150], trunk: 84, arm: { a: [-82, lerp(46, -84, p)] }, leg: { a: [-91, -90] } });
    var st = stack(330, p, ctx.stack); s = s.concat(st);
    // adjustable pulley column (positions 1-18), carriage at the top
    s.push(['back', 'frame', rrect(282, 26, 18, FLOOR - 26, 4)]);
    for (var i = 0; i < 18; i++) s.push(['back', 'metal-thin', P([291, FLOOR - 16 - i * 12], [291, FLOOR - 15.9 - i * 12])]);
    s.push(['back', 'metal', P([262, FLOOR - 2], [372, FLOOR - 2])]);
    var pul = [278, 44];
    s.push(['back', 'pulley', circ(pul, 7)]);
    s.push(['back', 'pulley', circ([st.cx, 30], 6)]);
    s.push(['back', 'cable', P(add(J.wri, [3, -6]), pul, [st.cx, 30], [st.cx, st.topY])]);
    s.push(['mid', 'glow', capsule(J.sho, J.elb, 11)]);
    s = s.concat(figure(J, ['ua']));
    s.push(['front', 'grip', P(add(J.wri, [3, -6]), add(J.wri, [0, 6]))]);
    return s;
  };

  function hipMachine(p, ctx, outward) {
    var v = ctx.value, kw = function (w) { return 20 + (w - 1) * 8; };   // knee offset for seat position 1..6
    var k0 = kw(v.width || 1), s = [], k = outward ? lerp(k0, Math.min(k0 + 34, 66), p) : lerp(k0, 20, p);
    s.push(['back', 'pad', rrect(146, 56, 68, 118, 14)]);
    s.push(['back', 'metal', P([180, 200], [180, FLOOR - 2])]);
    s.push(['back', 'metal', P([120, FLOOR - 2], [240, FLOOR - 2])]);
    s.push(['mid', 'pad', rrect(138, 170, 84, 14, 7)]);
    var cx = 180;
    s.push(['fig', 'trf', P([cx, 108], [cx, 172])]);
    s.push(['fig', 'shl', P([cx - 24, 108], [cx + 24, 108])]);
    s.push(['fig', 'nk', P([cx, 104], [cx, 94])]);
    s = s.concat(headFront([cx, 80]));
    [-1, 1].forEach(function (g) {
      var hj = [cx + g * 13, 174], kn = [cx + g * k, 190], an = [cx + g * (k * 0.75 + 6), 240];
      s.push(['mid', 'glow', capsule(hj, kn, 12)]);
      s.push(['fig', 'th act', P(hj, kn)]);
      s.push(['fig', 'sh', P(kn, an)]);
      s.push(['fig', 'ft', P(an, [an[0] + g * 4, an[1] + 4])]);
      s.push(['fig', 'ua', P([cx + g * 24, 110], [cx + g * 34, 146])]);
      s.push(['fig', 'fa', P([cx + g * 34, 146], [cx + g * 44, 172])]);
      s.push(['fig', 'hand', circ([cx + g * 44, 174], 5)]);
      var px = kn[0] + g * (outward ? 12 : -12);
      s.push(['front', 'pad', rrect(px - 6, kn[1] - 26, 12, 40, 6)]);
      s.push(['mid', 'metal-thin', P([an[0] - 9, an[1] + 6], [an[0] + 9, an[1] + 6])]);
    });
    // seat position scale 1..6 at knee height: where the pad starts for each position
    var sy = 30, sx = function (w) { return cx - 50 + (w - 1) * 20; };
    s.push(['back', 'rail', P([sx(1) - 8, sy], [sx(6) + 8, sy])]);
    for (var w = 1; w <= 6; w++) {
      var tx = sx(w), cls = w === v.width ? 'hole on' : 'hole';
      if (w === ctx.rec.width && w !== v.width) cls += ' rec';
      s.push(['front', cls, circ([tx, sy], 2.4), 'width']);
      s.push(['front', 'lbl tiny' + (w === v.width ? ' on' : ''), { x: tx, y: sy + 15, t: String(w), a: 'middle' }]);
    }
    s.push(['front', 'lbl tiny dim', { x: sx(1) - 14, y: sy + 3, t: 'вместе', a: 'end' }]);
    s.push(['front', 'lbl tiny dim', { x: sx(6) + 14, y: sy + 3, t: 'шире', a: 'start' }]);
    s.push(['front', 'lbl tiny dim', { x: cx, y: sy - 10, t: 'положение кресла', a: 'middle' }]);
    s.push(['front', 'hit', rrect(sx(1) - 46, sy - 20, 192, 42, 8), 'width']);
    s = s.concat(stack(318, p, ctx.stack, 20));
    return s;
  }
  EX['hip-abduction'] = function (p, c) { return hipMachine(p, c, true); };
  EX['hip-adduction'] = function (p, c) { return hipMachine(p, c, false); };


  // Plate-loaded horn seen from the front: plates edge-on, greedy split of the selected weight.
  // Plates within the recommendation are lime, plates above it use the over colour.
  function plateHorn(x, y, st) {
    var s = [], w = st.weights[st.sel], rec = st.rec != null ? st.weights[st.rec] : null;
    var sizes = [[20, 30], [15, 27], [10, 23], [5, 17], [2.5, 13], [1.25, 10]], left = w, sum = 0, px = x + 8;
    s.push(['back', 'metal', P([x - 30, y], [x + 64, y])]);
    s.push(['back', 'metal', P([x, y - 8], [x, y + 8])]);
    sizes.forEach(function (sz) {
      while (left >= sz[0] - 1e-9) {
        left -= sz[0]; sum += sz[0];
        var over = rec != null && sum > rec + 1e-9;
        s.push(['front', 'plate ' + (over ? 'over-plate' : 'act-plate'), rrect(px, y - sz[1], 6, sz[1] * 2, 2)]);
        px += 7;
      }
    });
    s.push(['front', 'lbl-bg', rrect(x + 2, y - 58, 52, 18, 9)]);
    s.push(['front', 'lbl sel-lbl', { x: x + 28, y: y - 45, t: w + ' кг', a: 'middle' }]);
    if (rec != null && w > rec) s.push(['front', 'lbl warn', { x: x + 28, y: y - 64, t: '+' + (w - rec) + ' кг', a: 'middle' }]);
    if (rec != null) s.push(['front', 'lbl rec-lbl', { x: x + 28, y: y + 46, t: 'рек. ' + rec + ' кг', a: 'middle' }]);
    return s;
  }

  // "Кресло гинеколога": Foreman FP-125, plate-loaded hip abduction. Upright back, knees raised and bent,
  // pads on the outside of the shins; the legs open out to the sides and slightly down. Hands hold the low handles.
  EX['reclined-hip-abduction'] = function (p, ctx) {
    var s = [], cx = 160, hipY = 172;
    s.push(['back', 'pad', rrect(cx - 34, 52, 68, 124, 16)]);
    s.push(['back', 'metal', P([cx - 70, FLOOR - 2], [cx + 70, FLOOR - 2])]);
    s.push(['back', 'metal', P([cx - 46, 198], [cx - 60, FLOOR - 2])]);
    s.push(['back', 'metal', P([cx + 46, 198], [cx + 60, FLOOR - 2])]);
    s.push(['back', 'metal', P([cx + 60, FLOOR - 2], [cx + 120, 150])]);
    s.push(['mid', 'pad', rrect(cx - 44, hipY - 2, 88, 16, 8)]);
    s.push(['fig', 'trf', P([cx, 110], [cx, hipY - 4])]);
    s.push(['fig', 'shl', P([cx - 23, 110], [cx + 23, 110])]);
    s.push(['fig', 'nk', P([cx, 106], [cx, 96])]);
    s = s.concat(headFront([cx, 82]));
    var piv = [cx, hipY + 34];
    s.push(['back', 'pulley', circ(piv, 7)]);
    [-1, 1].forEach(function (g) {
      var hj = [cx + g * 13, hipY + 2], kn = [cx + g * lerp(26, 68, p), lerp(150, 166, p)];
      var an = add(kn, [g * lerp(-2, 6, p), 48]);
      s.push(['mid', 'glow', circ([cx + g * 20, hipY - 2], 14)]);
      var pad = lerp2(kn, an, 0.45);
      pad = add(pad, [g * 12, 0]);
      s.push(['mid', 'metal', P(piv, add(pad, [0, 24]))]);
      s.push(['fig', 'th', P(hj, kn)]);
      s.push(['fig', 'sh', P(kn, an)]);
      s.push(['fig', 'ft', P(an, [an[0] + g * 4, an[1] + 5])]);
      s.push(['mid', 'metal-thin', P([an[0] - 10, an[1] + 7], [an[0] + 10, an[1] + 7])]);
      s.push(['front', 'pad', rrect(pad[0] - 7, pad[1] - 24, 14, 48, 7)]);
      // low handles beside the seat: arms hang down
      var h = [cx + g * 50, hipY + 8];
      s.push(['back', 'metal', P([cx + g * 44, hipY + 8], [cx + g * 44, hipY + 30])]);
      s.push(['fig', 'ua', P([cx + g * 23, 112], [cx + g * 38, 142])]);
      s.push(['fig', 'fa', P([cx + g * 38, 142], h)]);
      s.push(['fig', 'grip', P(add(h, [-5 * g, 0]), add(h, [7 * g, 0]))]);
      s.push(['fig', 'hand', circ(h, 5)]);
      var a0 = [cx + g * 92, 136];
      s.push(['front', 'arrow', P(a0, add(a0, [g * 16, 13]))]);
      s.push(['front', 'arrow', P(add(a0, [g * 10, 14]), add(a0, [g * 16, 13]), add(a0, [g * 15, 6]))]);
    });
    s.push(['front', 'lbl tiny on', { x: cx, y: 30, t: 'в стороны и чуть вниз · руки на нижних рукоятях', a: 'middle' }]);
    s = s.concat(plateHorn(300, lerp(150, 138, p), ctx.stack));
    return s;
  };

  // Dead bug (no machine): supine, opposite arm and leg extend, sides alternate. p runs 0..2 (side A, then B).
  EX['dead-bug'] = function (p) {
    var s = [], y = FLOOR - 14, hip = [222, y], sho = [150, y], head = [126, y - 3];
    var pa = p <= 1 ? p : 0, pb = p > 1 ? p - 1 : 0;   // A: near arm + far leg, B: far arm + near leg
    function arm(q) { var a = lerp(90, 168, q); var e = add(sho, vec(a, Lb.ua)); return [e, add(e, vec(a, Lb.fa))]; }
    function leg(q) { var th = lerp(90, 12, q), sh = lerp(0, 10, q); var k = add(hip, vec(th, Lb.th)), an = add(k, vec(sh, Lb.sh)); return [k, an, add(an, vec(sh + 90, Lb.ft))]; }
    var nA = arm(pa), fA = arm(pb), nL = leg(pb), fL = leg(pa);
    s.push(['back', 'pad', rrect(70, FLOOR - 6, 280, 8, 4)]);
    // far limbs (behind the body)
    s.push(['back', 'th far', P(hip, fL[0])]); s.push(['back', 'sh far', P(fL[0], fL[1])]); s.push(['back', 'ft far', P(fL[1], fL[2])]);
    s.push(['back', 'ua far', P(sho, fA[0])]); s.push(['back', 'fa far', P(fA[0], fA[1])]);
    // body
    s.push(['mid', 'glow', capsule(add(hip, [-8, -6]), add(sho, [16, -6]), 12)]);
    s.push(['fig', 'tr act', P(hip, sho)]);
    s.push(['fig', 'nk', P(sho, [138, y - 2])]);
    s = s.concat(headSide([138, y - 2], head, 1));
    s.push(['fig', 'th', P(hip, nL[0])]); s.push(['fig', 'sh', P(nL[0], nL[1])]); s.push(['fig', 'ft', P(nL[1], nL[2])]);
    s.push(['fig', 'ua', P(sho, nA[0])]); s.push(['fig', 'fa', P(nA[0], nA[1])]);
    s.push(['fig', 'hand', circ(nA[1], 5)]);
    // cue: lower back stays pressed to the mat
    s.push(['front', 'lbl tiny', { x: 186, y: FLOOR + 14, t: 'поясница прижата к полу', a: 'middle' }]);
    return s;
  };


  // Dumbbell front raise ("лайки"): side view + front view. Straight arms rise to shoulder level, hands slightly apart (V).
  EX['dumbbell-front-raise'] = function (p, ctx) {
    var s = [], a = lerp(-84, 0, p);
    // side view (left)
    var J = solve({ hip: [100, 150], trunk: 90, arm: { a: [a, a] }, leg: { a: [-90, -90] } });
    var far = add(J.wri, [-6, -3]);
    s.push(['back', 'ua far', P(add(J.sho, [-6, -2]), add(J.elb, [-6, -3]))]);
    s.push(['back', 'fa far', P(add(J.elb, [-6, -3]), far)]);
    s.push(['back', 'bell far', circ(far, 7)]);
    s.push(['mid', 'glow', circ(add(J.sho, [4, 4]), 13)]);
    s = s.concat(figure(J, ['ua']));
    s.push(['front', 'bell', circ(J.wri, 8)]);
    s.push(['front', 'grip', P(add(J.wri, [0, -3]), add(J.wri, [0, 3]))]);
    s.push(['back', 'guide', P([J.sho[0] + 60, J.sho[1]], [192, J.sho[1]])]);
    s.push(['front', 'lbl tiny', { x: 100, y: 28, t: 'СБОКУ', a: 'middle' }]);
    // front view (right): arms foreshorten as they come up, hands end a little wider than the shoulders
    var cx = 296, shY = 108;
    s.push(['back', 'guide', P([cx - 88, shY], [cx + 88, shY])]);
    s.push(['front', 'lbl tiny', { x: 392, y: shY - 6, t: 'уровень плеч', a: 'end' }]);
    s.push(['fig', 'trf', P([cx, shY], [cx, 172])]);
    s.push(['fig', 'shl', P([cx - 24, shY], [cx + 24, shY])]);
    s.push(['fig', 'nk', P([cx, shY - 4], [cx, shY - 14])]);
    s = s.concat(headFront([cx, shY - 28]));
    [-1, 1].forEach(function (g) {
      s.push(['fig', 'th', P([cx + g * 9, 172], [cx + g * 11, 216])]);
      s.push(['fig', 'sh', P([cx + g * 11, 216], [cx + g * 12, 258])]);
      s.push(['fig', 'ft', P([cx + g * 12, 258], [cx + g * 18, 260])]);
      var sho = [cx + g * 24, shY + 2], hand = [cx + g * lerp(30, 38, p), lerp(188, shY + 6, p)], k = lerp(1, 1.6, p);
      var elb = lerp2(sho, hand, 0.52);
      s.push(['mid', 'glow', circ([cx + g * 26, shY + 2], 12)]);
      s.push(['fig', 'ua act', P(sho, elb)]);
      s.push(['fig', 'fa', P(elb, hand)]);
      s.push(['front', 'metal-thin', P(add(hand, [-9 * k, 0]), add(hand, [9 * k, 0]))]);
      s.push(['front', 'bell', rrect(hand[0] - 13 * k, hand[1] - 7 * k, 5 * k, 14 * k, 2)]);
      s.push(['front', 'bell', rrect(hand[0] + 8 * k, hand[1] - 7 * k, 5 * k, 14 * k, 2)]);
      s.push(['front', 'hand', circ(hand, 5 * k)]);
    });
    s.push(['front', 'lbl tiny', { x: cx, y: 28, t: 'СПЕРЕДИ · руки чуть шире плеч', a: 'middle' }]);
    s.push(['back', 'metal-thin', P([200, 40], [200, 250])]);
    var st = ctx.stack;
    s.push(['front', 'lbl-bg', rrect(154, 270, 92, 22, 11)]);
    s.push(['front', 'lbl sel-lbl', { x: 200, y: 285, t: '2 × ' + st.weights[st.sel] + ' кг', a: 'middle' }]);
    return s;
  };

  // Crunch on a fitness ball: upper back curls up AND the pelvis tilts back (lower abs pull the pubic bone toward the ribs).
  EX['ball-crunch'] = function (p) {
    var s = [], ball = [190, 226];
    var hip = [lerp(210, 212, p), lerp(196, 191, p)];
    var lowA = lerp(172, 148, p), upA = lerp(164, 116, p);
    var mid = add(hip, vec(lowA, 34)), sho = add(mid, vec(upA, 38));
    var trA = angOf(hip, sho), head = add(sho, vec(upA, Lb.neck + Lb.head + 2));
    var J = solve({ hip: hip, trunk: trA, arm: { ik: add(head, vec(upA + 90, 6)), bend: -1 }, leg: { ik: [284, 254], bend: -1 }, foot: 0 });
    J.sho = sho; J.neck = add(sho, vec(upA, Lb.neck)); J.head = head;
    var r = ik(sho, add(head, vec(upA + 90, 6)), Lb.ua, Lb.fa, -1); J.elb = r[0]; J.wri = r[1];
    s.push(['back', 'ball', circ(ball, 34)]);
    s.push(['back', 'ball-hl', 'M' + n(ball[0] - 22) + ' ' + n(ball[1] - 22) + ' A30 30 0 0 1 ' + n(ball[0] + 6) + ' ' + n(ball[1] - 33)]);
    // glow on upper and lower abs
    s.push(['mid', 'glow', capsule(add(mid, vec(upA, 6)), add(mid, vec(upA, 30)), 12)]);
    s.push(['mid', 'glow low', capsule(add(hip, vec(lowA, 4)), add(hip, vec(lowA, 30)), 13)]);
    var fig = figure(J, []).filter(function (sh) { return sh[1].indexOf('tr') !== 0 && true; });
    fig.splice(3, 0, ['fig', 'tr act', P(hip, mid)], ['fig', 'tr act', P(mid, sho)]);
    s = s.concat(fig);
    // tilt cue: little arc at the pelvis
    var c = add(hip, [6, 14]);
    s.push(['front', 'arrow', 'M' + n(c[0] + 10) + ' ' + n(c[1] + 4) + ' A12 12 0 0 1 ' + n(c[0] - 8) + ' ' + n(c[1] - 6)]);
    s.push(['front', 'lbl tiny on', { x: 262, y: 162, t: 'низ пресса: таз подкручен', a: 'start' }]);
    s.push(['front', 'lbl tiny', { x: 180, y: FLOOR + 14, t: 'поясница на мяче, тянем лобок к рёбрам', a: 'middle' }]);
    return s;
  };


  // Scales and shifts shapes (absolute M/L/H/V/Q/A and relative a commands) so two views fit one frame.
  function xform(shapes, k, tx, ty) {
    function X(v) { return n(v * k + tx); } function Y(v) { return n(v * k + ty); }
    return shapes.map(function (sh) {
      var d = sh[2], out;
      if (typeof d !== 'string') out = { x: d.x * k + tx, y: d.y * k + ty, t: d.t, a: d.a };
      else out = d.replace(/([MLHVQAaZ])([^MLHVQAaZ]*)/g, function (m, c, args) {
        var v = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [], r = [];
        if (c === 'M' || c === 'L' || c === 'Q') for (var i = 0; i < v.length; i += 2) r.push(X(v[i]), Y(v[i + 1]));
        else if (c === 'H') r.push(X(v[0]));
        else if (c === 'V') r.push(Y(v[0]));
        else if (c === 'A') r.push(n(v[0] * k), n(v[1] * k), v[2], v[3], v[4], X(v[5]), Y(v[6]));
        else if (c === 'a') for (var j = 0; j < v.length; j += 7) r.push(n(v[j] * k), n(v[j + 1] * k), v[j + 2], v[j + 3], v[j + 4], n(v[j + 5] * k), n(v[j + 6] * k));
        return c + r.join(' ') + ' ';
      });
      return [sh[0], sh[1], out, sh[3]];
    });
  }

  // Neverest NR-6801 chest press: stack behind the seat, levers hang from an overhead pivot in front.
  // Side view (scaled, left) + front view (right): shoulders stay down, hands stop before the chest line.
  EX['chest-press'] = function (p, ctx) {
    var s = [], hip = [184, 196], tr = 100, w = lerp2([222, 134], [266, 128], p);
    var J = solve({ hip: hip, trunk: tr, arm: { ik: w, bend: 1 }, leg: { ik: [254, 254], bend: -1 } });
    var st = stack(ctx.thumb ? 22 : 48, p, ctx.stack); s = s.concat(st);
    var pivot = [280, 44];
    s.push(['back', 'metal', P([140, FLOOR - 2], [290, FLOOR - 2])]);
    s.push(['back', 'metal', P([156, FLOOR - 2], [156, 34], [286, 34], [286, 44])]);
    s.push(['back', 'metal', P([174, 210], [174, FLOOR - 2])]);
    s.push(['back', 'pulley', circ([st.cx, 40], 6)]);
    s.push(['back', 'cable', P([st.cx, st.topY], [st.cx, 40], [272, 40])]);
    var off = [Math.cos(rad(tr + 90)) * 14, -Math.sin(rad(tr + 90)) * 14];
    s.push(['mid', 'pad', capsule(add(add(hip, off), vec(tr, -6)), add(add(hip, off), vec(tr, 100)), 8)]);
    s.push(['mid', 'pad', rrect(146, 203, 64, 13, 6)]);
    s.push(['mid', 'metal', P(pivot, add(J.wri, [4, 10]))]);
    s.push(['back', 'pulley', circ(pivot, 8)]);
    s.push(['mid', 'glow', capsule(add(J.sho, [4, 6]), add(J.sho, [4, 20]), 8)]);
    s = s.concat(figure(J, ['ua', 'fa']));
    s.push(['front', 'grip', P(add(J.wri, [0, -4]), add(J.wri, [0, 4]))]);
    // stop line: hands come back only to the chest, elbows never go behind the back
    s.push(['back', 'guide', P([222, 100], [222, 170])]);
    s.push(['front', 'lbl tiny on', { x: 226, y: 96, t: 'стоп', a: 'middle' }]);
    if (ctx.thumb) return s;
    s = xform(s, 0.8, 10, FLOOR * 0.2);
    s.push(['front', 'lbl tiny', { x: 130, y: 22, t: 'СБОКУ', a: 'middle' }]);
    // front view
    var cx = 326, shY = 118, k = lerp(1, 1.45, p);
    s.push(['back', 'metal-thin', P([250, 40], [250, 250])]);
    s.push(['back', 'pad', rrect(cx - 30, 70, 60, 116, 14)]);
    s.push(['back', 'metal', P([cx, 196], [cx, FLOOR - 2])]);
    s.push(['back', 'metal', P([cx - 50, FLOOR - 2], [cx + 50, FLOOR - 2])]);
    s.push(['back', 'guide', P([cx - 70, shY], [cx + 70, shY])]);
    s.push(['mid', 'pad', rrect(cx - 36, 184, 72, 12, 6)]);
    s.push(['fig', 'trf', P([cx, shY], [cx, 182])]);
    s.push(['fig', 'shl', P([cx - 24, shY], [cx + 24, shY])]);
    s.push(['fig', 'nk', P([cx, shY - 4], [cx, shY - 14])]);
    s = s.concat(headFront([cx, shY - 28]));
    [-1, 1].forEach(function (g) {
      if (g > 0) s.push(['mid', 'glow', capsule([cx - 14, shY + 12], [cx + 14, shY + 12], 9)]);
      s.push(['front', 'arrow', P([cx + g * 30, shY - 26], [cx + g * 30, shY - 8])]);
      s.push(['front', 'arrow', P([cx + g * 30 - 4, shY - 13], [cx + g * 30, shY - 8], [cx + g * 30 + 4, shY - 13])]);
      var kn = [cx + g * 22, 200], an = [cx + g * 24, 254];
      s.push(['fig', 'th', P([cx + g * 11, 186], kn)]);
      s.push(['fig', 'sh', P(kn, an)]);
      s.push(['fig', 'ft', P(an, [an[0] + g * 6, an[1] + 3])]);
      var sho = [cx + g * 24, shY + 2], hand = [cx + g * lerp(44, 34, p), shY + 16];
      var elb = lerp2([cx + g * 54, shY + 22], lerp2(sho, hand, 0.55), p);
      s.push(['mid', 'metal', P([cx + g * 50, 40], add(hand, [0, -10 * k]))]);
      s.push(['fig', 'ua act', P(sho, elb)]);
      s.push(['fig', 'fa act', P(elb, hand)]);
      s.push(['front', 'grip', P(add(hand, [0, -10 * k]), add(hand, [0, 10 * k]))]);
      s.push(['front', 'hand', circ(hand, 5 * k)]);
    });
    s.push(['back', 'metal', P([cx - 54, 40], [cx + 54, 40])]);
    s.push(['front', 'lbl tiny', { x: cx, y: 22, t: 'СПЕРЕДИ · плечи вниз', a: 'middle' }]);
    return s;
  };


  // Vertical column of numbered holes; active = burgundy, recommended = blue. Returns shapes tagged with part.
  function holes(part, x0, y0, dx, dy, count, val, rec, labelSide) {
    var s = [];
    for (var k = 1; k <= count; k++) {
      var c = [x0 + (k - 1) * dx, y0 + (k - 1) * dy], cls = k === val ? 'hole on' : 'hole';
      if (k === rec && k !== val) cls += ' rec';
      s.push(['front', cls, circ(c, 2.2), part]);
      s.push(['front', 'lbl tiny' + (k === val ? ' on' : ''), { x: c[0] + (labelSide || 9), y: c[1] + 3, t: String(k), a: 'middle' }]);
    }
    return s;
  }

  // Lat pulldown: stack in front of the person, thigh pad with 8 positions, long bar pulled to the upper chest.
  EX['lat-pulldown'] = function (p, ctx) {
    var s = [], v = ctx.value, hip = [168, 204], tr = lerp(96, 104, p), w = lerp2([186, 58], [178, 128], p);
    var J = solve({ hip: hip, trunk: tr, arm: { ik: w, bend: 1 }, leg: { a: [0, -92] } });
    var st = stack(318, p, ctx.stack); s = s.concat(st);
    s.push(['back', 'metal', P([120, FLOOR - 2], [372, FLOOR - 2])]);
    s.push(['back', 'metal', P([262, FLOOR - 2], [262, 22], [318 + 17, 22])]);
    s.push(['back', 'metal', P([168, 220], [168, FLOOR - 2])]);
    s.push(['mid', 'pad', rrect(128, 210, 84, 13, 6)]);
    // thigh pad on a post with 8 holes
    var padY = 186 - (v.pad - ctx.rec.pad) * 4;
    s.push(['back', 'metal-thin', P([240, padY], [250, padY], [250, 232])]);
    s = s.concat(holes('pad', 250, 150, 0, 8, 8, v.pad, ctx.rec.pad, 10).map(function (h) { if (typeof h[2] === 'string') h[2] = h[2]; return h; }));
    var pulleyA = [182, 26], pulleyB = [st.cx, 26];
    s.push(['back', 'pulley', circ(pulleyA, 7)]);
    s.push(['back', 'pulley', circ(pulleyB, 6)]);
    s.push(['back', 'cable', P(J.wri, pulleyA, pulleyB, [st.cx, st.topY])]);
    s.push(['mid', 'glow', capsule(add(J.sho, [-10, 6]), add(J.sho, [-12, 34]), 11)]);
    s = s.concat(figure(J, ['ua']));
    s.push(['front', 'pad tap', capsule([206, padY + 4], [238, padY + 4], 7), 'pad']);
    s.push(['front', 'grip', P(add(J.wri, [-14, -2]), add(J.wri, [14, -2]))]);
    s.push(['front', 'hit', rrect(196, 140, 70, 70, 8), 'pad']);
    return s;
  };

  // Seated dumbbell shoulder press, front view: elbows at 90° with upper arms level, press overhead.
  EX['dumbbell-shoulder-press'] = function (p, ctx) {
    var s = [], cx = 180;
    s.push(['back', 'pad', rrect(cx - 34, 70, 68, 104, 14)]);
    s.push(['back', 'metal', P([cx, 200], [cx, FLOOR - 2])]);
    s.push(['back', 'metal', P([cx - 60, FLOOR - 2], [cx + 60, FLOOR - 2])]);
    s.push(['mid', 'pad', rrect(cx - 42, 170, 84, 14, 7)]);
    s.push(['fig', 'trf', P([cx, 108], [cx, 172])]);
    s.push(['fig', 'shl', P([cx - 24, 108], [cx + 24, 108])]);
    s.push(['fig', 'nk', P([cx, 104], [cx, 94])]);
    s = s.concat(headFront([cx, 80]));
    [-1, 1].forEach(function (g) {
      var sho = [cx + g * 24, 108], t = lerp2([cx + g * 66, 70], [cx + g * 36, 30], p);
      var r = ik(sho, t, Lb.ua, Lb.fa, g > 0 ? 1 : -1);
      s.push(['mid', 'glow', circ([cx + g * 28, 106], 12)]);
      s.push(['fig', 'ua act', P(sho, r[0])]);
      s.push(['fig', 'fa', P(r[0], r[1])]);
      s.push(['front', 'metal-thin', P(add(r[1], [-12, 0]), add(r[1], [12, 0]))]);
      s.push(['front', 'bell', rrect(r[1][0] - 17, r[1][1] - 9, 7, 18, 2)]);
      s.push(['front', 'bell', rrect(r[1][0] + 10, r[1][1] - 9, 7, 18, 2)]);
      s.push(['front', 'hand', circ(r[1], 5)]);
      var kn = [cx + g * 26, 190], an = [cx + g * 30, 244];
      s.push(['fig', 'th', P([cx + g * 13, 174], kn)]);
      s.push(['fig', 'sh', P(kn, an)]);
      s.push(['fig', 'ft', P(an, [an[0] + g * 5, an[1] + 4])]);
    });
    s.push(['back', 'guide', P([cx - 92, 108], [cx + 92, 108])]);
    var st = ctx.stack;
    s.push(['front', 'lbl-bg', rrect(276, 226, 92, 22, 11)]);
    s.push(['front', 'lbl sel-lbl', { x: 322, y: 241, t: '2 × ' + st.weights[st.sel] + ' кг', a: 'middle' }]);
    return s;
  };

  // Lying leg curl: prone on the bench, roller on the Achilles (6 positions on the lever).
  EX['lying-leg-curl'] = function (p, ctx) {
    var s = [], v = ctx.value, hip = [214, 176], a = lerp(-4, 118, p);
    var grip = [128, 220];
    var J = solve({ hip: hip, trunk: 182, arm: { ik: grip, bend: 1 }, leg: { a: [0, a] } });
    // head drops a little: gaze forward and slightly down, neck long
    J.neck = add(J.sho, vec(188, Lb.neck)); J.head = add(J.neck, vec(205, Lb.head + 2));
    J.face = -1;
    J.toe = add(J.ank, vec(a - 90, Lb.ft)); J.heel = add(J.ank, vec(a + 90, 5));
    var st = stack(22, p, ctx.stack); s = s.concat(st);
    s.push(['back', 'metal', P([70, FLOOR - 2], [300, FLOOR - 2])]);
    s.push(['back', 'metal', P([120, 196], [120, FLOOR - 2])]);
    s.push(['back', 'metal', P([250, 196], [262, FLOOR - 2])]);
    // handles under the front of the bench
    s.push(['back', 'metal', P([122, 196], [128, 212])]);
    s.push(['mid', 'grip', P([121, 220], [135, 220])]);
    s.push(['back', 'pulley', circ([st.cx, 40], 6)]);
    s.push(['back', 'cable', P([st.cx, st.topY], [st.cx, 40], [264, 40], [264, 186])]);
    s.push(['mid', 'pad', rrect(96, 184, 168, 12, 6)]);
    var pivot = [J.kne[0], J.kne[1] + 14], miss = (v.roller || 0) - (ctx.rec.roller || 0), lev = Lb.sh - 4 + miss * 4;
    var rp = add(J.kne, vec(a, lev)), sd = Math.atan2(rp[1] - J.kne[1], rp[0] - J.kne[0]);
    var roll = add(rp, [Math.sin(sd) * 11, -Math.cos(sd) * 11]);
    s.push(['back', 'metal', P(pivot, J.kne, roll)]);
    s.push(['mid', 'glow', capsule(add(hip, [8, -6]), add(J.kne, [-6, -6]), 9)]);
    s = s.concat(figure(J, ['th']));
    s.push(['front', 'pad tap', circ(roll, 9), 'roller']);
    s.push(['front', 'pulley', circ(pivot, 6)]);
    var gz = add(J.head, vec(200, 16));
    s.push(['front', 'arrow', P(gz, add(gz, vec(200, 24)))]);
    s.push(['front', 'arrow', P(add(gz, add(vec(200, 24), vec(235, 6))), add(gz, vec(200, 24)), add(gz, add(vec(200, 24), vec(165, 6))))]);
    s.push(['front', 'lbl tiny' + (miss ? ' warn' : ' on'), { x: 392, y: 50, t: miss ? 'валик ' + (miss < 0 ? 'на икре, ниже к пятке' : 'на пятке, выше к ахиллу') : 'валик стоит на ахилле, не ездит', a: 'end' }]);
    s.push(['front', 'lbl tiny', { x: 200, y: FLOOR + 14, t: 'смотрим вперёд и чуть вниз · руки на рукоятях внизу', a: 'middle' }]);
    s = s.concat(holes('roller', 300, 70, 12, 0, 6, v.roller, ctx.rec.roller, 0).map(function (h) { if (h[2].y) h[2].y += 12; return h; }));
    s.push(['front', 'lbl tiny dim', { x: 330, y: 100, t: 'валик', a: 'middle' }]);
    s.push(['front', 'hit', rrect(288, 58, 84, 48, 8), 'roller']);
    s.push(['front', 'hit', circ(roll, 16), 'roller']);
    return s;
  };

  // Same outfit everywhere: clothes never change colour. Muscle highlights sit on their own layer above the body,
  // and the white top gets a thin outline so it reads on white cards.
  Object.keys(EX).forEach(function (id) {
    var f = EX[id];
    EX[id] = function (p, c) {
      var out = [];
      f(p, c).forEach(function (sh) {
        var cls = sh[1].replace(/ act(?=\s|$)/, '');
        if (/^glow/.test(cls)) { out.push(['front', cls, sh[2], sh[3]]); return; }
        if (cls === 'tr' || cls === 'trf') out.push([sh[0], cls + '-o', sh[2], sh[3]]);
        out.push([sh[0], cls, sh[2], sh[3]]);
      });
      return out;
    };
  });

  // ---------- recommendations ----------
  var RATIO = { 'lat-pulldown': 0.4, 'dumbbell-shoulder-press': 0.05, 'lying-leg-curl': 0.15, 'chest-press': 0.3, 'dumbbell-front-raise': 0.03, 'seated-leg-curl': 0.18, 'seated-cable-row': 0.35, 'cable-triceps-pushdown': 0.15, 'hip-abduction': 0.3, 'hip-adduction': 0.3, 'reclined-hip-abduction': 0.3 };
  var STACK = { min: 10, max: 100, step: 5 };
  var NOWEIGHT = { 'dead-bug': 1, 'ball-crunch': 1 };
  function weights(id) { if (NOWEIGHT[id]) return []; var c = id === 'cable-triceps-pushdown' ? { min: 5, max: 70, step: 2.5 } : id === 'dumbbell-front-raise' || id === 'dumbbell-shoulder-press' ? { min: 1, max: 20, step: 1 } : id === 'lying-leg-curl' ? { min: 10, max: 80, step: 5 } : id === 'reclined-hip-abduction' ? { min: 5, max: 80, step: 2.5 } : STACK, a = []; for (var w = c.min; w <= c.max + 1e-9; w += c.step) a.push(w); return a; }
  function recommend(id, user) {
    var ws = weights(id);
    if (!ws.length) return {};
    var target = Math.max(ws[0], user.mass * (RATIO[id] || 0.2));
    var best = 0; ws.forEach(function (w, i) { if (Math.abs(w - target) < Math.abs(ws[best] - target)) best = i; });
    var r = { weight: ws[best] };
    if (id === 'seated-leg-curl') {
      r.back = Math.max(1, Math.min(6, Math.round((0.245 * user.height - 38) / 2) + 1));
      r.start = 2;
    }
    if (id === 'hip-abduction') r.width = 1;
    if (id === 'hip-adduction') r.width = 4;
    if (id === 'lat-pulldown') r.pad = Math.max(1, Math.min(8, Math.round((user.mass - 50) / 10) + 2));
    if (id === 'lying-leg-curl') r.roller = Math.max(1, Math.min(6, Math.round((0.246 * user.height - 38) / 2) + 1));
    return r;
  }

  // ---------- render ----------
  var NS = 'http://www.w3.org/2000/svg', LAYERS = ['back', 'mid', 'fig', 'front'];
  // Updates existing nodes in place so taps are not lost between animation frames.
  function render(svg, shapes) {
    var list = [];
    LAYERS.forEach(function (layer) { shapes.forEach(function (sh) { if (sh[0] === layer) list.push(sh); }); });
    var g = svg.__g;
    if (!g) {
      svg.innerHTML = '<line class="floor" x1="16" y1="' + (FLOOR + 2) + '" x2="' + (W - 16) + '" y2="' + (FLOOR + 2) + '"/><g></g>';
      g = svg.__g = svg.lastChild;
    }
    var nodes = g.childNodes, same = nodes.length === list.length;
    for (var i = 0; same && i < list.length; i++) same = nodes[i].tagName === (typeof list[i][2] === 'string' ? 'path' : 'text');
    if (!same) {
      g.textContent = '';
      list.forEach(function (sh) { g.appendChild(document.createElementNS(NS, typeof sh[2] === 'string' ? 'path' : 'text')); });
    }
    list.forEach(function (sh, i) {
      var el = nodes[i];
      if (el.getAttribute('class') !== sh[1]) el.setAttribute('class', sh[1]);
      if (sh[3]) el.setAttribute('data-part', sh[3]); else el.removeAttribute('data-part');
      if (typeof sh[2] === 'string') el.setAttribute('d', sh[2]);
      else {
        el.setAttribute('x', n(sh[2].x)); el.setAttribute('y', n(sh[2].y)); el.setAttribute('text-anchor', sh[2].a || 'start');
        if (el.textContent !== sh[2].t) el.textContent = sh[2].t;
      }
    });
  }

  function mount(el, id, opts) {
    opts = opts || {};
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', id === 'dead-bug' ? '40 75 340 255' : '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'gm');
    svg.setAttribute('role', 'img');
    el.appendChild(svg);
    var state = { user: opts.user || { height: 180, mass: 80 }, value: Object.assign({}, opts.value || {}), weights: opts.weights || null, rec: opts.rec || null };
    function nearest(ws, w) { var b = 0; ws.forEach(function (x, i) { if (Math.abs(x - w) < Math.abs(ws[b] - w)) b = i; }); return b; }
    function recOf() { return Object.assign(recommend(id, state.user), state.rec || {}); }
    function ctx() {
      var rec = recOf(), ws = state.weights || weights(id), v = state.value;
      if (v.weight == null && rec.weight != null) v.weight = rec.weight;
      if (id === 'seated-leg-curl') { if (v.back == null) v.back = rec.back; if (v.start == null) v.start = rec.start; }
      ['pad', 'roller', 'width'].forEach(function (k) { if (rec[k] != null && v[k] == null) v[k] = rec[k]; });
      var sel = ws.length ? nearest(ws, v.weight) : 0, ri = rec.weight == null || !ws.length ? null : nearest(ws, rec.weight);
      return { user: state.user, value: v, rec: rec, stack: { weights: ws, sel: sel, rec: ri } };
    }
    svg.addEventListener('click', function (e) {
      var t = e.target.closest('[data-part]');
      if (t && opts.onPick) opts.onPick(t.getAttribute('data-part'));
    });
    var t0 = performance.now(), raf = 0, DURX = id === 'dead-bug' ? DUR * 1.6 : DUR, still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(now) {
      var t = ((now - t0) % DURX) / DURX;
      var pp = id === 'dead-bug' ? (t < 0.5 ? progress(t * 2) : 1 + progress(t * 2 - 1)) : progress(t);
      render(svg, EX[id](still ? 0.5 : pp, ctx()));
      if (!still) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      update: function (o) {
        if (o.user) state.user = o.user;
        if (o.value) Object.assign(state.value, o.value);
        if (o.weights) state.weights = o.weights;
        if ('rec' in o) state.rec = o.rec;
        if (still) render(svg, EX[id](0.5, ctx()));
      },
      get: function () { return { value: Object.assign({}, ctx().value), rec: recOf(), weights: state.weights || weights(id) }; },
      destroy: function () { cancelAnimationFrame(raf); svg.remove(); }
    };
  }

  // ---------- reps / sets quick picks ----------
  // Popular values; neighbours of the current choice become the grey quick buttons.
  var REPS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100], SETS = [1, 2, 3, 4, 5, 6, 8, 10];
  var DEFAULTS = { reps: 12, sets: 3 }, EVEN = { 'dead-bug': { reps: 20, step: 4 } };
  function quick(id, kind, v) {
    var ev = EVEN[id];
    if (kind === 'reps' && ev) return { prev: Math.max(2, v - ev.step), value: v, next: Math.min(100, v + ev.step), options: range(2, 100, 2) };
    var list = kind === 'reps' ? REPS : SETS, lo = null, hi = null;
    list.forEach(function (x) { if (x < v) lo = x; if (x > v && hi == null) hi = x; });
    return { prev: lo, value: v, next: hi, options: range(1, kind === 'reps' ? 100 : 10, 1) };
  }
  function range(a, b, st) { var r = []; for (var i = a; i <= b; i += st) r.push(i); return r; }
  function defaults(id) { return { reps: EVEN[id] ? EVEN[id].reps : DEFAULTS.reps, sets: DEFAULTS.sets }; }

  // Next/previous weight on the stack (for the host's − / + buttons).
  function step(id, w, dir, list) { var ws = list || weights(id); if (!ws.length) return null; var i = 0; ws.forEach(function (x, k) { if (Math.abs(x - w) < Math.abs(ws[i] - w)) i = k; }); return ws[Math.max(0, Math.min(ws.length - 1, i + dir))]; }

  // Static vector picture of the equipment only (no person), for exercise cards. Needs machines.css.
  var THUMB_P = { 'dead-bug': 0.5, 'ball-crunch': 0.8, 'dumbbell-front-raise': 0.8 };
  var THUMB_VB = {'reclined-hip-abduction': '76 30 300 300', 'seated-leg-curl': '7 -2 299 299', 'seated-cable-row': '70 -2 299 299', 'cable-triceps-pushdown': '138 14 258 258', 'hip-abduction': '110 16 259 259', 'hip-adduction': '110 16 259 259', 'dead-bug': '60 69 300 300', 'dumbbell-front-raise': '12 38 222 222', 'ball-crunch': '110 85 202 202', 'chest-press': '7 2 293 293', 'lat-pulldown': '110 4 272 272', 'dumbbell-shoulder-press': '60 29 241 241', 'lying-leg-curl': '7 -9 314 314'};
  function thumb(id, ctxOverride) {
    var ws = weights(id), r = recommend(id, { height: 175, mass: 70 });
    var c = ctxOverride || { user: { height: 175, mass: 70 }, value: Object.assign({ weight: ws[0] }, r), rec: r, stack: { weights: ws.length ? ws : [0], sel: 2, rec: null }, thumb: true };
    // Person mid-rep on the machine: the pose makes the machine recognisable at a glance.
    var keep = EX[id](THUMB_P[id] != null ? THUMB_P[id] : 0.55, c).filter(function (sh) {
      return typeof sh[2] === 'string' && !/hit|hole|guide|arrow|tap|rec-mark|lbl|far|sep/.test(sh[1]) && !(sh[1] === 'metal-thin' && (sh[3] || id === 'dumbbell-front-raise'));
    });
    var out = '';
    LAYERS.forEach(function (l) { keep.forEach(function (sh) { if (sh[0] === l) out += '<path class="' + sh[1] + '" d="' + sh[2] + '"/>'; }); });
    return '<svg xmlns="http://www.w3.org/2000/svg" class="gm gm-thumb" viewBox="' + (THUMB_VB[id] || '0 0 400 300') + '">' + out + '</svg>';
  }

  root.GymMachines = { _ex: EX, _progress: progress, step: step, thumb: thumb, mount: mount, recommend: recommend, weights: weights, quick: quick, defaults: defaults, ids: Object.keys(EX) };
})(typeof window !== 'undefined' ? window : this);
