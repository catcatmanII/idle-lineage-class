// ===== ✨ 戰鬥特效增強模組 =====
// 包裝原始 VFX 函式，注入物理斬擊、元素專屬粒子、暴擊強化
// 不修改原始 09-vfx-render.js，透過 Wrapper Pattern 介入
// 開關：window.__vfxEnhanceOff = true 可關閉增強特效
(function() {
    'use strict';
    if (window.__vfxEnhanceOff) return;

    // --- 保存原始函式引用 ---
    const _origVfxImpact = window._vfxImpact;
    if (typeof _origVfxImpact !== 'function') return;   // 原版尚未載入，退出

    // --- 元素粒子配置 ---
    const _ELE_PARTICLE = {
        fire:   { colors: ['#ff7a45','#ffab40','#ff6d00'], drift: 'up' },
        water:  { colors: ['#4fc3f7','#81d4fa','#29b6f6'], drift: 'down' },
        wind:   { colors: ['#9ccc65','#dcedc8','#7cb342'], drift: 'horizontal' },
        earth:  { colors: ['#d8a657','#ffe082','#bf8c30'], drift: 'down' },
        magic:  { colors: ['#ce93d8','#e1bee7','#ab47bc'], drift: 'spread' },
        normal: { colors: ['#f1f5f9','#cbd5e1'],           drift: 'burst' }
    };

    // --- 取 VFX 層 ---
    function _enhLayer() {
        let l = document.getElementById('vfx-layer');
        if (!l) { l = document.createElement('div'); l.id = 'vfx-layer'; document.body.appendChild(l); }
        return l;
    }

    // ============================================================
    //  1. 斜線斬擊特效（物理攻擊限定）
    // ============================================================
    function _vfxSlash(cx, cy, isCrit) {
        try {
            let layer = _enhLayer();
            if (layer.childElementCount >= 200) return;
            let el = document.createElement('div');
            el.className = 'vfx-enh-slash';
            let len = isCrit ? 55 : 36;
            let thick = isCrit ? 3 : 2;
            el.style.left = cx + 'px';
            el.style.top = cy + 'px';
            el.style.width = len + 'px';
            el.style.height = thick + 'px';
            el.style.animation = 'vfxEnhSlash ' + (isCrit ? 0.14 : 0.1) + 's ease-out forwards';
            layer.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
            setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
        } catch(e) {}
    }

    // ============================================================
    //  2. 元素專屬粒子（取代原版通用火花）
    // ============================================================
    function _spawnEleParticles(cx, cy, ele, isCrit) {
        try {
            let layer = _enhLayer();
            if (layer.childElementCount >= 200) return;
            let cfg = _ELE_PARTICLE[ele] || _ELE_PARTICLE.normal;
            let n = isCrit ? 6 : 4;
            for (let i = 0; i < n; i++) {
                let sp = document.createElement('div');
                sp.className = 'vfx-enh-particle vfx-enh-p-' + ele;
                let sz = (isCrit ? 4 : 3) + Math.random() * 3;
                sp.style.width = sz + 'px';
                sp.style.height = sz + 'px';
                sp.style.left = cx + 'px';
                sp.style.top = cy + 'px';
                let col = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
                sp.style.background = col;
                sp.style.boxShadow = '0 0 6px ' + col;
                layer.appendChild(sp);
                // 依元素類型決定飛散方向
                let dx, dy;
                let dist = (isCrit ? 30 : 18) + Math.random() * 22;
                let ang = Math.PI * 2 * Math.random();
                switch (cfg.drift) {
                    case 'up':
                        dx = Math.cos(ang) * dist * 0.6;
                        dy = -Math.abs(Math.sin(ang) * dist) - 4;   // 向上飄
                        break;
                    case 'down':
                        dx = Math.cos(ang) * dist * 0.6;
                        dy = Math.abs(Math.sin(ang) * dist) + 4;    // 向下落
                        break;
                    case 'horizontal':
                        dx = Math.cos(ang) * dist;
                        dy = Math.sin(ang) * dist * 0.3;            // 水平飛散
                        break;
                    case 'spread':
                        dx = Math.cos(ang) * dist;
                        dy = Math.sin(ang) * dist - 4;              // 旋轉擴散
                        break;
                    default: // burst
                        dx = Math.cos(ang) * dist;
                        dy = Math.sin(ang) * dist - 6;
                }
                sp.animate(
                    [ { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
                      { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) scale(0.15) rotate(' + (120 + Math.random() * 180) + 'deg)', opacity: 0 } ],
                    { duration: 250 + Math.random() * 180, easing: 'cubic-bezier(.25,.7,.35,1)' }
                ).onfinish = () => sp.remove();
            }
        } catch(e) {}
    }

    // ============================================================
    //  3. 暴擊震動（輕量版，僅微小水平震動）
    // ============================================================
    function _spawnCritShake() {
        try {
            let layer = _enhLayer();
            let el = document.createElement('div');
            el.className = 'vfx-enh-crit-shake';
            layer.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
            setTimeout(() => { if (el.parentNode) el.remove(); }, 120);
        } catch(e) {}
    }

    // ============================================================
    //  4. 重擊閃光（元素色，非白色）
    // ============================================================
    function _spawnHeavyFlash(cx, cy, ele) {
        try {
            let layer = _enhLayer();
            if (layer.childElementCount >= 200) return;
            let col = (_VFX_ELE_COLOR && _VFX_ELE_COLOR[ele]) || '#ffd54f';
            let el = document.createElement('div');
            el.className = 'vfx-enh-heavy-flash';
            el.style.left = cx + 'px';
            el.style.top = cy + 'px';
            el.style.background = 'radial-gradient(circle, ' + col + ' 0%, transparent 70%)';
            layer.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
            setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
        } catch(e) {}
    }

    // ============================================================
    //  5. 包裝原始 _vfxImpact
    // ============================================================
    window._vfxImpact = function(cx, cy, ele, big) {
        // 呼叫原始（環 + 通用火花）
        _origVfxImpact.call(this, cx, cy, ele, big);

        // 追加增強特效
        let isCrit = big === 'crit';
        let isHeavy = big === 'heavy';

        // 物理斬擊（normal 元素）
        if (ele === 'normal') {
            _vfxSlash(cx, cy, isCrit);
        }

        // 元素專屬粒子（非 normal 時替換原版火花的效果）
        if (ele !== 'normal') {
            _spawnEleParticles(cx, cy, ele, isCrit);
        }

        // 暴擊震動
        if (isCrit) {
            _spawnCritShake();
        }

        // 重擊閃光（元素色）
        if (isHeavy) {
            _spawnHeavyFlash(cx, cy, ele);
        }
    };

})();
