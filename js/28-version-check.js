/* ============================================================================
 * 28-version-check.js — 原作者版本檢查模組
 *
 * 遊戲載入後延遲 3 秒，透過 GitHub API 查詢 shines871/idle-lineage-class
 * 的最新 commit SHA，與上次記錄比對。有更新則在系統日誌提示。
 *   - 每 24 小時最多查一次（localStorage 快取）。
 *   - API 失敗 / file:// 協定 → 靜默跳過，不影響遊戲。
 *   - 零維護：不需要手動更新任何 version.json。
 *
 * 掛接方式：在 index.html 的 </body> 前加一行
 *   <script src="js/28-version-check.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  var UPSTREAM_OWNER = 'shines871';
  var UPSTREAM_REPO  = 'idle-lineage-class';
  var API_URL = 'https://api.github.com/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + '/commits/main';
  var LS_KEY  = 'upstream_commit_sha';
  var LS_TIME = 'upstream_check_time';
  var CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 小時

  setTimeout(checkForUpdate, 3000);

  async function checkForUpdate() {
    try {
      var last = +localStorage.getItem(LS_TIME) || 0;
      if (Date.now() - last < CHECK_INTERVAL_MS) return;
    } catch (e) {}

    if (!/^https?:$/.test(location.protocol)) return;

    try {
      var res = await fetch(API_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) return;
      var data = await res.json();
      var sha = data && data.sha;
      if (!sha) return;

      var prev = localStorage.getItem(LS_KEY);
      if (prev && prev !== sha) {
        try {
          logSys('<span style="color:#fcd34d">🔄 原作者有新版本！請手動重整頁面以取得最新內容。（<a href="https://shines871.github.io/idle-lineage-class/" target="_blank" style="color:#7dd3fc">查看原版</a>）</span>');
        } catch (e) {
          console.log('[VersionCheck] 原作者有新版本，請手動重整。');
        }
      }

      localStorage.setItem(LS_KEY, sha);
      localStorage.setItem(LS_TIME, String(Date.now()));
    } catch (e) {
      // 網路錯誤 → 靜默跳過
    }
  }
})();
