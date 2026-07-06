/**
 * 33-poison-overhaul.js — 中毒傷害改進 Mod
 *
 * 改動：
 *  - 中毒從「1層取代制」改為「無限疊層、各自獨立計時」
 *  - 觸發傷害覆蓋為10%（精通20%），取代源碼的60%/200%
 *  - 每次命中觸發新一層，持續5秒，各層獨立到期消失
 *
 * 原理：
 *  - 包裝 enemyPhysicalAttack：攔截玩家觸發的 flat poison，改用 poisons 陣列
 *  - 包裝 allyOnHitEffects：攔截傭兵觸發的 flat poison，改用 poisons 陣列
 *  - 包裝 processMobStatusTick：poisons 陣列 tick 結算
 *
 * ⚠️ 依賴：enemyPhysicalAttack、allyOnHitEffects、processMobStatusTick、killMob、mobWake、
 *    logCombat、getMobColor、hasMastery、allyHasMastery、_dps
 */
(function() {
    'use strict';

    // ===== 1. 包裝 enemyPhysicalAttack：攔截玩家中毒 =====
    var _origEnemyPhysicalAttack = window.enemyPhysicalAttack;
    if (typeof _origEnemyPhysicalAttack === 'function') {
        window.enemyPhysicalAttack = function() {
            var mob = arguments[1];
            var _oldPoison = (mob && mob.st) ? (mob.st.poison || 0) : 0;

            var result = _origEnemyPhysicalAttack.apply(this, arguments);

            // 攔截：如果目標被上了 flat poison（source 的60%/200%），改用 poisons 陣列 + 覆蓋為10%/20%
            if (mob && mob.st && mob.st.poison > 0 && _oldPoison === 0 && mob.curHp > 0) {
                if (!mob.st.poisons) mob.st.poisons = [];
                var _pPct = hasMastery('d_poison') ? 0.2 : 0.1;
                var _rawUnit = mob.st.poisonDmg || 0;
                // poisonDmg 是 source 用 60%/200% 計算的，還原 hitDmg 後重新以10%/20%計算
                var _baseHit = Math.max(1, Math.floor(_rawUnit / (hasMastery('d_poison') ? 2.0 : 0.6)));
                var _pUnit = Math.max(1, Math.floor(_baseHit * _pPct));
                mob.st.poisons.push({ dmg: _pUnit, ticksLeft: 50 });  // 5秒=50 ticks
                // 清除 flat poison，後續由 poisons 陣列接管
                mob.st.poison = 0;
                mob.st.poisonDmg = 0;
                mob.st.poisonTick = 0;
                mob.st.poisonStacks = 0;
                mob.st.poisonUnit = 0;
            }
            return result;
        };
    }

    // ===== 2. 包裝 allyOnHitEffects：攔截傭兵中毒 =====
    var _origAllyOnHitEffects = window.allyOnHitEffects;
    if (typeof _origAllyOnHitEffects === 'function') {
        window.allyOnHitEffects = function(ally, t, res) {
            var _oldPoison = (t && t.st) ? (t.st.poison || 0) : 0;

            var result = _origAllyOnHitEffects.apply(this, arguments);

            // 攔截：黑暗妖精傭兵觸發的 flat poison → poisons 陣列
            if (t && t.st && t.st.poison > 0 && _oldPoison === 0 && t.curHp > 0
                && ally && ally.cls === 'dark' && ally.skills && ally.skills.includes('sk_dark_poison')) {
                if (!t.st.poisons) t.st.poisons = [];
                var _pPct = allyHasMastery(ally, 'd_poison') ? 0.2 : 0.1;
                var _rawUnit = t.st.poisonDmg || 0;
                var _baseHit = Math.max(1, Math.floor(_rawUnit / (allyHasMastery(ally, 'd_poison') ? 2.0 : 0.6)));
                var _pUnit = Math.max(1, Math.floor(_baseHit * _pPct));
                t.st.poisons.push({ dmg: _pUnit, ticksLeft: 50 });
                t.st.poison = 0; t.st.poisonDmg = 0; t.st.poisonTick = 0;
                t.st.poisonStacks = 0; t.st.poisonUnit = 0;
            }
            return result;
        };
    }

    // ===== 3. 包裝 processMobStatusTick：poisons 陣列 tick 結算 =====
    var _origProcessMobStatusTick = window.processMobStatusTick;
    if (typeof _origProcessMobStatusTick === 'function') {
        window.processMobStatusTick = function(m, i) {
            // 先處理 poisons 陣列（疊層中毒 DoT）
            if (m && m.st && m.st.poisons && m.st.poisons.length) {
                var poisonTotal = 0;
                for (var pi = m.st.poisons.length - 1; pi >= 0; pi--) {
                    var p = m.st.poisons[pi];
                    p.ticksLeft--;
                    if (p.ticksLeft % 10 === 0) poisonTotal += p.dmg;
                    if (p.ticksLeft <= 0) m.st.poisons.splice(pi, 1);
                }
                if (poisonTotal > 0) {
                    m.curHp -= poisonTotal;
                    m.justHit = 'magic';
                    mobWake(m);
                    _dps.player += poisonTotal;
                    logCombat('<span class="' + getMobColor(m.lv) + '">' + m.n + '</span> 受到中毒傷害 ' + poisonTotal + ' 點（' + m.st.poisons.length + ' 層）。', 'dot');
                    if (m.curHp <= 0) { killMob(i); return true; }
                }
            }
            // 執行原始 tick（怪物技能的 flat poison 等其他狀態照常處理）
            return _origProcessMobStatusTick.apply(this, arguments);
        };
    }

    // ===== 4. 擴充 newMobStatus：初始化 poisons 陣列 =====
    // 透過包裝确保所有新產生的 mob status 都有 poisons 欄位
    var _origNewMobStatus = window.newMobStatus;
    if (typeof _origNewMobStatus === 'function') {
        window.newMobStatus = function() {
            var s = _origNewMobStatus.apply(this, arguments);
            if (!s.poisons) s.poisons = [];
            return s;
        };
    }

    // ===== 5. 覆蓋精通頁面描述 =====
    if (typeof MASTERY_DATA !== 'undefined' && MASTERY_DATA.dark && MASTERY_DATA.dark.list) {
        var _dp = MASTERY_DATA.dark.list.d_poison;
        if (_dp) {
            _dp.msg = '附加劇毒必定觸發、每秒10%傷害（精通20%）、無限疊層';
            _dp.d = '附加劇毒觸發機率變成100%，且中毒每秒造成該次攻擊10%傷害（精通：20%）。可無限疊層，各層獨立計時5秒。';
        }
    }

    // ===== 6. 覆蓋技能 tooltip 描述 =====
    var _origBuildSkillTipHTML = window.buildSkillTipHTML;
    if (typeof _origBuildSkillTipHTML === 'function') {
        window.buildSkillTipHTML = function(sid) {
            var html = _origBuildSkillTipHTML.apply(this, arguments);
            if (sid === 'sk_dark_poison') {
                var old = '一般攻擊命中 50% 機率使目標中毒：每秒該次攻擊 60% 傷害、持續 5 秒、最多 1 層（取較高傷害並刷新；劇毒精通→100%、每秒 200%）';
                var rep = '一般攻擊命中 50% 機率使目標中毒：每秒該次攻擊 10% 傷害（精通：20%），持續 5 秒，可無限疊層（各層獨立計時）';
                html = html.replace(old, rep);
            }
            return html;
        };
    }

})();
