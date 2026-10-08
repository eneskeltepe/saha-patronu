// Alt sekmeler ve bottom sheet panelleri.
import { selectors as S, actions as A, config } from '../core/index.js';
import { formatMoney, formatNumber, esc, pitchName } from './format.js';
import { icon } from './icons.js';
import { showRewardedAd, purchase } from '../monetize.js';

const TABS = [['saha', 'pitch', 'Saha'], ['tesis', 'build', 'Tesis'], ['personel', 'people', 'Personel'], ['etkinlik', 'event', 'Etkinlik'], ['magaza', 'shop', 'Mağaza']];
const levelOf = (k) => config.unlocks?.[k] ?? config.upgrades?.[k]?.unlock ?? config.staff?.[k]?.unlock ?? 1;
const MISSION = { matches: (m) => `${m.target} maç oynat`, cafe: (m) => `Kafeteryadan ${formatMoney(m.target)} kazan`, events: () => 'Bir olayı çöz' };
const ACH = { first_pitch: 'İlk ek saha', matches100: '100 maç oynat', five_stars: '5 yıldız ol', first_tournament: 'İlk turnuva', first_venue: 'İlk şube', first_franchise: 'İlk franchise' };
const COSM = { gold: ['Altın saha çizgileri', 'Çizgiler altın sarısı olur'], blue: ['Mavi forma seti', 'Takımlar mavi formayla çıkar'] };
const BRAND = { cash: ['Başlangıç parası', 'Her franchise sonrası bonus kasa'], lights: ['Kalıcı ışık', 'Yeni sahalar aydınlatmalı başlar'], xp: ['Hızlı XP', 'Seviye atlamak %10 daha hızlı'] };
const UPG = {
  turf: ['Zemin', 'turf', 'Referans fiyat +%12/sv · aşınma -%6/sv'],
  lights: ['Aydınlatma', 'bulb', 'Sv1 geceyi açar · sonrası fiyat +%5/sv'],
  lockers: ['Soyunma & duş', 'shower', 'Referans fiyat +%8/sv · itibar +'],
  stands: ['Tribün', 'stands', 'Turnuva için gerekli · turnuva geliri +'],
  roof: ['Kapalı çatı', 'roof', 'Yağmur ve kış etkisini yok eder'],
};
const FAC = {
  cafe: ['Çay ocağı & kafeterya', 'cafe', 'Maç başı kişi başı harcama'],
  rental: ['Ekipman kiralama', 'rental', 'Krampon, forma, eldiven geliri'],
  parking: ['Otopark', 'parking', 'Talep +%3/sv'],
  camera: ['Maç kaydı & kamera', 'camera', 'Video satışı · itibar +'],
  social: ['Sosyal medya', 'social', 'Talep + · influencer şansı +'],
};
const STAFF = {
  keeper: ['Saha görevlisi', 'glove', 'Kondisyonu otomatik onarır'],
  cashier: ['Kasiyer', 'cash', 'Gelir +%5/sv'],
  manager: ['Menajer', 'clip', 'Çevrimdışı süre +1 sa/sv'],
  coach: ['Antrenör', 'whistle', 'Çocuk akademisi: sabah talebi'],
};
const listOf = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.entries(x).map(([id, v]) => ({ id, ...(typeof v === 'object' ? v : { name: v }) })) : []);
const maxOf = (kind, k, dflt) => config?.[kind]?.[k]?.max ?? dflt;

export function createPanels(app) {
  const body = document.getElementById('sheet-body'), sheet = document.getElementById('sheet'), title = document.getElementById('sheet-title'), tabsEl = document.getElementById('tabs');
  const landscape = () => matchMedia('(orientation:landscape) and (min-aspect-ratio:1/1)').matches;
  let tab = 'saha', open = true, selPitch = null, last = '', dragging = false, lastTabOpen = '';
  let st = app.state;
  const unlocked = (k) => { try { return !!S.isUnlocked(st, k); } catch { return st.level >= levelOf(k); } };
  const venue = () => st.venues.find((v) => v.id === st.activeVenueId) || st.venues[0];
  const lockMsg = (k) => `<div class="lockmsg">${icon('lock')} Sv ${levelOf(k)}'te açılır</div>`;

  function buy(act, data, cost, label) {
    if (cost == null || !isFinite(cost)) return `<button class="btn max" disabled>MAKS</button>`;
    const at = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button class="btn buy ${st.money < cost ? 'poor' : ''}" data-act="${act}" ${at}>${label}<small>${formatMoney(cost)}</small></button>`;
  }
  const pips = (lv, max) => `<div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'f' : ''}"></i>`).join('')}</div>`;
  const chTxt = (vid, pid, hr) => { const x = S.bookingChance(st, vid, pid, hr); return x > 0 ? '%' + Math.round(x * 100) : 'Kapalı'; };

  // ---------- SAHA ----------
  function sahaHtml() {
    const v = venue(); if (!v) return '';
    if (!v.pitches.some((p) => p.id === selPitch)) selPitch = v.pitches[0]?.id;
    const p = v.pitches.find((q) => q.id === selPitch);
    const inc = S.incomePerHour(st, v.id), sal = S.salaryPerHour(st, v.id), net = inc - sal;
    let h = `<div class="sum"><div>Gelir/saat<b>${formatMoney(inc)}</b></div><div>Maaş/saat<b>${formatMoney(sal)}</b></div><div>Net<b class="${net >= 0 ? 'pos' : 'neg'}">${formatMoney(net)}</b></div></div>`;
    h += `<div class="chips">${v.pitches.map((q) => `<button class="${q.id === selPitch ? 'on' : ''}" data-act="selp" data-p="${esc(q.id)}">${esc(pitchName(q))}</button>`).join('')}</div>`;
    if (p) {
      const cond = Math.round(p.condition ?? 100), cc = cond < 40 ? 'bad' : cond < 70 ? 'warn' : '';
      h += `<div class="card"><div class="row"><div class="grow"><h4>${icon('pitch')} ${esc(pitchName(p))}</h4><p>Kondisyon %${cond}${cond < 50 ? ' · fiyat ve itibar düşüyor' : ''}</p></div>
        <button class="btn ghost" data-act="repair" data-v="${v.id}" data-p="${p.id}">${icon('wrench')} Bakım · ${formatMoney(S.repairCost(st, v.id, p.id))}</button></div>
        <div class="bar ${cc}" style="margin-top:8px"><i style="width:${cond}%"></i></div>
        ${cond < 60 ? `<div style="margin-top:8px"><button class="btn gem block" data-act="irepair" data-v="${v.id}" data-p="${p.id}">${icon('gem')} Anında bakım (elmas)</button></div>` : ''}</div>`;
      // fiyat
      h += `<div class="card"><h4>${icon('coin')} Saat ücreti</h4>`;
      if (unlocked('price')) {
        const ref = S.referencePrice(st, v.id, p.id), min = Math.round(ref * 0.5), max = Math.round(ref * 2), step = ref < 5000 ? 10 : 50;
        h += `<div class="row"><b id="pv-price" style="font-size:20px;color:var(--gold)">${formatMoney(p.price)}</b><span class="grow"></span><small style="color:var(--dim)">Önerilen ${formatMoney(ref)}</small></div>
          <input type="range" id="price-range" data-v="${v.id}" data-p="${p.id}" min="${min}" max="${max}" step="${step}" value="${clampN(p.price, min, max)}">
          <div class="chance"><span>Gündüz doluluk<b id="pv-day">${chTxt(v.id, p.id, 14)}</b></span><span>Akşam doluluk (21:00)<b id="pv-eve">${chTxt(v.id, p.id, 21)}</b></span></div>
          <p>Ucuz = daha çok maç, pahalı = tek maçtan daha çok gelir.</p>`;
      } else h += `<p>Fiyat ayarı kilitli.</p>${lockMsg('price')}`;
      h += `</div>`;
      // yükseltmeler
      h += `<div class="card"><h4>${icon('hammer')} Saha yükseltmeleri</h4>`;
      for (const k of Object.keys(UPG)) {
        const [n, ic, ef] = UPG[k], lv = p.upgrades?.[k] || 0, max = maxOf('upgrades', k, 10), u = unlocked(k);
        h += `<div class="up ${u ? '' : 'locked'}"><div class="ib">${icon(ic)}</div><div class="grow"><div class="nm">${n}</div><div class="ef">${ef}</div>${u ? pips(lv, max) : lockMsg(k)}</div>${!u ? '' : lv >= max ? buy('', {}, null) : buy('upg', { v: v.id, p: p.id, k }, S.upgradeCost(st, v.id, p.id, k), lv ? 'Geliştir' : 'Satın al')}</div>`;
      }
      h += `</div>`;
    }
    // yeni saha
    const pc = S.pitchCost(st, v.id), full = pc == null || !isFinite(pc);
    h += `<div class="card row"><div class="ib" style="width:42px;height:42px;border-radius:12px;background:var(--card2);display:grid;place-items:center;color:var(--turf)">${icon('plus')}</div><div class="grow"><h4>Yeni saha</h4><p>${full ? 'Bu şubede saha kalmadı' : 'Yeni saha aç, daha çok maç oynansın'}</p></div>${full ? '' : buy('buyPitch', { v: v.id }, pc, 'Aç')}</div>`;
    // şubeler
    const vt = (config.venues || []).filter((t) => !st.venues.some((x) => x.typeId === t.id));
    if (vt.length) {
      h += `<div class="sect">Yeni şube</div>`;
      vt.forEach((t) => {
        const ok = unlocked(t.id);
        h += `<div class="card ${ok ? '' : 'locked'}"><div class="row"><div class="grow"><h4>${icon('build')} ${esc(t.name)}</h4><p>${t.capacity} saha kapasitesi · fiyat x${t.multiplier}</p>${ok ? '' : lockMsg(t.id)}</div>${ok ? buy('buyVenue', { t: t.id }, t.cost, 'Aç') : ''}</div></div>`;
      });
    }
    return h;
  }

  // ---------- TESİS / PERSONEL ----------
  function listHtml(map, kind, field, act, cost, hire) {
    const v = venue();
    let h = '';
    if (kind === 'staff') { const sal = S.salaryPerHour(st, v.id); h += `<div class="sum"><div>Toplam maaş / saat<b>${formatMoney(sal)}</b></div><div>Gelir / saat<b>${formatMoney(S.incomePerHour(st, v.id))}</b></div></div>`; }
    h += `<div class="card">`;
    for (const k of Object.keys(map)) {
      const [n, ic, ef] = map[k], lv = v[field]?.[k] || 0, max = maxOf(kind === 'staff' ? 'staff' : 'facilities', k, 10), u = unlocked(kind === 'staff' ? 'staff' : k), fk = kind === 'staff' ? 'staff' : k;
      h += `<div class="up ${u ? '' : 'locked'}"><div class="ib">${icon(ic)}</div><div class="grow"><div class="nm">${n}${lv ? ` <span class="tag green">Sv ${lv}</span>` : ''}</div><div class="ef">${ef}</div>${u ? pips(lv, max) : lockMsg(fk)}</div>${u ? (lv >= max ? buy('', {}, null) : buy(act, { v: v.id, k }, cost(st, v.id, k), hire && !lv ? 'İşe al' : lv ? 'Geliştir' : 'Aç')) : ''}</div>`;
    }
    return h + '</div>';
  }

  // ---------- ETKİNLİK ----------
  const DAYS = 7;
  function etkinlikHtml() {
    const v = venue(); let h = '';
    const ev = unlocked('events') ? S.eventView(st) : null;
    if (ev) h += `<div class="card" style="border-color:var(--gold)"><h4>${icon('chat')} ${esc(ev.title)}</h4><p>${esc(ev.text)}</p><div style="margin-top:8px"><button class="btn gold block" data-act="event">Karar ver</button></div></div>`;
    else if (!unlocked('events')) h += `<div class="card locked"><h4>${icon('chat')} Mahalle olayları</h4>${lockMsg('events')}</div>`;
    else h += `<div class="card"><h4>${icon('chat')} Olaylar</h4><p>Şimdilik sakin. Bir şey olunca buraya düşer.</p></div>`;
    // turnuvalar
    h += `<div class="sect">Turnuvalar</div>`;
    const p = v.pitches.find((q) => q.id === selPitch) || v.pitches[0];
    if (!unlocked('tournament')) h += `<div class="card locked"><h4>${icon('trophy')} Turnuvalar</h4>${lockMsg('tournament')}</div>`;
    else (config.tournaments || []).forEach((t) => {
      const need = (p?.upgrades?.stands || 0) < 1, ok = st.level >= t.unlock;
      h += `<div class="card ${ok ? '' : 'locked'}"><div class="row"><div class="grow"><h4>${icon('trophy')} ${esc(t.name)}</h4><p>${t.hours} saat · ödül ${formatMoney(t.reward)} · ${icon('gem')} ${t.gems}<br>${esc(pitchName(p))}${need ? ' · tribün gerekli' : ''}</p>${ok ? '' : `<div class="lockmsg">${icon('lock')} Sv ${t.unlock}'te açılır</div>`}</div>${ok ? buy('tourn', { v: v.id, p: p.id, t: t.id }, t.cost, 'Başlat') : ''}</div></div>`;
    });
    // görevler
    h += `<div class="sect">Günlük görevler</div>`;
    for (const m of st.missions?.list || []) {
      const ratio = Math.min(1, m.progress / (m.target || 1)), done = m.progress >= m.target;
      h += `<div class="card"><div class="row"><div class="grow"><h4>${esc((MISSION[m.id] || (() => m.id))(m))}</h4><p>${formatNumber(Math.min(m.progress, m.target))} / ${formatNumber(m.target)}</p><div class="bar gold" style="margin-top:6px"><i style="width:${ratio * 100}%"></i></div></div>
        ${m.claimed ? `<span class="tag green">${icon('check')} Alındı</span>` : `<button class="btn ${done ? 'gem' : 'ghost'}" ${done ? '' : 'disabled'} data-act="mission" data-id="${esc(m.id)}">${icon('gem')} ${formatNumber(m.reward)}</button>`}</div></div>`;
    }
    // giriş serisi
    const ls = st.loginStreak || { count: 0 };
    h += `<div class="sect">Giriş serisi</div><div class="card"><div class="days">${Array.from({ length: DAYS }, (_, i) => {
      const cnt = ls.count || 0, filled = cnt === 0 || (cnt % DAYS === 0 && !ls.claimedToday) ? 0 : ((cnt - 1) % DAYS) + 1;
      const done = i < filled, today = i === filled;
      return `<div class="${done ? 'done' : ''} ${today && !ls.claimedToday ? 'today' : ''}">${icon(done ? 'check' : 'gift')}${i + 1}. gün</div>`;
    }).join('')}</div><button class="btn ${ls.claimedToday ? 'ghost' : 'gold'} block" data-act="login" ${ls.claimedToday ? 'disabled' : ''}>${ls.claimedToday ? 'Bugünkü ödül alındı' : 'Günlük ödülü al'}</button></div>`;
    // başarımlar
    const al = config.achievements || [];
    h += `<div class="sect">Başarımlar</div><div class="card ach">${al.length ? al.map((a) => `<div class="${st.achievements?.[a.id] ? 'on' : ''}">${icon(st.achievements?.[a.id] ? 'star' : 'lock')}<span>${esc(ACH[a.id] || a.id)}</span></div>`).join('') : `<p>${Object.keys(st.achievements || {}).length} başarım kazandın</p>`}</div>`;
    return h;
  }

  // ---------- MAĞAZA ----------
  const PACKS = [['gems_small', 'Avuç dolusu elmas', '50 elmas', 'gem_pack_s'], ['gems_large', 'Kasa dolusu elmas', '250 elmas', 'gem_pack_l'], ['starter', 'Başlangıç paketi', formatMoney(config.rewards.starterMoney) + ' + ' + config.rewards.starterGems + ' elmas', 'starter_pack'], ['remove_ads', 'Reklamları kaldır', 'Zorla reklam zaten yok, destek ol', 'remove_ads']];
  function magazaHtml() {
    const now = Date.now(), R = config.rewards; let h = '';
    const boost = st.time?.speedBoostUntil > now;
    h += `<div class="sect">Ödüller (reklam)</div><div class="card">
      <div class="up"><div class="ib">${icon('bolt')}</div><div class="grow"><div class="nm">2x hız · ${Math.round(R.boostSeconds / 60)} dk</div><div class="ef">${boost ? 'Şu an aktif' : 'Oyun iki kat hızlı akar'}</div></div><button class="btn gold" data-act="ad" data-placement="speed2x" data-reward="speed2x">${icon('play')} İzle</button></div>
      <div class="up"><div class="ib">${icon('gem')}</div><div class="grow"><div class="nm">Bedava elmas</div><div class="ef">Kısa reklam, ${R.gems_small} elmas hediye</div></div><button class="btn gem" data-act="ad" data-placement="gems_small" data-reward="gems_small">${icon('play')} İzle</button></div></div>`;
    const gb = (what, cost, txt = '') => `<button class="btn gem" data-act="gem" data-what="${what}">${icon('gem')} ${txt || cost}</button>`;
    h += `<div class="sect">Elmas harca</div><div class="card">
      <div class="up"><div class="ib">${icon('clock')}</div><div class="grow"><div class="nm">Zaman atlat</div><div class="ef">${config.economy.offlineHours} saatlik kazancı anında al</div></div>${gb('timeskip', R.timeskipGems)}</div>
      <div class="up"><div class="ib">${icon('bolt')}</div><div class="grow"><div class="nm">Hızlandır</div><div class="ef">${Math.round(R.boostSeconds / 60)} dk 2x hız</div></div>${gb('speed2x', R.boostGems)}</div>`;
    (config.cosmetics || []).forEach((c) => {
      const own = st.cosmetics?.owned?.includes(c.id), [n, d] = COSM[c.id] || [c.id, 'Kozmetik'];
      h += `<div class="up"><div class="ib">${icon('star')}</div><div class="grow"><div class="nm">${esc(n)}</div><div class="ef">${esc(d)}</div></div>${own ? `<span class="tag green">${icon('check')} Sende</span>` : gb('cosmetic:' + c.id, R.cosmeticGems)}</div>`;
    });
    h += `</div><div class="sect">Elmas paketleri</div><div class="card">`;
    PACKS.forEach(([rid, n, d, sku]) => { h += `<div class="up"><div class="ib" style="color:var(--gem)">${icon('gem')}</div><div class="grow"><div class="nm">${n}</div><div class="ef">${d}</div></div><button class="btn gold" data-act="iap" data-sku="${sku}" data-reward="${rid}">Satın al</button></div>`; });
    h += `</div>`;
    // marka
    const pre = S.prestigePreview(st), ok = unlocked('franchise'), bu = st.brandUpgrades || {};
    h += `<div class="sect">Marka & franchise</div><div class="card ${ok ? '' : 'locked'}"><h4>${icon('crown')} Franchise ol</h4><p>Her şeyi sıfırla, Marka Puanı kazan. Her puan kalıcı +%10 gelir.</p>
      <div class="sum"><div>Mevcut puan<b>${formatNumber(st.brandPoints || 0)}</b></div><div>Kazanacağın<b class="pos">+${formatNumber(pre || 0)}</b></div></div>
      ${ok ? `<button class="btn gold block" data-act="prestige">${icon('crown')} Franchise ol</button>` : lockMsg('franchise')}</div>`;
    if ((st.brandPoints || 0) > 0 || Object.values(bu).some(Boolean)) {
      h += `<div class="card"><h4>${icon('crown')} Marka dükkanı</h4>`;
      for (const [k, [n, d]] of Object.entries(BRAND)) {
        const it = config.brandShop[k], lv = bu[k] || 0, maxed = k === 'lights' && lv;
        h += `<div class="up"><div class="ib">${icon('star')}</div><div class="grow"><div class="nm">${n}${lv ? ` <span class="tag green">x${lv}</span>` : ''}</div><div class="ef">${d}</div></div>${maxed ? '<span class="tag green">Tamam</span>' : `<button class="btn gold" data-act="brand" data-k="${k}">${formatNumber(it.cost)} puan</button>`}</div>`;
      }
      h += `</div>`;
    }
    h += `<div class="flavor">Maç sonrası çaylar bizden.</div>`;
    return h;
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- render ----------
  function html() {
    switch (tab) {
      case 'saha': return sahaHtml();
      case 'tesis': return listHtml(FAC, 'facilities', 'facilities', 'fac', S.facilityCost, false);
      case 'personel': return listHtml(STAFF, 'staff', 'staff', 'staff', S.staffCost, true);
      case 'etkinlik': return etkinlikHtml();
      default: return magazaHtml();
    }
  }
  const TITLES = { saha: 'Sahalar', tesis: 'Tesisler', personel: 'Personel', etkinlik: 'Etkinlik', magaza: 'Mağaza' };

  function renderTabs() {
    const claim = (st.missions?.list || []).some((m) => m.progress >= m.target && !m.claimed) || (st.loginStreak && !st.loginStreak.claimedToday);
    const dot = (id) => (id === 'etkinlik' && (st.pendingEvent || claim) ? '<i class="dot"></i>' : '');
    const sig = tab + open + dot('etkinlik');
    if (sig === lastTabOpen) return; lastTabOpen = sig;
    tabsEl.innerHTML = TABS.map(([id, ic, n]) => `<button data-tab="${id}" class="${open && tab === id ? 'on' : ''}" aria-label="${n}">${icon(ic)}<span>${n}</span>${dot(id)}</button>`).join('');
  }
  function render(force) {
    st = app.state;
    renderTabs();
    sheet.hidden = !open && !landscape();
    if (sheet.hidden || (dragging && !force)) return;
    title.textContent = TITLES[tab];
    const h = html();
    if (h === last && !force) return;
    last = h;
    const top = body.scrollTop; body.innerHTML = h; body.scrollTop = top;
  }

  function setTab(t) {
    if (t === tab && open && !landscape()) open = false; else { tab = t; open = true; }
    last = ''; render(true); app.resizeCanvasSoon();
  }
  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { app.fx('tap'); setTab(b.dataset.tab); } });

  // ---------- eylemler ----------
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const d = b.dataset, v = d.v, p = d.p; st = app.state;
    switch (d.act) {
      case 'selp': selPitch = d.p; app.selectPitch(d.p); return render(true);
      case 'upg': return app.run(() => A.upgradePitch(st, v, p, d.k));
      case 'repair': return app.run(() => A.repairPitch(st, v, p));
      case 'irepair': return app.run(() => A.useGems(st, `instantRepair:${v}:${p}`));
      case 'buyPitch': return app.run(() => A.buyPitch(st, v));
      case 'buyVenue': return app.run(() => A.buyVenue(st, d.t));
      case 'fac': return app.run(() => A.upgradeFacility(st, v, d.k));
      case 'staff': return app.run(() => A.hireOrUpgradeStaff(st, v, d.k));
      case 'tourn': return app.run(() => A.startTournament(st, v, p, d.t), 'Turnuva başladı!');
      case 'mission': return app.run(() => A.claimMission(st, d.id), 'Görev ödülü alındı', 'gem');
      case 'login': return app.run(() => A.claimLogin(st, Date.now()), 'Günlük ödül alındı', 'gem');
      case 'gem': return app.run(() => A.useGems(st, d.what), 'Tamam!', 'gem');
      case 'event': return app.openEvent();
      case 'brand': return app.run(() => A.buyBrandUpgrade(st, d.k), 'Marka güçlendi!', 'levelup');
      case 'prestige': return app.confirmPrestige();
      case 'ad': if (await showRewardedAd(d.placement)) app.run(() => A.grantReward(st, d.reward), 'Ödül hesabına eklendi', 'gem'); return;
      case 'iap': if (await purchase(d.sku)) app.run(() => A.grantReward(app.state, d.reward), 'Teşekkürler!', 'gem'); return;
    }
  });
  // fiyat kaydırıcı: DOM'u yeniden kurmadan canlı güncelle
  body.addEventListener('input', (e) => {
    const r = e.target; if (r.id !== 'price-range') return;
    st = app.state; const val = Number(r.value);
    A.setPrice(st, r.dataset.v, r.dataset.p, val);
    const q = (id) => document.getElementById(id);
    q('pv-price').textContent = formatMoney(val);
    q('pv-day').textContent = chTxt(r.dataset.v, r.dataset.p, 14);
    q('pv-eve').textContent = chTxt(r.dataset.v, r.dataset.p, 21);
  });
  body.addEventListener('pointerdown', (e) => { if (e.target.id === 'price-range') dragging = true; });
  const endDrag = () => { if (dragging) { dragging = false; last = ''; } };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
  matchMedia('(orientation:landscape)').addEventListener?.('change', () => { last = ''; render(true); app.resizeCanvasSoon(); });

  return { render, setTab, get selPitch() { return selPitch; }, set selPitch(v) { selPitch = v; last = ''; }, isOpen: () => open };
}
