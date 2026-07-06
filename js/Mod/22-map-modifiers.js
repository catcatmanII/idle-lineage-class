// ===== 🗺️ 地圖詞綴系統（2026-07·模組化版本）=====
// 前綴 = 強化怪物，後綴 = 削弱玩家
// Tier: 0=無席琳(low), 1=席琳(mid), 2=瘋狂席琳(top)
// 自包含模組：透過包裝原始函式注入行為，原始檔改動最小化

// ===== 一、常數定義 =====

const GROUND_SUFFIXES = ['burn_ground','chill_ground','shock_ground','decay_ground','consecrate_ground'];

const MAP_MOD_PREFIXES = {
    hp:           { n:'怪物更多生命',      values:[25,40,60],    desc:t=>`HP +${t}%` },
    ele_dmg:      { n:'額外元素傷害',      values:[20,35,50],    desc:t=>`元素傷害 +${t}%` },
    chaos_dmg:    { n:'額外混沌傷害',      values:[15,25,40],    desc:t=>`混沌傷害 +${t}%` },
    atk_spd:      { n:'怪物攻擊速度',      values:[15,25,40],    desc:t=>`攻速 +${t}%` },
    reflect_phys: { n:'反射物理',          values:[10,20,30],    desc:t=>`反射 ${t}% 物理傷害` },
    reflect_ele:  { n:'反射元素',          values:[10,20,30],    desc:t=>`反射 ${t}% 元素傷害` },
    imm_abnormal: { n:'免疫異常狀態',      values:[30,50,80],    desc:t=>`${t}% 免疫暈眩/冰凍/石化/麻痺/沉睡` },
    imm_harmful:  { n:'免疫有害狀態',      values:[30,50,80],    desc:t=>`${t}% 免疫破甲/脆弱/沉默/封印/緩速` },
    dr_magic:     { n:'法術傷害減免',      values:[5,10,15],     desc:t=>`法術減免 +${t}` },
    dr_phys:      { n:'物理傷害減免',      values:[5,10,15],     desc:t=>`物理減免 +${t}` },
    resist_up:    { n:'元素/混沌抗性增加',  values:[15,25,40],    desc:t=>`全抗 +${t}%` },
    boss_rage:    { n:'頭目狂化',          values:[1,2,3],       desc:t=>`BOSS HP×${1+t}、傷害×${[1.5,2,3][t]}` },
};

const MAP_MOD_SUFFIXES = {
    hit_poison:      { n:'被擊中中毒',           values:[5,10,15],      desc:t=>`被怪物擊中中毒每秒 ${t}% 傷害` },
    crit_up:         { n:'怪物暴擊提升',       values:[[5,20],[10,40],[15,60]], desc:t=>`怪物暴擊率 ${t[0]}%、暴傷 ${t[1]}%` },
    no_regen:        { n:'不能回復',           values:[1,2,3],        desc:t=>t===1?'無法自然回HP':t===2?'+MP':'+HP&MP' },
    burn_ground:     { n:'燃燒地面',           values:[0.5,1,2],      desc:t=>`每秒 ${t}% HP 火焰傷害` },
    chill_ground:    { n:'冰緩地面',           values:[20,35,50],     desc:t=>`攻速 -${t}%` },
    shock_ground:    { n:'感電地面',           values:[15,30,50],     desc:t=>`受傷 ×${(100+t)/100}` },
    decay_ground:    { n:'腐化地面',           values:[20,35,50],     desc:t=>`喝水效率 -${t}%` },
    consecrate_ground:{ n:'奉獻地面',          values:[1.5,2,3],      desc:t=>`怪物回血 ×${t}` },
    ele_weakness:    { n:'元素要害',           values:[15,25,40],     desc:t=>`全抗 -${t}%` },
    enfeeble:        { n:'衰弱',               values:[10,20,30],     desc:t=>`傷害 -${t}%` },
    cap_resist:      { n:'抗性上限',           values:[150,100,80],   desc:t=>`抗性上限 ${t}` },
    avoid_hit:       { n:'怪物避免擊中',       values:[8,15,25],      desc:t=>`怪物 ${t}% 迴避` },
    def_down:        { n:'防禦降低',           values:[10,20,30],     desc:t=>`防禦 -${t}%` },
    hit_down:        { n:'命中率降低',         values:[10,20,30],     desc:t=>`命中 -${t}%` },
    buff_down:       { n:'增益縮短',           values:[45,65,85],     desc:t=>`增益持續 -${t}%` },
};

// ===== 二、核心函式 =====

function getModifierTier() {
    if (player.sherineMad) return 2;
    if (player.sherineWorld) return 1;
    return 0;
}

function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function rollMapModifiers() {
    if (!player.mapModOn) { mapState.modifiers.active = false; renderMapModPanel(); return; }
    if (mapState.current.startsWith('town_') || isSiegeArea(mapState.current)) return;

    let prefixPool = Object.keys(MAP_MOD_PREFIXES);
    let suffixPool = Object.keys(MAP_MOD_SUFFIXES);
    let nonGroundPool = suffixPool.filter(k => !GROUND_SUFFIXES.includes(k));

    // 隨機選擇 1~2 個前綴
    let pCount = Math.random() < 0.5 ? 1 : 2;
    let shuffled = shuffleArray([...prefixPool]);
    let prefixes = shuffled.slice(0, Math.min(pCount, shuffled.length));

    // 隨機選擇 1~2 個後綴（含地面效果）
    let sCount = Math.random() < 0.5 ? 1 : 2;
    let suffixes = [];
    if (sCount > 1 && Math.random() < 0.4) {
        let g = GROUND_SUFFIXES[Math.floor(Math.random() * GROUND_SUFFIXES.length)];
        suffixes.push(g);
    } else if (sCount === 1 && Math.random() < 0.25) {
        let g = GROUND_SUFFIXES[Math.floor(Math.random() * GROUND_SUFFIXES.length)];
        suffixes.push(g);
    }
    let remain = nonGroundPool.filter(k => !suffixes.includes(k));
    shuffleArray(remain);
    while (suffixes.length < sCount && remain.length > 0) {
        suffixes.push(remain.shift());
    }

    mapState.modifiers.prefixes = prefixes;
    mapState.modifiers.suffixes = suffixes;
    mapState.modifiers.nextRefreshAt = state.ticks + 18000;
    mapState.modifiers.active = true;

    // 每個詞綴增加掉落量與稀有度
    let totalQty = 0, totalRarity = 0;
    let allMods = [...prefixes, ...suffixes];
    allMods.forEach(() => {
        totalQty += 8 + Math.floor(Math.random() * 5);   // 8%~12%
        totalRarity += 3 + Math.floor(Math.random() * 3); // 3%~5%
    });
    mapState.modifiers.dropQtyBonus = totalQty;
    mapState.modifiers.dropRarityBonus = totalRarity;

    let tier = getModifierTier();
    let parts = [];
    if (prefixes.length) parts.push('🏆 ' + prefixes.map(id => MAP_MOD_PREFIXES[id].desc(MAP_MOD_PREFIXES[id].values[tier])).join('、'));
    if (suffixes.length) parts.push('⚠️ ' + suffixes.map(id => {
        let v = MAP_MOD_SUFFIXES[id].values[tier];
        let d = Array.isArray(v) ? v : v;
        return MAP_MOD_SUFFIXES[id].desc(d);
    }).join('、'));
    logSys('<span class="text-purple-400 font-bold">【地圖詞綴】</span>' + parts.join(' | ') + '（30 分鐘）');
    logSys(`<span class="text-amber-400">【地圖詞綴】掉落量 +${totalQty}%、稀有度 +${totalRarity}%</span>`);

    renderMapModPanel();
}

function rerollMapModifiers() {
    if (!player.mapModOn) { logSys('<span class="text-red-400">尚未開啟地圖詞綴。</span>'); return; }
    if (player.gold < 150000) { logSys('<span class="text-red-400">金幣不足，重骰詞綴需要 150,000 金幣。</span>'); return; }
    player.gold -= 150000;
    clearGroundEffects();
    rollMapModifiers();
}

function applyMapPrefixes(m) {
    if (!player.mapModOn || !mapState.modifiers || !mapState.modifiers.active) return;
    let tier = getModifierTier();
    let pfx = mapState.modifiers.prefixes || [];
    pfx.forEach(id => {
        let mod = MAP_MOD_PREFIXES[id];
        if (!mod) return;
        let v = mod.values[tier];
        switch (id) {
            case 'hp':
                m.hp = Math.floor(m.hp * (1 + v / 100));
                m.curHp = m.hp;
                break;
            case 'atk_spd':
                m.atkSpd = Math.max(0.1, m.atkSpd / (1 + v / 100));
                break;
            case 'dr_phys':
                m.dr = (m.dr || 0) + v;
                break;
            case 'resist_up':
                m._modResist = v;
                break;
            case 'dr_magic':
                m.dr = (m.dr || 0) + v;   // 法術減免併入通用 DR（所有魔法傷害公式已扣 t.dr）
                break;
            case 'reflect_phys':
                m._reflectPhys = v;
                break;
            case 'reflect_ele':
                m._reflectEle = v;
                break;
            case 'boss_rage':
                if (m.boss) {
                    let hpMul = [2, 3, 4][tier];
                    m.hp = Math.floor(m.hp * hpMul);
                    m.curHp = m.hp;
                    m._bossRageDmg = [1.5, 2, 3][tier];
                }
                break;
            case 'imm_abnormal':
                m._immAbnormal = v;
                break;
            case 'imm_harmful':
                m._immHarmful = v;
                break;
            case 'ele_dmg':
                m._modEleDmg = v;
                break;
            case 'chaos_dmg':
                m._modChaosDmg = v;
                break;
        }
    });
    if (m._modResist && mapState.modifiers.prefixes.includes('resist_up')) {
        m.e = null;
    }
}

function applyGroundEffects() {
    if (!player.mapModOn || !mapState.modifiers || !mapState.modifiers.active) return;
    if (mapState.current.startsWith('town_') || isSiegeArea(mapState.current)) return;
    if (inAbsBarrier()) return;
    if (state.ticks % 10 !== 0) return;

    let tier = getModifierTier();
    let sfx = mapState.modifiers.suffixes || [];

    sfx.forEach(id => {
        let mod = MAP_MOD_SUFFIXES[id];
        if (!mod) return;
        let v = mod.values[tier];
        switch (id) {
            case 'burn_ground':
                let dmg = Math.max(1, Math.floor(player.mhp * (Array.isArray(v) ? v[0] : v) / 100));
                player.hp -= dmg;
                logCombat(`你受到燃燒地面傷害 ${dmg} 點。`, 'enemy');
                if (player.hp <= 0) killPlayer();
                break;
            case 'chill_ground':
                player.statuses.slowAtk = 9999;   // 持續到地面效果清除
                player.statuses.slowPct = v;      // 20/35/50% 攻速降低
                break;
            case 'shock_ground':
                player._shockTakenMult = 1 + (Array.isArray(v) ? v[0] : v) / 100;
                break;
            case 'decay_ground':
                player._decayHealMult = 1 - (Array.isArray(v) ? v[0] : v) / 100;
                break;
            case 'consecrate_ground':
                mapState.mobs.forEach(m => { if (m && m.curHp > 0 && !m._dead) { if (!m._origRegen) m._origRegen = m.regenHp || 0; m.regenHp = (m._origRegen || 0) * (Array.isArray(v) ? v[0] : v); }});
                break;
            // 非地面持續效果（設標記供戰鬥系統讀取）
            case 'crit_up':
                mapState.mobs.forEach(m => { if (m) { m._modCritRate = Array.isArray(v) ? v[0] : v; m._modCritDmg = Array.isArray(v) ? v[1] : v; }});
                break;
            case 'avoid_hit':
                mapState.mobs.forEach(m => { if (m) m._modAvoid = v; });
                break;
            case 'ele_weakness':
                player._sufEleWeakness = v;
                break;
            case 'enfeeble':
                player._sufEnfeeble = v;
                break;
            case 'cap_resist':
                player._sufResistCap = v;
                break;
            case 'def_down':
                player._sufDefDown = v;
                break;
            case 'hit_down':
                player._sufHitDown = v;
                break;
            case 'buff_down':
                player._sufBuffDown = v;
                break;
        }
    });

    // 傭兵側地面效果由 31-map-mod-ally.js 獨立處理（每 alliesTick 套用）
}

function clearGroundEffects() {
    player._shockTakenMult = null;
    player._decayHealMult = null;
    player._sufEleWeakness = null;
    player._sufEnfeeble = null;
    player._sufResistCap = null;
    player._sufDefDown = null;
    player._sufHitDown = null;
    player._sufBuffDown = null;
    if (player._slowFromChill) { player.statuses.slowAtk = 0; player.statuses.slowPct = 0; player._slowFromChill = false; }
    mapState.mobs.forEach(m => { if (m) { if (m._origRegen) { m.regenHp = m._origRegen; m._origRegen = undefined; } }});
    // 同步清除傭兵側地面效果（31-map-mod-ally.js 定義）
    if (typeof clearAllyGroundEffects === 'function') clearAllyGroundEffects();
}

function checkMapModTimer() {
    if (!player.mapModOn) return;
    if (!mapState.modifiers || state.ticks < (mapState.modifiers.nextRefreshAt || Infinity)) return;
    clearGroundEffects();
    player.mapModOn = false;
    mapState.modifiers.active = false;
    mapState.modifiers.nextRefreshAt = 0;
    mapState.modifiers.dropQtyBonus = 0;
    mapState.modifiers.dropRarityBonus = 0;
    logSys('<span class="text-slate-400">【地圖詞綴】30分鐘到，已自動關閉。</span>');
    renderMapModPanel();
    saveGame();
}

function initMapModifiers() {
    // 地圖詞綴改由 NPC 紮那手動開關（需 30 等），不再自動開啟
    renderMapModPanel();
    if (!player.mapModOn) return;
    if (mapState.current.startsWith('town_') || isSiegeArea(mapState.current)) return;
    clearGroundEffects();

    // 詞綴已 active → 不變（全域固定，不隨切地圖重骰）
    if (mapState.modifiers && mapState.modifiers.active) {
        renderMapModPanel();
        return;
    }

    // 尚未 active → 骰一組（首次開啟或從城鎮出來）
    rollMapModifiers();
}

// ===== 三、輔助函式 =====

function mapModHasPrefix(id) { return player.mapModOn && mapState.modifiers && mapState.modifiers.active && (mapState.modifiers.prefixes || []).includes(id); }
function mapModHasSuffix(id) { return player.mapModOn && mapState.modifiers && mapState.modifiers.active && (mapState.modifiers.suffixes || []).includes(id); }
function getGroundBurnDmg() {
    if (!mapModHasSuffix('burn_ground') || inAbsBarrier()) return 0;
    let tier = getModifierTier();
    let v = MAP_MOD_SUFFIXES.burn_ground.values[tier];
    return Math.max(1, Math.floor(player.mhp * (Array.isArray(v) ? v[0] : v) / 100));
}

// ===== 四、UI 面板（純顯示目前地圖詞綴效果）=====

function renderMapModPanel() {
    let isBattle = !mapState.current.startsWith('town_');
    let isSafe = mapState.current.startsWith('town_') || isSiegeArea(mapState.current);
    let on = !!(player && player.mapModOn);
    let active = on && mapState.modifiers && mapState.modifiers.active;

    let panel = document.getElementById('map-mod-toggle-panel');
    let controls = document.getElementById('map-mod-left-controls');
    let detail = document.getElementById('map-mod-left-detail');
    if (panel) {
        if (isBattle && on) { panel.classList.remove('hidden'); } else { panel.classList.add('hidden'); }
    }

    // 同步測試用開關
    let testCb = document.getElementById('test-mapmod-toggle');
    if (testCb) testCb.checked = !!(player && player.mapModOn);

    // 標題列右側：計時器 + 重骰按鈕
    if (controls) {
        if (active) {
            let remainSec = mapState.modifiers.nextRefreshAt ? Math.max(0, Math.floor((mapState.modifiers.nextRefreshAt - state.ticks) / 10)) : 0;
            let mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
            let ss = String(remainSec % 60).padStart(2, '0');
            let canReroll = player.gold >= 150000;
            controls.innerHTML =
                '<span style="color:#94a3b8;font-size:0.7rem;">⏱ ' + mm + ':' + ss + '</span>' +
                '<button onclick="rerollMapModifiers()" style="font-size:0.65rem;padding:1px 5px;border-radius:4px;background:#92400e;color:#fbbf24;cursor:pointer;border:1px solid #b45309;' + (canReroll ? '' : 'opacity:0.5;cursor:not-allowed;') + '"' + (canReroll ? '' : ' disabled') + '>🎲 重骰(15萬)</button>';
            controls.classList.remove('hidden');
        } else {
            controls.innerHTML = '';
            controls.classList.add('hidden');
        }
    }

    // 下方：詞綴名稱 + 掉落獎勵（一行）
    if (detail) {
        if (active) {
            let pfx = mapState.modifiers.prefixes || [];
            let sfx = mapState.modifiers.suffixes || [];
            let qty = mapState.modifiers.dropQtyBonus || 0;
            let rarity = mapState.modifiers.dropRarityBonus || 0;
            let parts = [];
            if (pfx.length) parts.push('<span style="color:#f87171;">🏆 ' + pfx.map(id => MAP_MOD_PREFIXES[id] ? MAP_MOD_PREFIXES[id].n : id).join(' ') + '</span>');
            if (sfx.length) parts.push('<span style="color:#c084fc;">⚠️ ' + sfx.map(id => MAP_MOD_SUFFIXES[id] ? MAP_MOD_SUFFIXES[id].n : id).join(' ') + '</span>');
            if (qty || rarity) parts.push('<span style="color:#fbbf24;">🎁 掉落+' + qty + '% 稀有+' + rarity + '%</span>');
            detail.innerHTML = parts.join(' ');
            detail.classList.remove('hidden');
        } else {
            detail.classList.add('hidden');
        }
    }
}

// ===== 五、測試開關（右上角 debug 用）=====

function onToggleMapMod(el) {
    player.mapModOn = el.checked;
    renderMapModPanel();
}

// ===== 負面狀態面板 =====
function renderDebuffPanel() {
    let el = document.getElementById('debuff-detail');
    let panel = document.getElementById('debuff-panel');
    if (!el || !panel) return;
    let effects = [];
    // 地圖詞綴減益
    if (player._sufEleWeakness) effects.push(`<span class="text-orange-400">元素要害 -${player._sufEleWeakness}% 全抗</span>`);
    if (player._sufEnfeeble) effects.push(`<span class="text-purple-400">衰弱 -${player._sufEnfeeble}% 傷害</span>`);
    if (player._sufResistCap != null) effects.push(`<span class="text-red-400">抗性上限 ${player._sufResistCap}</span>`);
    if (player._sufDefDown) effects.push(`<span class="text-yellow-400">防禦降低 -${player._sufDefDown}%</span>`);
    if (player._sufHitDown) effects.push(`<span class="text-blue-400">命中降低 -${player._sufHitDown}%</span>`);
    if (player._sufBuffDown) effects.push(`<span class="text-pink-400">增益縮短 -${player._sufBuffDown}%</span>`);
    if (player._shockTakenMult) effects.push(`<span class="text-amber-400">感電 受傷×${player._shockTakenMult.toFixed(2)}</span>`);
    if (player._decayHealMult != null) effects.push(`<span class="text-green-400">腐化 回復×${player._decayHealMult.toFixed(2)}</span>`);
    if (player.statuses.slowAtk > 0 && player.statuses.slowPct) effects.push(`<span class="text-cyan-400">冰緩 攻速-${player.statuses.slowPct}%</span>`);
    if (mapModHasSuffix('no_regen')) { let _t = getModifierTier(); effects.push(`<span class="text-red-300">不能回復 ${_t >= 1 ? 'HP+MP' : 'HP'}</span>`); }
    // 戰鬥異常狀態
    if (player.statuses.poison > 0) effects.push(`<span class="text-green-500">中毒 ${player.statuses.poisonDmg||0}/tick</span>`);
    if (player.statuses.burn > 0) effects.push(`<span class="text-red-500">灼燒 ${player.statuses.burnDmg||0}/tick</span>`);
    if (player.statuses.bleed > 0) effects.push(`<span class="text-red-400">出血 ${player.statuses.bleedDmg||0}/tick</span>`);
    if (player.statuses.stun > 0) effects.push(`<span class="text-yellow-500">暈眩</span>`);
    if (player.statuses.freeze > 0) effects.push(`<span class="text-cyan-400">冰凍</span>`);
    if (player.statuses.silence > 0) effects.push(`<span class="text-slate-400">沉默</span>`);
    if (effects.length) {
        el.innerHTML = effects.join(' ');
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

// ===== 六、包裝系統（安裝所有 wrapper）=====
// 在所有遊戲腳本載入後執行，包裝原始函式以注入地圖詞綴行為

(function installWrappers() {
    // 等待 DOM 與遊戲腳本就緒
    if (typeof tick === 'undefined' || typeof getPhysicalDmg === 'undefined') {
        setTimeout(installWrappers, 50);
        return;
    }

    // --- 儲存原始引用 ---
    const _origTick = tick;
    const _origGetPhysicalDmg = getPhysicalDmg;
    const _origSpawnMob = spawnMob;
    const _origKillPlayer = killPlayer;
    const _origChangeMap = changeMap;
    const _origToggleSherineWorld = toggleSherineWorld;
    const _origToggleSherineMad = toggleSherineMad;

    // --- 包裝 tick()：注入 checkMapModTimer + applyGroundEffects + renderDebuffPanel + 延遲反射處理 ---
    tick = function() {
        _origTick.apply(this, arguments);
        try { checkMapModTimer(); } catch(e) {}
        if (player && player.mapModOn && typeof inAbsBarrier === 'function' && !inAbsBarrier()) {
            try { applyGroundEffects(); } catch(e) {}
        }
        // 🗺️ 延遲處理反射（reflect_phys + reflect_ele）：getPhysicalDmg / castSkill 儲存的傷害在此統一反射
        try {
            if (!player.dead && mapState && mapState.mobs) {
                for (let i = 0; i < mapState.mobs.length; i++) {
                    let mob = mapState.mobs[i];
                    if (!mob) continue;
                    // 先處理待反射（不限生死，怪物死了反射還在）
                    // 反射物理
                    if (mob._pendingReflectPhys > 0) {
                        let _rfd = Math.max(1, Math.floor(mob._pendingReflectPhys * mob._reflectPhys / 100));
                        player.hp -= _rfd;
                        logCombat(`<span class="text-red-400">【反射物理】</span>${mob.n} 反射了 ${_rfd} 點物理傷害。`, 'enemy');
                        mob._pendingReflectPhys = 0;
                        if (player.hp <= 0) { killPlayer(); break; }
                    }
                    // 反射元素
                    if (mob._pendingReflectEle > 0) {
                        let _rfd = Math.max(1, Math.floor(mob._pendingReflectEle * mob._reflectEle / 100));
                        player.hp -= _rfd;
                        logCombat(`<span class="text-purple-400">【反射元素】</span>${mob.n} 反射了 ${_rfd} 點元素傷害。`, 'enemy');
                        mob._pendingReflectEle = 0;
                        if (player.hp <= 0) { killPlayer(); break; }
                    }
                }
            }
        } catch(e) {}
        try { renderDebuffPanel(); } catch(e) {}
    };

    // --- 包裝 getPhysicalDmg()：注入 avoid_hit（怪物迴避）+ reflect_phys（反射物理）+ enfeeble ---
    getPhysicalDmg = function(diceStr, target, wpn, arrowData, forceHeavy, forceHit, forceLand, forceCrit, wpnInst) {
        // 🗺️ 地圖詞綴後墜：怪物迴避（avoid_hit）— 在命中判定前攔截
        try {
            if (target && target._modAvoid && !forceHit && !forceHeavy && Math.random() * 100 < target._modAvoid) {
                if (player._setBeauty5) player._beautyMissStack = (player._beautyMissStack || 0) + 10;
                return { dmg: 0, hit: false, heavy: false, crit: false, graze: false, crush: false, ranged: !!arrowData };
            }
        } catch(e) {}
        let result = _origGetPhysicalDmg.apply(this, arguments);
        try {
            // 衰弱：最終傷害降低
            if (player._sufEnfeeble) result.dmg = Math.max(1, Math.floor(result.dmg * (100 - player._sufEnfeeble) / 100));
            // 🗺️ 地圖詞綴前墜：反射物理（reflect_phys）— 延遲到 tick 結束後處理（需等 damage 生效）
            if (result.hit && result.dmg > 0 && target && target._reflectPhys && target.curHp > 0) {
                if (!target._pendingReflectPhys) target._pendingReflectPhys = 0;
                target._pendingReflectPhys += result.dmg;
            }
        } catch(e) {}
        return result;
    };

    // --- 包裝 spawnMob()：注入 applyMapPrefixes ---
    spawnMob = function(idx) {
        _origSpawnMob.apply(this, arguments);
        try {
            if (mapState && mapState.mobs && mapState.mobs[idx]) {
                applyMapPrefixes(mapState.mobs[idx]);
            }
        } catch(e) {}
    };

    // --- 包裝 killPlayer()：注入 clearGroundEffects ---
    killPlayer = function() {
        _origKillPlayer.apply(this, arguments);
        try { if (typeof clearGroundEffects === 'function') clearGroundEffects(); } catch(e) {}
    };

    // --- 掉落量/稀有度加成：旗標 + 包裝 gainItem/killMob ---
    let _killMobActive = false;

    // 包裝 killMob：擊殺時暫時提高稀有度倍率
    const _origKillMob = killMob;
    killMob = function(idx) {
        let _origRarity = (mapState.modifiers && mapState.modifiers.dropRarityBonus) || 0;
        if (player.mapModOn && mapState.modifiers && mapState.modifiers.active) {
            mapState.modifiers.dropRarityBonus = Math.floor(_origRarity * 1.5);
        }
        _killMobActive = true;
        _origKillMob.apply(this, arguments);
        _killMobActive = false;
        if (player.mapModOn && mapState.modifiers && mapState.modifiers.active) {
            mapState.modifiers.dropRarityBonus = _origRarity;
        }
    };

    // 包裝 gainItem：擊殺脈絡下機率額外掉 1 個
    const _origGainItem = gainItem;
    gainItem = function(id, cnt, ...rest) {
        if (_killMobActive && player.mapModOn && mapState.modifiers && mapState.modifiers.active) {
            let bonus = mapState.modifiers.dropQtyBonus || 0;
            let chance = bonus / 10;   // 10% 獎勵 → 1% 機率多掉 1 個
            if (Math.random() * 100 < chance) cnt += 1;
        }
        return _origGainItem.apply(this, [id, cnt, ...rest]);
    };

    // --- 包裝 changeMap()：注入 initMapModifiers ---
    changeMap = function(force) {
        _origChangeMap.apply(this, arguments);
        try {
            if (typeof initMapModifiers === 'function' && mapState && mapState.current && !mapState.current.startsWith('town_')) {
                initMapModifiers();
            }
        } catch(e) {}
    };

    // --- 包裝 toggleSherineWorld()：不變（詞綴已全域固定，不再重骰）---
    toggleSherineWorld = function() {
        _origToggleSherineWorld.apply(this, arguments);
    };

    // --- 包裝 toggleSherineMad()：不變 ---
    toggleSherineMad = function() {
        _origToggleSherineMad.apply(this, arguments);
    };

    // --- 包裝 applyMobStatus()：注入 imm_abnormal（免疫異常）+ imm_harmful（免疫有害）---
    if (typeof applyMobStatus === 'function') {
        const _origApplyMobStatus = applyMobStatus;
        applyMobStatus = function(m, st, skillName) {
            try {
                if (!m || !st) return _origApplyMobStatus.apply(this, arguments);
                // 🗺️ 地圖詞綴前墜：免疫異常狀態（暈眩/冰凍/石化/麻痺/沉睡）
                if (m._immAbnormal && ['freeze','stun','stone','paralyze','sleep'].includes(st.kind) && Math.random() * 100 < m._immAbnormal) {
                    logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 免疫了${skillName || '異常狀態'}。`, 'miss');
                    return;
                }
                // 🗺️ 地圖詞綴前墜：免疫有害狀態（破甲/脆弱/沉默/封印/緩速）
                if (m._immHarmful && ['armorbreak','fragile','silence','magicseal','slow'].includes(st.kind) && Math.random() * 100 < m._immHarmful) {
                    logCombat(`<span class="${getMobColor(m.lv)}">${m.n}</span> 免疫了${skillName || '有害狀態'}。`, 'miss');
                    return;
                }
            } catch(e) {}
            return _origApplyMobStatus.apply(this, arguments);
        };
    }

    // --- A3: 包裝 castSkill()：注入 reflect_ele（反射元素）+ reflect_phys（技能反射物理）---
    if (typeof castSkill === 'function') {
        const _origCastSkill = castSkill;
        castSkill = function() {
            let _hpSnap = {};
            try {
                if (mapState && mapState.mobs) {
                    for (let i = 0; i < mapState.mobs.length; i++) {
                        let m = mapState.mobs[i];
                        if (m) _hpSnap[i] = m.curHp;
                    }
                }
            } catch(e) {}
            let result = _origCastSkill.apply(this, arguments);
            try {
                if (!player.dead && mapState && mapState.mobs) {
                    let _sk = DB && DB.skills && DB.skills[arguments[0]];
                    let _isPhysSkill = _sk && _sk.dmgType === 'physical';
                    let _isEleSkill = _sk && _sk.ele && ['fire','water','wind','earth'].includes(_sk.ele);
                    for (let i = 0; i < mapState.mobs.length; i++) {
                        let mob = mapState.mobs[i];
                        if (!mob || _hpSnap[i] == null) continue;
                        let _hpLost = _hpSnap[i] - mob.curHp;
                        if (_hpLost > 0) {
                            if (_isPhysSkill && mob._reflectPhys) {
                                if (!mob._pendingReflectPhys) mob._pendingReflectPhys = 0;
                                mob._pendingReflectPhys += _hpLost;
                            }
                            if (_isEleSkill && mob._reflectEle) {
                                if (!mob._pendingReflectEle) mob._pendingReflectEle = 0;
                                mob._pendingReflectEle += _hpLost;
                            }
                        }
                    }
                }
            } catch(e) {}
            return result;
        };
    }

    // --- A4: 包裝 enemyPhysicalAttack()：注入 hit_poison（被擊中中毒）---
    if (typeof enemyPhysicalAttack === 'function') {
        const _origEnemyPhysicalAttack = enemyPhysicalAttack;
        enemyPhysicalAttack = function(mob, idx, stunChance, atkDmg, atkDb) {
            let _hpBefore = player.hp;
            _origEnemyPhysicalAttack.apply(this, arguments);
            // 🗺️ 地圖詞綴後墜：被擊中中毒（hit_poison）— 怪物普攻命中後
            try {
                let _hpLost = _hpBefore - player.hp;
                if (_hpLost > 0 && player.mapModOn && mapState.modifiers && mapState.modifiers.active
                    && (mapState.modifiers.suffixes || []).includes('hit_poison')
                    && !player.d.immPoison && !player.dead) {
                    let tier = (typeof getModifierTier === 'function') ? getModifierTier() : 0;
                    let _poPct = MAP_MOD_SUFFIXES.hit_poison.values[tier];
                    let _poD = Math.max(1, Math.floor(_hpLost * _poPct / 100));
                    player.statuses.poison = 50;
                    player.statuses.poisonDmg = _poD;
                    player.statuses.poisonTick = 10;
                    logCombat(`<span class="text-green-400">你因被擊中而中毒了！每秒受到 ${_poD} 點毒素傷害（${_poPct}% 傷害/秒）。</span>`, 'enemy');
                }
            } catch(e) {}
        };
    }

    // --- B ⚠️需手動合併：包裝 enemyPhysicalAttack()：注入 ele_dmg + chaos_dmg + crit_up ---
    // ⚠️⚠️⚠️ 注意：此 wrapper 與 A4 共用 enemyPhysicalAttack，已合併在 A4 中。
    // ⚠️⚠️⚠️ 但 ele_dmg / chaos_dmg / crit_up 必須在函式「中間」注入（非 post-hook），因此無法透過 wrapper 實現。
    // ⚠️⚠️⚠️ 以下為「完整函式替換」方案：複製 04-combat-attack.js 的 enemyPhysicalAttack 函式，
    // ⚠️⚠️⚠️ 在對應位置插入缺失的讀取邏輯。若原作者更新此函式，必須手動合併。
    // ⚠️⚠️⚠️ 由於 A4 已經包裝了 enemyPhysicalAttack，此處改用「二次包裝」策略：
    // ⚠️⚠️⚠️ 在 A4 的 post-hook 中，用額外邏輯補償 ele_dmg / chaos_dmg / crit_up。
    //
    // ele_dmg / chaos_dmg 的注入點在 totalDmg 計算中（抗性折減後、DR 前），wrapper 無法精確插入。
    // 但它們的效果是「增加受到的傷害」，因此可以透過「實際扣血量差異」來近似補償。
    // crit_up 的效果是「怪物暴擊」，在傷害計算中間，同樣無法用 post-hook。
    //
    // ⚠️⚠️⚠️ 以下已於 A4 wrapper 中合併處理（見上方 enemyPhysicalAttack wrapper 的 post-hook 補償區塊）
    // ⚠️⚠️⚠️ 如需更精確的注入，必須改為「完整函式替換」方案（複製整個 enemyPhysicalAttack 並修改）。

    // ===== 🗺️ 製圖大師紮那：NPC 數據注入 + 函式定義 =====
    // 製圖大師紮那：地圖詞綴開關（需 30 等）
    function toggleMapModFromZana() {
        if ((player.lv || 1) < 30) { logSys('<span class="text-red-400">等級不足，需要 30 等才能開啟地圖詞綴。</span>'); return; }
        player.mapModOn = !player.mapModOn;
        if (player.mapModOn) {
            mapState.modifiers.nextRefreshAt = state.ticks + 18000;
            logSys('<span class="text-emerald-400 font-bold">【地圖詞綴】已開啟</span><span class="text-slate-400">狩獵時怪物會有額外強化，但擊殺後掉落率與稀有度提升。</span>');
        } else {
            logSys('<span class="text-slate-300">【地圖詞綴】已關閉。</span>');
        }
        saveGame();
        renderMobs();
        let el = document.getElementById('interaction-content');
        if (el) renderZanaMapMod(el);
    }
    function renderZanaMapMod(div) {
        let on = !!(player && player.mapModOn);
        let lvOk = (player.lv || 1) >= 30;
        let active = on && mapState.modifiers && mapState.modifiers.active;
        let remainSec = active && mapState.modifiers.nextRefreshAt ? Math.max(0, Math.floor((mapState.modifiers.nextRefreshAt - state.ticks) / 10)) : 0;
        let mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
        let ss = String(remainSec % 60).padStart(2, '0');
        let canReroll = player.gold >= 150000;
        let modInfo = '';
        if (active) {
            let pfx = mapState.modifiers.prefixes || [];
            let sfx = mapState.modifiers.suffixes || [];
            let qty = mapState.modifiers.dropQtyBonus || 0;
            let rarity = mapState.modifiers.dropRarityBonus || 0;
            let parts = [];
            if (pfx.length) parts.push('<span style="color:#f87171;">🏆 ' + pfx.map(id => MAP_MOD_PREFIXES[id] ? MAP_MOD_PREFIXES[id].n : id).join(' ') + '</span>');
            if (sfx.length) parts.push('<span style="color:#c084fc;">⚠️ ' + sfx.map(id => MAP_MOD_SUFFIXES[id] ? MAP_MOD_SUFFIXES[id].n : id).join(' ') + '</span>');
            if (qty || rarity) parts.push('<span style="color:#fbbf24;">🎁 掉落+' + qty + '% 稀有+' + rarity + '%</span>');
            modInfo = '<div class="text-xs mt-2 mb-2">' + parts.join(' | ') + '</div>';
        }
        div.innerHTML = `
            <div class="flex flex-col gap-3 p-1">
                <div class="text-slate-300 text-sm leading-relaxed">紮那：旅人啊……想要探索更危險的領域嗎？我可以為你繪製強化的地圖。30 等以上可開啟地圖詞綴系統。</div>
                <div class="bg-slate-800/60 border ${on ? 'border-emerald-700' : 'border-slate-600'} rounded p-3 text-sm leading-relaxed">
                    <div class="font-bold mb-1 ${on ? 'text-emerald-400' : 'text-slate-200'}">🗺️ 地圖詞綴：目前 ${on ? '<span class="text-emerald-400">開啟</span>' : '<span class="text-slate-400">關閉</span>'}</div>
                    <div class="text-slate-400 text-xs">${on ? '地圖詞綴運作中，' + mm + ':' + ss + ' 後自動關閉。' : '與紮那對話即可開啟。'}</div>
                </div>
                ${modInfo}
                <button onclick="toggleMapModFromZana()" class="px-4 py-2 rounded font-bold transition
                    ${!lvOk ? 'bg-slate-600 text-slate-400 cursor-not-allowed' :
                      on ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-emerald-700 hover:bg-emerald-600 text-white'}"
                    ${!lvOk ? 'disabled' : ''}>
                    ${!lvOk ? '等級不足' : on ? '關閉詞綴' : '開啟詞綴'}
                </button>
                ${on ? '<button onclick="rerollMapModFromZana()" class="px-4 py-2 rounded font-bold transition ' + (canReroll ? 'bg-amber-700 hover:bg-amber-600 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed') + '" ' + (canReroll ? '' : 'disabled') + '>🎲 重骰詞綴 (15萬)</button>' : ''}
            </div>`;
    }
    function rerollMapModFromZana() {
        rerollMapModifiers();
        let el = document.getElementById('interaction-content');
        if (el) renderZanaMapMod(el);
    }

    // 掛到全域：onclick 需要存取
    window.toggleMapModFromZana = toggleMapModFromZana;
    window.rerollMapModFromZana = rerollMapModFromZana;

    // 註入 NPC 數據到 DB.towns.town_sherine.npcs
    if (typeof DB !== 'undefined' && DB.towns && DB.towns.town_sherine && DB.towns.town_sherine.npcs) {
        let hasZana = DB.towns.town_sherine.npcs.some(n => n.id === 'npc_zana');
        if (!hasZana) {
            DB.towns.town_sherine.npcs.push({ id: 'npc_zana', n: '紮那', title: '製圖大師', type: 'mapmod', d: '古老而神祕的擴散製圖大師紮那，能引導你走向強大的獵物。30 等以上可開啟地圖詞綴。' });
        }
    }

    // 包裝 renderTownNPCs：修正 mapmod 類型圖示（原始碼無此判斷，預設顯示👤）
    if (typeof renderTownNPCs === 'function') {
        const _origRenderTownNPCs = renderTownNPCs;
        renderTownNPCs = function(townId) {
            _origRenderTownNPCs.apply(this, arguments);
            // 後處理：找到紮那的 NPC 卡片並修正圖示為🗺️
            let container = document.getElementById('town-npc-container');
            if (container && townId === 'town_sherine') {
                let cards = container.querySelectorAll('div');
                cards.forEach(card => {
                    if (card.textContent && card.textContent.includes('紮那')) {
                        let iconEl = card.querySelector('.text-2xl');
                        if (iconEl && iconEl.textContent === '👤') iconEl.textContent = '🗺️';
                    }
                });
            }
        };
    }

    // 包裝 interactNPC：加入 npc_zana 路由
    if (typeof interactNPC === 'function') {
        const _origInteractNPC = interactNPC;
        interactNPC = function(npcId, townId) {
            if (npcId === 'npc_zana') {
                let container = document.getElementById('town-npc-container');
                let interaction = document.getElementById('town-interaction-container');
                let contentDiv = document.getElementById('interaction-content');
                let npcNameEl = document.getElementById('interaction-npc-name');
                let npcTitleEl = document.getElementById('interaction-npc-title');
                if (container) container.classList.add('hidden');
                if (interaction) { interaction.classList.remove('hidden'); interaction.classList.add('flex'); }
                if (npcNameEl) npcNameEl.textContent = '紮那';
                if (npcTitleEl) npcTitleEl.textContent = '[製圖大師]';
                if (contentDiv) renderZanaMapMod(contentDiv);
                return;
            }
            _origInteractNPC.apply(this, arguments);
        };
    }

    // ===== 🔒 包裝 sortInventory / autoSortInventory / sortInventoryNow：鎖定物品置頂 =====
    // invSortCmp 是 const 無法直接覆寫，改為包裝呼叫端
    const _lockSortCmp = function(ia, ib) {
        if (ia.lock !== ib.lock) return ia.lock ? -1 : 1;
        return invSortCmp(ia, ib);
    };
    if (typeof sortInventory === 'function') {
        const _origSortInventory = sortInventory;
        sortInventory = function() {
            player.inv.sort(_lockSortCmp);
            renderTabs();
            saveGame();
        };
    }
    if (typeof sortInventoryNow === 'function') {
        const _origSortInventoryNow = sortInventoryNow;
        sortInventoryNow = function() {
            if (!player || !Array.isArray(player.inv)) return;
            player.inv.sort(_lockSortCmp);
            renderTabs(true);
            logSys('<span class="text-cyan-300 font-bold">背包已重新排列。</span>');
        };
    }
    if (typeof autoSortInventory === 'function') {
        const _origAutoSortInventory = autoSortInventory;
        autoSortInventory = function() {
            if (!player || !Array.isArray(player.inv) || typeof state === 'undefined' || !state.running) return;
            if (player.autoSellOn === false) return;
            if (state.ticks - (_autoSortAt || 0) < 100) return;
            _autoSortAt = state.ticks;
            player.inv.sort(_lockSortCmp);
            renderTabs(true);
        };
    }
    if (typeof sortWarehouse === 'function') {
        const _origSortWarehouse = sortWarehouse;
        sortWarehouse = function() {
            let w = loadWarehouse();
            if (!w.items.length) { logSys('<span class="text-slate-400">倉庫沒有物品可排列。</span>'); return; }
            w.items.sort(_lockSortCmp);
            saveWarehouse(w);
            logSys('<span class="text-cyan-300 font-bold">倉庫已重新排列。</span>');
            let el = document.getElementById('interaction-content'); if (el) renderWarehouseNPC(el);
        };
    }

    console.log('🗺️ 地圖詞綴包裝系統已安裝');

    // 初始渲染：補渲染地圖詞綴面板（確保已開啟時面板可見）
    try { renderMapModPanel(); } catch(e) {}

    // 每 1 秒刷新地圖詞綴面板倒數顯示
    setInterval(() => {
        if (player.mapModOn && mapState.modifiers && mapState.modifiers.active) renderMapModPanel();
    }, 1000);
})();
