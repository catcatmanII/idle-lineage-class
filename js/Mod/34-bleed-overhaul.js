/**
 * 34-bleed-overhaul.js — 流血傷害改版 Mod
 *
 * 改動：
 *  - 流血從「5層/8秒/每秒20%」改為「1層/5秒/每秒160%」
 *  - 精通：每秒210%（取代原「+10%/層」加成）
 *  - 單層制：已有出血 → 刷新持續時間 + 更新傷害（不疊加）
 *
 * 原理：
 *  - 包裝 applyBleed：覆蓋為新公式
 *  - 出血 tick（processMobStatusTick 內 bleeds 遍歷）不需改動，自動適配
 *
 * ⚠️ 依賴：applyBleed
 */
(function() {
    'use strict';

    var _origApplyBleed = window.applyBleed;
    if (typeof _origApplyBleed !== 'function') return;

    /**
     * 新版 applyBleed：
     *  - 單層制，不可疊加
     *  - 持續 5 秒（50 ticks）
     *  - 普通：hitDmg × 160%/秒
     *  - 精通：hitDmg × 210%/秒
     */
    window.applyBleed = function(m, hitDmg, maxLayers, masteryBoost) {
        if (!m || !m.curHp || m.curHp <= 0) return;
        if (!m.bleeds) m.bleeds = [];

        var dpsPct = masteryBoost ? 2.10 : 1.60;
        var dps = Math.max(1, Math.floor(hitDmg * dpsPct));

        // 已有出血 → 刷新5秒 + 更新傷害（不疊層）
        if (m.bleeds.length > 0) {
            m.bleeds[0].ticksLeft = 50;  // 5秒 = 50 ticks
            m.bleeds[0].dmg = dps;
            if (masteryBoost) m._bleedMastery = true;
            return;
        }

        // 新出血 → 單層
        m.bleeds.push({ dmg: dps, ticksLeft: 50 });
        if (masteryBoost) m._bleedMastery = true;
    };

})();
