/* ══════════════════════════════════════════════════════════════════
   ARROYO POS — FREE TRIAL LAYER
   Counts sales taken during the trial, shows how many are left, and
   locks the till once the allowance is used up. Sales that ship with
   the sample store are tagged DEMO- and are never counted.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CAP = __TRIAL_CAP__;
  var EDITION = '__TRIAL_EDITION__';
  var STORE = '__TRIAL_STORE__';
  var STATE_KEY = '__TRIAL_STATE_KEY__';
  var HOME = '__TRIAL_HOME__';
  var SELLER = {
    name: 'Reymar Arroyo',
    phone: '+63 906 396 4052',
    tel: '+639063964052',
    email: 'areymar36@gmail.com'
  };

  /* Vendor escape hatch: ?reset=1 wipes the trial and starts it over. */
  if (/[?&]reset=1/.test(location.search)) {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (/^arroyo/.test(k)) localStorage.removeItem(k);
      });
    } catch (e) {}
    location.replace(location.pathname);
    return;
  }

  /* ── counting ────────────────────────────────────────────────── */
  function salesArray() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      var arr = Array.isArray(parsed) ? parsed : parsed && parsed.sales;
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function used() {
    return salesArray().filter(function (s) {
      var id = String((s && (s.id || s.txn_id)) || '');
      return id.indexOf('DEMO-') !== 0;
    }).length;
  }

  /* ── chrome ──────────────────────────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '#arroyo-trial,#arroyo-lock{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;}',
    '#arroyo-trial{position:fixed;left:12px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:10px;',
    'background:#14170f;color:#f4f3ea;border:1px solid rgba(244,243,234,.22);border-radius:999px;',
    'padding:7px 8px 7px 14px;box-shadow:0 6px 22px rgba(0,0,0,.34);max-width:calc(100vw - 24px);}',
    '#arroyo-trial.mini{padding:0;width:38px;height:38px;justify-content:center;}',
    '#arroyo-trial.mini .at-body,#arroyo-trial.mini .at-buy{display:none;}',
    '.at-body{display:flex;flex-direction:column;line-height:1.25;min-width:0;}',
    '.at-head{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#c8c95f;font-weight:700;}',
    '.at-count{font-size:12.5px;font-weight:600;white-space:nowrap;}',
    '.at-count b{font-weight:800;}',
    '.at-buy{background:#c8c95f;color:#14170f;border:none;border-radius:999px;padding:8px 14px;',
    'font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;}',
    '.at-buy:hover{background:#d7d874;}',
    '.at-tog{background:transparent;border:none;color:#8f9184;font-size:15px;cursor:pointer;padding:4px 8px;line-height:1;}',
    '#arroyo-trial.mini .at-tog{padding:0;font-size:16px;color:#c8c95f;width:38px;height:38px;}',
    '.at-buy:focus-visible,.at-tog:focus-visible,#arroyo-lock button:focus-visible,#arroyo-lock a:focus-visible{outline:2px solid #c8c95f;outline-offset:2px;}',
    '@media(max-width:640px){#arroyo-trial{bottom:auto;top:8px;left:8px;padding:5px 6px 5px 11px;}',
    '.at-count{font-size:11.5px;}.at-buy{padding:6px 11px;font-size:11px;}}',
    '#arroyo-lock{position:fixed;inset:0;z-index:2147483600;background:rgba(12,14,10,.94);',
    'display:flex;align-items:center;justify-content:center;padding:22px;overflow:auto;}',
    '.al-card{background:#fbfaf5;color:#1b1b18;max-width:430px;width:100%;border-radius:4px;',
    'padding:30px 26px;box-shadow:0 20px 60px rgba(0,0,0,.5);}',
    '.al-eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a80;font-weight:700;margin-bottom:14px;}',
    '.al-card h2{font-size:22px;line-height:1.25;margin:0 0 12px;font-weight:800;letter-spacing:-.01em;}',
    '.al-card p{font-size:14px;line-height:1.62;color:#4a4a44;margin:0 0 16px;}',
    '.al-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1b1b18;',
    'border-top:1px dashed #c9c8bd;border-bottom:1px dashed #c9c8bd;padding:12px 0;margin:0 0 18px;}',
    '.al-num div{display:flex;justify-content:space-between;gap:12px;padding:2px 0;}',
    '.al-num span:last-child{font-weight:700;}',
    '.al-acts{display:flex;flex-direction:column;gap:9px;}',
    '.al-acts a{display:block;text-align:center;text-decoration:none;padding:13px;border-radius:3px;font-size:14px;font-weight:700;}',
    '.al-pri{background:#14170f;color:#f4f3ea;}',
    '.al-sec{background:transparent;color:#1b1b18;border:1.5px solid #1b1b18;}',
    '.al-foot{font-size:12px;color:#8a8a80;margin:16px 0 0;line-height:1.6;}'
  ].join('');
  document.head.appendChild(css);

  var pill = document.createElement('div');
  pill.id = 'arroyo-trial';
  pill.setAttribute('role', 'status');
  pill.innerHTML =
    '<div class="at-body">' +
      '<div class="at-head">Free trial</div>' +
      '<div class="at-count" id="at-count">&nbsp;</div>' +
    '</div>' +
    '<button class="at-buy" id="at-buy" type="button">Get it</button>' +
    '<button class="at-tog" id="at-tog" type="button" aria-label="Hide trial notice">&minus;</button>';

  function mount() {
    if (!document.body) return;
    document.body.appendChild(pill);
    document.getElementById('at-tog').onclick = function () {
      var mini = pill.classList.toggle('mini');
      this.innerHTML = mini ? '&bull;' : '&minus;';
      this.setAttribute('aria-label', mini ? 'Show trial notice' : 'Hide trial notice');
    };
    document.getElementById('at-buy').onclick = function () { showLock(true); };
    tick();
  }

  /* ── lock screen ─────────────────────────────────────────────── */
  var lock = null;

  function showLock(soft) {
    if (lock) return;
    var n = used();
    lock = document.createElement('div');
    lock.id = 'arroyo-lock';
    lock.setAttribute('role', 'dialog');
    lock.setAttribute('aria-modal', 'true');

    var heading = soft
      ? 'Ready to run this on your own counter?'
      : 'The trial has reached ' + CAP + ' sales';
    var lead = soft
      ? 'You are looking at the ' + EDITION + '. The version you buy is set up with your own business name, your logo, your products and your prices \u2014 and it has no sales limit.'
      : 'That is the whole free allowance. Nothing you rang up has been lost, but the till stops here. Your own copy comes with your business name, your products and your prices, and no limit.';

    lock.innerHTML =
      '<div class="al-card">' +
        '<div class="al-eyebrow">' + EDITION + '</div>' +
        '<h2>' + heading + '</h2>' +
        '<p>' + lead + '</p>' +
        '<div class="al-num">' +
          '<div><span>Sample store</span><span>' + STORE + '</span></div>' +
          '<div><span>Trial sales taken</span><span>' + n + ' / ' + CAP + '</span></div>' +
          '<div><span>Your own build</span><span>No limit</span></div>' +
        '</div>' +
        '<div class="al-acts">' +
          '<a class="al-pri" href="mailto:' + SELLER.email +
            '?subject=' + encodeURIComponent('POS enquiry \u2014 ' + EDITION) +
            '&body=' + encodeURIComponent(
              'Hi Reymar,\n\nI tried the ' + EDITION + ' demo and I would like a copy for my business.\n\n' +
              'Business name:\nWhat we sell:\nNumber of tills:\n\nThanks,\n'
            ) + '">Email ' + SELLER.name + '</a>' +
          '<a class="al-sec" href="tel:' + SELLER.tel + '">Call ' + SELLER.phone + '</a>' +
          (soft
            ? '<a class="al-sec" href="#" id="al-back">Keep trying the demo</a>'
            : '<a class="al-sec" href="' + HOME + '">See the other demos</a>') +
        '</div>' +
        '<p class="al-foot">Trial data lives on this device only. Nothing was uploaded anywhere.</p>' +
      '</div>';

    document.body.appendChild(lock);
    var back = document.getElementById('al-back');
    if (back) back.onclick = function (e) {
      e.preventDefault();
      lock.remove();
      lock = null;
    };
  }

  /* ── loop ────────────────────────────────────────────────────── */
  function tick() {
    var n = used();
    var left = Math.max(0, CAP - n);
    var el = document.getElementById('at-count');
    if (el) {
      el.innerHTML = left > 0
        ? '<b>' + left + '</b> of ' + CAP + ' sales left'
        : 'Sales allowance used up';
    }
    if (n >= CAP) showLock(false);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
  setInterval(tick, 700);
})();
