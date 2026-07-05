/**
 * 29-merc-support.js — 傭兵支援模組（傭兵對隊友施放增益法術）
 *
 * 零修改 06-status-allies.js：透過包裝 alliesTick 注入隊友增益邏輯。
 * 與現有 _isMercSelfBuff（自我增益）並行不衝突。
 *
 * 功能：
 *  - 傭兵對隊友（玩家 + 其他傭兵）施放增益法術
 *  - 血盟限定技能（體魄強健術/通暢氣脈術/聖結界）需判定血盟成員
 *  - 每種增益持續時間獨立追蹤（per-target）
 *  - 僅施放快照傭兵已學會的技能（ally.skills.includes）
 *  - 每 3 秒（tick%30===0）檢查一次
 */
(function() {
    'use strict';

    // ===== 常數 =====
    // 可對隊友施放的增益技能列表
    const MERC_SUPPORT_BUFFS = [
        'sk_str_up',         // 體魄強健術（血盟限定）
        'sk_dex_up',         // 通暢氣脈術（血盟限定）
        'sk_holy_barrier',   // 聖結界（血盟限定）
        'sk_bless_wpn',      // 祝福魔法武器
        'sk_elf_firewpn',    // 火焰武器（火妖）
        'sk_elf_windshot',   // 風之神射（風妖）
        'sk_elf_earthguard', // 大地防護（地妖）
        'sk_illu_ogre',      // 幻覺：歐吉
        'sk_illu_lich',      // 幻覺：巫妖
        'sk_illu_golem',     // 幻覺：鑽石高崙
        'sk_illu_insight',   // 洞察
        'sk_berserk',        // 狂暴術（7級· meleeDmg+5, ac-10）
    ];
    const MERC_PLEDGE_ONLY = new Set(['sk_str_up', 'sk_dex_up', 'sk_holy_barrier']);

    // ===== 輔助函式 =====

    /** 血盟成員判定：玩家與其招募的傭兵同血盟 */
    function _isSameBloodPledge(target) {
        let myPledge = (typeof player !== 'undefined' && player) ? player.bloodPledge : null;
        if (!myPledge) return false;
        if (target === player) return true;
        // 傭兵透過 NPC 招募，與玩家同血盟
        return true;
    }

    /** 取得可施放目標列表（玩家 + 其他存活傭兵，排除施法者自己） */
    function _allySupportTargets(caster) {
        let targets = [];
        if (typeof player !== 'undefined' && player && !player.dead) targets.push(player);
        if (player && player.allies) {
            for (let a of player.allies) {
                if (a && a !== caster && !a._downed) targets.push(a);
            }
        }
        return targets;
    }

    // ===== 核心函式 =====

    /**
     * 傭兵對隊友施放增益法術（每 3 秒檢查一次）
     * @param {Object} ally - 施法傭兵
     */
    function _allySupportBuffs(ally) {
        if (!ally || ally._downed) return;
        if (state.ticks % 30 !== 0) return;
        if (!ally.skills || !ally.skills.length) return;

        let _ast = ally.statuses || {};
        if (mapState.current.startsWith('town_') || _ast.silence > 0 || _ast.magicseal > 0 ||
            _ast.stun > 0 || _ast.freeze > 0 || _ast.stone > 0 || _ast.paralyze > 0 || _ast.sleep > 0) return;

        if (!ally._allySupportExpiry) ally._allySupportExpiry = {};

        let targets = _allySupportTargets(ally);
        if (!targets.length) return;

        for (let sid of MERC_SUPPORT_BUFFS) {
            if (!ally.skills.includes(sid)) continue;
            let sk = DB.skills[sid];
            if (!sk) continue;

            let cost = (ally.d && typeof ally.d.getMpCost === 'function') ? ally.d.getMpCost(sk.mp, sk.tier) : (sk.mp || 0);
            if ((ally.mp || 0) < cost) continue;

            // 找第一個可施放目標
            for (let tgt of targets) {
                // 血盟限定：目標必須同血盟
                if (MERC_PLEDGE_ONLY.has(sid) && !_isSameBloodPledge(tgt)) continue;
                // 已有此 buff 或冷卻中 → 跳過
                if ((tgt.buffs && tgt.buffs[sid] || 0) > 0) continue;
                let key = sid + '#' + ((tgt === player) ? 'player' : (tgt._slot || 'ally'));
                if ((ally._allySupportExpiry[key] || 0) > state.ticks) continue;
                // 施放
                ally.mp -= cost;
                if (!tgt.buffs) tgt.buffs = {};
                tgt.buffs[sid] = sk.dur;
                ally._allySupportExpiry[key] = state.ticks + sk.dur;
                logCombat(`<span class="text-emerald-300 font-bold">協力·${ally._allyName}</span> 對${(tgt === player) ? '你' : '協力·' + (tgt._allyName || '傭兵')}施放了 ${sk.n}。`, 'heal', 'mercenary');
                try { if (tgt === player) { recomputeStats(); } else { _allyLevelRecompute(tgt); } } catch(e) {}
                break;
            }
        }
    }

    // ===== 包裝 alliesTick =====
    let _origAlliesTick = (typeof alliesTick === 'function') ? alliesTick : null;

    alliesTick = function() {
        if (_origAlliesTick) _origAlliesTick();  // 原有全部邏輯（含自我增益/召喚/攻擊/立方）

        // 新增：隊友增益（每個傭兵獨立檢查）
        if (typeof player !== 'undefined' && player && player.allies && player.allies.length) {
            for (let ally of player.allies) {
                if (ally && !ally._downed) _allySupportBuffs(ally);
            }
        }
    };

})();
