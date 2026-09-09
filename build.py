#!/usr/bin/env python3
"""Assemble the DEMO-POS repository from the three Arroyo POS builders."""

import datetime as dt
import json, os, random, re, shutil

SRC   = '/home/claude/extract'
BUILD = '/home/claude/build'
OUT   = '/mnt/user-data/outputs/DEMO-POS'

REPO_URL   = 'https://interptools.github.io/DEMO-POS'
DEMO_HOST  = 'https://demo.arroyopos.local'
TRIAL_CAP  = 30
STATE_PREFIX = 'arroyodemo'

# The real credentials are never written down here. They are discovered in the
# builder source at build time, replaced, and then asserted absent from output,
# so this script is safe to publish alongside the demos.
CONSTS = ('SUPA_URL', 'SUPA_KEY', 'CREATOR_PASS', 'GITHUB_PAGES_URL')


def discover(html, name):
    m = re.search(r"const " + name + r"\s*=\s*'([^']*)'\s*;", html)
    if not m:
        raise SystemExit(f'ANCHOR MISSING: const {name}')
    return m.group(1)


PREFILL_ANCHOR = ("const PREFILL={bizName:'',bizType:'',ownerName:'',ownerEmail:'',"
                  "location:'',dailyGoal:0,themeColor:'',bizLogo:'',bizId:''};")
QUEUE_ANCHOR   = "const QUEUE_CFG={enabled:false,prefix:'',url:''};//QUEUECFG"
MANIFEST_LINK  = '<link rel="manifest" href="manifest.json"/>'
SW_REG = ("if('serviceWorker' in navigator){window.addEventListener('load',()=>{"
          "navigator.serviceWorker.register('./sw.js').catch(()=>{});});}")

# ── sample catalogues ────────────────────────────────────────────────
CAFE = [
    ('Espresso',            90, 'Coffee',  'CAFE', 99),
    ('Americano',          100, 'Coffee',  'CAFE', 99),
    ('Cafe Latte',         130, 'Coffee',  'CAFE', 99),
    ('Cappuccino',         130, 'Coffee',  'CAFE', 99),
    ('Spanish Latte',      145, 'Coffee',  'CAFE', 99),
    ('Iced Mocha',         155, 'Coffee',  'DRNK', 99),
    ('Matcha Latte',       150, 'Non-coffee', 'DRNK', 60),
    ('House Iced Tea',      65, 'Non-coffee', 'DRNK', 80),
    ('Bottled Water',       25, 'Non-coffee', 'DRNK', 120),
    ('Butter Croissant',    85, 'Pastry',  'BROD', 24),
    ('Cinnamon Roll',       95, 'Pastry',  'BROD', 18),
    ('Banana Bread',        75, 'Pastry',  'BROD', 20),
    ('Cheesecake Slice',   130, 'Pastry',  'CAKE', 12),
    ('Ensaymada',           60, 'Pastry',  'BROD', 30),
    ('Tuna Panini',        175, 'Meals',   'FOOD', 15),
    ('Carbonara',          165, 'Meals',   'BOWL', 14),
]

GRILL = [
    ('Pork Sisig',         185, 'Mains',  'FOOD', 30),
    ('Chicken Inasal',     165, 'Mains',  'FOOD', 35),
    ('Beef Tapa',          175, 'Mains',  'FOOD', 25),
    ('Bangus Sisig',       195, 'Mains',  'BOWL', 18),
    ('Pork BBQ Stick',      45, 'Mains',  'FOOD', 80),
    ('Plain Rice',          25, 'Rice',   'RICE', 200),
    ('Garlic Rice',         45, 'Rice',   'RICE', 150),
    ('Java Rice',           50, 'Rice',   'RICE', 120),
    ('Atchara',             25, 'Sides',  'ITEM', 60),
    ('Ensaladang Talong',   55, 'Sides',  'ITEM', 30),
    ('Extra Sauce',         15, 'Sides',  'ITEM', 100),
    ('Softdrink in Can',    45, 'Drinks', 'DRNK', 90),
    ('Iced Tea Pitcher',   120, 'Drinks', 'DRNK', 25),
    ('Bottled Water',       25, 'Drinks', 'DRNK', 120),
    ('Buko Juice',          60, 'Drinks', 'DRNK', 40),
]

EXPENSES = [
    ('Electricity share', 1850, 'Utilities'),
    ('Ice delivery',       420, 'Supplies'),
    ('Packaging cups',     980, 'Supplies'),
    ('Cleaning materials', 350, 'Supplies'),
]


def products(cat, biz_id):
    out = []
    for i, (name, price, group, icon, stock) in enumerate(cat, start=1):
        out.append({
            'id': f'seed-prod-{i:02d}', 'biz_id': biz_id, 'local_id': i,
            'name': name, 'price': price, 'cat': group, 'icon': icon,
            'stock': stock, 'variants': [], 'img': None,
            'sale_pct': 0, 'barcode': ''
        })
    return out


def sales_history(cat, biz_id, seed, cashiers, days=6, per_day=(3, 6)):
    """Six days of sample takings so the reports and charts open with data."""
    rng = random.Random(seed)
    rows, n = [], 0
    today = dt.datetime.now().replace(microsecond=0)
    for back in range(days, 0, -1):
        day = today - dt.timedelta(days=back)
        for _ in range(rng.randint(*per_day)):
            n += 1
            when = day.replace(hour=rng.randint(8, 19), minute=rng.randint(0, 59))
            items, total = [], 0
            for name, price, group, icon, _stock in rng.sample(cat, rng.randint(1, 3)):
                qty = rng.randint(1, 3)
                items.append({'name': name, 'qty': qty, 'price': price,
                              'variantLabel': '', 'cat': group})
                total += price * qty
            method = rng.choice(['Cash', 'Cash', 'Cash', 'GCash', 'Card'])
            rows.append({
                'id': f'seed-sale-{n:03d}', 'biz_id': biz_id,
                'txn_id': f'DEMO-{when.strftime("%m%d")}-{n:03d}',
                'date': when.isoformat(), 'total': total, 'discount': 0,
                'method': method, 'items': items,
                'cashier': rng.choice(cashiers), 'ref': '',
                'voided': False, 'voided_by': '', 'voided_at': '',
                'queue_no': 0, 'queue_status': '', 'queue_day': None
            })
    return rows


def expenses_rows(biz_id):
    out = []
    today = dt.datetime.now()
    for i, (name, amount, cat) in enumerate(EXPENSES, start=1):
        out.append({
            'id': f'seed-exp-{i:02d}', 'biz_id': biz_id, 'name': name,
            'amount': amount, 'cat': cat,
            'date': (today - dt.timedelta(days=i)).isoformat()
        })
    return out


def read(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)


def swap(html, old, new, label, required=True, once=False):
    hits = html.count(old)
    if not hits:
        if required:
            raise SystemExit(f'ANCHOR MISSING: {label}')
        return html
    if once:
        return html.replace(old, new, 1)
    return html.replace(old, new)


def trial_layer(edition, store, state_key):
    js = read(f'{BUILD}/trial.js')
    js = js.replace('__TRIAL_CAP__', str(TRIAL_CAP))
    js = js.replace('__TRIAL_EDITION__', edition)
    js = js.replace('__TRIAL_STORE__', store)
    js = js.replace('__TRIAL_STATE_KEY__', state_key)
    js = js.replace('__TRIAL_HOME__', REPO_URL + '/')
    return js


# ══════════════════════════════════════════════════════════════════════
#  DEPLOYER DEMOS (cloud editions, running on the local demo backend)
# ══════════════════════════════════════════════════════════════════════
def build_deployer(src_file, folder, spec):
    html = read(f'{SRC}/{src_file}')
    biz_id, user_id = spec['biz_id'], spec['user_id']

    # 1. strip every real credential, then prove it is gone
    real = {n: discover(html, n) for n in CONSTS}
    demo = {
        'SUPA_URL': DEMO_HOST,
        'SUPA_KEY': 'demo-local-anon-key-not-a-real-token',
        'CREATOR_PASS': 'arroyo-demo',
        'GITHUB_PAGES_URL': DEMO_HOST,
    }
    for name, value in real.items():
        # Replace the bare value everywhere, not just the declaration: the key
        # is also spliced into header objects further down the template.
        html = swap(html, value, demo[name], name)

    project_ref = re.sub(r'^https?://', '', real['SUPA_URL']).split('.')[0]
    for leaked in list(real.values()) + [project_ref]:
        if leaked and leaked in html:
            raise SystemExit(f'LEAK in {folder}: {leaked[:36]}')

    # 2. bake in the sample business
    prefill = {
        'bizName': spec['name'], 'bizType': spec['biz_type'],
        'ownerName': 'Demo Manager', 'ownerEmail': spec['email'],
        'location': spec['location'], 'dailyGoal': spec['goal'],
        'themeColor': spec['theme'], 'bizLogo': '', 'bizId': biz_id
    }
    html = swap(html, PREFILL_ANCHOR,
                'const PREFILL=' + json.dumps(prefill).replace('<', '\\u003c') + ';',
                'PREFILL')
    html = swap(html, QUEUE_ANCHOR,
                "const QUEUE_CFG={enabled:false,prefix:'',url:''};//QUEUECFG-demo",
                'QUEUE_CFG')

    # 3. single self-contained page: no manifest, no service worker
    html = swap(html, MANIFEST_LINK, '', 'manifest link')
    html = swap(html, SW_REG, '/* Demo build: no service worker. */', 'sw registration')
    html = swap(html, '<title>Arroyo POS</title>',
                f'<title>{spec["name"]} POS \u2014 free trial</title>', 'title')

    # 4. seed the demo backend
    cashiers = spec['cashiers']
    seed = {
        'tables': {
            '__users': [{'id': user_id, 'email': spec['email'], 'password': spec['pw']}],
            'businesses': [{
                'id': biz_id, 'user_id': user_id, 'name': spec['name'],
                'biz_type': spec['biz_type'],
                'settings': {
                    'biz_name': spec['name'], 'pass': '1234',
                    'daily_goal': spec['goal'], 'theme_color': spec['theme'],
                    'require_ref': False, 'biz_logo': '',
                    'owner_name': 'Demo Manager', 'location': spec['location']
                }
            }],
            'products': products(spec['catalog'], biz_id),
            'sales': sales_history(spec['catalog'], biz_id, spec['seed'], cashiers),
            'expenses': expenses_rows(biz_id),
            'employees': [], 'customers': [], 'ingredients': [],
            'recipes': [], 'attendance': [], 'shifts': [],
            'wastage': [], 'credit_ledger': []
        }
    }

    shim = read(f'{BUILD}/shim.js')
    shim = (shim.replace('__DEMO_HOST__', DEMO_HOST)
                .replace('__DEMO_BIZ_ID__', biz_id)
                .replace('__DEMO_USER_ID__', user_id)
                .replace('__DEMO_EMAIL__', spec['email'])
                .replace('__DEMO_PASS__', spec['pw'])
                .replace('__DEMO_APP_VER__', spec['app_ver'])
                .replace('__DEMO_SEED__', json.dumps(seed)))

    trial = trial_layer(spec['edition'], spec['name'], 'arroyo_pos')

    hint = f"""
/* Fills the sign-in form once, so a first-time visitor is one tap from the
   till without the field being rewritten under them as they type. */
(function(){{
  var E='{spec['email']}', P='{spec['pw']}', filled=false;
  var timer=setInterval(function(){{
    var card=document.querySelector('.auth-card');
    if(!card)return;
    if(!document.getElementById('demo-note')){{
      var n=document.createElement('div');
      n.id='demo-note';
      n.style.cssText='margin-top:14px;padding:11px 13px;border:1px dashed rgba(128,128,128,.5);'+
        'font-size:12px;line-height:1.6;opacity:.85';
      n.innerHTML='<strong>Free trial</strong> \\u2014 the sign-in details are already '+
        'filled in for you. Inside the till, the manager password is <strong>1234</strong>.';
      card.appendChild(n);
    }}
    if(!filled){{
      var e=document.getElementById('authEmail'), p=document.getElementById('authPass');
      if(e&&p){{
        if(!e.value)e.value=E;
        if(!p.value)p.value=P;
        filled=true;
        clearInterval(timer);
      }}
    }}
  }},400);
}})();
"""

    injected = ('</head>\n<body>\n<script>\n' + shim + '\n</script>\n<script>\n' + trial
                + '\n' + hint + '\n</script>\n')
    html = swap(html, '</head>\n<body>', injected, 'document body', once=True)

    write(f'{OUT}/{folder}/index.html', html)
    return len(html)


# ══════════════════════════════════════════════════════════════════════
#  APPLICATION-ONLY DEMO (offline till, no cloud at all)
# ══════════════════════════════════════════════════════════════════════
def build_app_only(folder, spec):
    html = read(f'{SRC}/apponly_POS.html')

    # Retire the real client's name from a publicly linked demo. The name is
    # read out of the template rather than hard-coded, so it never appears here.
    m = re.search(r'<title>(.+?) POS</title>', html)
    if not m:
        raise SystemExit('ANCHOR MISSING: <title> in offline template')
    old_full = m.group(1)
    old_short = old_full.split()[0]
    low = old_short.lower()

    # storage keys first, e.g. <brand>_sales -> arroyodemo_sales
    html = html.replace(low + '_', STATE_PREFIX + '_')
    # remaining lowercase brand tokens: handles, domains, e-mail placeholders
    html = re.sub(low + r'(?=[a-z@.])', 'sweetcrumb', html)
    # then the display names
    html = html.replace(old_full, spec['name']).replace(old_short, spec['short'])

    for leaked in (old_full, old_short, low):
        if leaked in html:
            raise SystemExit(f'LEAK in {folder}: {leaked}')

    html = swap(html, f'<title>{spec["name"]} POS</title>',
                f'<title>{spec["name"]} POS \u2014 free trial</title>', 'title', once=True)

    trial = trial_layer(spec['edition'], spec['name'], STATE_PREFIX + '_sales')

    hint = """
/* Shows the trial login on the lock screen instead of making people guess. */
(function(){
  var timer=setInterval(function(){
    var box=document.querySelector('.login-box')||document.getElementById('login-screen');
    if(!box)return;
    if(!document.getElementById('demo-note')){
      var n=document.createElement('div');
      n.id='demo-note';
      n.style.cssText='margin-top:16px;padding:11px 13px;border:1px dashed rgba(128,128,128,.55);'+
        'border-radius:6px;font-size:12px;line-height:1.6;text-align:left';
      n.innerHTML='<strong>Free trial</strong> \\u2014 login password <strong>login123</strong>, '+
        'admin password <strong>admin123</strong>.';
      box.appendChild(n);
    }
    var inp=document.getElementById('login-password');
    if(inp&&!inp.value)inp.value='login123';
    clearInterval(timer);
  },400);
})();
"""

    html = swap(html, '</head>\n<body>',
                '</head>\n<body>\n<script>\n' + trial + '\n' + hint + '\n</script>\n',
                'document body', once=True)

    write(f'{OUT}/{folder}/index.html', html)
    return len(html)


# ══════════════════════════════════════════════════════════════════════
SPECS = {
    'cloud-light': dict(
        src='v711_POS_B64.html', folder='cloud-light',
        edition='Cloud edition \u2014 daylight theme',
        name='Brew & Bite Caf\u00e9', biz_type='cafe', catalog=CAFE,
        location='Makati City', goal=8000, theme='#1b3a8c',
        email='demo@brewandbite.test', pw='demo1234', app_ver='3.1',
        biz_id='11111111-1111-4111-8111-111111111111',
        user_id='22222222-2222-4222-8222-222222222222',
        cashiers=['Ana R.', 'Mico P.'], seed=711,
    ),
    'cloud-dark': dict(
        src='v612_POS_B64.html', folder='cloud-dark',
        edition='Cloud edition \u2014 midnight theme',
        name='Kanto Grill & Rice', biz_type='food', catalog=GRILL,
        location='Quezon City', goal=12000, theme='#2f81f7',
        email='demo@kantogrill.test', pw='demo1234', app_ver='3.1',
        biz_id='33333333-3333-4333-8333-333333333333',
        user_id='44444444-4444-4444-8444-444444444444',
        cashiers=['Jomar T.', 'Bea L.'], seed=612,
    ),
    'offline': dict(
        folder='offline', edition='Offline edition',
        name='Sweet Crumb Bakeshop', short='Sweet Crumb',
    ),
}

if __name__ == '__main__':
    for sub in ('cloud-light', 'cloud-dark', 'offline'):
        if os.path.isdir(f'{OUT}/{sub}'):
            shutil.rmtree(f'{OUT}/{sub}')
    a = build_deployer(SPECS['cloud-light']['src'], 'cloud-light', SPECS['cloud-light'])
    b = build_deployer(SPECS['cloud-dark']['src'], 'cloud-dark', SPECS['cloud-dark'])
    c = build_app_only('offline', SPECS['offline'])
    # chooser page + Pages housekeeping
    shutil.copyfile(f'{BUILD}/landing.html', f'{OUT}/index.html')
    open(f'{OUT}/.nojekyll', 'w').close()
    os.makedirs(f'{OUT}/build', exist_ok=True)
    for f in ('build.py', 'shim.js', 'trial.js', 'landing.html'):
        shutil.copyfile(f'{BUILD}/{f}', f'{OUT}/build/{f}')
    print(f'cloud-light  {a:>9,} chars')
    print(f'cloud-dark   {b:>9,} chars')
    print(f'offline      {c:>9,} chars')
