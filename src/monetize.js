// Tek para kazanma arayüzü. Oyunun geri kalanı sağlayıcıyı bilmez.
// Gerçek sağlayıcı (AdMob / Play Billing) için setProvider({ showRewardedAd, purchase }) çağır.
const fakeModal = (html, seconds, okLabel) => new Promise((resolve) => {
  const el = document.createElement('div');
  el.className = 'modal-back ad-back';
  el.innerHTML = `<div class="modal-card ad-card">${html}<div class="ad-count"></div>
    <div class="ad-btns"><button class="btn ghost" data-x>Vazgeç</button><button class="btn primary" data-ok disabled>${okLabel}</button></div></div>`;
  document.body.appendChild(el);
  const count = el.querySelector('.ad-count'), ok = el.querySelector('[data-ok]');
  let left = seconds;
  const done = (v) => { clearInterval(iv); el.remove(); resolve(v); };
  const tick = () => { count.textContent = left > 0 ? `${left}` : '✓'; if (left <= 0) { ok.disabled = false; clearInterval(iv); } left--; };
  const iv = setInterval(tick, 1000); tick();
  el.querySelector('[data-x]').onclick = () => done(false);
  ok.onclick = () => done(true);
});

const fakeProvider = {
  showRewardedAd: (placement) => fakeModal(
    `<div class="ad-tag">Reklam (test)</div><h3>Ödüllü reklam</h3><p>Gerçek sürümde burada video reklam oynar. (${placement})</p>`, 3, 'Ödülü al'),
  purchase: (sku) => fakeModal(
    `<div class="ad-tag">Satın alma (test)</div><h3>${sku}</h3><p>Bu bir test satın almasıdır, ücret alınmaz.</p>`, 1, 'Onayla'),
};

let provider = fakeProvider;
export const setProvider = (p) => { provider = p; };
export const showRewardedAd = async (placement) => { try { return !!(await provider.showRewardedAd(placement)); } catch { return false; } };
export const purchase = async (sku) => { try { return !!(await provider.purchase(sku)); } catch { return false; } };
