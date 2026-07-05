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

    // --- 包裝 tick()：注入 checkMapModTimer + applyGroundEffects + renderDebuffPanel ---
    tick = function() {
        _origTick.apply(this, arguments);
        try { checkMapModTimer(); } catch(e) {}
        if (player && player.mapModOn && typeof inAbsBarrier === 'function' && !inAbsBarrier()) {
            try { applyGroundEffects(); } catch(e) {}
        }
        try { renderDebuffPanel(); } catch(e) {}
    };

    // --- 包裝 getPhysicalDmg()：注入 enfeeble ---
    getPhysicalDmg = function(diceStr, target, wpn, arrowData, forceHeavy, forceHit, forceLand, forceCrit, wpnInst) {
        let result = _origGetPhysicalDmg.apply(this, arguments);
        try {
            // 衰弱：最終傷害降低
            if (player._sufEnfeeble) result.dmg = Math.max(1, Math.floor(result.dmg * (100 - player._sufEnfeeble) / 100));
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

    console.log('🗺️ 地圖詞綴包裝系統已安裝');

    // 每 1 秒刷新地圖詞綴面板倒數顯示
    setInterval(() => {
        if (player.mapModOn && mapState.modifiers && mapState.modifiers.active) renderMapModPanel();
    }, 1000);
})();
