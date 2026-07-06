# Idle Lineage Class

改版說明：地圖詞綴、防作弊、中毒機制、傭兵優化、QoL 浮動數字、加速齒輪、1.8 風格 UI。

## 來源與整合

- **主程式來源**：[shines871/idle-lineage-class](https://github.com/shines871/idle-lineage-class)（作者：秋玥 v3.0.13）
- **離線掛機整合**：[pp771007/idle-lineage-class](https://github.com/pp771007/idle-lineage-class)（改寫自 afk-offline.js）
- **巴哈原始文章**：[idle-lineage-class 討論串](https://forum.gamer.com.tw/C.php?page=1&bsn=84452&snA=8362&tnum=2268)

---

## 模組優化紀錄（2026-07-05 ~ 2026-07-06）

對 11 個額外模組（21-31）進行全面優化：

| 模組 | 變更 | 影響 |
|------|------|------|
| `js/Mod/22-map-modifiers.js` | 移除傭兵同步區塊（~50行），傭兵側由31獨立處理 | 職責分離，減少重複邏輯 |
| `js/Mod/31-map-mod-ally.js` | 新增 `applyGroundEffectsToAlly()` + `clearAllyGroundEffects()` + alliesTick wrapper；修正 allyTryHeal wrapper 缺失 | 傭兵正確套用地面效果（燃燒/冰緩/感電/腐化） |
| `js/Mod/23-anti-cheat.js` | 三次倉庫掃描合併為單次遍歷（Map-based） | 載入時掃描效率提升 ~3x |
| `js/Mod/29-merc-support.js` | 血盟限定/共通增益分支合併為單一循環 | 消除重複程式碼 |
| `js/Mod/27-afk-offline.js` | 提取 `_invDeltaItems` 共用函式；新增區塊目錄 | 降低重複，提升可維護性 |
| `js/Mod/26-qol-enhance.js` | 移除封存的 `getMercDebuffTarget` 註解 | 清理死代碼 |

---

## 🗺️ 地圖詞綴系統 (`js/Mod/22-map-modifiers.js`)

**30 等**後可向席琳神殿 NPC「紮那」開啟，玩家可自由開關。

開啟時隨機生成 **1~2 前綴** + **1~2 後綴**，詞綴全域固定（不隨切地圖改變），持續 30 分鐘後自動關閉。可花 **15 萬金幣**向紮那重骰詞綴。

| 類型 | 作用 | 範例 |
|------|------|------|
| 前綴 | 強化怪物 | HP+25至60%、額外元素/混沌傷害、攻速+15至40%、反射物理/元素、免疫異常/有害狀態、物理/法術減免、全抗+15至40%、頭目狂化 |
| 後綴 | 削弱玩家 | 被擊中毒、怪物暴擊提升、不能回復、燃燒/冰緩/感電/腐化/奉獻地面、元素要害、衰弱、抗性上限、怪物迴避、防禦/命中降低、增益縮短 |

### 三階難度（依席琳模式）

| Tier | 條件 | 強度 |
|------|------|------|
| 0 | 無席琳 | low |
| 1 | 席琳世界 | mid |
| 2 | 瘋狂席琳 | top |

地面效果互斥，最多同時一種。玩家側由 `js/Mod/22-map-modifiers.js` 處理，傭兵側由 `js/Mod/31-map-mod-ally.js` 獨立處理（透過 `applyGroundEffectsToAlly()` 每 tick 套用）。

**掉落獎勵**：每個詞綴 +8至12% 掉落量、+3至5% 稀有度。殺怪時有 1%×掉落量 機率額外掉 1 個物品；殺怪時暫時 ×1.5 稀有度加成。

安全區（村莊、城堡）不出現詞綴。

---

## 🛡️ 防存檔洗裝系統 (`js/Mod/23-anti-cheat.js`)

偵測並標註異常裝備（**不阻止操作，僅標記** ⚠️）。

### 偵測機制

| 類型 | 偵測方式 | 標記 |
|------|----------|------|
| 重複物品 | 倉庫中同 UID 出現 ≥2 次 | ⚠️ 重複物品 |
| 衝裝洗白 | 匯入旧存檔覆蓋衝裝紀錄 | ⚠️ 異常強化 |
| 倉庫版本不匹配 | 匯入旧存檔後倉庫物品版本高於玩家 | ⚠️ 異常倉庫 |

### 運作方式

- **存款時**：`whDeposit` 呼叫後即時掃描倉庫重複 UID，發現立刻標記
- **載入時**：`loadGame` 後一次性掃描背包、裝備、倉庫（重複 UID / 版本不匹配 / 衝裝異常），標記存回 localStorage
- **顯示**：被標註物品在名稱旁顯示 ⚠️（hover 顯示原因）

不影響正常遊戲操作。

---

## ☠️ 中毒機制

### 玩家附加劇毒（黑暗妖精技能）

每次攻擊 50% 機率附加中毒（**劇毒精通**：100% 觸發）。每層中毒每秒造成該次攻擊 **10%** 傷害（**劇毒精通：20%**），持續 5 秒，最多 1 層（取較高傷害並刷新持續時間）。

### 地圖詞綴「被擊中毒」

被怪物擊中時中毒，每秒造成 **5/10/15% 傷害**（依 Tier），持續 5 秒。每次擊中覆蓋刷新。

### 怪物中毒

怪物施放中毒技能時，造成固定毒素傷害，持續數秒。

### 毒性抵抗

裝備或技能提供的毒性抵抗可使中毒傷害減半。

---

## ✨ QoL 改進

### BOSS 優先攻擊

玩家、傭兵、寵物的所有攻擊自動優先鎖定 BOSS。BOSS 出現時即使不是最近目標也會切換攻擊。BOSS 死亡後恢復預設目標邏輯。

設 `window.__bossPriorityOff = true` 可關閉。

### 鎖定物品頂置

背包排序時，鎖定物品（🔒）永遠排在最上方，再按原有規則（強化等級→附魔→名稱）排序。

### 倉庫套裝篩選

倉庫新增第三層下拉選單「席琳套裝篩選」，可依 12 種套裝類型（紅獅/白鳥/鐵衛/麗人/疾風/月光/學徒/魔女/暗影/幻覺/龍血/狂怒）過濾物品。切換主分類時自動清除套裝篩選。

### 傭兵 AI 改進

- **不重複施放**：目標已有相同負面效果時跳過，避免浪費 MP。已有邏輯確認正確（`allyCastNonDamage` 檢查 `targets.every(m => m.st[status.kind] > 0)`）。
- **增益不重複**：傭兵自身或主玩家已有相同增益時不重複施放（`allyMaintainBuffs` 檢查 `ally.buffs[sid] > 0` 和 `player.buffs[sid] > 0`）。

### 浮動戰鬥數字

- **治癒數字**：玩家變身 sprite 頭上浮動顯示治癒量（綠色 `+XXX`），自動合併同 tick 治癒。
- **玩家 MISS**：被怪物 miss/迴避時顯示灰色「MISS」浮動文字。
- **怪物 MISS/DODGE**：怪物迴避或未命中時顯示浮動文字。
- **傷害數字**：玩家受傷時在變身 sprite 頭上顯示紅色傷害數字。
- **開關**：設 `window.__vfxNumOff = true` 關閉所有浮動數字（保留戰鬥訊息）。

### 加速齒輪 (`js/Mod/32-speed-toggle.js`)

遊戲速度三檔切換：**1x / 5x / 20x**。透過在 `gameLoop` 的 `_tickDebt` 中注入額外等效時間實現加速（非 `setInterval` 改速）。

原本內建於 `01-drops-config.js`，以作者原始碼覆蓋後遺失，由 Mod 補回。

---

## 📦 Mod/ 架構

所有功能模組集中於 `js/Mod/` 資料夾，依編號排序載入：

| 模組 | 功能 |
|------|------|
| `00-optimizer.js` | 效能優化：補跑守護、`renderStatusEffects`/`renderDebuffPanel` 節流、wrapper 鏈偵測 |
| `21-skill-tags.js` | 技能標籤系統 |
| `22-map-modifiers.js` | 地圖詞綴系統（前綴/後綴/地面效果/掉落獎勵） |
| `23-anti-cheat.js` | 防存檔洗裝偵測 |
| `24-monster-skills.js` | 怪物技能配置 |
| `26-qol-enhance.js` | QoL 增強（BOSS 優先/套裝篩選/傭兵重雇保留/MISS 特效/浮動數字） |
| `27-afk-offline.js` | 離線掛機整合 |
| `28-version-check.js` | 版本檢查 |
| `29-merc-support.js` | 傭兵自動增益 |
| `30-merc-fix.js` | 傭兵已知問題修復 |
| `31-map-mod-ally.js` | 傭兵地面效果同步 |
| `32-speed-toggle.js` | 加速齒輪 1x/5x/20x |

共用工具函數（`$`、`$$`、`renderBatch`、`showBattleView` 等）位於 `js/00-utils.js`。

---

## 🚀 CI/CD — GitHub Pages 部署

每次 push 到 `master` 分支時，GitHub Actions 自動觸發部署：

1. **checkout** → **上傳 artifact**（整個 repo，排除 `.git`/`.opencode`/`.github`）
2. **Deploy to GitHub Pages** → 以 artifact 內容部署到 `https://catcatmanii.github.io/idle-lineage-class/`

workflow 位於 `.github/workflows/deploy-pages.yml`。

---

## 🎨 1.8 風格 UI

移植參考版的 1.8 原版風格介面：

- **道具欄**：`inventory-1.8.png` 底圖，8 格框架 + 金色滾條
- **技能欄**：`skill-window-1.8.png` 底圖，技能樹框架
- **裝備視窗**：`19-equipment-window.js` 重寫，浮動式裝備詳情面板

CSS 實作於 `css/style.css`（`classic-inventory-*` / `classic-skill-*` 前綴系列）。

---

## 🛡️ 傭兵支援模組 (`js/Mod/29-merc-support.js`)

傭兵自動對隊友（玩家 + 其他傭兵）施放增益法術。零修改來源檔，透過 Wrapper Pattern 包裝 `alliesTick`。

### 運作方式

- 每 **3 秒**（tick%30）檢查一次
- 安全區 / 硬控 / 沉默時不施放
- 僅施放**傭兵已學會**的技能（`ally.skills.includes`）
- 每次施放一個目標，優先玩家
- 每種增益 **per-target 獨立追蹤**持續時間
- 扣除施法傭兵 MP（非目標）

### 支援技能

| 技能ID | 名稱 | 條件 | 備註 |
|--------|------|------|------|
| `sk_berserk` | 狂暴術 | 傭兵需學會 | 7級·meleeDmg+5, ac-10 |
| `sk_bless_wpn` | 祝福魔法武器 | 傭兵需學會 | 共通 |
| `sk_str_up` | 體魄強健術 | 血盟限定 | 同血盟才能施放 |
| `sk_dex_up` | 通暢氣脈術 | 血盟限定 | 同血盟才能施放 |
| `sk_holy_barrier` | 聖結界 | 血盟限定 | 同血盟才能施放 |
| `sk_elf_firewpn` | 火焰武器 | 妖精系 | 火妖學此技能 |
| `sk_elf_windshot` | 風之神射 | 妖精系 | 風妖學此技能 |
| `sk_elf_earthguard` | 大地防護 | 妖精系 | 地妖學此技能 |
| `sk_illu_ogre` | 幻覺：歐吉 | 幻術士 | 幻術士學此技能 |
| `sk_illu_lich` | 幻覺：巫妖 | 幻術士 | 幻術士學此技能 |
| `sk_illu_golem` | 幻覺：鑽石高崙 | 幻術士 | 幻術士學此技能 |
| `sk_illu_insight` | 洞察 | 幻術士 | 幻術士學此技能 |

### 注意事項

- **快照限制**：傭兵招募時的技能快照，沒學的技能不會施放
- **血盟判定**：體魄強健術/通暢氣脈術/聖結界限定同血盟成員（玩家與招募傭兵視為同血盟）
- **MP 消耗**：施法者扣 MP，目標不扣
- **不重複**：目標已有相同 buff 時跳過
- **不衝突**：與現有 `_isMercSelfBuff` 自我增益並行，互不干擾

---

## 🔧 傭兵修復模組 (`js/Mod/30-merc-fix.js`)

暫時補丁，修復主程式中傭兵相關的已知問題。原作者修復後可移除此模組。

### 已修復問題

| # | 問題 | 影響 | 修復方式 |
|---|------|------|----------|
| 1 | `mobEffAC` 弱點精通 AC 減免讀玩家精通 | 傭兵有 `k_weakness` 時弱點曝光的 -3 AC/層 不生效，命中率偏低（最多差 15 AC） | 模組包裝 `mobEffAC`，接受 attacker 參數；改兩處呼叫端傳入 `ally` |
| B | `stretchHitValue` 傭兵不套用 | 傭兵命中值 <8 時走線性截斷而非玩家的非線性曲線，對高 AC 目標命中率偏高 | 改 `06-status-allies.js` L369/L764，`Math.max(0,Math.min(20,...))` → `stretchHitValue(...)` |
| 3 | `buildAlly` 招募時不轉發玩家收藏 | 傭兵缺少卡片/裝備/道具收集冊加成，直到第一次升級才補回 | 模組包裝 `buildAlly`，招募後轉發玩家 `cardDex/equipDex/miscDex` 並重算 |
| 4 | 娃娃全收集六維+1 在招募時未套用 | 同上，`equipCatComplete('doll')` 讀傭兵自身快照 | 同 #3，收藏轉發後重算即生效 |

### 已知限制（不修復）

| 問題 | 說明 |
|------|------|
| 裝備技能洩漏 (`grantSkills`) | 傭兵換身重算時裝備 grantSkills 寫入 `player.grantedSkills`，真實玩家臨時多出技能，直到下次 `recomputeStats` 自動清除。影響輕微且自動修復。 |
| `i_mana` MP 翻倍未套用 | 幻術士傭兵的 `i_mana` 精通（MP 消耗翻倍）在 13 處 inline cost 公式中未檢查。實際效果是傭兵少扣 MP（benefit），影響極小（僅幻術士職業）。 |

### 技術細節

- **mobEffAC 包裝**：新版 `mobEffAC(m, attacker?)` 根據 `attacker.mastery` 判定弱點精通；不傳 attacker 時退回 `player`（向後相容玩家/召喚物）
- **stretchHitValue**：`06-status-allies.js` 兩處命中計算改用 `stretchHitValue()`（`03-combat-core.js:783`），與玩家命中曲線一致
- **buildAlly 包裝**：原始函式後轉發玩家收藏桶並重算，會重算兩次（招募時一次性性能影響可接受）
- **改動**：`06-status-allies.js` L369、L764 各改一行（`Math.max(0,Math.min(20,...))` → `stretchHitValue(...)`）
