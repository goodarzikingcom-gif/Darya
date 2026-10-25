/* Bloom: glowing particle flowers. Used by flower.html (single flowers) and flowers.html (bouquets). */
(() => {
  const W = 900, H = 600, BASEY = 548;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = k => k * k * (3 - 2 * k);
  const mix = (a, b, k) => a + (b - a) * k;
  const mixc = (c1, c2, k) => [mix(c1[0], c2[0], k), mix(c1[1], c2[1], k), mix(c1[2], c2[2], k)];
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;
  const shade = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // ---------- Particles ----------
  // wx, wy, wz: world position. c: color, s: size, b: birth time, p/f: twinkle phase and speed, d: brightness
  const mk = (c, s, b, d) => ({ wx: 0, wy: 0, wz: 0, c, s, b, p: Math.random() * 6.28, f: 1 + Math.random() * 2.2, d: d || 0.9 });
  const newFlower = (ox, sc) => ({ ox: ox || 0, sc: sc || 1, stat: [], dyn: [], heads: [] });

  function addStatic(fl, x, y, z, c, s, b, d) {
    const q = mk(c, s, b, d); q.wx = fl.ox + x * fl.sc; q.wy = y * fl.sc; q.wz = z * fl.sc; fl.stat.push(q); return q;
  }
  // Dotted great circles around the flower, like the glowing sphere in the reel
  function addHalo(fl, cy, R, c1, c2) {
    [[0, 0], [1.05, 0], [-1.05, 0], [0.6, 1.0], [-0.6, -1.0], [1.5, 0.5]].forEach(([a, b]) => {
      for (let i = 0; i < 260; i++) {
        const t = i / 260 * 6.283 + rnd(-0.01, 0.01), x = Math.cos(t) * R, y = Math.sin(t) * R;
        const y1 = y * Math.cos(a), z1 = y * Math.sin(a);
        addStatic(fl, x * Math.cos(b) + z1 * Math.sin(b), cy + y1, -x * Math.sin(b) + z1 * Math.cos(b), mixc(c1 || [170, 130, 255], c2 || [255, 160, 220], Math.random()), 1, 11 + Math.random() * 3, 0.4);
      }
    });
  }
  function addSoil(fl, spread) {
    for (let i = 0; i < 1400; i++) {
      const x = gauss() * spread, z = gauss() * spread * 0.45, h = Math.exp(-(x * x) / (spread * spread)) * 14;
      addStatic(fl, x, Math.abs(gauss()) * h * 0.7, z, mixc([130, 130, 160], [220, 220, 245], Math.random()), 1, Math.random() * 1.5);
    }
  }
  const GREEN1 = [40, 230, 150], GREEN2 = [140, 255, 200];
  function addStem(fl, path, n, t0, dur, r, c1, c2) {
    for (let i = 0; i < n; i++) {
      const s = Math.random(), [x, y, z] = path(s);
      addStatic(fl, x + rnd(-r, r), y + rnd(-r, r) * 0.3, z + rnd(-r, r), mixc(c1 || GREEN1, c2 || GREEN2, Math.random()), 1, t0 + s * dur);
    }
  }
  // A leaf: pointed outline that rises and then droops, growing outward from (x0, y0, z0) along azimuth psi
  function addLeaf(fl, x0, y0, z0, psi, len, wmax, rise, droop, n, t0, c1, c2) {
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : rnd(-1, 1);
      const w = wmax * Math.pow(Math.sin(Math.PI * u), 0.7), r = len * u, y = y0 + len * rise * u - len * droop * u * u, ac = v * w;
      addStatic(fl, x0 + r * Math.cos(psi) - ac * Math.sin(psi), y + Math.abs(v) * 2, z0 + r * Math.sin(psi) + ac * Math.cos(psi),
        mixc(c1 || [30, 200, 140], c2 || [140, 255, 195], clamp(Math.abs(v) * 0.6 + u * 0.3)), 1, t0 + u * 0.9);
    }
  }

  // ---------- Flower heads ----------
  // A head is a cloud of particles in a local frame (y axis = flower axis). It is scaled by S, turned to face direction n
  // and moved to center c. Opening is driven by b (0 = bud, 1 = full bloom).
  const PAL = {
    red: { i: [150, 0, 35], o: [255, 70, 100] }, deepred: { i: [110, 0, 30], o: [235, 45, 85] }, blush: { i: [255, 120, 160], o: [255, 205, 222] },
    peonyPink: { i: [255, 85, 160], o: [255, 215, 235] }, peonyCoral: { i: [255, 130, 115], o: [255, 218, 205] },
    tulipRed: { i: [255, 50, 95], o: [255, 170, 190] }, tulipYellow: { i: [255, 160, 30], o: [255, 245, 165] }, tulipPink: { i: [255, 90, 160], o: [255, 205, 228] }
  };
  const TMP = { x: 0, y: 0, z: 0 };

  function makeHead(kind, o) {
    const h = { o, parts: [], pre: null, local: null }, pal = o.pal || PAL.red;
    const add = (c, s, extra) => { const q = mk(c, Math.random() < 0.22 ? 2 : s, o.t0 - 0.6, 1.6); Object.assign(q, extra); h.parts.push(q); };
    const lobePick = (lobes, twist) => {                       // favors petal edges so outlines glow
      let l, f, lobe;
      for (let tr = 0; tr < 4; tr++) {
        l = Math.sqrt(Math.random()); f = rnd(0, 6.283); lobe = 0.5 + 0.5 * Math.cos(lobes * f + twist * l);
        if (Math.random() < 0.35 + 0.65 * Math.pow(lobe, 3)) break;
      }
      return [l, f, lobe];
    };
    if (kind === 'rose') {
      for (let i = 0; i < 700; i++) {
        const [l, f, lobe] = lobePick(5, 7);
        add(shade(mixc(pal.i, pal.o, Math.pow(l, 0.8)), 0.75 + 0.5 * lobe), lobe > 0.9 ? 2 : 1, { l, f, lobe });
      }
      h.local = (q, b) => {
        const R = 0.55 + 0.45 * b, r = R * (0.1 + 0.9 * q.l) * (0.88 + 0.12 * q.lobe), f = q.f + q.l * 0.9;
        TMP.x = r * Math.cos(f); TMP.z = r * Math.sin(f);
        TMP.y = (1 - 0.25 * b) * 0.9 * Math.pow(1 - q.l, 0.75) - 0.45 * R * Math.pow(q.l, 3) * b;
      };
    } else if (kind === 'peony') {
      for (let i = 0; i < (o.count || 900); i++) {
        const [l, f, lobe] = lobePick(8, 6);
        add(shade(mixc(pal.i, pal.o, Math.pow(l, 0.9)), 0.8 + 0.45 * lobe), lobe > 0.92 ? 2 : 1, { l, f, lobe, low: Math.random() < 0.3 });
      }
      h.local = (q, b) => {
        // Globular, densely layered bowl with ruffled edges
        const R = 0.62 + 0.4 * b, r = R * (0.08 + 0.92 * q.l) * (0.8 + 0.2 * q.lobe + 0.06 * Math.sin(q.f * 17 + q.l * 9));
        TMP.x = r * Math.cos(q.f); TMP.z = r * Math.sin(q.f);
        TMP.y = 0.95 * Math.pow(1 - q.l, 0.6) * (1 - 0.15 * b) - 0.3 * Math.pow(q.l, 3) * b + 0.06 * Math.sin(q.f * 11) * q.l;
        if (q.low) { TMP.x *= 0.88; TMP.z *= 0.88; TMP.y = -0.6 * Math.pow(1 - q.l, 0.7) * (0.5 + 0.5 * b) - 0.04; }  // rounded underside
      };
    } else if (kind === 'tulip') {
      for (let i = 0; i < 950; i++) {
        const k = Math.floor(Math.random() * 6), u = Math.random(), roll = Math.random();
        const v = roll < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : roll < 0.3 ? 0 : rnd(-1, 1);
        add(shade(mixc(pal.i, pal.o, Math.pow(u, 1.3)), k % 2 ? 1.1 : 0.9), Math.abs(v) === 1 ? 2 : 1, { k, u, v });
      }
      h.local = (q, b) => {
        const u = q.u, w = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.9)), 0.55);
        const r = (0.16 + (0.55 + 0.2 * b) * Math.sin(Math.PI * Math.pow(u, 0.85)) * (1 - 0.3 * (1 - b) * u) + 0.38 * b * Math.pow(u, 4)) * (q.k % 2 ? 0.9 : 1);
        const f = q.k * Math.PI / 3 + q.v * w * 0.62;
        TMP.x = r * Math.cos(f); TMP.z = r * Math.sin(f); TMP.y = 1.25 * u;
      };
    } else if (kind === 'lily') {
      const N = 20, mr = new Float32Array(6 * (N + 1)), my = new Float32Array(6 * (N + 1)), PW = [0.15, 0.2], PL = [1, 0.95];
      for (let k = 0; k < 6; k++) for (let i = 0; i < 360; i++) {
        const u = Math.random(), roll = Math.random(), v = roll < 0.18 ? (Math.random() < 0.5 ? -1 : 1) : roll < 0.28 ? 0 : rnd(-1, 1);
        let c = u < 0.35 ? mixc([255, 235, 130], [255, 70, 150], u / 0.35) : u < 0.8 ? mixc([255, 70, 150], [255, 190, 225], (u - 0.35) / 0.45) : mixc([255, 190, 225], [255, 245, 250], (u - 0.8) / 0.2);
        if (u < 0.6 && Math.random() < 0.07) c = [200, 25, 110];
        add(c, Math.random() < 0.08 ? 2 : 1, { k, u, v, st: 0 });
      }
      for (let k = 0; k < 7; k++) for (let i = 0; i < (k < 6 ? 40 : 60); i++) {
        const s = Math.random(), tip = s > 0.9;
        add(k === 6 ? [255, 250, 205] : tip ? [255, 120, 40] : [255, 230, 170], tip ? 2 : 1, { k, s2: s, j: rnd(-1, 1), st: 1 });
      }
      h.pre = b => {
        for (let k = 0; k < 6; k++) {
          const L = PL[k % 2], a0 = 0.1 + 0.95 * b - 0.12 * (k % 2) * b, curl = 0.15 + 1.1 * b;
          let r = 0, y = 0;
          for (let i = 0; i <= N; i++) { mr[k * (N + 1) + i] = r; my[k * (N + 1) + i] = y; const al = a0 + curl * Math.pow(i / N, 1.2); r += Math.sin(al) * L / N; y += Math.cos(al) * L / N; }
        }
      };
      h.local = (q, b) => {
        if (q.st === 0) {
          const k = q.k, idx = q.u * N, i0 = Math.floor(idx), i1 = Math.min(N, i0 + 1), fr = idx - i0, o2 = k * (N + 1);
          const r = mix(mr[o2 + i0], mr[o2 + i1], fr), y = mix(my[o2 + i0], my[o2 + i1], fr);
          const w = PW[k % 2] * Math.pow(Math.sin(Math.PI * Math.pow(q.u, 0.75)), 0.9), ac = q.v * w, phi = k * Math.PI / 3 + 0.2;
          TMP.x = r * Math.cos(phi) - ac * Math.sin(phi); TMP.z = r * Math.sin(phi) + ac * Math.cos(phi); TMP.y = y + 0.35 * w * q.v * q.v * (1 - q.u);
        } else {
          const s = q.s2, ph = q.k * Math.PI / 3 + 0.55;
          const r = q.k === 6 ? 0.06 * s * b : (0.05 + 0.32 * s) * (0.25 + 0.75 * b), y = 0.06 + (q.k === 6 ? 0.72 : 0.57) * s - 0.17 * s * s * b;
          TMP.x = r * Math.cos(ph) - q.j * 0.03 * Math.sin(ph); TMP.z = r * Math.sin(ph) + q.j * 0.03 * Math.cos(ph); TMP.y = y;
        }
      };
    } else if (kind === 'orchid') {
      // Moth orchid face: two wing petals, three sepals, a lip and a column, all flat ellipses with a slight cup
      const ell = (cx, cy, rx, ry, rot, col, n) => {
        for (let i = 0; i < n; i++) {
          const roll = Math.random(), th = rnd(0, 6.283), r = roll < 0.22 ? 1 : roll < 0.34 ? Math.random() : Math.sqrt(Math.random());
          const ex = r * Math.cos(th) * rx, ey = r * Math.sin(th) * ry;
          const lx = cx + ex * Math.cos(rot) - ey * Math.sin(rot), ly = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
          add(col(r, ly), r > 0.97 ? 2 : 1, { lx, ly, lz: 0.28 * (lx * lx + ly * ly) });
        }
      };
      const wing = r => mixc([255, 215, 255], [200, 100, 255], clamp(r * 1.1)), sepal = r => mixc([250, 190, 255], [215, 120, 255], clamp(r));
      const lip = (r, y) => y < -0.25 ? [255, 50, 150] : mixc([255, 225, 90], [255, 60, 160], clamp(-y * 3));
      ell(-0.62, 0.18, 0.62, 0.55, 0.26, wing, 150); ell(0.62, 0.18, 0.62, 0.55, -0.26, wing, 150);
      ell(0, 0.8, 0.36, 0.62, 0, sepal, 120); ell(-0.4, -0.58, 0.3, 0.62, 0.5, sepal, 110); ell(0.4, -0.58, 0.3, 0.62, -0.5, sepal, 110);
      ell(0, -0.26, 0.17, 0.3, 0, lip, 90); ell(-0.15, -0.12, 0.07, 0.14, 0.3, lip, 20); ell(0.15, -0.12, 0.07, 0.14, -0.3, lip, 20);
      ell(0, 0.04, 0.09, 0.09, 0, () => [255, 255, 235], 22);
      h.local = (q, b) => { const sz = 0.12 + 0.88 * b; TMP.x = q.lx * sz; TMP.z = q.ly * sz; TMP.y = q.lz * sz * b * 0.9; };
    }
    // Orientation: y axis to n, and the "up" side of the flower toward the world's up direction
    const n = norm(o.n || [0, 1, 0]);
    let a = [-n[0] * n[1], 1 - n[1] * n[1], -n[2] * n[1]];
    if (Math.hypot(a[0], a[1], a[2]) < 1e-3) a = [0, 0, -1];
    a = norm(a); h.r = cross(n, a); h.a = a; h.n = n; h.spin = kind === 'orchid' ? 0 : (o.spin === undefined ? rnd(0, 6.28) : o.spin);
    return h;
  }

  function placeHead(fl, h, t) {
    const o = h.o, b = ease(clamp((t - o.t0) / o.dur));
    if (h.pre) h.pre(b, t);
    const cs = Math.cos(h.spin), ss = Math.sin(h.spin), r = h.r, n = h.n, a = h.a, S = o.S;
    h.parts.forEach(q => {
      h.local(q, b, t);
      const lx = TMP.x * cs + TMP.z * ss, lz = -TMP.x * ss + TMP.z * cs, ly = TMP.y;
      q.wx = fl.ox + (o.c[0] + S * (lx * r[0] + ly * n[0] + lz * a[0])) * fl.sc;
      q.wy = (o.c[1] + S * (lx * r[1] + ly * n[1] + lz * a[1])) * fl.sc;
      q.wz = (o.c[2] + S * (lx * r[2] + ly * n[2] + lz * a[2])) * fl.sc;
    });
  }
  function addHead(fl, kind, o) { const h = makeHead(kind, o); fl.heads.push(h); fl.dyn.push(...h.parts); return h; }
  const finish = fl => { fl.upd = t => fl.heads.forEach(h => placeHead(fl, h, t)); return fl; };

  // ---------- Single flowers ----------
  function lilyScene() {
    const fl = newFlower(0, 1), stem = s => [26 * s * s, 330 * s, 0];
    addSoil(fl, 110); addStem(fl, stem, 650, 1.2, 6.5, 2.5);
    for (let li = 0; li < 8; li++) { const s0 = 0.1 + li * 0.075, [sx, sy] = stem(s0); addLeaf(fl, sx, sy, 0, li * 2.4, 125 - 60 * s0, 11, 0.65, 0.3, 260, 1.2 + s0 * 6.5); }
    addHalo(fl, 200, 250);
    addHead(fl, 'lily', { c: stem(1), n: [0.12, 1, 0.05], S: 165, t0: 8, dur: 5.5 });
    return { flowers: [finish(fl)], pivot: 0, caption: 'Lily. Pure, graceful, and impossible to forget.' };
  }

  function orchidScene() {
    const fl = newFlower(-55, 1.3), spike = s => [250 * Math.pow(s, 1.6), 70 + 420 * s - 330 * s * s, 0];
    addSoil(fl, 120);
    addStem(fl, s => [0, 70 * s, 0], 220, 1.2, 1.6, 2.5); addStem(fl, spike, 520, 2.6, 5.4, 2.2);
    [[0.2, 190, 44], [2.0, 170, 40], [3.6, 150, 36]].forEach(([psi, len, wmax], i) => addLeaf(fl, 0, 22, 0, psi, len, wmax, 0.45, 0.4, 800, 0.8 + i * 0.6, [20, 170, 140], [110, 255, 205]));
    addHalo(fl, 150, 250);
    for (let k = 0; k < 5; k++) {
      const s = 0.3 + k * 0.17, [bx, by] = spike(s);
      addHead(fl, 'orchid', { c: [bx, by + 6, 0], n: [0.3 + 0.05 * k, 0.3, 0.9], S: 54 - 4.5 * k, t0: 8.3 + k * 0.9, dur: 2.8 });
    }
    return { flowers: [finish(fl)], pivot: -55 + 110 * 1.3, caption: 'Orchid. Rare, elegant, and worth every moment of waiting.' };
  }

  function tulipScene() {
    const fl = newFlower(0, 1.1), stem = s => [12 * s * s, 300 * s, 0];
    addSoil(fl, 100); addStem(fl, stem, 520, 1.2, 6, 2.6);
    addLeaf(fl, 0, 16, 0, 0.5, 230, 26, 0.95, 0.85, 700, 1.2, [25, 190, 135], [130, 255, 190]);
    addLeaf(fl, 0, 16, 0, 3.7, 215, 24, 0.95, 0.85, 650, 1.8, [25, 190, 135], [130, 255, 190]);
    addHalo(fl, 190, 235, [255, 140, 190], [255, 190, 150]);
    addHead(fl, 'tulip', { c: stem(1), n: [0.05, 1, 0], S: 108, t0: 7.5, dur: 4.5, pal: PAL.tulipRed });
    return { flowers: [finish(fl)], pivot: 0, caption: 'Tulip. Simple, bright, and the start of every spring.' };
  }

  function peonyScene() {
    const fl = newFlower(0, 1.15), stem = s => [18 * s * s, 235 * s, 0];
    addSoil(fl, 110); addStem(fl, stem, 560, 1.2, 6, 3);
    for (let li = 0; li < 6; li++) { const s0 = 0.18 + li * 0.1, [sx, sy] = stem(s0); addLeaf(fl, sx, sy, 0, li * 2.2, 105, 20, 0.45, 0.35, 340, 1.2 + s0 * 6, [30, 190, 135], [130, 250, 185]); }
    addHalo(fl, 190, 235, [255, 150, 200], [210, 160, 255]);
    addHead(fl, 'peony', { c: stem(1), n: [0.1, 0.85, 0.5], S: 92, t0: 7.5, dur: 5, pal: PAL.peonyPink, count: 2600 });
    return { flowers: [finish(fl)], pivot: 0, caption: 'Peony. Soft, full of layers, and impossible not to love.' };
  }

  // ---------- Bouquets ----------
  // items: [{ kind, pal, S }], placed on a dome, each with its own stem from the tied bunch; then baby's breath, paper and a bow
  function bouquetScene(spec) {
    const fl = newFlower(0, 1.1), B = [0, 44, 0], D = [0, spec.cy, 0], N = spec.items.length;
    spec.items.forEach((it, i) => {
      const th = spec.cap * Math.sqrt((i + 0.5) / N), ph = i * 2.39996;
      const dir = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      let n = dir;
      if (it.kind === 'tulip') n = norm([dir[0] * 0.5, dir[1] * 0.5 + 0.85, dir[2] * 0.5]);
      const c = [D[0] + dir[0] * spec.R, D[1] + dir[1] * spec.R * 0.85, D[2] + dir[2] * spec.R];
      const tip = [c[0] - n[0] * it.S * 0.45, c[1] - n[1] * it.S * 0.45, c[2] - n[2] * it.S * 0.45];
      const ctl = [(B[0] + tip[0]) / 2, (B[1] + tip[1]) / 2 + 22, (B[2] + tip[2]) / 2];
      const tg = 0.8 + i * 0.18;
      for (let k = 0; k < 150; k++) {
        const s = Math.random(), m = 1 - s;
        addStatic(fl, m * m * B[0] + 2 * m * s * ctl[0] + s * s * tip[0] + rnd(-1.5, 1.5), m * m * B[1] + 2 * m * s * ctl[1] + s * s * tip[1], m * m * B[2] + 2 * m * s * ctl[2] + rnd(-1.5, 1.5),
          mixc(GREEN1, GREEN2, Math.random()), 1, tg + s * 1.8);
      }
      addHead(fl, it.kind, { c, n, S: it.S, t0: 4.5 + i * 0.45, dur: 3, pal: it.pal });
    });
    // Leaves peeking out around the rim of the dome
    for (let j = 0; j < 14; j++) {
      const ph = j * 0.449 + 0.3, th = spec.cap * 1.05, dx = Math.sin(th) * Math.cos(ph), dz = Math.sin(th) * Math.sin(ph);
      addLeaf(fl, dx * spec.R * 0.85, spec.cy + Math.cos(th) * spec.R * 0.7, dz * spec.R * 0.85, ph, 75, 14, 0.3, 0.2, 260, 3.2 + j * 0.12);
    }
    // Baby's breath
    for (let j = 0; j < (spec.baby || 24); j++) {
      const th = rnd(0.1, spec.cap * 1.25), ph = rnd(0, 6.283), dir = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const g = [D[0] + dir[0] * spec.R * 1.15, D[1] + dir[1] * spec.R * 1.1, D[2] + dir[2] * spec.R * 1.15], t0 = 9 + Math.random() * 2.5;
      for (let k = 0; k < 24; k++) { const s = Math.random(); addStatic(fl, mix(D[0] + dir[0] * spec.R * 0.5, g[0], s), mix(D[1] + dir[1] * spec.R * 0.5, g[1], s), mix(D[2] + dir[2] * spec.R * 0.5, g[2], s), [150, 230, 190], 1, t0, 0.7); }
      for (let k = 0; k < 26; k++) addStatic(fl, g[0] + gauss() * 15, g[1] + gauss() * 15, g[2] + gauss() * 15, [255, 250, 255], Math.random() < 0.45 ? 2 : 1, t0 + 0.3, 1.3);
    }
    // Paper cone with a scalloped rim, a ribbon and a bow
    const yTop = spec.cy - 36, Rt = spec.R * 0.82, coneR = y => Rt * (y - B[1]) / (yTop - B[1]);
    for (let i = 0; i < 1500; i++) {
      const y = rnd(B[1], yTop), a = rnd(0, 6.283), rim = (y - B[1]) / (yTop - B[1]);
      addStatic(fl, coneR(y) * (1 + 0.06 * Math.sin(5 * a) * rim) * Math.cos(a), y, coneR(y) * (1 + 0.06 * Math.sin(5 * a) * rim) * Math.sin(a), mixc([245, 215, 250], [255, 235, 245], Math.random()), 1, 11.5 + rim * 1.5, 0.6);
    }
    for (let i = 0; i < 360; i++) { const a = rnd(0, 6.283), r = Rt + 7 * Math.abs(Math.sin(4.5 * a)); addStatic(fl, r * Math.cos(a), yTop + 5 * Math.sin(9 * a), r * Math.sin(a), [255, 240, 250], 2, 12.5 + Math.random(), 0.9); }
    const yR = 92, rR = coneR(yR) + 1.5, gold = [255, 205, 120];
    for (let i = 0; i < 260; i++) { const a = rnd(0, 6.283); addStatic(fl, rR * Math.cos(a), yR + rnd(-7, 7), rR * Math.sin(a), mixc(gold, [255, 150, 190], Math.random()), 1, 13, 1); }
    [-1, 1].forEach(sg => {
      for (let i = 0; i < 90; i++) { const t = rnd(0, 6.283), lx = 22 * Math.cos(t), ly = 12 * Math.sin(t), rot = sg * 0.35; addStatic(fl, sg * 26 + lx * Math.cos(rot) - ly * Math.sin(rot), yR + 6 + lx * Math.sin(rot) + ly * Math.cos(rot), rR + 3, mixc(gold, [255, 150, 190], Math.random()), 2, 13.4, 1); }
      for (let i = 0; i < 40; i++) { const s = Math.random(); addStatic(fl, sg * (8 + 16 * s), yR + 2 - 50 * s, rR + 3, gold, 1, 13.6, 1); }
    });
    for (let i = 0; i < 50; i++) { const a = rnd(0, 6.283); addStatic(fl, 6 * Math.cos(a), yR + 6 + 6 * Math.sin(a), rR + 4, [255, 230, 160], 2, 13.4, 1); }
    addHalo(fl, spec.cy - 20, spec.R * 1.75, spec.h1, spec.h2);
    return {
      flowers: [finish(fl)], pivot: 0, caption: spec.caption,
      steps: [[0, 'Gathering the flowers…'], [2.6, 'Each one picked for you…'], [11.8, 'Tied with a ribbon.'], [14.8, spec.caption]]
    };
  }
  const items = (list) => list.flatMap(([kind, pal, S, n]) => Array.from({ length: n }, () => ({ kind, pal, S })));
  // Mix the items so colors and shapes are spread over the dome
  const shuffled = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  const SCENES = {
    lily: lilyScene, orchid: orchidScene, tulip: tulipScene, peony: peonyScene,
    roses: () => bouquetScene({ items: shuffled(items([['rose', PAL.red, 36, 7], ['rose', PAL.deepred, 34, 3], ['rose', PAL.blush, 35, 3]])), cy: 255, R: 128, cap: 1.2, baby: 26,
      h1: [255, 120, 160], h2: [255, 190, 210], caption: 'Roses for you, because some feelings need no words.' }),
    spring: () => bouquetScene({ items: shuffled(items([['peony', PAL.peonyPink, 50, 4], ['peony', PAL.peonyCoral, 48, 1], ['tulip', PAL.tulipRed, 40, 3], ['tulip', PAL.tulipYellow, 38, 2], ['tulip', PAL.tulipPink, 38, 2]])), cy: 262, R: 138, cap: 1.15, baby: 24,
      h1: [255, 190, 120], h2: [255, 150, 200], caption: 'Peonies and tulips, a little spring just for you.' }),
    mixed: () => bouquetScene({ items: shuffled(items([['rose', PAL.red, 33, 4], ['rose', PAL.blush, 33, 2], ['peony', PAL.peonyPink, 46, 3], ['lily', null, 56, 2], ['orchid', null, 38, 2]])), cy: 262, R: 140, cap: 1.2, baby: 26,
      h1: [190, 130, 255], h2: [255, 160, 220], caption: 'Roses, peonies, lilies and orchids, all the ones you love.' })
  };

  // ---------- Music: add your own song (remembered on this device); the flowers pulse with it ----------
  function setupMusic() {
    const css = document.createElement('style');
    css.textContent = '.music{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}' +
      '.mbtn{font:inherit;font-weight:600;cursor:pointer;color:#ffd9e8;background:#1a0f26;border:3px solid #4a2a63;border-radius:999px;padding:6px 18px}' +
      '.mbtn:hover{border-color:#ff7aa8}.mbtn:focus-visible{outline:3px solid #ffb3cf;outline-offset:3px}.mbtn[hidden]{display:none}' +
      '.mname{max-width:22ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75;font-size:.95rem}';
    document.head.appendChild(css);
    const box = document.createElement('div'); box.className = 'music';
    box.innerHTML = '<button class="mbtn" id="madd">🎵 Add song</button><input type="file" id="mfile" accept="audio/*" hidden>' +
      '<button class="mbtn" id="mplay" hidden>▶ Play</button><span class="mname" id="mname"></span><button class="mbtn" id="mdel" hidden aria-label="Remove song">✕</button>';
    const host = document.getElementById('music');             // pages can choose where the controls go
    if (host) host.appendChild(box); else document.getElementById('replay').after(box);
    const $ = id => document.getElementById(id);
    const file = $('mfile'), add = $('madd'), play = $('mplay'), del = $('mdel'), nameEl = $('mname');
    const audio = new Audio(); audio.loop = true; audio.preload = 'auto';
    let ac = null, an = null, data = null, url = null, loaded = false, level = 0;

    // IndexedDB keeps the chosen song for next time (all calls are guarded: storage can be unavailable)
    const idb = (mode, fn) => new Promise((res, rej) => {
      try {
        const r = indexedDB.open('bloom-music', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('s');
        r.onsuccess = () => { const tx = r.result.transaction('s', mode), q = fn(tx.objectStore('s')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); };
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    const setPlaying = on => { play.textContent = on ? '❚❚ Pause' : '▶ Play'; };
    function show(src, name) {
      audio.src = src; nameEl.textContent = name; play.hidden = false; del.hidden = false; loaded = true; setPlaying(false);
    }
    function ensureAnalyser() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        if (!ac) { ac = new AC(); const src = ac.createMediaElementSource(audio); an = ac.createAnalyser(); an.fftSize = 256; src.connect(an); an.connect(ac.destination); data = new Uint8Array(an.frequencyBinCount); }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { an = null; }
    }
    function toggle() {
      if (!audio.paused) { audio.pause(); return; }
      ensureAnalyser(); audio.play().catch(() => { nameEl.textContent = 'This file cannot be played'; });
    }
    add.addEventListener('click', () => file.click());
    play.addEventListener('click', toggle);
    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(f); show(url, f.name);
      idb('readwrite', st => st.put({ blob: f, name: f.name }, 'song')).catch(() => {});
      toggle();                                                          // starts right away: the tap counts as the user's gesture
      file.value = '';
    });
    del.addEventListener('click', () => {
      audio.pause(); audio.removeAttribute('src'); audio.load(); loaded = false; play.hidden = true; del.hidden = true; nameEl.textContent = '';
      idb('readwrite', st => st.delete('song')).catch(() => {});
    });
    idb('readonly', st => st.get('song')).then(v => { if (v && v.blob && !loaded) { url = URL.createObjectURL(v.blob); show(url, v.name); } })
      .catch(() => {}).then(() => {
        // Optional: a song placed next to the page as music.mp3 is offered too
        if (!loaded && location.protocol.indexOf('http') === 0) fetch('music.mp3', { method: 'HEAD' }).then(r => { if (r.ok && !loaded) show('music.mp3', 'music.mp3'); }).catch(() => {});
      });
    return {
      energy() {
        let target = 0;
        if (an && !audio.paused) { an.getByteFrequencyData(data); let sum = 0; for (let i = 0; i < 8; i++) sum += data[i]; target = sum / 8 / 255; }
        level += (target - level) * 0.25; return level;
      }
    };
  }

  // ---------- Rendering ----------
  function mount(names) {
    const cv = document.getElementById('c'), ctx = cv.getContext('2d');
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d'), frameImg = octx.createImageData(W, H), px = frameImg.data, u32 = new Uint32Array(px.buffer);
    const line = document.getElementById('line'), tabs = [...document.querySelectorAll('.tab')];
    const flies = Array.from({ length: 90 }, () => ({ x: rnd(-420, 420), y: rnd(0, 520), z: rnd(-200, 200), v: rnd(6, 20), p: Math.random() * 6.28 }));
    const music = setupMusic();
    let scene = null, t0 = performance.now(), raf = 0, spin = 0, spinTarget = 0, capStep = -1, lastCap = '';

    function setCaption(txt) {
      if (txt === lastCap) return; lastCap = txt;
      line.classList.add('out'); setTimeout(() => { line.textContent = txt; line.classList.remove('out'); }, 450);
    }
    function splat(x, y, r, g, b, big) {
      const ix = Math.floor(x), iy = Math.floor(y); if (ix < 1 || iy < 1 || ix >= W - 2 || iy >= H - 2) return;
      const fx = x - ix, fy = y - iy;
      const put = (X, Y, w) => { const i = (Y * W + X) * 4; px[i] += r * w; px[i + 1] += g * w; px[i + 2] += b * w; };
      put(ix, iy, (1 - fx) * (1 - fy)); put(ix + 1, iy, fx * (1 - fy)); put(ix, iy + 1, (1 - fx) * fy); put(ix + 1, iy + 1, fx * fy);
      if (big) { put(ix - 1, iy, 0.35); put(ix + 2, iy, 0.35); put(ix, iy - 1, 0.35); put(ix, iy + 2, 0.35); }
    }
    function frame(now) {
      const t = (now - t0) / 1000;
      spin += (spinTarget - spin) * 0.05;
      const ang = Math.sin(t * 0.35) * 0.5 + spin, ca = Math.cos(ang), sa = Math.sin(ang), F = 1000, pv = scene.pivot;
      u32.fill(0xFF000000);
      const en = music.energy();
      const draw = (wx, wy, wz, c, s, birth, p, f, base) => {
        const ba = clamp((t - birth) / 0.7); if (ba <= 0) return;
        const dx = wx - pv, x2 = dx * ca + wz * sa, z2 = -dx * sa + wz * ca, k = F / (F + z2);
        const a = ba * (0.55 + 0.45 * Math.sin(t * f + p)) * clamp(1.15 - z2 / 800, 0.5, 1.25) * base * (1 + en * 0.9);
        splat(W / 2 + x2 * k, BASEY - wy * k, c[0] * a, c[1] * a, c[2] * a, s > 1);
      };
      scene.flowers.forEach(fl => { fl.upd(t); fl.stat.forEach(q => draw(q.wx, q.wy, q.wz, q.c, q.s, q.b, q.p, q.f, q.d)); fl.dyn.forEach(q => draw(q.wx, q.wy, q.wz, q.c, q.s, q.b, q.p, q.f, q.d)); });
      if (t > 2) flies.forEach(q => draw(q.x + Math.sin(t * 0.5 + q.p) * 14, (q.y + t * q.v) % 560, q.z, [255, 225, 250], 1, 2, q.p, 1.5, 0.45));
      octx.putImageData(frameImg, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(off, 0, 0);
      if ('filter' in ctx) { ctx.save(); ctx.filter = 'blur(5px)'; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(off, 0, 0); ctx.restore(); }
      const steps = scene.steps || [[0, 'A tiny seed…'], [1.8, 'It reaches for the light…'], [8, 'And then it blooms.'], [13.8, scene.caption]];
      steps.forEach(([ts, txt], i) => { if (t >= ts && capStep < i) { capStep = i; setCaption(txt); } });
    }
    const loop = now => { frame(now); raf = requestAnimationFrame(loop); };
    function start() { cancelAnimationFrame(raf); t0 = performance.now(); capStep = -1; raf = requestAnimationFrame(loop); }
    function pick(n) { tabs.forEach((b, k) => b.setAttribute('aria-pressed', k === n)); scene = SCENES[names[n]](); start(); }
    tabs.forEach((b, k) => b.addEventListener('click', () => pick(k)));
    document.getElementById('replay').addEventListener('click', () => pick(tabs.findIndex(b => b.getAttribute('aria-pressed') === 'true')));
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); spinTarget = ((e.clientX - r.left) / r.width - 0.5) * 1.6; });
    cv.addEventListener('pointerleave', () => { spinTarget = 0; });
    pick(0);
  }
  window.Bloom = { mount };
})();
