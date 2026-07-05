// ===== 00-utils.js — 基礎工具函數 + Mod Stub =====
// 此檔案在所有腳本之前載入（index.html 第一個 script）
// 功能：
//   Part A — 工具函數：$、$$、renderBatch、showBattleView、showTownView、showScreen
//   Part B — Mod Stub：原始碼依賴的函數預設值（Mod/ 載入後覆蓋）
// 刪除 js/Mod/ 資料夾後，此檔案確保遊戲不會崩潰
(function () {
  'use strict';

  // ========================================================================
  // Part A — 工具函數
  // ========================================================================

  // DOM 快捷函數
  window.$ = function (id) { return document.getElementById(id); };
  window.$$ = function (sel) { return document.querySelectorAll(sel); };

  // 批次重繪/存檔工具
  window.renderBatch = function (opts) {
    if (opts.calcStats) calcStats();
    if (opts.renderMobs) renderMobs();
    if (opts.renderTabs) renderTabs(opts.forceTabs || false);
    if (opts.save) saveGame();
  };

  // 視圖切換
  window.showBattleView = function () {
    var battle = document.getElementById('battle-view');
    var log = document.getElementById('combat-log-panel');
    var town = document.getElementById('town-view');
    if (battle) battle.classList.remove('hidden');
    if (log) log.classList.remove('hidden');
    if (town) { town.classList.add('hidden'); town.classList.remove('flex'); }
  };

  window.showTownView = function () {
    var battle = document.getElementById('battle-view');
    var log = document.getElementById('combat-log-panel');
    var town = document.getElementById('town-view');
    if (battle) battle.classList.add('hidden');
    if (log) log.classList.add('hidden');
    if (town) { town.classList.remove('hidden'); town.classList.add('flex'); }
  };

  window.showScreen = function (screen) {
    var all = ['menu', 'create', 'slots'];
    for (var i = 0; i < all.length; i++) {
      var el = document.getElementById(all[i]);
      if (el) el.classList.toggle('hidden', all[i] !== screen);
    }
  };

  // ========================================================================
  // Part B — Mod Stub（原始碼依賴的函數預設值）
  // Mod/ 載入後會覆蓋這些 stub，提供真正功能
  // Mod/ 刪除時，stub 提供安全預設值，確保遊戲不崩潰
  // ========================================================================

  // 22-map-modifiers.js 提供的函數
  // 原始碼 03-combat-core.js:153 呼叫：mapModHasSuffix('no_regen')
  // 回傳 false → 執行 regenTick() → HP/MP 正常回復
  window.mapModHasSuffix = function () { return false; };

  // 原始碼 03-combat-core.js:155 呼叫：getModifierTier()
  // 回傳 0 → tier 0 分支 → 只擋 HP，MP 正常回復
  window.getModifierTier = function () { return 0; };

  // 原始碼 04-combat-attack.js:814 呼叫：MAP_MOD_SUFFIXES.hit_poison.values[tier]
  // 回傳 { hit_poison: { values: [0, 0, 0] } } → 傷害% = 0 → 無中毒
  window.MAP_MOD_SUFFIXES = { hit_poison: { values: [0, 0, 0] } };

  // 原始碼 11-world-map.js:1243 呼叫：rerollMapModifiers()
  // Noop — 按鈕觸發，無效果即可
  window.rerollMapModifiers = function () {};

  // 26-qol-enhance.js 提供的函數
  // 原始碼 12-npc-quests.js:304-305 呼叫：whMatchSetFilter(it)
  // 回傳 true → 所有物品都顯示（無篩選）
  window.whMatchSetFilter = function () { return true; };

})();
