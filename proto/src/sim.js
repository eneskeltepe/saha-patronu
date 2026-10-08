// Oyun simülasyonu (DOM yok; tarayıcıda da node'da da çalışır: tools/pace.mjs).
import { CFG, STATIONS, GOALS, KITS, HAIRS, ORDER } from './config.js';
import { G, SPX, WALK_Y, W, route, along } from './layout.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const PITCHES = ['saha1', 'saha2'];
const SERVICE = ['gise', 'soyunma', 'dus', 'cay', 'bufe'];
const MAXLVL = 150;

export function newSave() {
  const st = {};
  for (const id of ORDER) st[id] = { lvl: STATIONS[id].build ? 0 : 1, built: !STATIONS[id].build, mgr: false, pile: 0, rate: 0 };
  return { v: 1, money: CFG.startMoney, gems: 0, day: CFG.day.start, st, goal: 0, goalReady: false, matches: 0, scored: 0,
    boostLeft: 0, tut: 0, settings: { music: true, sound: true }, lastSeen: Date.now(), playTime: 0, lost: 0 };
}

export function stats(id, L) {
  const d = STATIONS[id];
  L = Math.max(1, L);
  let profit = d.profit * (1 + CFG.levelProfit * (L - 1)), time = d.time * Math.pow(CFG.levelSpeed, L - 1), cap = d.cap, lights = false, stage = 0;
  CFG.milestones.forEach((m, i) => {
    if (L < m) return;
    const ms = d.ms[i]; stage = i + 1;
    if (ms.cap) cap += ms.cap; if (ms.speed) time /= ms.speed; if (ms.profit) profit *= ms.profit; if (ms.lights) lights = true;
  });
  return { profit: Math.round(profit), time, cap, lights, stage };
}
export const levelCost = (id, L) => STATIONS[id].cost * Math.pow(STATIONS[id].growth, L - 1);
// n seviye (Infinity = MAX) için kaç seviye alınabilir ve toplam maliyet; afford=false ise en az 1 seviyenin fiyatı
export function costFor(id, L, n, money) {
  let c = 0, k = 0;
  while (k < n && L + k < MAXLVL) {
    const nc = levelCost(id, L + k);
    if (n === Infinity && c + nc > money && k > 0) break;
    if (n === Infinity && k === 0 && nc > money) { c = nc; k = 1; break; }
    c += nc; k++;
  }
  return { cost: c, levels: k };
}
export const nextMilestone = (L) => CFG.milestones.find((m) => m > L) || null;
export const isNight = (day) => day >= CFG.day.nightFrom || day < CFG.day.nightTo;
// 0 gündüz .. 1 gece, yumuşak geçiş
export function darkness(day) {
  const f = CFG.day.nightFrom, t = CFG.day.nightTo, e = 0.05;
  if (day >= f - e && day < f) return (day - (f - e)) / e;
  if (day >= f || day < t - e) return 1;
  if (day >= t - e && day < t) return 1 - (day - (t - e)) / e;
  return 0;
}

export class World {
  constructor(save, emit = () => {}) {
    this.s = save; this.emit = emit;
    this.cust = []; this.teams = []; this.cars = []; this.traffic = []; this.workers = [];
    this.q = {}; for (const id of SERVICE) this.q[id] = [];
    this.pitch = {}; for (const id of PITCHES) this.pitch[id] = this.newPitch(id);
    this.seats = G.cay.seats.map(() => null);
    this.parking = G.otopark.slots.map(() => null);
    this.spawnT = 0.2; this.firstTeam = !save.playTime; this.mgrT = 0; this.rateT = 0; this.acc = {}; this.trafficT = 1; this.id = 1; this.time = 0;
    this.headless = false;
    this.speed = 1;
    this.initWorkers();
  }
  // ---------- yardımcılar ----------
  built(id) { return this.s.st[id]?.built; }
  st(id) { return stats(id, this.s.st[id].lvl); }
  mul() { return this.s.boostLeft > 0 ? CFG.boost.mult : 1; }
  night() { return isNight(this.s.day); }
  totalLevels() { let n = 0; for (const id of ORDER) n += this.s.st[id].lvl; return n; }
  arrivalInterval() {
    const a = CFG.arrival;
    let t = a.base / (1 + a.perLevel * this.totalLevels());
    if (this.built('otopark')) t *= a.otopark;
    if (this.night()) t *= a.night;
    return Math.max(a.min, t) / this.mul();
  }
  addPile(id, amt) {
    this.s.st[id].pile += amt; this.acc[id] = (this.acc[id] || 0) + amt;
    this.emit('earn', { id, amt });
  }
  collect(id) {
    const st = this.s.st[id], a = st.pile;
    if (a <= 0) return 0;
    st.pile = 0; this.s.money += a; return a;
  }
  // ---------- satın alma ----------
  upgrade(id, n) {
    const st = this.s.st[id];
    if (!st.built) return 0;
    const { cost, levels } = costFor(id, st.lvl, n, this.s.money);
    if (!levels || cost > this.s.money) return 0;
    const before = st.lvl;
    this.s.money -= cost; st.lvl += levels;
    this.emit('upgrade', { id, levels });
    CFG.milestones.forEach((m, i) => { if (before < m && st.lvl >= m) this.emit('milestone', { id, i, txt: STATIONS[id].ms[i].txt }); });
    return levels;
  }
  build(id) {
    const st = this.s.st[id], c = STATIONS[id].build;
    if (st.built || this.s.money < c) return false;
    this.s.money -= c; st.built = true; st.lvl = 1;
    if (PITCHES.includes(id)) this.pitch[id] = this.newPitch(id);
    this.initWorkers();
    this.emit('build', { id });
    return true;
  }
  hire(id) {
    const st = this.s.st[id], c = STATIONS[id].mgr;
    if (!st.built || st.mgr || this.s.money < c) return false;
    this.s.money -= c; st.mgr = true; this.initWorkers(); this.emit('hire', { id }); return true;
  }
  goal() { return GOALS[this.s.goal] || null; }
  goalProgress(g = this.goal()) {
    if (!g) return 1;
    const st = g.st && this.s.st[g.st];
    if (g.type === 'level') return Math.min(1, (st.lvl || 0) / g.n);
    if (g.type === 'build') return st.built ? 1 : Math.min(0.99, this.s.money / STATIONS[g.st].build);
    if (g.type === 'manager') return st.mgr ? 1 : Math.min(0.99, this.s.money / STATIONS[g.st].mgr);
    if (g.type === 'matches') return Math.min(1, this.s.matches / g.n);
    return 0;
  }
  claimGoal() {
    const g = this.goal(); if (!g || !this.s.goalReady) return null;
    this.s.gems += g.gems; this.s.goal++; this.s.goalReady = false;
    this.emit('goalDone', { g, last: !this.goal() });
    return g;
  }
  // ---------- işçiler (görsel) ----------
  initWorkers() {
    const keep = this.workers.filter((w) => w.kind === 'caycı' || w.kind === 'saha');
    this.workers = [];
    const cay = keep.find((w) => w.kind === 'caycı') || { kind: 'caycı', x: 150, y: 700, path: [], tasks: [], tray: false, hair: 'black', kit: 'white' };
    this.workers.push(cay);
    for (const id of PITCHES) if (this.built(id)) {
      const old = keep.find((w) => w.kind === 'saha' && w.pitch === id);
      const r = G[id].rect;
      this.workers.push(old || { kind: 'saha', pitch: id, x: r.x + 16, y: r.y + 16, path: [], hair: 'brown', kit: 'yellow', sweep: 0 });
    }
  }
  // ---------- müşteriler ----------
  spawnTeam() {
    const backlog = this.teams.filter((t) => t.phase === 'pre').length;
    const pitches = PITCHES.filter((id) => this.built(id)).length;
    const kit = pick(KITS);
    const fromLeft = Math.random() < 0.5, near = this.firstTeam; this.firstTeam = false;
    const turnAway = backlog >= CFG.backlog.base + CFG.backlog.perPitch * pitches;
    const team = { id: this.id++, kit, members: [], phase: turnAway ? 'away' : 'pre', pitch: null, wait: 0, car: null };
    this.teams.push(team);
    if (turnAway) this.s.lost += CFG.teamSize;
    let carSlot = -1;
    if (!turnAway && this.built('otopark') && Math.random() < CFG.arrival.carShare) carSlot = this.parking.indexOf(null);
    if (carSlot >= 0) {
      const sl = G.otopark.slots[carSlot];
      const car = { id: this.id++, sprite: `car_${pick(['blue', 'red', 'green', 'yellow', 'black'])}_${pick([1, 3, 5])}`, x: W + 60, y: 92, ang: Math.PI, team, slot: carSlot, state: 'in',
        path: [{ x: G.otopark.entryX, y: 92 }, { x: G.otopark.entryX, y: G.otopark.aisle }, { x: sl.x, y: G.otopark.aisle }, { x: sl.x, y: sl.y }], speed: 150 };
      this.parking[carSlot] = car; team.car = car; this.cars.push(car);
      return team;
    }
    for (let i = 0; i < CFG.teamSize; i++) {
      const x = near ? 560 + i * 22 : fromLeft ? -20 - i * 22 : W + 20 + i * 22;
      const c = this.newCust(team, x, WALK_Y + rnd(-4, 4));
      if (turnAway) {
        c.plan = ['away']; c.path = [{ x: fromLeft ? W + 40 + i * 20 : -40 - i * 20, y: c.y }];
        if (i === 0) this.say(c, pick(['Saha dolu abi, başka yere!', 'Sıra çok, gidelim!', 'Of, yer yok!']), 3);
      } else { c.plan = this.makePlan(); this.next(c); if (i === 0 && Math.random() < 0.6) this.say(c, pick(['Abi saha boş mu?', 'Maç var mı abi?', 'Bu akşam fark atarız!', 'Kaleci kim lan?']), 2.5); }
    }
    return team;
  }
  newCust(team, x, y) {
    const c = { id: this.id++, team, kit: team.kit, hair: pick(HAIRS), x, y, ang: 0, path: [], plan: [], st: 'walk', at: null, slot: -1, t: 0,
      hidden: false, speed: CFG.walkSpeed * rnd(0.92, 1.1), bubble: null, bob: Math.random() * 6 };
    team.members.push(c); this.cust.push(c); return c;
  }
  makePlan() {
    const p = ['gise', 'soyunma', 'pitch'];
    if (this.built('dus') && Math.random() < CFG.dusShare) p.push('dus');
    p.push('cay');
    if (this.built('bufe') && Math.random() < CFG.bufeShare) p.push('bufe');
    p.push('exit');
    return p;
  }
  say(c, txt, dur = 2.4) { if (!this.headless) c.bubble = { txt, t: dur, max: dur }; }
  next(c) {
    const step = c.plan.shift();
    c.at = step; c.slot = -1;
    if (!step) { c.st = 'gone'; return; }
    if (SERVICE.includes(step)) {
      if (!this.built(step) || this.q[step].length >= CFG.queueMax) { this.next(c); return; }
      this.q[step].push(c); c.st = 'queue';
      c.path = route(c, this.queuePos(step, this.q[step].length - 1));
    } else if (step === 'pitch') {
      const t = c.team;
      if (!t.pitch) {
        // en az kalabalık sahayı seç
        let best = null, bn = 1e9;
        for (const id of PITCHES) if (this.built(id)) {
          const n = this.teams.filter((x) => x.pitch === id && x.phase === 'pre').length + (this.pitch[id].state !== 'idle' ? 1 : 0);
          if (n < bn) { bn = n; best = id; }
        }
        t.pitch = best;
      }
      const pt = this.pitch[t.pitch];
      pt.bench.push(c); c.st = 'bench';
      c.path = route(c, this.benchPos(t.pitch, pt.bench.length - 1));
    } else if (step === 'exit') {
      c.team.phase = 'post';
      if (c.team.car && c.team.car.state === 'parked') { const car = c.team.car; c.st = 'tocar'; c.path = route(c, { x: G.otopark.slots[car.slot].x + 22, y: G.otopark.aisle }); }
      else { c.st = 'leave'; const left = Math.random() < 0.5; c.path = [...route(c, { x: SPX, y: WALK_Y }), { x: left ? -40 : W + 40, y: WALK_Y + rnd(-4, 4) }]; }
      if (Math.random() < 0.15) this.say(c, pick(['Haftaya rövanş!', 'Eyvallah abi!', 'Yenilen öder demiştik!', 'Çaylar benden!']));
    }
  }
  queuePos(id, i) { return along(G[id].queue, i * 17); }
  benchPos(id, i) { const b = G[id].bench; return { x: b.x + (i % 2 ? 10 : 0), y: b.y0 + i * 17 }; }

  // ---------- güncelleme ----------
  update(dt) {
    const s = this.s; this.time += dt; s.playTime += dt;
    s.day = (s.day + dt / CFG.day.length) % 1;
    if (s.boostLeft > 0) s.boostLeft = Math.max(0, s.boostLeft - dt);
    // gelişler
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnTeam(); this.spawnT = this.arrivalInterval() * rnd(0.85, 1.15); }
    if (!this.headless) this.updateTraffic(dt);
    this.updateCars(dt);
    for (const id of SERVICE) if (this.built(id)) this.updateService(id, dt);
    for (const id of PITCHES) if (this.built(id)) this.updatePitch(id, dt);
    for (const c of this.cust) this.updateCust(c, dt);
    if (!this.headless) this.updateWorkers(dt);
    // temizlik
    if (this.cust.some((c) => c.st === 'gone')) {
      this.cust = this.cust.filter((c) => c.st !== 'gone');
      this.teams = this.teams.filter((t) => t.members.some((c) => c.st !== 'gone') || (t.car && t.car.state !== 'gone'));
    }
    // yöneticiler
    this.mgrT += dt;
    if (this.mgrT >= CFG.mgrInterval) {
      this.mgrT = 0;
      for (const id of ORDER) { const st = s.st[id]; if (st.mgr && st.pile > 0) { const a = this.collect(id); this.emit('mgr', { id, amt: a }); } }
    }
    // gelir hızı (çevrimdışı için)
    this.rateT += dt;
    if (this.rateT >= 5) {
      for (const id of ORDER) { const st = s.st[id]; st.rate = st.rate * 0.85 + 0.15 * ((this.acc[id] || 0) / this.rateT); }
      this.acc = {}; this.rateT = 0;
    }
    // hedef
    const g = this.goal();
    if (g && !s.goalReady && this.goalDone(g)) { s.goalReady = true; this.emit('goalReady', { g }); }
  }
  goalDone(g) {
    const st = g.st && this.s.st[g.st];
    if (g.type === 'level') return st.lvl >= g.n;
    if (g.type === 'build') return st.built;
    if (g.type === 'manager') return st.mgr;
    if (g.type === 'matches') return this.s.matches >= g.n;
    return false;
  }
  move(o, dt, speed) {
    if (!o.path.length) return true;
    const t = o.path[0], dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy), step = speed * dt;
    if (d > 0.5) o.ang = Math.atan2(dy, dx);
    if (d <= step) { o.x = t.x; o.y = t.y; o.path.shift(); return !o.path.length; }
    o.x += dx / d * step; o.y += dy / d * step; return false;
  }
  updateCust(c, dt) {
    if (c.bubble) { c.bubble.t -= dt; if (c.bubble.t <= 0) c.bubble = null; }
    if (c.st === 'play') return; // maç kontrol eder
    const arrived = this.move(c, dt, c.speed * (this.mul() > 1 ? 1.4 : 1));
    if (c.st === 'queue' && arrived) {
      const i = this.q[c.at].indexOf(c), qp = this.queuePos(c.at, i);
      if (dist(c, qp) > 1) c.path = [qp];
      else if (!this.headless && i > 4 && Math.random() < dt * 0.04) this.say(c, pick(['Sıra ne zaman abi?', 'Hadi ya, uzun sürdü!', 'Abi biraz hızlı!']));
    } else if (c.st === 'bench' && arrived) {
      const pt = this.pitch[c.team.pitch], i = pt.bench.indexOf(c), bp = this.benchPos(c.team.pitch, i);
      if (dist(c, bp) > 1) c.path = [bp];
      c.ang = 0;
      if (!this.headless && Math.random() < dt * 0.03) this.say(c, this.night() && !this.st(c.team.pitch).lights ? pick(['Abi ışıkları yak!', 'Karanlıkta top görünmüyor!']) : pick(['Yenilen öder!', 'Kim kaleye geçiyor?', 'Isınalım beyler!', 'Abi saha ne zaman boşalır?']));
    } else if (c.st === 'svc' && arrived) {
      if (G[c.at].inside) c.hidden = true;
      c.t -= dt * this.mul();
      if (c.t <= 0) {
        c.hidden = false;
        this.addPile(c.at, this.st(c.at).profit);
        this.emit('served', { id: c.at, c });
        if (c.at === 'cay') {
          const si = this.seats.findIndex((x, k) => !x && (G.cay.tables[G.cay.seats[k].table].tier === 0 || this.st('cay').stage >= 2));
          if (si >= 0) { this.seats[si] = c; c.st = 'seat'; c.slot = si; c.t = CFG.seatTime; c.path = [{ x: G.cay.seats[si].x, y: G.cay.seats[si].y }]; this.orderTea(si); if (Math.random() < 0.25) this.say(c, pick(['Çaylar benden!', 'Bir tost da ver abi!', 'Ayran var mı?', 'Oh be, çay iyi geldi!'])); return; }
        }
        this.next(c);
      }
    } else if (c.st === 'seat' && arrived) {
      c.ang = G.cay.seats[c.slot].face;
      c.t -= dt * this.mul();
      if (c.t <= 0) { this.seats[c.slot] = null; this.next(c); }
    } else if (c.st === 'tocar' && arrived) {
      c.st = 'incar'; c.hidden = true;
    } else if (c.st === 'leave' && arrived) {
      c.st = 'gone';
    } else if (c.st === 'walk' && arrived && c.plan[0] === 'away') c.st = 'gone';
  }
  updateService(id, dt) {
    const q = this.q[id], cap = Math.min(this.st(id).cap, G[id].svc.length * (G[id].inside ? 99 : 1));
    const busy = this.cust.filter((c) => c.st === 'svc' && c.at === id);
    let free = cap - busy.length;
    while (free > 0 && q.length) {
      const h = q[0];
      if (h.path.length || dist(h, this.queuePos(id, 0)) > 6) break;
      q.shift(); free--;
      const used = new Set(busy.map((c) => c.slot));
      let k = 0; if (!G[id].inside) while (used.has(k)) k++;
      h.st = 'svc'; h.slot = k; h.t = this.st(id).time;
      h.path = [G[id].svc[G[id].inside ? 0 : k]];
      busy.push(h);
    }
  }
  // ---------- arabalar ----------
  updateCars(dt) {
    for (const car of this.cars) {
      if (car.state === 'in') {
        if (this.move(car, dt, car.speed)) {
          car.state = 'parked'; car.ang = Math.PI / 2;
          this.addPile('otopark', this.st('otopark').profit);
          const sl = G.otopark.slots[car.slot];
          for (let i = 0; i < CFG.teamSize; i++) {
            const c = this.newCust(car.team, sl.x + 22, G.otopark.aisle + 10 + i * 4);
            c.path = [{ x: sl.x + 22 + i * 14, y: G.otopark.aisle }]; c.plan = this.makePlan(); c.plan.unshift('__');
            c.st = 'walk'; c.t = i * 0.35;
          }
          if (Math.random() < 0.5) this.say(car.team.members[0], pick(['Park yeri de var, süper!', 'Abi saha boş mu?']));
        }
      } else if (car.state === 'parked') {
        // inenler: kısa beklemeden sonra plana başla
        for (const c of car.team.members) if (c.plan[0] === '__' && !c.path.length) { c.t -= dt; if (c.t <= 0) { c.plan.shift(); this.next(c); } }
        if (car.team.phase === 'post' && car.team.members.every((c) => c.st === 'incar')) {
          for (const c of car.team.members) c.st = 'gone';
          const sl = G.otopark.slots[car.slot];
          car.state = 'out'; car.path = [{ x: sl.x, y: G.otopark.aisle }, { x: G.otopark.entryX, y: G.otopark.aisle }, { x: G.otopark.entryX, y: 40 }, { x: -120, y: 40 }];
        }
      } else if (car.state === 'out') {
        if (this.move(car, dt, car.speed)) { car.state = 'gone'; this.parking[car.slot] = null; }
      }
    }
    if (this.cars.some((c) => c.state === 'gone')) this.cars = this.cars.filter((c) => c.state !== 'gone');
  }
  updateTraffic(dt) {
    this.trafficT -= dt;
    if (this.trafficT <= 0) {
      this.trafficT = rnd(2.5, 6);
      const right = Math.random() < 0.5;
      this.traffic.push({ sprite: `car_${pick(['blue', 'red', 'green', 'yellow', 'black'])}_${pick([1, 3, 5])}`, x: right ? -100 : W + 100, y: right ? 40 : 92, ang: right ? 0 : Math.PI, v: rnd(110, 170) * (right ? 1 : -1) });
    }
    for (const t of this.traffic) t.x += t.v * dt;
    this.traffic = this.traffic.filter((t) => t.x > -150 && t.x < W + 150);
  }
  // ---------- işçiler ----------
  orderTea(si) { const w = this.workers.find((x) => x.kind === 'caycı'); if (w && w.tasks.length < 6) w.tasks.push(si); }
  updateWorkers(dt) {
    for (const w of this.workers) {
      if (w.kind === 'caycı') {
        const home = { x: 168, y: 772 };
        if (this.move(w, dt, 110)) {
          if (w.tray && w.target != null) { w.tray = false; w.target = null; w.path = [home]; }
          else if (!w.tray && w.tasks.length && dist(w, home) < 2) {
            const si = w.tasks.shift(); const s = G.cay.seats[si];
            w.tray = true; w.target = si; w.path = [{ x: s.x + (s.face ? -14 : 14), y: s.y - 16 }];
          } else if (!w.tray && dist(w, home) > 2) w.path = [home];
        }
      } else if (w.kind === 'saha') {
        const pt = this.pitch[w.pitch], r = G[w.pitch].rect;
        if (pt.state === 'idle') {
          w.sweeping = true;
          if (this.move(w, dt, 45)) {
            w.sweep = (w.sweep + 1) % 8;
            const y = r.y + 40 + (w.sweep >> 1) * (r.h - 80) / 3;
            w.path = [{ x: w.sweep % 2 ? r.x + 40 : r.x + r.w - 40, y }];
          }
        } else {
          w.sweeping = false;
          const spot = { x: r.x + r.w - 8, y: r.y + r.h / 2 };
          if (!w.path.length && dist(w, spot) > 2) w.path = [spot];
          if (this.move(w, dt, 90)) w.ang = Math.PI;
        }
      }
    }
  }
  // ---------- saha / maç ----------
  newPitch(id) { return { id, state: 'idle', teams: [], bench: (this.pitch?.[id]?.bench) || [], timer: 0, t0: 0, ball: null, score: [0, 0], net: [0, 0], pause: 0, players: [], cele: 0 }; }
  updatePitch(id, dt) {
    const pt = this.pitch[id], r = G[id].rect, st = this.st(id);
    pt.net[0] = Math.max(0, pt.net[0] - dt); pt.net[1] = Math.max(0, pt.net[1] - dt); pt.cele = Math.max(0, pt.cele - dt);
    // bekleyen takımlar
    const waiting = this.teams.filter((t) => t.pitch === id && t.phase === 'pre');
    for (const t of waiting) t.wait += dt;
    if (pt.state === 'idle') {
      const canPlay = !this.night() || st.lights;
      const ready = waiting.filter((t) => t.members.length && t.members.every((c) => c.st === 'bench' && !c.path.length));
      pt.blocked = !canPlay && ready.length > 0;
      if (canPlay && (ready.length >= 2 || (ready.length === 1 && ready[0].wait > CFG.soloWait))) this.startMatch(id, ready.slice(0, 2));
    } else if (pt.state === 'enter') {
      pt.timer -= dt;
      for (const p of pt.players) this.move(p.c, dt, p.c.speed * 1.4);
      if (pt.timer <= 0 || pt.players.every((p) => !p.c.path.length)) {
        pt.state = 'play'; pt.timer = st.time; pt.t0 = st.time;
        pt.ball = { x: r.x + r.w / 2, y: r.y + r.h / 2, vx: 0, vy: 0, cd: 0.6, spin: 0 };
        this.emit('whistle', { id });
      }
    } else if (pt.state === 'play') {
      pt.timer -= dt * this.mul();
      this.playStep(pt, r, dt);
      if (pt.timer <= 0) this.endMatch(id);
    }
  }
  startMatch(id, teams) {
    const pt = this.pitch[id], r = G[id].rect;
    pt.state = 'enter'; pt.timer = 6; pt.teams = teams; pt.score = [0, 0]; pt.players = [];
    const solo = teams.length === 1;
    const all = solo ? teams[0].members.map((c, i) => ({ c, side: i % 2 })) : teams.flatMap((t, k) => t.members.map((c) => ({ c, side: k })));
    const forms = [[0.5, 0.92], [0.28, 0.74], [0.72, 0.74], [0.36, 0.56], [0.64, 0.56]];
    const cnt = [0, 0];
    for (const p of all) {
      const k = cnt[p.side]++; const f = forms[k % 5];
      p.hx = r.x + r.w * f[0]; p.hy = r.y + r.h * (p.side ? 1 - f[1] : f[1]); p.gk = k === 0;
      p.c.st = 'play'; p.c.path = [G[id].gate, { x: p.hx, y: p.hy }];
      const pb = pt.bench.indexOf(p.c); if (pb >= 0) pt.bench.splice(pb, 1);
      pt.players.push(p);
    }
    for (const t of teams) { t.phase = 'play'; t.wait = 0; }
  }
  endMatch(id) {
    const pt = this.pitch[id];
    this.addPile(id, this.st(id).profit * pt.players.length);
    this.s.matches++;
    this.emit('final', { id, score: pt.score });
    for (const p of pt.players) { p.c.st = 'walk'; p.c.path = []; this.next(p.c); p.c.path.unshift({ ...G[id].gate }); }
    for (const t of pt.teams) t.phase = 'post';
    pt.players = []; pt.teams = []; pt.state = 'idle'; pt.ball = null;
  }
  playStep(pt, r, dt) {
    const b = pt.ball;
    if (this.headless) return;
    if (pt.pause > 0) {
      pt.pause -= dt;
      if (pt.pause <= 0) { b.x = r.x + r.w / 2; b.y = r.y + r.h / 2; b.vx = b.vy = 0; b.cd = 0.8; }
    }
    // top fiziği
    b.x += b.vx * dt; b.y += b.vy * dt; b.spin += Math.hypot(b.vx, b.vy) * dt * 0.1;
    const fr = Math.pow(0.35, dt); b.vx *= fr; b.vy *= fr; b.cd -= dt;
    const gx0 = r.x + r.w / 2 - 34, gx1 = r.x + r.w / 2 + 34, m = 10;
    if (b.x < r.x + m) { b.x = r.x + m; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > r.x + r.w - m) { b.x = r.x + r.w - m; b.vx = -Math.abs(b.vx) * 0.6; }
    for (const side of [0, 1]) {
      const ly = side ? r.y + r.h - m : r.y + m; // side 0 = üst kale (takım 0 hücum eder)
      const out = side ? b.y > ly : b.y < ly;
      if (!out) continue;
      if (pt.pause <= 0 && b.x > gx0 && b.x < gx1) {
        const scorer = side ? 1 : 0;
        pt.score[scorer]++; pt.net[side] = 0.6; pt.pause = 1.6; pt.cele = 1.6; pt.celeSide = scorer;
        this.s.scored++;
        this.emit('goal', { id: pt.id, x: b.x, y: ly, side });
        b.vx *= 0.2; b.vy *= 0.2; b.y = ly;
      } else { b.y = ly; b.vy = -b.vy * 0.6; }
    }
    // oyuncular
    let near = [null, null], nd = [1e9, 1e9];
    for (const p of pt.players) {
      if (p.gk) continue;
      const d = dist(p.c, b); if (d < nd[p.side]) { nd[p.side] = d; near[p.side] = p; }
    }
    for (const p of pt.players) {
      const c = p.c; let tx, ty;
      if (pt.pause > 0) { tx = c.x + Math.sin(this.time * 8 + c.id) * 2; ty = c.y; }
      else if (p.gk) { tx = Math.max(gx0 - 6, Math.min(gx1 + 6, b.x)); ty = p.hy; }
      else if (near[p.side] === p) { tx = b.x; ty = b.y + (p.side ? -8 : 8); }
      else { tx = p.hx + (b.x - p.hx) * 0.35; ty = p.hy + (b.y - (r.y + r.h / 2)) * 0.45; }
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), sp = (near[p.side] === p ? 95 : 60) * dt;
      if (d > 1) { c.ang = Math.atan2(dy, dx); const k = Math.min(1, sp / d); c.x += dx * k; c.y += dy * k; c.running = d > 3; }
      else c.running = false;
      // vuruş
      if (pt.pause <= 0 && b.cd <= 0 && Math.hypot(c.x - b.x, c.y - b.y) < 13) {
        const goalY = p.side ? r.y + r.h : r.y; // side 0 yukarı hücum
        const distG = Math.abs(b.y - goalY);
        let tx2, ty2, pw;
        if (distG < r.h * 0.38 && Math.random() < 0.55) { tx2 = r.x + r.w / 2 + rnd(-46, 46); ty2 = goalY + (p.side ? 20 : -20); pw = rnd(230, 300); this.emit('shot', { id: pt.id }); }
        else {
          const mates = pt.players.filter((q) => q.side === p.side && q !== p);
          const q = pick(mates) || p; tx2 = q.c.x + rnd(-10, 10); ty2 = q.c.y + (p.side ? 30 : -30); pw = rnd(150, 210);
        }
        const a = Math.atan2(ty2 - b.y, tx2 - b.x); b.vx = Math.cos(a) * pw; b.vy = Math.sin(a) * pw; b.cd = 0.5;
        // kaleci kurtarışı şansı
        this.emit('kick', { id: pt.id });
      }
      if (p.gk && pt.pause <= 0 && Math.hypot(c.x - b.x, c.y - b.y) < 15 && Math.random() < 0.5 && b.cd < 0.4) {
        b.vx = rnd(-120, 120); b.vy = (p.side ? 1 : -1) * rnd(150, 220); b.cd = 0.4;
      }
    }
  }
  // ---------- çevrimdışı ----------
  offlineEarnings(sec) {
    const t = Math.min(sec, CFG.offlineCapH * 3600);
    let sum = 0;
    for (const id of ORDER) { const st = this.s.st[id]; if (st.mgr && st.built) sum += st.rate * t * CFG.offlineMul; }
    return { amt: Math.floor(sum), sec: t };
  }
}
