/* ============================================================================
 * 27-afk-offline.js — 離線掛機模組（關閉瀏覽器也能結算掛機收益）
 *
 * 改寫自 pp771007/afk-offline.js，適配本專案模組化架構。
 *   - 時間戳存在自己的 localStorage 鍵（afk_ts_<slot>），不碰原存檔格式。
 *   - 離線戰鬥直接呼叫原作者的 tick()，平衡/掉落跟著原版自動同步。
 *   - 撞死即停、存活則結算後接回原狩獵圖續掛。
 *   - 時間切片 + 進度遮罩，長時間補跑也不會凍結頁面。
 *   - 背景 Worker 節拍器，分頁切到背景也不停。
 *   - 離線歷史紀錄寫 localStorage（afk_hist_<slot>），無 UI 顯示。
 *   - 補跑上限 12 小時。
 *
 * 區塊目錄：
 *   1. 可調參數與自我檢查
 *   2. 工具函式（slot/ts/map key、格式化、倒數計時）
 *   3. 物品差異計算（共用）
 *   4. 離線歷史紀錄
 *   5. 背景 Worker 節拍器
 *   6. 進度遮罩 UI
 *   7. 快照與摘要
 *   8. gotoMap / homeTown
 *   9. 離線補跑（時間切片核心）
 *  10. maybeCatchup 入口
 *  11. 包裝 saveGame / loadGame / changeMap / killMob
 *  12. 入口提示注入
 *  13. 事件監聽
 * ========================================================================== */
(function () {
  'use strict';

  // ----- 可調參數 ---------------------------------------------------------
  var CAP_HOURS        = 12;                      // 離線收益上限（小時）
  var CAP_MS           = CAP_HOURS * 3600 * 1000;
  var HEARTBEAT_MS     = 5 * 1000;              // 活著時多久蓋一次時間戳
  var OVERLAY_MIN_TICK = 3000;                  // 補跑超過這麼多 tick 才顯示進度遮罩（約 5 分鐘）
  var SLICE_MIN_MS     = 28;                    // 短離線：接近一個影格，畫面順
  var SLICE_MAX_MS     = 250;                   // 長離線：讓出少、結算快
  var SLICE_SHORT_TICK = 3000;                  // ≤5 分鐘以下一律用最小值
  var SLICE_LONG_TICK  = 36000;                 // ≥1 小時一律用最大值
  function sliceFor(totalTicks) {
    if (totalTicks <= SLICE_SHORT_TICK) return SLICE_MIN_MS;
    if (totalTicks >= SLICE_LONG_TICK) return SLICE_MAX_MS;
    var f = (totalTicks - SLICE_SHORT_TICK) / (SLICE_LONG_TICK - SLICE_SHORT_TICK);
    return Math.round(SLICE_MIN_MS + f * (SLICE_MAX_MS - SLICE_MIN_MS));
  }
  function fmtCatchupTime(ticks) {
    var s = Math.round(ticks * TICK_MS / 1000);
    if (s < 60) return s + ' 秒';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分' + (s % 60 ? ' ' + (s % 60) + ' 秒' : '');
    var h = Math.floor(m / 60);
    return h + ' 小時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
  }
  var TS_PREFIX = 'afk_ts_';

  // ----- 自我檢查 ---------------------------------------------------------
  if (typeof window.saveGame !== 'function' ||
      typeof window.loadGame !== 'function' ||
      typeof window.tick !== 'function' ||
      typeof window.settleDeadMobs !== 'function' ||
      typeof window.startGameTimers !== 'function') {
    console.warn('[AFK] 缺少核心函式掛點（saveGame/loadGame/tick/...），離線功能停用。');
    return;
  }
  try { void state; void player; void currentSlot; void TICK_MS; }
  catch (e) {
    console.warn('[AFK] 缺少核心全域（state/player/currentSlot/TICK_MS），離線功能停用。');
    return;
  }

  // ----- 小工具 -----------------------------------------------------------
  function validSlot() { var n = +currentSlot; return Number.isInteger(n) && n >= 1; }
  function tsKey()      { return TS_PREFIX + currentSlot; }
  function mapKey()     { return 'afk_map_' + currentSlot; }
  function prideKey()   { return 'afk_pride_' + currentSlot; }
  function oblKey()     { return 'afk_obl_' + currentSlot; }
  function readTs()     { try { return +localStorage.getItem(tsKey()) || 0; } catch (e) { return 0; } }
  function readMap()    { try { return localStorage.getItem(mapKey()) || ''; } catch (e) { return ''; } }
  function readPride()  { try { var s = localStorage.getItem(prideKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function readObl()    { try { var s = localStorage.getItem(oblKey()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function stamp() {
    try {
      if (!validSlot()) return;
      var gs = document.getElementById('game-screen');
      if (!gs || gs.classList.contains('hidden')) return;
      localStorage.setItem(tsKey(), Date.now());
      if (typeof mapState !== 'undefined' && mapState && mapState.current) localStorage.setItem(mapKey(), mapState.current);
      if (typeof state !== 'undefined' && state && state.prideClimb) {
        localStorage.setItem(prideKey(), JSON.stringify({ climb: true, ranked: !!state.prideRanked, floor: state.prideFloor || 2, startMs: state.prideStartMs || 0 }));
      } else {
        localStorage.removeItem(prideKey());
      }
      if (typeof state !== 'undefined' && state && state.oblivion) {
        localStorage.setItem(oblKey(), JSON.stringify({ phase: state.oblivion }));
      } else {
        localStorage.removeItem(oblKey());
      }
    } catch (e) {}
  }
  function raf() {
    return new Promise(function (resolve) {
      var done = false;
      var fin = function () { if (!done) { done = true; resolve(); } };
      try { requestAnimationFrame(fin); } catch (e) {}
      setTimeout(fin, 50);
    });
  }

  // ----- 地圖名稱（直接查 DB.maps，不依賴外部模組）-----------------------
  function mapName(id) {
    if (!id) return '?';
    try { if (typeof DB !== 'undefined' && DB && DB.maps && DB.maps[id]) return DB.maps[id].n || id; } catch (e) {}
    return id;
  }

  // ----- 背景節拍器（Worker）----------------------------------------------
  var _ticker = null, _tickerBad = false;
  function ticker() {
    if (_ticker || _tickerBad) return _ticker;
    try {
      var src = 'onmessage=function(e){setTimeout(function(){postMessage(1)},(e.data&&e.data.gap)||0)}';
      _ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    } catch (e) { _tickerBad = true; _ticker = null; }
    return _ticker;
  }
  function killTicker() { try { if (_ticker) _ticker.terminate(); } catch (e) {} _ticker = null; }
  function workerGap(gap) {
    return new Promise(function (resolve) {
      var w = ticker(), done = false;
      var fin = function () { if (done) return; done = true; resolve(); };
      if (!w) { setTimeout(fin, gap); return; }
      var on = function () { try { w.removeEventListener('message', on); } catch (e) {} fin(); };
      w.addEventListener('message', on);
      setTimeout(fin, gap + 2000);
      try { w.postMessage({ gap: gap }); } catch (e) { fin(); }
    });
  }
  function pace(sliceMs) {
    var hidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    if (!hidden) return raf();
    var gap = Math.max(16, Math.round((sliceMs || 60) * 0.6));
    return workerGap(gap);
  }

  // ----- 進度遮罩 ---------------------------------------------------------
  var overlayEl = null, overlayBar = null, overlayTxt = null, overlayFill = null;
  var HOLD_MS = 1500;
  var HOLD_SLICE_MS = 30;
  var _holdStart = 0, _abortCatchup = false;
  function showOverlay(totalTicks) {
    if (overlayEl) return;
    _abortCatchup = false; _holdStart = 0;
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('style', [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(2,6,23,0.92)', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:16px',
      'font-family:system-ui,sans-serif', 'color:#e2e8f0'
    ].join(';'));
    var title = document.createElement('div');
    title.textContent = '離線掛機結算中…';
    title.setAttribute('style', 'font-size:20px;font-weight:bold;color:#fcd34d');
    var barWrap = document.createElement('div');
    barWrap.setAttribute('style', 'width:min(70vw,420px);height:14px;background:#1e293b;border-radius:8px;overflow:hidden;border:1px solid #334155');
    overlayBar = document.createElement('div');
    overlayBar.setAttribute('style', 'height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)');
    barWrap.appendChild(overlayBar);
    overlayTxt = document.createElement('div');
    overlayTxt.setAttribute('style', 'font-size:13px;color:#94a3b8');
    overlayTxt.textContent = '0%';
    overlayEl.appendChild(title);
    overlayEl.appendChild(barWrap);
    overlayEl.appendChild(overlayTxt);

    var holdLabel = document.createElement('div');
    holdLabel.setAttribute('style', 'font-size:12px;color:#fca5a5;height:15px;opacity:0;transition:opacity .15s;margin-top:6px;');
    holdLabel.textContent = '放棄中…';
    var holdTrack = document.createElement('div');
    holdTrack.setAttribute('style', 'width:min(60vw,260px);height:6px;background:#3f1d1d;border-radius:4px;overflow:hidden;opacity:0;transition:opacity .15s;');
    overlayFill = document.createElement('div');
    overlayFill.setAttribute('style', 'height:100%;width:100%;background:#ef4444;transform-origin:left;transform:scaleX(0);');
    holdTrack.appendChild(overlayFill);
    var abandonBtn = document.createElement('button');
    abandonBtn.setAttribute('style', 'margin-top:4px;padding:10px 22px;font-size:14px;font-weight:bold;color:#fecaca;background:#7f1d1d;border:1px solid #b91c1c;border-radius:10px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;');
    abandonBtn.textContent = '長按放棄剩餘收益';
    overlayEl.appendChild(holdLabel);
    overlayEl.appendChild(holdTrack);
    overlayEl.appendChild(abandonBtn);

    function startHold(e) {
      if (e) e.preventDefault();
      if (_holdStart) return;
      _holdStart = performance.now();
      holdLabel.style.opacity = '1'; holdTrack.style.opacity = '1';
      overlayFill.style.transition = 'none'; overlayFill.style.transform = 'scaleX(0)';
      void overlayFill.offsetWidth;
      overlayFill.style.transition = 'transform ' + HOLD_MS + 'ms linear';
      overlayFill.style.transform = 'scaleX(1)';
    }
    function cancelHold() {
      if (!_holdStart) return;
      _holdStart = 0;
      holdLabel.style.opacity = '0'; holdTrack.style.opacity = '0';
      overlayFill.style.transition = 'transform .12s ease-out'; overlayFill.style.transform = 'scaleX(0)';
    }
    abandonBtn.addEventListener('pointerdown', startHold);
    abandonBtn.addEventListener('pointerup', cancelHold);
    abandonBtn.addEventListener('pointerleave', cancelHold);
    abandonBtn.addEventListener('pointercancel', cancelHold);

    document.body.appendChild(overlayEl);
  }
  function updateOverlay(frac, done, total) {
    if (!overlayBar) return;
    var pct = Math.min(100, Math.round(frac * 100));
    overlayBar.style.width = pct + '%';
    overlayTxt.textContent = pct + '%　已結算 ' + fmtCatchupTime(done) + ' / 共 ' + fmtCatchupTime(total);
  }
  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = overlayBar = overlayTxt = overlayFill = null;
    _holdStart = 0;
  }

  // ----- 收益快照 / 摘要 --------------------------------------------------
  function snapshot() {
    var inv = {};
    try { (player.inv || []).forEach(function (i) { if (i && i.id) inv[i.id] = (inv[i.id] || 0) + (i.cnt || 1); }); } catch (e) {}
    return { gold: player.gold || 0, exp: player.exp || 0, lv: player.lv || 0, inv: inv };
  }
  function fmt(n) { try { return (n || 0).toLocaleString(); } catch (e) { return '' + n; } }
  function countKingKeys() {
    try { return (player.inv || []).reduce(function (s, i) { return s + ((i && i.id === 'item_king_key') ? (i.cnt || 1) : 0); }, 0); }
    catch (e) { return 0; }
  }

  // ----- 離線歷史紀錄（只寫 localStorage，無 UI）--------------------------
  var HIST_PREFIX = 'afk_hist_';
  var HIST_MAX    = 5;
  function histKey() { return HIST_PREFIX + currentSlot; }
  // ----- 物品差異計算（共用）-----------------------------------------------
  function _invDeltaItems(b, a) {
    var ids = {}, out = [];
    for (var k in b.inv) ids[k] = 1;
    for (var k2 in a.inv) ids[k2] = 1;
    for (var id in ids) {
      var d = (a.inv[id] || 0) - (b.inv[id] || 0);
      if (d > 0) {
        var dd = (typeof DB !== 'undefined' && DB.items && DB.items[id]) ? DB.items[id] : null;
        out.push({ n: dd ? dd.n : id, d: d });
      }
    }
    out.sort(function (x, y) { return y.d - x.d; });
    return out;
  }

  function invDeltaList(before, after) {
    var ids = {}, out = [];
    for (var k in before.inv) ids[k] = 1;
    for (var k2 in after.inv) ids[k2] = 1;
    for (var id in ids) {
      var d = (after.inv[id] || 0) - (before.inv[id] || 0);
      if (d > 0) {
        var dd = (typeof DB !== 'undefined' && DB.items && DB.items[id]) ? DB.items[id] : null;
        out.push({ n: dd ? dd.n : id, cnt: d, c: dd ? (dd.c || '') : '' });
      }
    }
    out.sort(function (a, b) { return b.cnt - a.cnt; });
    return out;
  }
  function recordHistory(rec) {
    try {
      if (!validSlot()) return;
      var arr = [];
      try { var raw = localStorage.getItem(histKey()); if (raw) arr = JSON.parse(raw) || []; } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.unshift(rec);
      if (arr.length > HIST_MAX) arr = arr.slice(0, HIST_MAX);
      localStorage.setItem(histKey(), JSON.stringify(arr));
    } catch (e) { console.warn('[AFK] recordHistory error:', e); }
  }
  function expTotal(lv, exp) {
    var t = exp || 0;
    if (typeof getExpReq === 'function') {
      for (var i = 1; i < (lv || 1); i++) { var r = getExpReq(i); if (!isFinite(r)) break; t += r; }
    }
    return t;
  }
  function climbSegDelta(floor, b, a) {
    var exp = expTotal(a.lv, a.exp) - expTotal(b.lv, b.exp); if (exp < 0) exp = 0;
    return { floor: floor, exp: exp, gold: (a.gold || 0) - (b.gold || 0), lv: (a.lv || 0) - (b.lv || 0), items: _invDeltaItems(b, a) };
  }
  function summarizeClimb(segs, doneTicks, died) {
    var mins = Math.round(doneTicks * TICK_MS / 60000);
    var timeStr = mins < 60 ? (mins + ' 分鐘') : (Math.floor(mins / 60) + ' 小時' + (mins % 60 ? ' ' + (mins % 60) + ' 分鐘' : ''));
    var reached = segs.length ? segs[segs.length - 1].floor : (segs[0] ? segs[0].floor : 0);
    var fromFloor = segs.length ? segs[0].floor : 0;
    var head = '<span class="text-sky-300 font-bold">🌙 離線攀登傲慢之塔 ' + timeStr + '</span>（' + fromFloor + ' 樓 → ' + reached + ' 樓）：';
    try { logSys(head); } catch (e) { console.log('[AFK]', head.replace(/<[^>]+>/g, '')); }
    var shown = 0;
    segs.forEach(function (s) {
      var parts = [];
      if (s.gold > 0) parts.push('<span class="text-yellow-400 font-bold">' + fmt(s.gold) + ' 金幣</span>');
      if (s.lv   > 0) parts.push('<span class="text-green-400 font-bold">升 ' + s.lv + ' 級</span>');
      if (s.exp  > 0) parts.push('<span class="text-purple-400 font-bold">' + fmt(s.exp) + ' 經驗</span>');
      if (s.items.length) parts.push(s.items.map(function (it) { return it.n + '×' + it.d; }).join('、'));
      if (!parts.length) return;
      shown++;
      var ln = '<span class="text-rose-200">傲慢之塔 ' + s.floor + ' 樓</span>：' + parts.join('、') + '。';
      try { logSys(ln); } catch (e) { console.log('[AFK]', ln.replace(/<[^>]+>/g, '')); }
    });
    if (!shown) { try { logSys('（本次攀登無明顯收益）'); } catch (e) {} }
    if (died) { try { logSys('<span class="text-red-500 font-bold">離線攀登中陣亡，已結算至死亡前並送回村莊。</span>'); } catch (e) {} }
  }
  function summarize(before, after, doneTicks, died, huntMap, kingInfo) {
    var mins = Math.round(doneTicks * TICK_MS / 60000);
    var dGold = (after.gold || 0) - (before.gold || 0);
    var dExp  = expTotal(after.lv, after.exp) - expTotal(before.lv, before.exp);
    if (dExp < 0) dExp = 0;
    var dLv   = (after.lv   || 0) - (before.lv   || 0);
    var items = _invDeltaItems(before, after);
    var itemStr = items.map(function (it) { return it.n + '×' + it.d; }).join('、');

    window.__afk.last = { mins: mins, gold: dGold, exp: dExp, lv: dLv, died: !!died, ticks: doneTicks, items: items.length };

    var timeStr = mins < 60 ? (mins + ' 分鐘')
                : (Math.floor(mins / 60) + ' 小時' + (mins % 60 ? ' ' + (mins % 60) + ' 分鐘' : ''));
    var line = '<span class="text-sky-300 font-bold">🌙 離線掛機 ' + timeStr + '</span>（在 <b>' + mapName(huntMap) + '</b>），獲得：';
    var parts = [];
    if (dGold > 0) parts.push('<span class="text-yellow-400 font-bold">' + fmt(dGold) + ' 金幣</span>');
    if (dLv   > 0) parts.push('<span class="text-green-400 font-bold">升 ' + dLv + ' 級</span>');
    if (dExp  > 0) parts.push('<span class="text-purple-400 font-bold">' + fmt(dExp) + ' 經驗</span>');
    if (itemStr)   parts.push(itemStr);
    line += parts.length ? parts.join('、') : '（無明顯收益）';
    line += '。';
    try { logSys(line); } catch (e) { console.log('[AFK]', line.replace(/<[^>]+>/g, '')); }
    if (kingInfo && kingInfo.kills > 0) {
      var kl = '<span class="text-amber-300">⚔ 軍王之室：本次擊敗軍王 <b>' + kingInfo.kills + '</b> 輪'
        + (kingInfo.keysUsed > 0 ? '，消耗 <b>' + kingInfo.keysUsed + '</b> 把軍王的鑰匙' : '') + '。</span>';
      try { logSys(kl); } catch (e) { console.log('[AFK]', kl.replace(/<[^>]+>/g, '')); }
    }
    if (kingInfo && kingInfo.depleted) {
      try { logSys('<span class="text-amber-300 font-bold">🔑 軍王的鑰匙已用完，已自動傳回村莊。</span>'); }
      catch (e) { console.log('[AFK] 軍王的鑰匙已用完，已自動傳回村莊。'); }
    }
    var preciseMin = doneTicks * TICK_MS / 60000;
    if (preciseMin > 0 && (dExp > 0 || dGold > 0)) {
      var exp10 = Math.floor(dExp / preciseMin * 10);
      var gold10 = Math.floor(dGold / preciseMin * 10);
      try { logSys('<span class="text-amber-300">📊 平均效率：經驗 ' + fmt(exp10) + ' / 10分、金幣 ' + fmt(gold10) + ' / 10分</span>'); }
      catch (e) { console.log('[AFK] 平均效率: 經驗 ' + exp10 + '/10分, 金幣 ' + gold10 + '/10分'); }
    }
    if (died) {
      try { logSys('<span class="text-red-500 font-bold">離線期間角色陣亡，進度已結算至死亡前。</span>'); }
      catch (e) { console.log('[AFK] 離線期間陣亡，結算至死亡前。'); }
    }
  }

  // ----- gotoMap / homeTown ------------------------------------------------
  function gotoMap(mapKey) {
    try {
      if (typeof setMapSelectors === 'function') setMapSelectors(mapKey);
      var sel = document.getElementById('map-select');
      if (sel) {
        if (!Array.prototype.some.call(sel.options, function (o) { return o.value === mapKey; })) {
          var o = document.createElement('option'); o.value = mapKey;
          o.textContent = mapName(mapKey);
          sel.appendChild(o);
        }
        sel.value = mapKey;
      }
      if (typeof changeMap === 'function') changeMap(true);
    } catch (e) { console.warn('[AFK] gotoMap(' + mapKey + ') 失敗:', e); }
  }
  function homeTown() {
    try { return (typeof getHomeTown === 'function') ? getHomeTown() : 'town_silver_knight'; }
    catch (e) { return 'town_silver_knight'; }
  }

  // ----- 離線補跑（時間切片）----------------------------------------------
  var catchingUp = false;
  var killTally = null;
  async function runCatchup(totalTicks, withOverlay, huntMap, prePride, preObl, timing) {
    if (catchingUp) return;
    catchingUp = true;
    killTally = {};

    var sliceMs = sliceFor(totalTicks);
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked && typeof enterPrideFloor === 'function');
    var isObl = !isClimb && !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');
    var isKing = !isClimb && !isObl && (typeof KING_ROOMS !== 'undefined') && !!KING_ROOMS[huntMap];
    var kingKeysBefore = isKing ? countKingKeys() : 0;
    var kingLeftRoom = false;

    // 暫停 live loop
    try { if (typeof _gameLoopId !== 'undefined' && _gameLoopId !== null) { clearInterval(_gameLoopId); _gameLoopId = null; } } catch (e) {}
    // 暫停自動存檔（補跑期間不逐次存檔，結束後才存一次）
    try { if (typeof _saveLoopId !== 'undefined' && _saveLoopId !== null) { clearInterval(_saveLoopId); _saveLoopId = null; } } catch (e) {}

    var prevFf0 = state.ff, prevInTick0 = state.inTick;
    state.ff = true; state.inTick = true;
    if (isClimb) {
      state.prideClimb = true;
      state.prideRanked = !!prePride.ranked;
      state.prideFloor = prePride.floor || 2;
      if (prePride.startMs) state.prideStartMs = prePride.startMs;
      enterPrideFloor(state.prideFloor);
    } else if (isObl) {
      state.oblivion = preObl.phase;
      state._oblivionAdvance = false;
      enterOblivionMap(huntMap);
    } else {
      gotoMap(huntMap);
    }

    var before = snapshot();
    if (withOverlay) showOverlay(totalTicks);

    var climbSegs = isClimb ? [] : null;
    var segStart = isClimb ? before : null;
    var segFloor = isClimb ? (state.prideFloor || 2) : 0;

    var done = 0, died = false;
    try {
      while (done < totalTicks && !_abortCatchup) {
        if (player.dead || !state.running) { died = !!player.dead; break; }
        var t0 = performance.now();
        while (done < totalTicks && !player.dead && state.running && !_abortCatchup &&
               (performance.now() - t0) < (_holdStart ? HOLD_SLICE_MS : sliceMs)) {
          tick();
          settleDeadMobs();
          done++;
          if (isKing && !kingLeftRoom && mapState && mapState.current !== huntMap) kingLeftRoom = true;
          if (climbSegs) {
            var nf = state.prideFloor || 0;
            if (nf !== segFloor) {
              var sNow = snapshot();
              climbSegs.push(climbSegDelta(segFloor, segStart, sNow));
              segStart = sNow; segFloor = nf;
            }
          }
        }
        if (withOverlay) updateOverlay(done / totalTicks, done, totalTicks);
        await pace(sliceMs);
        if (_holdStart && (performance.now() - _holdStart) >= HOLD_MS) _abortCatchup = true;
      }
    } catch (e) {
      console.error('[AFK] 離線補跑發生例外，已中止:', e);
    } finally {
      killTicker();
      settleDeadMobs();
    }

    var after = snapshot();
    var oblEndMap = isObl ? (mapState && mapState.current) : null;
    if (climbSegs && segFloor > 0) climbSegs.push(climbSegDelta(segFloor, segStart, after));

    // 結算後落點
    player.dead = false;
    if (isClimb) {
      if (died) {
        try { if (state.prideClimb && state.prideRanked && typeof prideRecord === 'function') prideRecord(state.prideFloor || 2); } catch (e) {}
        state.prideClimb = false; state.prideRanked = false; state.prideFloor = 0;
        gotoMap(homeTown());
      } else if (state.prideClimb) {
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        state.ff = prevFf0; state.inTick = prevInTick0;
        enterPrideFloor(state.prideFloor || 2);
      } else {
        gotoMap(homeTown());
      }
    } else if (isObl) {
      if (died) {
        state.oblivion = null; state._oblivionAdvance = false;
        gotoMap(homeTown());
      } else {
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        state.ff = prevFf0; state.inTick = prevInTick0;
        enterOblivionMap(mapState.current);
      }
    } else if (!died && huntMap) {
      if (isKing && kingLeftRoom) {
        gotoMap(homeTown());
      } else {
        try { if (player.mhp) player.hp = player.mhp; if (player.mmp) player.mp = player.mmp; } catch (e) {}
        gotoMap(huntMap);
      }
    } else {
      gotoMap(homeTown());
    }
    if (state.ff !== prevFf0) { state.ff = prevFf0; state.inTick = prevInTick0; }

    // 重啟 live loop + 自動存檔
    try { startGameTimers(); } catch (e) {}
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}

    var kingInfo = null;
    if (isKing) {
      var kingKeysUsed = Math.max(0, kingKeysBefore - countKingKeys());
      kingInfo = { keysUsed: kingKeysUsed, kills: kingKeysUsed + (kingLeftRoom ? 1 : 0), depleted: kingLeftRoom };
    }
    if (climbSegs && climbSegs.length) summarizeClimb(climbSegs, done, died);
    else summarize(before, after, done, died, (isObl && oblEndMap) ? oblEndMap : huntMap, kingInfo);
    if (_abortCatchup) {
      var _skipMin = Math.max(0, Math.round((totalTicks - done) * TICK_MS / 60000));
      try { if (typeof logSys === 'function') logSys('<span style="color:#fca5a5;font-weight:bold;">⏭ 已放棄剩餘約 ' + _skipMin + ' 分鐘的離線收益（你提前結束了結算）。</span>'); } catch (e) {}
    }

    // 寫離線歷史紀錄
    try {
      if (timing && timing.closeTs && done > 0) {
        var hKills = [];
        for (var kn in killTally) hKills.push({ n: kn, cnt: killTally[kn] });
        hKills.sort(function (a, b) { return a.cnt - b.cnt; });
        var hKind, hMap;
        if (climbSegs && climbSegs.length) {
          hKind = 'climb';
          hMap = '傲慢之塔（' + climbSegs[0].floor + ' → ' + climbSegs[climbSegs.length - 1].floor + ' 樓）';
        } else if (isObl) { hKind = 'oblivion'; hMap = mapName(oblEndMap || huntMap); }
        else if (isKing)  { hKind = 'king';     hMap = mapName(huntMap); }
        else              { hKind = 'normal';   hMap = mapName(huntMap); }
        var hExp, hGold, hLv;
        if (climbSegs && climbSegs.length) {
          hExp = 0; hGold = 0; hLv = 0;
          climbSegs.forEach(function (s) { hExp += s.exp || 0; hGold += s.gold || 0; hLv += s.lv || 0; });
        } else {
          hExp = expTotal(after.lv, after.exp) - expTotal(before.lv, before.exp); if (hExp < 0) hExp = 0;
          hGold = (after.gold || 0) - (before.gold || 0);
          hLv = (after.lv || 0) - (before.lv || 0);
        }
        var loginTs = timing.loginTs || Date.now();
        recordHistory({
          v: 1,
          closeTs: timing.closeTs,
          loginTs: loginTs,
          realMs: Math.max(0, loginTs - timing.closeTs),
          settledMs: done * TICK_MS,
          capped: (loginTs - timing.closeTs) > CAP_MS,
          kind: hKind,
          map: hMap,
          exp: hExp, gold: hGold, lv: hLv,
          items: invDeltaList(before, after),
          kills: hKills,
          died: !!died,
          keysUsed: (kingInfo && kingInfo.keysUsed) || 0
        });
      }
    } catch (e) { console.warn('[AFK] 寫離線紀錄失敗:', e); }
    killTally = null;
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    removeOverlay();
    stamp();
    catchingUp = false;
  }

  // ----- maybeCatchup -----------------------------------------------------
  function maybeCatchup(preMap, preTs, prePride, preObl) {
    if (!validSlot() || !state || !state.running) return;
    var last = preTs;
    var savedMap = preMap;
    if (!savedMap) {
      try { var raw = JSON.parse(localStorage.getItem('lineage_idle_save_' + currentSlot)); savedMap = (raw && raw.ms && raw.ms.current) || ''; } catch (e) {}
    }
    var isClimb = !!(prePride && prePride.climb && !prePride.ranked);
    var isObl = !!(preObl && preObl.phase && typeof enterOblivionMap === 'function');
    if (isObl && !savedMap) savedMap = (preObl.phase === 'island') ? 'oblivion_island' : 'oblivion_travel';
    var now = Date.now();
    stamp();
    if (prePride && prePride.climb && prePride.ranked) {
      console.info('[AFK] 上次在傲慢之塔排名挑戰中：依設計不自動續。');
      return;
    }
    if (savedMap === 'rift_battle') {
      console.info('[AFK] 上次在時空裂痕中：依設計不自動續、不結算離線收益。');
      return;
    }
    if (!last) {
      if (isClimb || isObl) runCatchup(0, false, savedMap, prePride, preObl);
      return;
    }
    var gap = now - last;
    if (!isClimb && !isObl) {
      if (!savedMap || savedMap.indexOf('town_') === 0) {
        console.info('[AFK] 關閉時位於村莊/無有效地圖，無離線戰鬥收益。');
        return;
      }
      if (typeof isSiegeArea === 'function' && isSiegeArea(savedMap)) {
        console.info('[AFK] 關閉時位於攻城區，略過離線結算。');
        return;
      }
      if (typeof DB !== 'undefined' && DB.maps && !DB.maps[savedMap]) {
        console.info('[AFK] 上次地圖「' + savedMap + '」非標準狩獵圖（不在 DB.maps），離線略過以免空轉。');
        return;
      }
    }
    var ms = Math.min(gap, CAP_MS);
    var ticks = Math.floor(ms / TICK_MS);
    if (ticks <= 0 && !isClimb && !isObl) return;
    runCatchup(Math.max(0, ticks), ticks > OVERLAY_MIN_TICK, savedMap, prePride, preObl, { closeTs: last, loginTs: now });
  }

  // ----- 包裹 saveGame / loadGame -----------------------------------------
  var _save = window.saveGame;
  window.saveGame = function () {
    var r = _save.apply(this, arguments);
    stamp();
    return r;
  };

  var _load = window.loadGame;
  window.loadGame = function () {
    var preMap = readMap();
    var preTs = readTs();
    var prePride = readPride();
    var preObl = readObl();
    var r = _load.apply(this, arguments);
    try { maybeCatchup(preMap, preTs, prePride, preObl); } catch (e) { console.warn('[AFK] maybeCatchup error:', e); }
    return r;
  };

  // ----- 包裹 changeMap ----------------------------------------------------
  if (typeof window.changeMap === 'function') {
    var _changeMap = window.changeMap;
    window.changeMap = function () {
      var r = _changeMap.apply(this, arguments);
      stamp();
      return r;
    };
  }

  // ----- 包裹 killMob ------------------------------------------------------
  if (typeof window.killMob === 'function') {
    var _killMob = window.killMob;
    window.killMob = function (idx) {
      if (killTally) {
        try { var m = mapState.mobs[idx]; if (m && !m._dead && m.n) killTally[m.n] = (killTally[m.n] || 0) + 1; } catch (e) {}
      }
      return _killMob.apply(this, arguments);
    };
  }

  // ----- 入口提示：時空裂痕 / 傲慢之塔排名模式不支援離線掛機 ---------------
  function injectEntranceHint(fnName, html) {
    if (typeof window[fnName] !== 'function' || window[fnName].__afkHint) return;
    var orig = window[fnName];
    window[fnName] = function (container) {
      var r = orig.apply(this, arguments);
      try {
        var box = container && container.lastElementChild;
        if (box && !box.querySelector('.afk-norank-note')) {
          var note = document.createElement('div');
          note.className = 'afk-norank-note';
          note.setAttribute('style', 'margin-top:2px;padding:8px 10px;border:1px solid #b45309;background:rgba(180,83,9,0.14);border-radius:8px;color:#fcd34d;font-size:12px;line-height:1.55;');
          note.innerHTML = html;
          box.appendChild(note);
        }
      } catch (e) {}
      return r;
    };
    window[fnName].__afkHint = true;
  }
  injectEntranceHint('renderRiftEntrance',
    '⚠ <b>不支援離線掛機</b>：關閉或重新整理頁面會中斷挑戰，<b>不結算、不記排名</b>。要記錄成績與獎勵，請以戰死或主動撤離結束。');
  injectEntranceHint('renderPrideEntrance',
    '⚠ <b>排名模式不支援離線掛機</b>：排名挑戰中關閉或重新整理頁面會直接回城、<b>放棄該次排名</b>。（一般攀登可正常離線續爬，不受影響。）');

  // ----- 心跳 + 關閉前蓋章 -------------------------------------------------
  setInterval(function () {
    if (validSlot() && state && state.running) stamp();
  }, HEARTBEAT_MS);
  window.addEventListener('beforeunload', stamp);
  window.addEventListener('pagehide', stamp);

  // ----- 除錯介面 ----------------------------------------------------------
  window.__afk = {
    version: '1.0.0',
    capHours: CAP_HOURS,
    stamp: stamp,
    readTs: readTs,
    mapName: mapName,
    histKey: histKey,
    forceCatchup: function (mins) { runCatchup(Math.floor((mins || 60) * 60000 / TICK_MS), true); }
  };

  console.log('[AFK] hooks OK — 離線掛機模組已啟用（上限 ' + CAP_HOURS + ' 小時，撞死即停，存活回原狩獵圖）。');
})();
