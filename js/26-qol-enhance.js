// ===== 🔧 QoL 增強模組 =====
// 從原始檔抽出的 QoL 功能 + 新增功能
// 開關：window.__qolOff = true
(function() {
    'use strict';
    if (window.__qolOff) return;

    // ---- 1. BOSS 優先攻擊（全域） ----
    // 開關：window.__bossPriorityOff = true 關閉
    (function() {
        const _origGetTarget = window.getTarget;
        if (typeof _origGetTarget !== 'function') return;
        window.getTarget = function() {
            if (window.__bossPriorityOff) return _origGetTarget();
            let boss = mapState.mobs.find(m => m && m.boss && m.curHp > 0 && !m._dead);
            if (boss) return boss;
            return _origGetTarget();
        };
    })();

    // ---- 2. 倉庫套裝篩選（原 12-npc-quests.js） ----
    // 倉庫物品是否符合「套裝篩選」（獨立於主分類/子分類·與 whMatchFilter 串接使用）
    // _whSetFilter 變數仍定義在 12-npc-quests.js（HTML 模板引用）
    window.whMatchSetFilter = function(invOrWhItem) {
        if (!_whSetFilter) return true;
        return !!(invOrWhItem && invOrWhItem.seteff && invOrWhItem.seteff.slice(0, 2) === _whSetFilter);
    };

    // ---- 3. 傭兵重雇保留 HP 設定（新功能） ----
    // 解散後重新雇用時，保留治癒門檻/停技門檻/喝水門檻設定
    const _origRehireAlly = window.rehireAlly;
    if (typeof _origRehireAlly === 'function') {
        window.rehireAlly = function(slotN) {
            // 保存舊設定
            let cur = (player.allies || []).find(a => a && a._slot === String(slotN));
            let saved = cur ? {
                healHpPct: cur._healHpPct,
                hpSkillPct: cur._hpSkillPct,
                potHpPct: cur._potHpPct
            } : null;
            // 呼叫原始（會 rebuildAlly）
            _origRehireAlly(slotN);
            // 還原設定
            if (saved) {
                let newAlly = (player.allies || []).find(a => a && a._slot === String(slotN));
                if (newAlly) {
                    if (saved.healHpPct != null) newAlly._healHpPct = saved.healHpPct;
                    if (saved.hpSkillPct != null) newAlly._hpSkillPct = saved.hpSkillPct;
                    if (saved.potHpPct != null) newAlly._potHpPct = saved.potHpPct;
                }
            }
        };
    }

    // ---- 4. Miss/Dodge 特效 ----
    // 物理攻擊未命中/閃避時跳出文字特效
    function _vfxShowMiss(type) {
        try {
            if (window.__vfxOff) return;
            let layer = document.getElementById('vfx-layer');
            if (!layer || layer.childElementCount >= 200) return;
            // 找目標位置：取當前目標怪物
            let mob = mapState.mobs[mapState.targetIdx];
            if (!mob || mob._dead || mob.curHp <= 0) return;
            let ml = document.getElementById('mob-list');
            let slot = ml && ml.querySelector('.mob-target[data-uid="' + mob.uid + '"]');
            if (!slot) return;
            let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;
            let r = box.getBoundingClientRect();
            if (r.width === 0) return;
            let el = document.createElement('div');
            el.className = 'vfx-miss-text';
            el.textContent = type === 'dodge' ? 'DODGE' : 'MISS';
            el.style.left = (r.left + r.width / 2 + (Math.random() * 20 - 10)) + 'px';
            el.style.top = (r.top + r.height * 0.35) + 'px';
            layer.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
            setTimeout(() => { if (el.parentNode) el.remove(); }, 1200);
        } catch(e) {}
    }
    const _origLogCombat = window.logCombat;
    if (typeof _origLogCombat === 'function') {
        window.logCombat = function(msg, type, src) {
            _origLogCombat(msg, type, src);
            if (type === 'miss' || type === 'dodge') {
                _vfxShowMiss(type);
            }
        };
    }

})();
