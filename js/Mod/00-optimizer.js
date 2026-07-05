// ===== Mod/00-optimizer.js — Drop-in 效能優化模組 =====
// 使用方式：放在 js/Mod/ 資料夾，在 index.html 最後一個 script 標籤之前加入
// <script src="js/Mod/00-optimizer.js"></script>
//
// 功能：
// 1. 補跑守護 — state.ff 期間跳過非關鍵計時器
// 2. renderStatusEffects 節流 — 每秒執行（原本每 tick）
// 3. renderDebuffPanel 節流 — 每秒執行（原本每 tick）
// 4. renderMapModPanel 節流 — 每秒執行（原本每秒 setInterval）
// 5. Wrapper 鏈偵測 — 偵測其他模組的 wrapper 衝突
// 工具函數（$、$$、renderBatch、showBattleView 等）已移至 js/00-utils.js
(function () {
  'use strict';

  // ========================================================================
  // 0. 錯誤偵測：衝突環境優先報錯
  // ========================================================================
  if (window.__optimizerLoaded) {
    console.error('[Optimizer] 偵測到重複載入，請移除重複的 <script src="js/Mod/00-optimizer.js">');
    return;
  }
  window.__optimizerLoaded = true;

  // 延遲初始化：等所有模組載入後再執行
  function _init() {
    // 基本依賴檢查
    var _missing = [];
    if (typeof state === 'undefined') _missing.push('state');
    if (typeof player === 'undefined') _missing.push('player');
    if (typeof updateUI !== 'function') _missing.push('updateUI');
    if (typeof renderMobs !== 'function') _missing.push('renderMobs');
    if (typeof saveGame !== 'function') _missing.push('saveGame');
    if (typeof tick !== 'function') _missing.push('tick');
    if (typeof _updateUIImpl !== 'function') _missing.push('_updateUIImpl');
    if (typeof _renderMobsImpl !== 'function') _missing.push('_renderMobsImpl');
    if (_missing.length) {
      console.error('[Optimizer] 缺少必要的全域變數/函數：' + _missing.join(', ') + '，優化模組無法啟動');
      return;
    }

    // ========================================================================
    // 1. Wrapper 鏈偵測 + 包裝工具
    // ========================================================================
    function _warnWrapper(name, fn) {
      if (fn && fn.__wrapped) {
        console.warn('[Optimizer] ' + name + ' 已被其他模組 wrapper（' + (fn.__wrapperName || 'unknown') + '），可能產生衝突');
      }
    }
    function _wrap(name, fn, wrapper) {
      _warnWrapper(name, fn);
      var wrapped = wrapper(fn);
      wrapped.__wrapped = true;
      wrapped.__wrapperName = name;
      return wrapped;
    }
    _warnWrapper('updateUI', updateUI);
    _warnWrapper('renderMobs', renderMobs);
    _warnWrapper('tick', tick);
    _warnWrapper('saveGame', saveGame);
    _warnWrapper('alliesTick', window.alliesTick);
    _warnWrapper('spawnMob', window.spawnMob);

    // ========================================================================
    // 2. Wrapper: saveGame（補跑守護）
    // ========================================================================
    window.saveGame = _wrap('saveGame', window.saveGame, function (orig) {
      return function () {
        if (state.ff) return;
        return orig.apply(this, arguments);
      };
    });

    // ========================================================================
    // 3. Wrapper: renderAuditTab（補跑守護）
    // ========================================================================
    if (typeof window.renderAuditTab === 'function') {
      window.renderAuditTab = _wrap('renderAuditTab', window.renderAuditTab, function (orig) {
        return function () {
          if (state.ff) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 4. Wrapper: _bgmTick（補跑守護）
    // ========================================================================
    if (typeof window._bgmTick === 'function') {
      window._bgmTick = _wrap('_bgmTick', window._bgmTick, function (orig) {
        return function () {
          if (state.ff) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 5. Wrapper: renderStatusEffects（節流：每秒執行）
    // ========================================================================
    if (typeof window.renderStatusEffects === 'function') {
      window.renderStatusEffects = _wrap('renderStatusEffects', window.renderStatusEffects, function (orig) {
        return function () {
          if (state.ticks % 10 !== 0) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 6. Wrapper: renderDebuffPanel（節流：每秒執行）
    // ========================================================================
    if (typeof window.renderDebuffPanel === 'function') {
      window.renderDebuffPanel = _wrap('renderDebuffPanel', window.renderDebuffPanel, function (orig) {
        return function () {
          if (state.ticks % 10 !== 0) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 7. Wrapper: renderMapModPanel（節流：每秒執行）
    // ========================================================================
    if (typeof window.renderMapModPanel === 'function') {
      window.renderMapModPanel = _wrap('renderMapModPanel', window.renderMapModPanel, function (orig) {
        return function () {
          if (state.ticks % 10 !== 0) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 8. Wrapper: renderMorphSnapshot（補跑守護）
    // ========================================================================
    if (typeof window.renderMorphSnapshot === 'function') {
      window.renderMorphSnapshot = _wrap('renderMorphSnapshot', window.renderMorphSnapshot, function (orig) {
        return function () {
          if (state.ff) return;
          return orig.apply(this, arguments);
        };
      });
    }

    // ========================================================================
    // 完成
    // ========================================================================
    console.log('[Optimizer] 效能優化模組已載入');
  }

  // 等 DOM ready 後初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
