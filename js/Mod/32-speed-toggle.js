// ===== ⚡ 加速齒輪恢復（32-speed-toggle.js）=====
// 原本在 01-drops-config.js 中，用作者原始碼覆蓋後遺失
// 此 Mod 補回 toggleGameSpeed 功能：1x / 5x / 20x 三檔切換
//
// 關鍵：gameLoop 使用 _tickDebt 累積制（非固定 interval），
// 改 setInterval 間隔無法改變速度。必須在 _tickDebt 中注入額外等效時間。

let _gameSpeedIdx = 0;
const _gameSpeeds = [1, 5, 20];
const _gameSpeedLabels = ['1x', '5x', '20x'];

function toggleGameSpeed() {
    _gameSpeedIdx = (_gameSpeedIdx + 1) % _gameSpeeds.length;
    _applyGameSpeed();
}

function _applyGameSpeed() {
    let speed = _gameSpeeds[_gameSpeedIdx];
    let lbl = _gameSpeedLabels[_gameSpeedIdx];
    let elLbl = document.getElementById('speed-label');
    let elIcon = document.getElementById('speed-icon');
    if (elLbl) elLbl.textContent = lbl;
    if (elIcon) elIcon.style.color = speed >= 20 ? '#ef4444' : speed >= 5 ? '#facc15' : '';
}

(function installSpeedToggle() {
    if (typeof gameLoop === 'undefined' || typeof _loopLast === 'undefined') {
        setTimeout(installSpeedToggle, 50);
        return;
    }

    const _origGameLoop = gameLoop;
    gameLoop = function() {
        let speed = _gameSpeeds[_gameSpeedIdx] || 1;
        if (speed > 1 && _loopLast != null) {
            let now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            let elapsed = now - _loopLast;
            if (elapsed > 0) {
                _tickDebt += elapsed * (speed - 1);
            }
        }
        _origGameLoop.apply(this, arguments);
    };

    console.log('⚡ 加速齒輪模組已安裝（1x / 5x / 20x）');
})();
