// ===== 🔥 地圖詞綴傭兵套用模組 =====
// 將地圖詞綴後綴 debuff 套用至傭兵（不改動主程式）
// 開關：window.__mapModAllyOff = true
(function() {
    'use strict';
    if (window.__mapModAllyOff) return;

    // ===== 傭兵側地面效果（從 22-map-modifiers.js 拆出）=====

    /** 將地面效果套用至單一傭兵（每 alliesTick 呼叫） */
    function applyGroundEffectsToAlly(a) {
        if (!player || !player.mapModOn || !mapState.modifiers || !mapState.modifiers.active) return;
        if (a._downed || (a.curHp || 0) <= 0) return;

        let tier = (typeof getModifierTier === 'function') ? getModifierTier() : 0;
        let sfx = mapState.modifiers.suffixes || [];

        sfx.forEach(id => {
            let mod = (typeof MAP_MOD_SUFFIXES !== 'undefined') ? MAP_MOD_SUFFIXES[id] : null;
            if (!mod) return;
            let v = mod.values[tier];
            switch (id) {
                case 'burn_ground':
                    if (state.ticks % 10 === 0) {
                        let _bd = Math.max(1, Math.floor((a.mhp || 1) * (Array.isArray(v) ? v[0] : v) / 100));
                        a.curHp -= _bd;
                    }
                    break;
                case 'chill_ground':
                    if (!a.statuses) a.statuses = {};
                    a.statuses.slowAtk = 9999;
                    a.statuses.slowPct = v;
                    break;
                case 'shock_ground':
                    a._shockTakenMult = 1 + (Array.isArray(v) ? v[0] : v) / 100;
                    break;
                case 'decay_ground':
                    a._decayHealMult = 1 - (Array.isArray(v) ? v[0] : v) / 100;
                    break;
                case 'ele_weakness':
                    a._sufEleWeakness = v;
                    break;
                case 'enfeeble':
                    a._sufEnfeeble = v;
                    break;
                case 'cap_resist':
                    a._sufResistCap = v;
                    break;
                case 'def_down':
                    a._sufDefDown = v;
                    break;
                case 'hit_down':
                    a._sufHitDown = v;
                    break;
                case 'buff_down':
                    a._sufBuffDown = v;
                    break;
                case 'no_regen':
                    a._sufNoRegen = true;
                    break;
                case 'hit_poison':
                    a._sufHitPoison = v;
                    break;
            }
        });
    }

    /** 清除所有傭兵的地面效果標記（死亡/切圖時呼叫） */
    function clearAllyGroundEffects() {
        if (!player || !player.allies) return;
        player.allies.forEach(a => {
            if (!a) return;
            a._shockTakenMult = null;
            a._decayHealMult = null;
            a._sufEleWeakness = null;
            a._sufEnfeeble = null;
            a._sufResistCap = null;
            a._sufDefDown = null;
            a._sufHitDown = null;
            a._sufBuffDown = null;
            a._sufNoRegen = null;
            a._sufHitPoison = null;
            if (a.statuses) { a.statuses.slowAtk = 0; a.statuses.slowPct = 0; }
        });
    }

    // 匯出供外部呼叫
    window.clearAllyGroundEffects = clearAllyGroundEffects;

    // ===== 原有：戰鬥事件套用 debuff =====

    function installMapModAlly() {
        if (typeof enemyAttackAlly === 'undefined' || typeof applyMobMagicToAlly === 'undefined') {
            setTimeout(installMapModAlly, 50);
            return;
        }

        // ---- 1. 包裝 enemyAttackAlly：物理攻擊套用 debuff ----
        var _origEnemyAttackAlly = enemyAttackAlly;
        enemyAttackAlly = function(mob, ally) {
            if (!mob || !ally || ally._downed || (ally.curHp || 0) <= 0) return _origEnemyAttackAlly.apply(this, arguments);

            // 防禦降低：AC 減算
            if (ally._sufDefDown) {
                let _origAc = (ally.d || {}).ac || 0;
                if (!ally.d) ally.d = {};
                ally.d.ac = _origAc - ally._sufDefDown;
                let result = _origEnemyAttackAlly.apply(this, arguments);
                ally.d.ac = _origAc;
                return result;
            }

            // 命中降低：Mob hit 減算（影響命中判定）
            if (ally._sufHitDown) {
                let _origHit = mob.hit || 0;
                mob.hit = _origHit - ally._sufHitDown;
                let result = _origEnemyAttackAlly.apply(this, arguments);
                mob.hit = _origHit;
                return result;
            }

            // 其他 debuff：在傷害結算後套用
            let _hpBefore = ally.curHp;
            _origEnemyAttackAlly.apply(this, arguments);
            let _dmgTaken = _hpBefore - (ally.curHp || 0);
            if (_dmgTaken <= 0) return;

            // 震懾地面：受傷增加
            if (ally._shockTakenMult && !ally._downed) {
                let _extra = Math.floor(_dmgTaken * (ally._shockTakenMult - 1));
                if (_extra > 0) {
                    ally.curHp -= _extra;
                    logCombat(`<span class="text-purple-300">【震懾地面】</span> 協力·${ally._allyName} 額外受到 ${_extra} 點傷害。`, 'enemy');
                }
            }

            // 衰弱：最終傷害降低（敵人打傭兵時的衰弱 = 傭兵輸出降低，不是受傷降低。此處不套用）
            // 被擊中毒
            if (ally._sufHitPoison && !ally._downed && !((ally.d || {}).immPoison)) {
                let tier = (typeof getModifierTier === 'function') ? getModifierTier() : 'low';
                let _poPct = (typeof MAP_MOD_SUFFIXES !== 'undefined' && MAP_MOD_SUFFIXES.hit_poison) ? MAP_MOD_SUFFIXES.hit_poison.values[tier] : 5;
                let _poD = Math.max(1, Math.floor(_dmgTaken * _poPct / 100));
                if (!ally.statuses) ally.statuses = {};
                ally.statuses.poison = 50;
                ally.statuses.poisonDmg = _poD;
                ally.statuses.poisonTick = 10;
                logCombat(`<span class="text-green-400">協力·${ally._allyName} 因被擊中而中毒！每秒受到 ${_poD} 點毒素傷害。</span>`, 'enemy');
            }
        };

        // ---- 2. 包裝 applyMobMagicToAlly：魔法攻擊套用 debuff ----
        var _origApplyMobMagicToAlly = applyMobMagicToAlly;
        applyMobMagicToAlly = function(mob, sk, ally) {
            if (!mob || !ally || ally._downed || (ally.curHp || 0) <= 0) return _origApplyMobMagicToAlly.apply(this, arguments);

            // 衰弱：最終傷害降低（敵人魔法打傭兵時不套用衰弱·衰弱是削減傭兵自身輸出）

            // 抗性上限 + 元素要害：套用到傭兵抗性
            let d = ally.d || {};
            let _changed = false;
            if (ally._sufResistCap != null || ally._sufEleWeakness != null) {
                let _resKeys = ['resFire', 'resWater', 'resEarth', 'resWind'];
                let _origRes = {};
                _resKeys.forEach(k => {
                    _origRes[k] = d[k] || 0;
                    let _v = _origRes[k];
                    if (ally._sufResistCap != null) _v = Math.min(_v, ally._sufResistCap);
                    if (ally._sufEleWeakness != null) _v = Math.max(0, _v - ally._sufEleWeakness);
                    if (_v !== _origRes[k]) { d[k] = _v; _changed = true; }
                });
            }

            // 震懾地面：在傷害計算前臨時加乘
            let _hpBefore = ally.curHp;
            _origApplyMobMagicToAlly.apply(this, arguments);
            let _dmgTaken = _hpBefore - (ally.curHp || 0);

            // 還原抗性
            if (_changed) {
                ['resFire', 'resWater', 'resEarth', 'resWind'].forEach(k => {
                    if (_origRes[k] !== undefined) d[k] = _origRes[k];
                });
            }

            if (_dmgTaken <= 0) return;

            // 震懾地面：受傷增加
            if (ally._shockTakenMult && !ally._downed) {
                let _extra = Math.floor(_dmgTaken * (ally._shockTakenMult - 1));
                if (_extra > 0) {
                    ally.curHp -= _extra;
                    logCombat(`<span class="text-purple-300">【震懾地面】</span> 協力·${ally._allyName} 額外受到 ${_extra} 點魔法傷害。`, 'enemy');
                }
            }
        };

        // ---- 3. 包裝 allyTryHeal：治療量受腐化地面減免 ----
        var _origAllyTryHeal = allyTryHeal;
        allyTryHeal = function(ally) {
            if (!ally || ally._downed) return false;
            if (!player || !player.mapModOn || !mapState.modifiers || !mapState.modifiers.active) return _origAllyTryHeal.apply(this, arguments);
            if (!ally._decayHealMult) return _origAllyTryHeal.apply(this, arguments);

            let _hpBefore = ally.curHp || 0;
            let result = _origAllyTryHeal.apply(this, arguments);
            if (result && (ally.curHp || 0) > _hpBefore) {
                let _healed = (ally.curHp || 0) - _hpBefore;
                let _reduced = Math.floor(_healed * ally._decayHealMult);
                let _diff = _healed - _reduced;
                if (_diff > 0) {
                    ally.curHp = _hpBefore + _reduced;
                }
            }
            return result;
        };

        // ---- 4. 包裝 allyMaintainBuffs：增益遞減受「增益縮短」加速 ----
        var _origAllyMaintainBuffs = allyMaintainBuffs;
        allyMaintainBuffs = function(ally) {
            if (!ally || ally._downed || !ally._sufBuffDown) return _origAllyMaintainBuffs.apply(this, arguments);

            // 暫時替換 buff 遞減邏輯：用加速步進取代 flat -1
            // allyMaintainBuffs L1706: for (let k in ally.buffs) { if (ally.buffs[k] > 0) { ally.buffs[k]--; ... } }
            // 我們改為在呼叫前後套用：先把 ally.buffs 的值放大，再還原
            let _step = Math.max(1, Math.round(100 / (100 - ally._sufBuffDown)));
            if (_step <= 1) return _origAllyMaintainBuffs.apply(this, arguments);

            // 臨時把每個 buff 值加 (step-1)，讓原函式 -1 後實際减少 step
            // 假設：原函式使用 buffs[k]-- 遞減。若改為 Math.floor(buffs[k] * decay) 則此 hack 失效
            if (!ally.buffs) return _origAllyMaintainBuffs.apply(this, arguments);
            let _keys = Object.keys(ally.buffs);
            _keys.forEach(k => { if (ally.buffs[k] > 0) ally.buffs[k] += (_step - 1); });
            _origAllyMaintainBuffs.apply(this, arguments);
            // 不需要還原，因為原函式已經 -1 並可能歸零
        };

        // ---- 5. 包裝 allyTryPotion：藥水受腐化地面減免 ----
        var _origAllyTryPotion = allyTryPotion;
        allyTryPotion = function(ally) {
            if (!ally || ally._downed) return;
            if (!player || !player.mapModOn || !mapState.modifiers || !mapState.modifiers.active || !ally._decayHealMult) {
                return _origAllyTryPotion.apply(this, arguments);
            }

            let _hpBefore = ally.curHp || 0;
            _origAllyTryPotion.apply(this, arguments);
            if ((ally.curHp || 0) > _hpBefore) {
                let _healed = (ally.curHp || 0) - _hpBefore;
                let _reduced = Math.floor(_healed * ally._decayHealMult);
                let _diff = _healed - _reduced;
                if (_diff > 0) {
                    ally.curHp = _hpBefore + _reduced;
                }
            }
        };

        // ---- 6. 包裝 alliesTick：每 tick 對傭兵套用土地面效果 ----
        // 29-merc-support.js 已包裝 alliesTick（加隊友增益），31 在其後載入再包一層
        // 執行鏈：31 ground effects → 29 support buffs → 原始 alliesTick
        if (typeof alliesTick === 'function') {
            var _origAlliesTick31 = alliesTick;
            alliesTick = function() {
                // 先套用土地面效果（burn/chill/shock/decay 等持續效果）
                if (player && player.mapModOn && player.allies && player.allies.length) {
                    for (let _a of player.allies) {
                        if (_a && !_a._downed && (_a.curHp || 0) > 0) {
                            try { applyGroundEffectsToAlly(_a); } catch(e) {}
                        }
                    }
                }
                // 再呼叫 29 的 wrapper（含原始 alliesTick + 支援增益）
                _origAlliesTick31();
            };
        }

        console.log('🔥 地圖詞綴傭兵套用已安裝');
    }

    installMapModAlly();
})();
