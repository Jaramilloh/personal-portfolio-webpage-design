// LOCAL VENDOR COPY — diverges from upstream: (1) QR_LIB_URL local; (2) Google-Fonts injection removed for CSP.
/* ============================================================================
 * qr-share.js  —  "SCAN_TO_OPEN" QR share widget
 * Drop-in, framework-agnostic. No build step. ~7 KB + one tiny CDN dependency.
 *
 * Adds a floating SCAN button (bottom-right). Click it -> a HUD overlay with a
 * scannable QR code of your page URL, plus Copy link / Share / Download PNG.
 *
 * USAGE (pick one):
 *   1) Script tag with data-attributes:
 *        <script src="qr-share.js"
 *                data-url="https://your-site/"      // optional, defaults to current page
 *                data-name="Your Name"
 *                data-role="Your Role"
 *                data-accent="#46e6a3"              // optional HUD accent
 *                data-open="false"></script>        // start collapsed (default)
 *
 *   2) Config object before the script:
 *        <script>window.QR_SHARE_CONFIG = { name:'…', role:'…' };</script>
 *        <script src="qr-share.js"></script>
 *
 *   3) Manual control (no auto-init): set data-auto="false", then call
 *        QRShare.init({ url, name, role, accent, startOpen });
 *        QRShare.open(); QRShare.close(); QRShare.toggle();
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.QRShare) return;

  var QR_LIB_URL = './assets/vendor/qrcode-generator.js';
  var els = {};      // cached DOM refs
  var CFG = {};

  /* ---- resolve config from script tag / global ----------------------------*/
  function resolveConfig(override) {
    var s = document.currentScript ||
            document.querySelector('script[src*="qr-share"]') || {};
    var d = s.dataset || {};
    var g = window.QR_SHARE_CONFIG || {};
    var o = override || {};
    return {
      url:       o.url       || d.url    || g.url    || window.location.href,
      name:      o.name      || d.name   || g.name   || '',
      role:      o.role      || d.role   || g.role   || '',
      accent:    o.accent    || d.accent || g.accent || '#46e6a3',
      startOpen: o.startOpen != null ? o.startOpen
                 : (d.open === 'true' || g.startOpen === true)
    };
  }

  /* ---- one-time style + font injection ------------------------------------*/
  function injectStyles(accent) {
    if (document.getElementById('qrs-styles')) {
      document.documentElement.style.setProperty('--qrs-accent', accent);
      return;
    }
    var css = [
      ':root{--qrs-accent:' + accent + ';}',
      '.qrs-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;}',
      '.qrs-sans{font-family:"Space Grotesk",system-ui,sans-serif;}',
      '@keyframes qrs-pulse{0%,100%{opacity:1}50%{opacity:.3}}',
      '@keyframes qrs-scan{0%{top:4%;opacity:0}12%{opacity:1}88%{opacity:1}100%{top:94%;opacity:0}}',
      '@keyframes qrs-fadeup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      /* trigger button */
      '.qrs-btn{position:fixed;right:24px;bottom:24px;z-index:2147483000;display:flex;align-items:center;gap:11px;padding:12px 16px;border-radius:13px;cursor:pointer;background:#101317;border:1px solid rgba(255,255,255,.12);color:#e9eae7;font-size:13px;letter-spacing:.13em;font-weight:600;box-shadow:0 12px 32px -10px rgba(0,0,0,.7);transition:transform .2s,border-color .2s,box-shadow .2s;}',
      '.qrs-btn:hover{border-color:var(--qrs-accent);transform:translateY(-2px);box-shadow:0 18px 44px -12px rgba(70,230,163,.4);}',
      '.qrs-glyph{display:grid;grid-template-columns:repeat(3,4px);grid-template-rows:repeat(3,4px);gap:2px;}',
      '.qrs-glyph i{display:block;}',
      '.qrs-glyph i.on{background:var(--qrs-accent);border-radius:1px;}',
      /* overlay */
      '.qrs-overlay{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,7,9,.74);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;pointer-events:none;transition:opacity .35s ease;}',
      '.qrs-overlay.open{opacity:1;pointer-events:auto;}',
      '.qrs-card{width:min(92vw,400px);background:#0c0e12;border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:22px;box-shadow:0 44px 100px -34px rgba(0,0,0,.85);color:#e9eae7;position:relative;}',
      '.qrs-overlay.open .qrs-card{animation:qrs-fadeup .4s ease both;}',
      '.qrs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
      '.qrs-tag{font-size:11px;letter-spacing:.14em;color:#8b9197;}',
      '.qrs-live{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;color:var(--qrs-accent);}',
      '.qrs-live i{width:6px;height:6px;border-radius:50%;background:var(--qrs-accent);animation:qrs-pulse 1.6s infinite;}',
      '.qrs-x{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.1);color:#9aa0a6;font-size:15px;line-height:1;cursor:pointer;transition:color .15s,border-color .15s;}',
      '.qrs-x:hover{color:#e9eae7;border-color:rgba(255,255,255,.25);}',
      '.qrs-frame{position:relative;width:280px;padding:16px;margin:0 auto;}',
      '.qrs-br{position:absolute;width:22px;height:22px;border:2px solid var(--qrs-accent);}',
      '.qrs-br.tl{top:6px;left:6px;border-right:none;border-bottom:none;border-radius:7px 0 0 0;}',
      '.qrs-br.tr{top:6px;right:6px;border-left:none;border-bottom:none;border-radius:0 7px 0 0;}',
      '.qrs-br.bl{bottom:6px;left:6px;border-right:none;border-top:none;border-radius:0 0 0 7px;}',
      '.qrs-br.brr{bottom:6px;right:6px;border-left:none;border-top:none;border-radius:0 0 7px 0;}',
      '.qrs-panel{position:relative;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:11px;padding:14px;overflow:hidden;box-shadow:0 0 0 1px rgba(70,230,163,.22),0 0 44px -6px rgba(70,230,163,.28);}',
      '.qrs-panel canvas{display:block;width:220px;height:220px;image-rendering:pixelated;}',
      '.qrs-line{position:absolute;left:8px;right:8px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--qrs-accent),transparent);box-shadow:0 0 12px 2px rgba(70,230,163,.6);animation:qrs-scan 2.6s ease-in-out infinite;}',
      '.qrs-conf{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;font-size:11px;letter-spacing:.14em;}',
      '.qrs-conf .a{color:var(--qrs-accent);}.qrs-conf .s{color:#3f444a;}.qrs-conf .b{color:#8b9197;}',
      '.qrs-name{text-align:center;margin-top:14px;}',
      '.qrs-name h4{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em;}',
      '.qrs-name p{margin:3px 0 0;font-size:12.5px;color:#8b9197;}',
      '.qrs-url{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:13px;padding:9px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#0a0c0f;font-size:11.5px;color:#9aa0a6;}',
      '.qrs-url .a{color:var(--qrs-accent);flex:none;}',
      '.qrs-url span.u{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.qrs-acts{display:flex;gap:9px;margin-top:14px;}',
      '.qrs-acts button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border-radius:10px;font-size:12px;letter-spacing:.04em;cursor:pointer;transition:border-color .15s,color .15s,filter .15s;}',
      '.qrs-acts .pri{flex:1;border:none;background:var(--qrs-accent);color:#06140d;font-weight:600;}',
      '.qrs-acts .pri:hover{filter:brightness(1.08);}',
      '.qrs-acts .sec{background:transparent;border:1px solid rgba(255,255,255,.14);color:#e9eae7;}',
      '.qrs-acts .sec:hover{border-color:var(--qrs-accent);color:var(--qrs-accent);}',
      '.qrs-foot{text-align:center;margin-top:12px;font-size:10.5px;letter-spacing:.1em;color:#585d63;}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'qrs-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- build DOM ----------------------------------------------------------*/
  function build() {
    var btn = document.createElement('button');
    btn.className = 'qrs-btn qrs-mono';
    btn.setAttribute('aria-label', 'Show QR code to this page');
    btn.innerHTML =
      '<span class="qrs-glyph"><i class="on"></i><i></i><i class="on"></i>' +
      '<i></i><i class="on"></i><i></i><i class="on"></i><i></i><i class="on"></i></span>SCAN';

    var ov = document.createElement('div');
    ov.className = 'qrs-overlay qrs-sans';
    ov.innerHTML =
      '<div class="qrs-card">' +
        '<div class="qrs-head">' +
          '<span class="qrs-tag qrs-mono">// SCAN_TO_OPEN</span>' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            '<span class="qrs-live qrs-mono"><i></i>LIVE</span>' +
            '<button class="qrs-x" data-qrs-close aria-label="Close">\u00d7</button>' +
          '</div>' +
        '</div>' +
        '<div class="qrs-frame">' +
          '<span class="qrs-br tl"></span><span class="qrs-br tr"></span>' +
          '<span class="qrs-br bl"></span><span class="qrs-br brr"></span>' +
          '<div class="qrs-panel"><canvas></canvas><div class="qrs-line"></div></div>' +
        '</div>' +
        '<div class="qrs-conf qrs-mono"><span class="a">QR \u00b7 1.00</span><span class="s">|</span><span class="b">TARGET_LOCKED</span></div>' +
        '<div class="qrs-name"><h4 data-qrs-name></h4><p data-qrs-role></p></div>' +
        '<div class="qrs-url qrs-mono"><span class="a">\u2197</span><span class="u" data-qrs-url></span></div>' +
        '<div class="qrs-acts qrs-mono">' +
          '<button class="pri" data-qrs-copy>Copy link</button>' +
          '<button class="sec" data-qrs-share>Share</button>' +
          '<button class="sec" data-qrs-png>PNG</button>' +
        '</div>' +
        '<div class="qrs-foot qrs-mono">point your camera \u2014 no app needed</div>' +
      '</div>';

    document.body.appendChild(btn);
    document.body.appendChild(ov);

    els.btn = btn;
    els.overlay = ov;
    els.card = ov.querySelector('.qrs-card');
    els.canvas = ov.querySelector('canvas');
    els.copy = ov.querySelector('[data-qrs-copy]');

    // fill text
    ov.querySelector('[data-qrs-name]').textContent = CFG.name || '';
    ov.querySelector('[data-qrs-role]').textContent = CFG.role || '';
    ov.querySelector('[data-qrs-url]').textContent = CFG.url;
    if (!CFG.name && !CFG.role) ov.querySelector('.qrs-name').style.display = 'none';

    // events
    btn.addEventListener('click', api.toggle);
    ov.addEventListener('click', function (e) { if (e.target === ov) api.close(); });
    ov.querySelector('[data-qrs-close]').addEventListener('click', api.close);
    els.copy.addEventListener('click', copyLink);
    ov.querySelector('[data-qrs-share]').addEventListener('click', share);
    ov.querySelector('[data-qrs-png]').addEventListener('click', download);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') api.close(); });
  }

  /* ---- QR rendering -------------------------------------------------------*/
  function ensureLib(cb) {
    if (window.qrcode) return cb();
    var s = document.createElement('script');
    s.src = QR_LIB_URL;
    s.onload = cb;
    s.onerror = function () { console.error('[qr-share] failed to load QR library'); };
    document.head.appendChild(s);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    if (!window.qrcode || !els.canvas) return;
    var qr;
    try { qr = window.qrcode(0, 'M'); qr.addData(CFG.url); qr.make(); }
    catch (e) { console.error('[qr-share]', e); return; }
    var n = qr.getModuleCount(), quiet = 4, scale = 9;
    var size = (n + quiet * 2) * scale;
    var cv = els.canvas;
    cv.width = size; cv.height = size;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0a0b0d';
    var r = scale * 0.42, s = scale * 0.88;
    for (var row = 0; row < n; row++) {
      for (var col = 0; col < n; col++) {
        if (!qr.isDark(row, col)) continue;
        roundRect(ctx, (col + quiet) * scale + scale * 0.06,
                       (row + quiet) * scale + scale * 0.06, s, s, r);
        ctx.fill();
      }
    }
  }

  /* ---- actions ------------------------------------------------------------*/
  function copyLink() {
    var done = function () {
      els.copy.textContent = 'COPIED \u2713';
      setTimeout(function () { els.copy.textContent = 'Copy link'; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CFG.url).then(done).catch(done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = CFG.url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  }
  function share() {
    if (navigator.share) {
      navigator.share({ title: CFG.name || document.title, url: CFG.url }).catch(function () {});
    } else { copyLink(); }
  }
  function download() {
    if (!els.canvas) return;
    var a = document.createElement('a');
    a.href = els.canvas.toDataURL('image/png');
    a.download = 'portfolio-qr.png';
    a.click();
  }

  /* ---- public API ---------------------------------------------------------*/
  var api = {
    init: function (override) {
      CFG = resolveConfig(override);
      injectStyles(CFG.accent);
      build();
      ensureLib(draw);
      if (CFG.startOpen) api.open();
      return api;
    },
    open:  function () { if (els.overlay) els.overlay.classList.add('open'); },
    close: function () { if (els.overlay) els.overlay.classList.remove('open'); },
    toggle:function () { if (els.overlay) els.overlay.classList.toggle('open'); },
    setUrl:function (u) { CFG.url = u;
      var t = els.overlay && els.overlay.querySelector('[data-qrs-url]');
      if (t) t.textContent = u; draw(); }
  };
  window.QRShare = api;

  /* ---- auto-init (unless data-auto="false") -------------------------------*/
  var self = document.currentScript ||
             document.querySelector('script[src*="qr-share"]');
  var auto = !(self && self.dataset && self.dataset.auto === 'false');
  if (auto) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { api.init(); });
    } else { api.init(); }
  }
})();
