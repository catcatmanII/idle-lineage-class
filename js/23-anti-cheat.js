// ===== 🛡️ 防存檔洗裝系統（2026-07·v2 偵測重複UID）=====
// 偵測並標註異常裝備（不阻止操作，僅標記）
// 透過包裝原始函式注入行為，原始檔不動

(function installAntiCheat() {
    if (typeof doEnhance === 'undefined' || typeof whDeposit === 'undefined' || typeof loadGame === 'undefined') {
        setTimeout(installAntiCheat, 50);
        return;
    }

    // --- 儲存原始引用 ---
    const _origDoEnhance = doEnhance;
    const _origWhDeposit = whDeposit;
    const _origLoadGame = loadGame;
    const _origGetItemFullName = getItemFullName;

    // --- 偵測重複 UID：回傳 Set<重複出現的 uid> ---
    function _findDuplicateUids(items) {
        let seen = new Map();
        let dupes = new Set();
        for (let i = 0; i < items.length; i++) {
            let uid = items[i] && items[i].uid;
            if (uid == null) continue;
            if (seen.has(uid)) { dupes.add(uid); }
            else { seen.set(uid, i); }
        }
        return dupes;
    }

    // --- 包裝 doEnhance()：追蹤衝裝序列號 ---
    doEnhance = function(targetUid, isEq) {
        if (player._enhanceSeq == null) player._enhanceSeq = 0;
        player._enhanceSeq++;

        let _oldEn = 0;
        let _target = null;
        if (isEq) {
            _target = Object.values(player.eq).find(e => e && e.uid === targetUid);
        } else {
            _target = player.inv.find(i => i.uid === targetUid);
        }
        if (_target) _oldEn = Number(_target.en) || 0;

        _origDoEnhance.apply(this, arguments);

        if (_target) {
            let _newEn = Number(_target.en) || 0;
            if (_newEn > _oldEn) {
                _target._cheatSeq = player._enhanceSeq;
            }
        }
    };

    // --- 包裝 whDeposit()：存款時即時偵測重複 UID ---
    whDeposit = function(uidv, qty) {
        let _invBefore = player.inv.length;

        _origWhDeposit.apply(this, arguments);

        // 存入成功（物品離開背包）→ 偵測倉庫重複 UID
        if (player.inv.length < _invBefore || player.inv.findIndex(i => i.uid === uidv) < 0) {
            try {
                let w = loadWarehouse();
                if (w && w.items && w.items.length > 1) {
                    let dupes = _findDuplicateUids(w.items);
                    if (dupes.size > 0) {
                        let dirty = false;
                        w.items.forEach(it => {
                            if (it && dupes.has(it.uid) && !it._cheatFlag) {
                                it._cheatFlag = '⚠️ 重複物品';
                                dirty = true;
                                let d = DB.items[it.id];
                                let name = d ? d.n : it.id;
                                logCombat(`<span class="text-red-400">⚠️ 偵測到重複物品：${name}（UID 重複）</span>`, 'enemy');
                            }
                        });
                        if (dirty) saveWarehouse(w);
                    }
                }
            } catch(e) {}
        }
    };

    // --- 包裝 loadGame()：後置掃描異常裝備 ---
    loadGame = function() {
        _origLoadGame.apply(this, arguments);
        try { _postLoadScan(); } catch(e) {}
    };

    // --- 載入時一次性掃描（設定標記後存回倉庫）---
    function _postLoadScan() {
        if (player._enhanceSeq == null) player._enhanceSeq = 0;
        if (player._whVersion == null) player._whVersion = 0;

        // 掃描背包 + 已裝備（僅設定標記，不需寫回）
        if (Array.isArray(player.inv)) {
            player.inv.forEach(item => { if (item) _checkItem(item); });
        }
        if (player.eq) {
            Object.values(player.eq).forEach(item => { if (item) _checkItem(item); });
        }

        // 掃描倉庫（單次遍歷完成三種偵測）
        try {
            let w = loadWarehouse();
            if (w && w.items) {
                let dirty = false;

                // 第一遍：建立 UID 出現次數 Map
                let uidCount = new Map();
                w.items.forEach(it => {
                    if (it && it.uid != null) {
                        uidCount.set(it.uid, (uidCount.get(it.uid) || 0) + 1);
                    }
                });

                // 第二遍：單次遍歷完成三種標記
                w.items.forEach(it => {
                    if (!it || it._cheatFlag) return;

                    // 1. 重複 UID 偵測
                    if (it.uid != null && uidCount.get(it.uid) > 1) {
                        it._cheatFlag = '⚠️ 重複物品';
                        dirty = true;
                        let d = DB.items[it.id];
                        logCombat(`<span class="text-red-400">⚠️ 偵測到重複物品：${d ? d.n : it.id}（UID 重複）</span>`, 'enemy');
                        return;
                    }

                    // 2. 版本不匹配偵測
                    if (it._cheatWhVer && it._cheatWhVer > player._whVersion) {
                        it._cheatFlag = '⚠️ 異常倉庫';
                        dirty = true;
                        let d = DB.items[it.id];
                        logCombat(`<span class="text-red-400">⚠️ 偵測到異常倉庫物品：${d ? d.n : it.id}（版本不匹配）</span>`, 'enemy');
                        return;
                    }

                    // 3. 衝裝異常偵測
                    if (it._cheatSeq && it._cheatSeq > player._enhanceSeq) {
                        it._cheatFlag = '⚠️ 異常強化';
                        dirty = true;
                        let d = DB.items[it.id];
                        logCombat(`<span class="text-red-400">⚠️ 偵測到異常裝備：${d ? d.n : it.id}（序列號不匹配）</span>`, 'enemy');
                    }
                });

                if (dirty) saveWarehouse(w);
            }
        } catch(e) {}
    }

    function _checkItem(item) {
        // 衝裝異常：裝備的 _cheatSeq > 玩家的 _enhanceSeq
        if (item._cheatSeq && item._cheatSeq > player._enhanceSeq) {
            item._cheatFlag = '⚠️ 異常強化';
            let d = DB.items[item.id];
            let name = d ? d.n : item.id;
            logCombat(`<span class="text-red-400">⚠️ 偵測到異常裝備：${name}（序列號不匹配）</span>`, 'enemy');
        }
    }

    // --- 包裝 getItemFullName()：被標註裝備顯示 ⚠️ ---
    getItemFullName = function(item) {
        let result = _origGetItemFullName.apply(this, arguments);
        if (item && item._cheatFlag) {
            return result + ` <span class="text-red-500 text-xs" title="${item._cheatFlag}">⚠️</span>`;
        }
        return result;
    };

    console.log('🛡️ 防存檔洗裝系統 v2 已安裝（重複UID偵測）');
})();
