/* Drives MyStore_POS_Builder_v31's own generateApp() under a minimal DOM
   shim, so the demo is exactly what the builder would hand a paying client.
   Config comes in as JSON on argv[2]; the finished POS lands at argv[3]. */

const fs = require('fs');
const vm = require('vm');

const cfgIn = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outPath = process.argv[3];
const srcPath = process.argv[4];

/* ── DOM shim ─────────────────────────────────────────────────────── */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};

function makeEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    _children: [],
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    href: '',
    download: '',
    style: new Proxy({}, { get: () => '', set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(c) { this._children.push(c); return c; },
    removeChild() {},
    insertBefore(c) { this._children.push(c); return c; },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    click() {}, focus() {}, blur() {}, remove() {},
    getContext: () => null,
    toDataURL: () => '',
    get parentNode() { return null; },
  };
  return el;
}

const byId = new Map();
globalThis.document = {
  body: makeEl('body'),
  head: makeEl('head'),
  documentElement: makeEl('html'),
  getElementById(id) {
    if (!byId.has(id)) byId.set(id, makeEl());
    return byId.get(id);
  },
  createElement: makeEl,
  createTextNode: t => ({ textContent: t }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  execCommand: () => false,
};

globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.window = globalThis;
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', clipboard: null, serviceWorker: undefined },
  configurable: true, writable: true,
});
globalThis.location = { href: 'file:///builder.html', search: '', hostname: '', replace() {} };
globalThis.alert = m => { throw new Error('builder alert: ' + m); };
globalThis.confirm = () => true;
globalThis.prompt = () => null;
globalThis.URL.createObjectURL = () => 'blob:demo';
globalThis.URL.revokeObjectURL = () => {};
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.FileReader = class { readAsText() {} readAsDataURL() {} };
globalThis.Image = class { set src(_) { if (this.onerror) this.onerror(); } };

/* ── load the builder ─────────────────────────────────────────────── */
const src = fs.readFileSync(srcPath, 'utf8');
const errors = [];
try {
  // runInThisContext keeps the builder in sloppy mode with real globals, so
  // its top-level function declarations land on globalThis where we can
  // override the form readers.
  vm.runInThisContext(src, { filename: 'builder.js' });
} catch (e) {
  errors.push('load: ' + e.message);
}

if (typeof globalThis.generateApp !== 'function') {
  console.error('generateApp not defined after load:', errors);
  process.exit(1);
}

/* ── feed it our config instead of the form ───────────────────────── */
globalThis.collectForm = () => ({
  name: cfgIn.name, addr: cfgIn.addr, tin: cfgIn.tin, phrase: cfgIn.phrase,
  emoji: cfgIn.emoji || '', themeColor: cfgIn.themeColor,
  vatReg: cfgIn.vatReg || 'vat', serial: cfgIn.serial, minNo: cfgIn.minNo,
  permit: cfgIn.permit, till: cfgIn.till || 'TILL-01',
  retDays: String(cfgIn.retDays ?? 7), uiScale: '1',
  ghUser: cfgIn.ghUser || '', ghRepo: cfgIn.ghRepo || '', ghShort: '',
  multi: false, sbUrl: '', sbKey: '', sbStore: '', sbTill: '', sbEmail: '',
});
globalThis.getRows = () => cfgIn.products;
globalThis.getUsers = () => cfgIn.users;
globalThis.logoData = '';
globalThis.bizType = cfgIn.bizType;
globalThis.showToast = () => {};
globalThis.markStep = () => {};

/* The builder chains setTimeout steps; poll for the finished HTML. */
globalThis.generateApp();

const dl = document.getElementById('btn-dl');
let waited = 0;
const poll = setInterval(() => {
  waited += 50;
  if (dl._posHtml) {
    clearInterval(poll);
    fs.writeFileSync(outPath, dl._posHtml, 'utf8');
    console.log('generated ' + dl._posHtml.length.toLocaleString() + ' chars -> ' + outPath);
    process.exit(0);
  }
  if (waited > 20000) {
    clearInterval(poll);
    console.error('timed out; builder errors:', errors);
    process.exit(1);
  }
}, 50);
