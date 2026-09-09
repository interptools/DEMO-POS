/* ══════════════════════════════════════════════════════════════════
   ARROYO POS — DEMO BACKEND (free trial build)
   Emulates the Supabase auth + PostgREST endpoints entirely in the
   browser, backed by localStorage. No server, no credentials, no cost.
   Everything the trial records stays on this device.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var HOST = '__DEMO_HOST__';
  var DBK = 'arroyo_demo_db_v1';
  var BIZ_ID = '__DEMO_BIZ_ID__';
  var USER_ID = '__DEMO_USER_ID__';
  var DEMO_EMAIL = '__DEMO_EMAIL__';
  var DEMO_PASS = '__DEMO_PASS__';
  var APP_VER = '__DEMO_APP_VER__';
  var SEED = __DEMO_SEED__;

  /* ── store ───────────────────────────────────────────────────── */
  function read() {
    try { return JSON.parse(localStorage.getItem(DBK)); } catch (e) { return null; }
  }
  function write(db) {
    try { localStorage.setItem(DBK, JSON.stringify(db)); } catch (e) { /* quota */ }
  }
  var db = read();
  if (!db || !db.tables) { db = SEED; write(db); }
  window.__demoResetDb = function () {
    try { localStorage.removeItem(DBK); } catch (e) {}
  };

  function tbl(name) {
    if (!db.tables[name]) db.tables[name] = [];
    return db.tables[name];
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ── query parsing (the PostgREST subset this POS actually uses) ── */
  var RESERVED = { select: 1, order: 1, limit: 1, offset: 1, on_conflict: 1 };

  function parseQuery(qs) {
    var q = { filters: [], order: null, limit: 0 };
    if (!qs) return q;
    qs.split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      if (eq < 0) return;
      var key = decodeURIComponent(pair.slice(0, eq));
      var raw = pair.slice(eq + 1);
      if (key === 'order') {
        var bits = decodeURIComponent(raw).split('.');
        q.order = { col: bits[0], dir: bits[1] === 'desc' ? 'desc' : 'asc' };
        return;
      }
      if (key === 'limit') { q.limit = parseInt(decodeURIComponent(raw), 10) || 0; return; }
      if (RESERVED[key]) return;
      var val = decodeURIComponent(raw);
      var dot = val.indexOf('.');
      var op = dot < 0 ? 'eq' : val.slice(0, dot);
      var arg = dot < 0 ? val : val.slice(dot + 1);
      if (op === 'not') {
        var inner = arg.split('.');
        q.filters.push({ col: key, op: 'not_' + inner[0], arg: inner.slice(1).join('.') });
        return;
      }
      q.filters.push({ col: key, op: op, arg: arg });
    });
    return q;
  }

  function loose(a, b) {
    if (a === null || a === undefined) return b === 'null';
    return String(a) === String(b);
  }

  function passes(row, f) {
    var v = row[f.col];
    switch (f.op) {
      case 'eq':  return loose(v, f.arg);
      case 'neq': return !loose(v, f.arg);
      case 'is':  return f.arg === 'null'
        ? (v === null || v === undefined)
        : (f.arg === 'true' ? v === true : f.arg === 'false' ? v === false : loose(v, f.arg));
      case 'not_is': return f.arg === 'null' ? !(v === null || v === undefined) : !loose(v, f.arg);
      case 'in': {
        var list = f.arg.replace(/^\(|\)$/g, '').split(',').map(function (s) {
          return s.replace(/^"|"$/g, '');
        });
        return list.some(function (x) { return loose(v, x); });
      }
      case 'gte': return v >= f.arg;
      case 'lte': return v <= f.arg;
      case 'gt':  return v > f.arg;
      case 'lt':  return v < f.arg;
      case 'like':
      case 'ilike': {
        var pat = f.arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
        return new RegExp('^' + pat + '$', 'i').test(String(v == null ? '' : v));
      }
      default: return true;
    }
  }

  function select(name, q) {
    var out = tbl(name).filter(function (r) {
      return q.filters.every(function (f) { return passes(r, f); });
    });
    if (q.order) {
      var c = q.order.col, sgn = q.order.dir === 'desc' ? -1 : 1;
      out = out.slice().sort(function (a, b) {
        var x = a[c], y = b[c];
        if (x === y) return 0;
        return (x > y ? 1 : -1) * sgn;
      });
    }
    if (q.limit) out = out.slice(0, q.limit);
    return out;
  }

  /* ── responses ───────────────────────────────────────────────── */
  function json(body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
  function empty(status) {
    return Promise.resolve(new Response(null, { status: status || 204 }));
  }

  function bodyOf(init) {
    if (!init || !init.body) return null;
    try { return JSON.parse(init.body); } catch (e) { return null; }
  }

  /* ── auth ────────────────────────────────────────────────────── */
  function session(user) {
    return {
      access_token: 'demo-token.' + user.id,
      refresh_token: 'demo-refresh.' + user.id,
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: user.id, email: user.email, role: 'authenticated' }
    };
  }

  function handleAuth(path, init) {
    var method = ((init && init.method) || 'GET').toUpperCase();
    var body = bodyOf(init) || {};
    var users = tbl('__users');

    if (path.indexOf('/signup') === 0) {
      var email = String(body.email || '').toLowerCase();
      if (!email || !body.password) {
        return json({ error: { message: 'Email and password are required.' } }, 400);
      }
      if (String(body.password).length < 6) {
        return json({ error: { message: 'Password must be at least 6 characters.' } }, 400);
      }
      if (users.some(function (u) { return u.email === email; })) {
        return json({ error: { message: 'That email is already registered in this trial. Sign in instead.' } }, 400);
      }
      var nu = { id: uuid(), email: email, password: String(body.password) };
      users.push(nu);
      write(db);
      return json({ id: nu.id, email: nu.email, role: 'authenticated' });
    }

    if (path.indexOf('/token') === 0) {
      if (path.indexOf('grant_type=refresh_token') > -1) {
        var rt = String(body.refresh_token || '');
        var rid = rt.split('.')[1];
        var ru = users.filter(function (u) { return u.id === rid; })[0];
        if (!ru) return json({ error: { message: 'Session expired. Sign in again.' } }, 400);
        return json(session(ru));
      }
      var le = String(body.email || '').toLowerCase();
      var lu = users.filter(function (u) {
        return u.email === le && u.password === String(body.password || '');
      })[0];
      if (!lu) return json({ error: { message: 'Those details don\'t match this trial account.' } }, 400);
      return json(session(lu));
    }

    if (path.indexOf('/user') === 0) {
      var auth = (init && init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
      var uid = String(auth).replace('Bearer ', '').split('.')[1];
      var cu = users.filter(function (u) { return u.id === uid; })[0];
      if (!cu) return json({ error: { message: 'Not signed in.' } }, 401);
      return json({ id: cu.id, email: cu.email, role: 'authenticated' });
    }

    if (path.indexOf('/logout') === 0) return empty(204);
    if (method === 'GET') return json({});
    return json({});
  }

  /* ── rest ────────────────────────────────────────────────────── */
  function handleRest(path, init) {
    var method = ((init && init.method) || 'GET').toUpperCase();
    var qmark = path.indexOf('?');
    var name = (qmark < 0 ? path : path.slice(0, qmark)).replace(/^\//, '');
    var qs = qmark < 0 ? '' : path.slice(qmark + 1);

    if (name.indexOf('rpc/') === 0) return json([]);
    if (!name) return json([]);

    var q = parseQuery(qs);
    var rows = tbl(name);

    if (method === 'GET' || method === 'HEAD') return json(select(name, q));

    if (method === 'POST') {
      var payload = bodyOf(init);
      if (!payload) return json([], 201);
      var list = Array.isArray(payload) ? payload : [payload];
      var made = list.map(function (r) {
        var rec = Object.assign({}, r);
        if (rec.id === undefined || rec.id === null) rec.id = uuid();
        if (!rec.created_at) rec.created_at = new Date().toISOString();
        rows.push(rec);
        return rec;
      });
      write(db);
      return json(made, 201);
    }

    if (method === 'PATCH') {
      var patch = bodyOf(init) || {};
      var hit = [];
      rows.forEach(function (r) {
        if (q.filters.every(function (f) { return passes(r, f); })) {
          Object.assign(r, patch);
          hit.push(r);
        }
      });
      write(db);
      return json(hit);
    }

    if (method === 'DELETE') {
      var keep = [], gone = [];
      rows.forEach(function (r) {
        if (q.filters.every(function (f) { return passes(r, f); })) gone.push(r);
        else keep.push(r);
      });
      db.tables[name] = keep;
      write(db);
      return json(gone);
    }

    return json([]);
  }

  /* ── fetch interception ──────────────────────────────────────── */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';

    if (url.indexOf(HOST) !== 0) {
      return nativeFetch ? nativeFetch(input, init) : Promise.reject(new Error('offline'));
    }

    // Requests built from a Request object carry method/body/headers there.
    if (typeof input !== 'string' && input) {
      init = init || {};
      if (!init.method) init.method = input.method;
      if (!init.headers) init.headers = input.headers;
    }

    var path = url.slice(HOST.length);

    if (path.indexOf('/version.json') === 0) {
      return json({ version: APP_VER, notes: 'This is the free trial build.' });
    }
    if (path.indexOf('/auth/v1') === 0) return handleAuth(path.slice(8), init);
    if (path.indexOf('/rest/v1') === 0) return handleRest(path.slice(8), init);
    if (path.indexOf('/index.html') === 0 || path.indexOf('/dashboard') === 0) {
      return Promise.resolve(new Response('', { status: 404 }));
    }
    return json({});
  };

  /* Credentials the trial banner shows, and the seeded identity. */
  window.__DEMO_INFO = {
    email: DEMO_EMAIL, pass: DEMO_PASS, bizId: BIZ_ID, userId: USER_ID
  };
})();
