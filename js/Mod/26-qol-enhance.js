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
        if (typeof _whSetFilter === 'undefined' || !_whSetFilter) return true;
        return !!(invOrWhItem && invOrWhItem.seteff && invOrWhItem.seteff.slice(0, 2) === _whSetFilter);
    };

    // ---- 3. 傭兵重雇保留 HP 設定（新功能） ----
    // 解散後重新雇用時，保留治癒門檻/停技門檻/喝水門檻設定
    const _origRehireAlly = window.rehireAlly;
    if (typeof _origRehireAlly === 'function') {
        window.rehireAlly = function(slotN) {
            let cur = (player.allies || []).find(a => a && a._slot == slotN);
            let saved = cur ? {
                healHpPct: cur._healHpPct,
                hpSkillPct: cur._hpSkillPct,
                potHpPct: cur._potHpPct
            } : null;
            _origRehireAlly(slotN);
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

    // ---- 4. Miss/Dodge 浮動特效（在 vfx-layer 上顯示 MISS/DODGE 文字） ----
    (function() {
        const _origLogCombat = window.logCombat;
        if (typeof _origLogCombat !== 'function') return;
        (function() {
            let _st = document.getElementById('qol-miss-fx-style');
            if (_st) return;
            _st = document.createElement('style');
            _st.id = 'qol-miss-fx-style';
            _st.textContent = '.vfx-miss-text{position:absolute;font-size:18px;font-weight:700;color:#94a3b8;pointer-events:none;z-index:999;text-shadow:0 1px 3px rgba(0,0,0,0.6);transform:translate(-50%,-50%);animation:qolMissFade 1s ease-out forwards}@keyframes qolMissFade{0%{transform:translate(-50%,-50%) scale(0.8);opacity:1}30%{transform:translate(-50%,-65%) scale(1.15);opacity:1}100%{transform:translate(-50%,-90%) scale(0.9);opacity:0}}.vfx-player-miss{position:absolute;font-size:16px;font-weight:700;color:#94a3b8;pointer-events:none;z-index:1000;text-shadow:0 1px 3px rgba(0,0,0,0.6);transform:translate(-50%,-50%);animation:qolPMissFade 0.9s ease-out forwards}@keyframes qolPMissFade{0%{transform:translate(-50%,-50%) scale(0.8);opacity:1}25%{transform:translate(-50%,-65%) scale(1.1);opacity:1}100%{transform:translate(-50%,-90%) scale(0.9);opacity:0}}';
            document.head.appendChild(_st);
        })();
        let _lastMissTime = 0;
        window.logCombat = function(msg, type, src) {
            _origLogCombat(msg, type, src);
            if (window.__vfxNumOff) return;
            try {
                if (type === 'evade' && src !== 'enemy') { _showPlayerMiss(); return; }
                if (type === 'miss' && src === 'enemy' && msg.indexOf('協力·') === -1) { _showPlayerMiss(); return; }
                if (type === 'miss' || type === 'dodge') {
                    let now = Date.now();
                    if (now - _lastMissTime < 80) return;
                    _lastMissTime = now;
                    let target = (typeof getTarget === 'function') ? getTarget() : null;
                    if (!target) return;
                    let ml = document.getElementById('mob-list');
                    let slot = ml && ml.querySelector('.mob-target[data-uid="' + target.uid + '"]');
                    if (!slot) return;
                    let box = slot.querySelector('.mob-img-inner') || slot.querySelector('.mob-img-wrap') || slot;
                    let r = box.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) return;
                    let layer = document.getElementById('vfx-layer');
                    if (!layer) return;
                    if (layer.childElementCount > 200) return;
                    let el = document.createElement('div');
                    el.className = 'vfx-miss-text';
                    el.textContent = type === 'dodge' ? 'DODGE' : 'MISS';
                    el.style.left = (r.left + r.width / 2) + 'px';
                    el.style.top = (r.top + r.height * 0.3) + 'px';
                    layer.appendChild(el);
                    el.addEventListener('animationend', () => el.remove(), { once: true });
                    setTimeout(() => { if (el.isConnected) el.remove(); }, 1500);
                }
            } catch(e) {}
        };
        function _showPlayerMiss() {
            let now = Date.now();
            if (now - _lastMissTime < 200) return;
            _lastMissTime = now;
            let layer = document.getElementById('vfx-layer');
            if (!layer || layer.childElementCount > 200) return;
            let pr = (typeof _pmCasterRect === 'function') ? _pmCasterRect() : null;
            if (!pr) {
                let bv = document.getElementById('battle-view');
                if (!bv) return;
                let br = bv.getBoundingClientRect();
                if (br.width === 0) return;
                pr = { left: br.left, top: br.top + br.height * 0.82, width: br.width, height: 0 };
            }
            let el = document.createElement('div');
            el.className = 'vfx-player-miss';
            el.textContent = 'MISS';
            el.style.left = (pr.left + pr.width / 2 + (Math.random() * 16 - 8)) + 'px';
            el.style.top = (pr.top - 8 + (Math.random() * 8 - 4)) + 'px';
            layer.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
            setTimeout(() => { if (el.isConnected) el.remove(); }, 1500);
        }
    })();

    // ---- 5. 玩家受傷/治癒浮動數字（在變身 sprite 頭上顯示傷害/治癒值，依類型合併＋隨機飄動）----
    (function() {
        if (typeof player === 'undefined') return;

        let _pQ = [];
        let _prevHp = player.hp;

        (function() {
            let _st = document.getElementById('qol-dmg-fx-style');
            if (_st) return;
            _st = document.createElement('style');
            _st.id = 'qol-dmg-fx-style';
            _st.textContent = '.vfx-heal{position:absolute;transform:translate(-50%,-50%);font-weight:900;font-family:"Arial Black","Segoe UI",system-ui,sans-serif;white-space:nowrap;letter-spacing:.5px;will-change:transform,opacity;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 7px rgba(0,0,0,.55);color:#22c55e;animation:vfxFloat .85s ease-out forwards}';
            document.head.appendChild(_st);
        })();

        if (typeof enemyPhysicalAttack === 'function') {
            const _orig = enemyPhysicalAttack;
            enemyPhysicalAttack = function() {
                let b = player.hp;
                let r = _orig.apply(this, arguments);
                if (b - player.hp > 1 && player.hp > 0) _pQ.push({ dmg: b - player.hp, type: 'phys' });
                return r;
            };
        }

        if (typeof applyMobMagic === 'function') {
            const _orig = applyMobMagic;
            applyMobMagic = function(mob, idx, sk) {
                let b = player.hp;
                let r = _orig.apply(this, arguments);
                if (b - player.hp > 1 && player.hp > 0) _pQ.push({ dmg: b - player.hp, type: 'magic', ele: (sk && sk.ele) || null });
                return r;
            };
        }

        let _lastT = 0;
        function _showDmg(dmg) {
            if (window.__vfxNumOff) return;
            try {
                let now = Date.now();
                if (now - _lastT < 80) return;
                _lastT = now;
                let layer = document.getElementById('vfx-layer');
                if (!layer || layer.childElementCount > 200) return;
                let pr = (typeof _pmCasterRect === 'function') ? _pmCasterRect() : null;
                if (!pr) {
                    let bv = document.getElementById('battle-view');
                    if (!bv) return;
                    let br = bv.getBoundingClientRect();
                    if (br.width === 0) return;
                    pr = { left: br.left, top: br.top + br.height * 0.82, width: br.width, height: 0 };
                }
                let isBig = dmg > player.mhp * 0.25;
                let el = document.createElement('div');
                el.className = 'vfx-dmg' + (isBig ? ' vfx-crit' : '');
                el.style.left = (pr.left + pr.width / 2 + (Math.random() * 20 - 10)) + 'px';
                el.style.top = (pr.top - 10 + (Math.random() * 10 - 5)) + 'px';
                el.style.color = '#ff3b30';
                if (isBig) el.style.fontSize = '24px';
                el.textContent = '-' + (dmg >= 10000 ? (dmg / 1000).toFixed(1) + 'k' : '' + dmg);
                layer.appendChild(el);
                el.addEventListener('animationend', () => el.remove(), { once: true });
                setTimeout(() => { if (el.isConnected) el.remove(); }, 1400);
            } catch(e) {}
        }

        function _showHeal(amount) {
            if (window.__vfxNumOff) return;
            try {
                let now = Date.now();
                if (now - _lastT < 80) return;
                _lastT = now;
                let layer = document.getElementById('vfx-layer');
                if (!layer || layer.childElementCount > 200) return;
                let pr = (typeof _pmCasterRect === 'function') ? _pmCasterRect() : null;
                if (!pr) {
                    let bv = document.getElementById('battle-view');
                    if (!bv) return;
                    let br = bv.getBoundingClientRect();
                    if (br.width === 0) return;
                    pr = { left: br.left, top: br.top + br.height * 0.82, width: br.width, height: 0 };
                }
                let el = document.createElement('div');
                el.className = 'vfx-heal';
                el.style.left = (pr.left + pr.width * 0.35 + (Math.random() * 14 - 7)) + 'px';
                el.style.top = (pr.top - 12 + (Math.random() * 8 - 4)) + 'px';
                el.textContent = '+' + (amount >= 10000 ? (amount / 1000).toFixed(1) + 'k' : '' + amount);
                layer.appendChild(el);
                el.addEventListener('animationend', () => el.remove(), { once: true });
                setTimeout(() => { if (el.isConnected) el.remove(); }, 1400);
            } catch(e) {}
        }

        setInterval(function() {
            try {
                let delta = _prevHp - player.hp;
                _prevHp = player.hp;

                if (_pQ.length === 0) {
                    if (delta > 2) _showDmg(delta);
                    if (delta < -2 && !window.__vfxNumOff) _showHeal(-delta);
                    return;
                }
                let merged = {};
                for (let e of _pQ) {
                    let k = e.type === 'magic' ? 'm_' + (e.ele || '') : 'phys';
                    if (!merged[k]) merged[k] = { dmg: 0, type: e.type, ele: e.ele };
                    merged[k].dmg += e.dmg;
                }
                _pQ = [];
                let qTotal = 0;
                for (let k in merged) qTotal += merged[k].dmg;
                let n = 0;
                for (let k in merged) { if (n++ >= 2) break; _showDmg(merged[k].dmg); }
                let extra = delta - qTotal;
                if (extra > 2 && n < 2) _showDmg(extra);
                if (extra < -2 && n < 2 && !window.__vfxNumOff) _showHeal(-extra);
            } catch(e) {}
        }, 125);
    })();

})();
