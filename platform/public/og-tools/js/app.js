// UI wiring. Connects forms to calculation modules and applies preferences.
// Layout: anchor-scroll landing page (no tabs). Adds drawer, scroll progress,
// reveal animations, back-to-top, and mobile footer accordion.

import { convert, listCategories, listUnits } from './converters.js';
import {
  MUD_UNITS, convertMudWeight,
  hydrostaticPsi, hydrostaticKpa,
  pipeCapacityBblFt, annularCapacityBblFt,
  pipeVolumeBbl, annularVolumeBbl, ecdPpg,
} from './drilling.js';
import {
  apiToSg, sgToApi,
  gorScfStbToSm3Sm3, gorSm3Sm3ToScfStb,
  oilFvfStanding, gasFvf, fahrenheitToRankine,
} from './production.js';
import {
  GAS_VOL_UNITS, convertGasVolume,
  gasSgToMw, mwToGasSg,
  pseudoCriticals, zFromConditions, gasDensityLbFt3,
} from './gas.js';
import { getPrefs, setPrefs, resetPrefs, formatNumber } from './preferences.js';

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const fmt = v => formatNumber(v, getPrefs().sigFigs);
const parseNum = el => {
  if (!el.value) return NaN;
  const n = parseFloat(el.value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// ─── Tabs ──────────────────────────────────────────────────────────────

const TAB_IDS = ['units', 'drilling', 'production', 'gas', 'settings'];

function activateTab(id, opts = {}) {
  if (!TAB_IDS.includes(id)) return;
  $$('.tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));
  $$('.calc-section.panel').forEach(p => p.classList.toggle('is-active', p.id === id));
  // Re-trigger reveal animations on the freshly visible panel.
  document.getElementById(id)?.querySelectorAll('.reveal')
    .forEach(el => el.classList.add('visible'));
  if (opts.updateHash !== false && location.hash !== '#' + id) {
    history.replaceState(null, '', '#' + id);
  }
  if (opts.scroll) {
    // Defer so any drawer-close handler runs first (it clears body.overflow:hidden).
    requestAnimationFrame(() => {
      const tabs = $('#mb-tabs');
      const navH = $('#mb-nav')?.offsetHeight ?? 58;
      if (!tabs) return;
      const target = tabs.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: target - navH + 1, behavior: 'smooth' });
    });
  }
}

function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
  // Hero pills + nav anchors + drawer anchors that point to a tab id should
  // activate that tab (and not just rely on hash scrolling).
  $$('a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (!TAB_IDS.includes(id)) return;
    a.addEventListener('click', e => {
      e.preventDefault();
      activateTab(id, { scroll: true });
    });
  });
  // Initial activation from URL hash.
  const initial = location.hash.slice(1);
  if (TAB_IDS.includes(initial)) activateTab(initial, { updateHash: false });
  // Browser back/forward.
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (TAB_IDS.includes(id)) activateTab(id, { updateHash: false });
  });
}

// ─── Chrome (drawer + scroll + reveals + footer accordion) ─────────────

function initChrome() {
  const drawer = $('#mb-drawer');
  const overlay = $('#mb-drawer-overlay');
  const burger = $('#mb-hamburger-btn');
  const closeBtn = $('.mb-drawer-close');
  const drawerReady = drawer && overlay && burger && closeBtn;

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    burger.classList.add('active');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    burger.classList.remove('active');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (drawerReady) {
    burger.addEventListener('click', () => {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    overlay.addEventListener('click', closeDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    // Close drawer when an in-page anchor is followed.
    $$('#mb-drawer a[href^="#"]').forEach(a => a.addEventListener('click', closeDrawer));
  }

  // Scroll progress + back-to-top
  const progress = $('#mb-progress');
  const backTop = $('#mb-back-top');
  const onScroll = () => {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop || document.body.scrollTop;
    const total = doc.scrollHeight - doc.clientHeight;
    if (progress) progress.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
    if (backTop) backTop.classList.toggle('visible', scrolled > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backTop) backTop.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Reveal on scroll (hero already visible immediately).
  $$('#portal-hero .reveal').forEach(el => el.classList.add('visible'));
  const obs = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    }
  }, { threshold: 0.1 });
  $$('.reveal').forEach(el => {
    if (!el.classList.contains('visible')) obs.observe(el);
  });

  // Footer accordion (mobile only).
  $$('.mb-footer-col-head[data-toggle]').forEach(head => {
    head.addEventListener('click', () => {
      if (window.innerWidth > 640) return;
      const ul = head.nextElementSibling;
      const isOpen = head.classList.contains('open');
      head.classList.toggle('open', !isOpen);
      if (ul) ul.classList.toggle('open', !isOpen);
    });
  });
}

// ─── Unit converter ────────────────────────────────────────────────────

function initUnitConverter() {
  const cat   = $('#uc-category');
  const from  = $('#uc-from-unit');
  const to    = $('#uc-to-unit');
  const fromV = $('#uc-from-value');
  const toV   = $('#uc-to-value');

  listCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.label;
    cat.appendChild(opt);
  });

  const FIELD_DEFAULTS = {
    volume: ['bbl', 'm3'],
    pressure: ['psi', 'kPa'],
    temperature: ['F', 'C'],
    length: ['ft', 'm'],
    mass: ['lb', 'kg'],
    flowRate: ['bbld', 'm3d'],
  };
  const SI_DEFAULTS = {
    volume: ['m3', 'bbl'],
    pressure: ['kPa', 'psi'],
    temperature: ['C', 'F'],
    length: ['m', 'ft'],
    mass: ['kg', 'lb'],
    flowRate: ['m3d', 'bbld'],
  };

  function refillUnits() {
    const opts = listUnits(cat.value);
    [from, to].forEach(sel => {
      sel.innerHTML = '';
      opts.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = u.name;
        sel.appendChild(o);
      });
    });
    const defaults = (getPrefs().unitSystem === 'si' ? SI_DEFAULTS : FIELD_DEFAULTS)[cat.value];
    if (defaults) { from.value = defaults[0]; to.value = defaults[1]; }
    recompute('from');
  }

  function recompute(side) {
    if (side === 'from') {
      const v = parseNum(fromV);
      if (Number.isNaN(v)) { toV.value = ''; return; }
      toV.value = fmt(convert(cat.value, v, from.value, to.value));
    } else {
      const v = parseNum(toV);
      if (Number.isNaN(v)) { fromV.value = ''; return; }
      fromV.value = fmt(convert(cat.value, v, to.value, from.value));
    }
  }

  cat.addEventListener('change', refillUnits);
  from.addEventListener('change', () => recompute('from'));
  to.addEventListener('change',   () => recompute('from'));
  fromV.addEventListener('input', () => recompute('from'));
  toV.addEventListener('input',   () => recompute('to'));

  cat.value = 'volume';
  fromV.value = '1';
  refillUnits();
}

// ─── Drilling ──────────────────────────────────────────────────────────

function initDrilling() {
  const mwFromV = $('#mw-from-value');
  const mwFromU = $('#mw-from-unit');
  const mwToU   = $('#mw-to-unit');
  const mwToV   = $('#mw-to-value');

  MUD_UNITS.forEach(u => {
    [mwFromU, mwToU].forEach(sel => {
      const o = document.createElement('option'); o.value = u; o.textContent = u;
      sel.appendChild(o);
    });
  });
  mwFromU.value = 'ppg'; mwToU.value = 'sg';

  function recomputeMud() {
    const v = parseNum(mwFromV);
    if (Number.isNaN(v)) { mwToV.value = ''; return; }
    mwToV.value = fmt(convertMudWeight(v, mwFromU.value, mwToU.value));
  }
  [mwFromV, mwFromU, mwToU].forEach(el => el.addEventListener('input', recomputeMud));
  mwFromU.addEventListener('change', recomputeMud);
  mwToU.addEventListener('change', recomputeMud);
  mwFromV.value = '8.3454';
  recomputeMud();

  function recomputeHydro() {
    const mw = parseNum($('#hp-mw'));
    const tvd = parseNum($('#hp-tvd'));
    const sys = $('#hp-system').value;
    const out = $('#hp-result');
    if (Number.isNaN(mw) || Number.isNaN(tvd)) { out.textContent = ''; return; }
    out.textContent = sys === 'field'
      ? `${fmt(hydrostaticPsi(mw, tvd))} psi`
      : `${fmt(hydrostaticKpa(mw, tvd))} kPa`;
  }
  ['#hp-mw', '#hp-tvd', '#hp-system'].forEach(s => $(s).addEventListener('input', recomputeHydro));
  $('#hp-system').addEventListener('change', recomputeHydro);

  function recomputePipe() {
    const id = parseNum($('#pv-id'));
    const len = parseNum($('#pv-len'));
    if (!Number.isNaN(id)) {
      $('#pv-cap').textContent = `${fmt(pipeCapacityBblFt(id))} bbl/ft`;
      $('#pv-vol').textContent = !Number.isNaN(len) ? `${fmt(pipeVolumeBbl(id, len))} bbl` : '';
    } else {
      $('#pv-cap').textContent = '';
      $('#pv-vol').textContent = '';
    }
  }
  ['#pv-id', '#pv-len'].forEach(s => $(s).addEventListener('input', recomputePipe));

  function recomputeAnn() {
    const dh = parseNum($('#av-dh'));
    const dp = parseNum($('#av-dp'));
    const len = parseNum($('#av-len'));
    if (!Number.isNaN(dh) && !Number.isNaN(dp)) {
      $('#av-cap').textContent = `${fmt(annularCapacityBblFt(dh, dp))} bbl/ft`;
      $('#av-vol').textContent = !Number.isNaN(len) ? `${fmt(annularVolumeBbl(dh, dp, len))} bbl` : '';
    } else {
      $('#av-cap').textContent = '';
      $('#av-vol').textContent = '';
    }
  }
  ['#av-dh', '#av-dp', '#av-len'].forEach(s => $(s).addEventListener('input', recomputeAnn));

  function recomputeEcd() {
    const mw = parseNum($('#ecd-mw'));
    const apl = parseNum($('#ecd-apl'));
    const tvd = parseNum($('#ecd-tvd'));
    const out = $('#ecd-result');
    if ([mw, apl, tvd].some(Number.isNaN)) { out.textContent = ''; return; }
    out.textContent = `${fmt(ecdPpg(mw, apl, tvd))} ppg`;
  }
  ['#ecd-mw', '#ecd-apl', '#ecd-tvd'].forEach(s => $(s).addEventListener('input', recomputeEcd));
}

// ─── Production ────────────────────────────────────────────────────────

function initProduction() {
  const apiV = $('#api-value');
  const sgV  = $('#api-sg');
  apiV.addEventListener('input', () => {
    const v = parseNum(apiV);
    sgV.value = Number.isNaN(v) ? '' : fmt(apiToSg(v));
  });
  sgV.addEventListener('input', () => {
    const v = parseNum(sgV);
    apiV.value = Number.isNaN(v) ? '' : fmt(sgToApi(v));
  });
  apiV.value = '30';
  sgV.value = fmt(apiToSg(30));

  const gorScf = $('#gor-scfstb');
  const gorSm  = $('#gor-sm3');
  gorScf.addEventListener('input', () => {
    const v = parseNum(gorScf);
    gorSm.value = Number.isNaN(v) ? '' : fmt(gorScfStbToSm3Sm3(v));
  });
  gorSm.addEventListener('input', () => {
    const v = parseNum(gorSm);
    gorScf.value = Number.isNaN(v) ? '' : fmt(gorSm3Sm3ToScfStb(v));
  });

  function recomputeBo() {
    const rs = parseNum($('#bo-rs'));
    const gg = parseNum($('#bo-gasSg'));
    const go = parseNum($('#bo-oilSg'));
    const tF = parseNum($('#bo-temp'));
    const out = $('#bo-result');
    if ([rs, gg, go, tF].some(Number.isNaN) || go <= 0) { out.textContent = ''; return; }
    out.textContent = `${fmt(oilFvfStanding(rs, gg, go, tF))} rb/STB`;
  }
  ['#bo-rs', '#bo-gasSg', '#bo-oilSg', '#bo-temp'].forEach(s => $(s).addEventListener('input', recomputeBo));

  function recomputeBg() {
    const z = parseNum($('#bg-z'));
    const tF = parseNum($('#bg-temp'));
    const p = parseNum($('#bg-press'));
    const out = $('#bg-result');
    if ([z, tF, p].some(Number.isNaN) || p <= 0) { out.textContent = ''; return; }
    const bg = gasFvf(z, fahrenheitToRankine(tF), p);
    out.textContent = `${fmt(bg)} rcf/scf  (${fmt(bg * 1000)} rcf/Mscf)`;
  }
  ['#bg-z', '#bg-temp', '#bg-press'].forEach(s => $(s).addEventListener('input', recomputeBg));
}

// ─── Gas ───────────────────────────────────────────────────────────────

function initGas() {
  const fromV = $('#gv-from-value');
  const fromU = $('#gv-from-unit');
  const toU   = $('#gv-to-unit');
  const toV   = $('#gv-to-value');
  GAS_VOL_UNITS.forEach(u => {
    [fromU, toU].forEach(sel => {
      const o = document.createElement('option'); o.value = u; o.textContent = u;
      sel.appendChild(o);
    });
  });
  fromU.value = 'Mscf'; toU.value = 'MMscf';
  function recomputeGv() {
    const v = parseNum(fromV);
    toV.value = Number.isNaN(v) ? '' : fmt(convertGasVolume(v, fromU.value, toU.value));
  }
  [fromV, fromU, toU].forEach(el => el.addEventListener('input', recomputeGv));
  fromU.addEventListener('change', recomputeGv);
  toU.addEventListener('change', recomputeGv);
  fromV.value = '1000';
  recomputeGv();

  $('#gsg-sg').addEventListener('input', () => {
    const v = parseNum($('#gsg-sg'));
    $('#gsg-mw').value = Number.isNaN(v) ? '' : fmt(gasSgToMw(v));
  });
  $('#gsg-mw').addEventListener('input', () => {
    const v = parseNum($('#gsg-mw'));
    $('#gsg-sg').value = Number.isNaN(v) ? '' : fmt(mwToGasSg(v));
  });

  function recomputeZ() {
    const sg = parseNum($('#zf-sg'));
    const tF = parseNum($('#zf-temp'));
    const p = parseNum($('#zf-press'));
    const out = $('#zf-result');
    if ([sg, tF, p].some(Number.isNaN) || sg <= 0 || p <= 0) { out.textContent = ''; return; }
    const tR = fahrenheitToRankine(tF);
    const { tpc, ppc } = pseudoCriticals(sg);
    const z = zFromConditions(sg, tR, p);
    out.textContent = `${fmt(z)}   (Tpr ${fmt(tR/tpc)} · Ppr ${fmt(p/ppc)})`;
  }
  ['#zf-sg', '#zf-temp', '#zf-press'].forEach(s => $(s).addEventListener('input', recomputeZ));

  function recomputeRho() {
    const sg = parseNum($('#gd-sg'));
    const tF = parseNum($('#gd-temp'));
    const p = parseNum($('#gd-press'));
    const out = $('#gd-result');
    if ([sg, tF, p].some(Number.isNaN) || sg <= 0 || p <= 0) { out.textContent = ''; return; }
    const tR = fahrenheitToRankine(tF);
    const z = zFromConditions(sg, tR, p);
    const rho = gasDensityLbFt3(p, sg, z, tR);
    out.textContent = `${fmt(rho)} lb/ft³  (Z ${fmt(z)})`;
  }
  ['#gd-sg', '#gd-temp', '#gd-press'].forEach(s => $(s).addEventListener('input', recomputeRho));
}

// ─── Settings ──────────────────────────────────────────────────────────

function initSettings() {
  const systemEl = $('#pref-system');
  const sigEl = $('#pref-sigfigs');
  const resetEl = $('#pref-reset');
  if (!systemEl || !sigEl || !resetEl) return;

  const prefs = getPrefs();
  systemEl.value = prefs.unitSystem;
  sigEl.value = String(prefs.sigFigs);

  systemEl.addEventListener('change', e => {
    setPrefs({ unitSystem: e.target.value });
  });
  sigEl.addEventListener('change', e => {
    setPrefs({ sigFigs: parseInt(e.target.value, 10) });
    sigEl.value = String(getPrefs().sigFigs);
    // Refresh visible values by re-firing input events on every numeric field.
    $$('input[type="text"]').forEach(i => i.dispatchEvent(new Event('input', { bubbles: true })));
  });
  resetEl.addEventListener('click', () => {
    const p = resetPrefs();
    systemEl.value = p.unitSystem;
    sigEl.value = String(p.sigFigs);
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initChrome();
  initUnitConverter();
  initDrilling();
  initProduction();
  initGas();
  initSettings();
});
