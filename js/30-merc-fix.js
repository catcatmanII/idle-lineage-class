// 30-merc-fix.js — 傭兵已知問題修復模組（暫時補丁，原作者修復後可移除）
// 修復項目：
//   #1  mobEffAC：弱點精通 AC 減免讀錯人（讀玩家而非攻擊者傭兵）
//   #3  buildAlly：招募時不轉發玩家收藏加成（卡片/裝備/道具收集冊）
//   #4  buildAlly：娃娃全收集六維+1 在招募時未套用
//   #5  _isMercSelfBuff：龍騎士覺醒技能不應自我維持（長CD爆發·免白耗MP）
//   注意：Fix #A（killMob 傭兵 MP-on-kill）已由上游 05-kill-progression.js:212 修復，不再需要
(function() {
    'use strict';

    // ===== 修復 #1：mobEffAC 攻擊者精通判定 =====
    // 原始 mobEffAC(m) 中 hasMastery('k_weakness') 讀 player.mastery（真實玩家）。
    // 傭兵攻擊時 player 仍是真實玩家，導致傭兵有弱點精通卻讀不到。
    // 上游 allyAttackOnce 已傳 mobEffAC(t, ally) 但 mobEffAC 簽章只收 m→第二參數被忽略。
    // 修復：包裝 mobEffAC，接受可選 attacker 參數，根據 attacker.mastery 判定。
    var _origMobEffAC = mobEffAC;
    mobEffAC = function(m, attacker) {
        var base = (m.ac || 0)
            + ((m.st && m.st.disease > 0) ? 8 : 0)
            + ((m.st && (m.st.confuse > 0 || m.st.panic > 0)) ? 5 : 0)
            + ((m.st && m.st.guardbreak > 0) ? 10 : 0)
            - ((m._acGuardEnd > state.ticks) ? (m._acGuardVal || 0) : 0);
        var _atk = attacker || player;
        if (m.weakExpose > 0 && _atk && _atk.mastery === 'k_weakness') {
            base += 3 * Math.min(5, m.weakExpose);
        }
        return base;
    };

    // ===== 修復 #3+#4：buildAlly 招募收藏轉發 =====
    // 原始 buildAlly 深拷貝傭兵存檔，但不包含真實玩家的 cardDex/equipDex/miscDex。
    // _allyLevelRecompute 有轉發（升級後補回），但招募當下缺失→收藏加成（含娃娃全收集六維+1）不套用。
    // 修復：包裝 buildAlly，原始函式後轉發玩家收藏桶並重算。
    var _origBuildAlly = buildAlly;
    buildAlly = function(slotN) {
        var result = _origBuildAlly(slotN);
        if (!result) return null;
        var _save = player;
        // 轉發玩家收藏桶（卡片/裝備/道具收集冊）
        result.cardDex = _save.cardDex;
        result.equipDex = _save.equipDex;
        result.miscDex = _save.miscDex;
        // 重算以套用收藏加成（含娃娃全收集六維+1）
        player = result;
        try { recomputeStats(); } catch(e) {}
        { var _rm = royalAllyMult(); if (_rm !== 1) { result.mhp = Math.max(1, Math.floor((result.mhp || 1) * _rm)); result.mmp = Math.floor((result.mmp || 0) * _rm); } }
        player = _save; calcStats();
        result.curHp = Math.min(result.curHp || result.mhp, result.mhp || 1);
        return result;
    };

    // ===== 修復 #5：_isMercSelfBuff 龍騎士覺醒排除 =====
    // 原始 _isMercSelfBuff(06-status-allies.js:1691) 不排除覺醒技能，
    // 導致傭兵自動維持覺醒（長CD爆發·非持續增益·白耗MP）。
    // 上游 allyMaintainBuffs:1730 有覺醒互斥（已有一個→不放第二個），但不排除首次施放。
    // 修復：包裝 _isMercSelfBuff，原始判定後追加 _MERC_AWAKENS 排除。
    var _origIsMercSelfBuff = _isMercSelfBuff;
    _isMercSelfBuff = function(sk, sid) {
        if (!_origIsMercSelfBuff(sk, sid)) return false;
        if (typeof _MERC_AWAKENS !== 'undefined' && _MERC_AWAKENS.includes(sid)) return false;
        return true;
    };
})();
