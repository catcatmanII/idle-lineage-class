/**
 * 24-monster-skills.js — 怪物技能系統
 * 
 * 功能：
 * 1. 從參考站獲取的使用率資料，更新現有魔法怪物的技能使用率
 * 2. 集中管理怪物技能資料
 * 3. 提供怪物技能查詢和更新功能
 * 
 * 範圍：
 * - 僅更新現有魔法怪物（約100隻）的使用率
 * - 不為非魔法怪物添加新技能
 * - 保持00-data.js 的 mag 定義不動
 */
(function() {
    'use strict';

    // ========== 參考站使用率資料 ==========
    // 格式：{ [monsterKey]: { [skillName]: usageRate } }
    // 使用率為小數（0.5 = 50%）
    const USAGE_RATE_MAP = {
        // 從參考站抓取的使用率資料
        'harpy': { '木乃伊的咀咒': 1.0, '吸血鬼之吻': 1.0 },  // 哈維：100% + 100%
        'dark_elf': { '龍捲風': 0.6 },  // 黑暗精靈：60%
        'doppel_boss': { '冰雪暴': 0.7, '火風暴': 0.3 },  // 變形怪首領：70% + 30%
        'orc_mage': { '燃燒的火球': 1.0 },  // 妖魔法師：100%
        
        // 以下為推斷的使用率（基於怪物等級和類型）
        'nm_002': { '中毒': 0.3 },  // 蘑菇：30%
        'nm_006': { '落石術': 0.2 },  // 安普長老：20%
        'nm_007': { '中毒': 0.3 },  // 污染的安特：30%
        'floating_eye': { '木乃伊的詛咒': 0.5 },  // 漂浮之眼：50%
        'orc_zombie': { '中毒': 0.3 },  // 妖魔殭屍：30%
        'roach': { '中毒': 0.3 },  // 蟑螂人：30%
        'ghoul': { '麻痺': 0.2 },  // 食屍鬼：20%
        'ungoliant': { '中毒': 0.3 },  // 楊果里恩：30%
        'starfish': { '麻痺': 0.2 },  // 海星：20%
        'elder': { '極道落雷': 0.3 },  // 長老：30%
        'gaster': { '沉默': 0.5 },  // 卡司特：50%
        'ogre': { '火牢': 0.1 },  // 食人妖精：10%
        'cerberus': { '噴火': 0.3 },  // 地獄犬：30%
        'sildeis': { '漩渦': 0.3 },  // 希爾黛斯：30%
        'scorpion': { '中毒': 0.5 },  // 毒蠍：50%
        'succubus': { '吸血鬼之吻': 0.5 },  // 思克巴：50%
        'succubus_queen': { '吸血鬼之吻': 0.5 },  // 思克巴女皇：50%
        'giant_ancient': { '震裂術': 0.35 },  // 古代巨人：35%
        'ogre_king': { '火牢': 0.1 },  // 食人妖精王：10%
        'nm_015': { '冰錐': 0.3 },  // 艾爾摩法師：30%
        'gaster_king': { '沉默': 0.5 },  // 卡司特王：50%
        'beholder': { '木乃伊的詛咒': 0.5 },  // 多眼怪：50%
        'arian': { '石化光線': 0.5 },  // 亞力安：50%
        'aruba': { '加速術': 0.3 },  // 阿魯巴：30%
        'evil_lizard': { '石化噴吐': 0.3 },  // 邪惡蜥蜴：30%
        'necromancer': { '極光雷電': 0.5 },  // 巫師：50%
        'lava_golem': { '燃燒的火球': 0.3 },  // 熔岩高崙：30%
        'nm_028': { '爆炎的火球': 0.5 },  // 夢幻之島火精靈王：50%
        'nm_029': { '水柱': 0.5 },  // 夢幻之島水精靈王：50%
        'nm_030': { '龍捲風': 0.5 },  // 夢幻之島風精靈王：50%
        'nm_031': { '巨石之擊': 0.5 },  // 夢幻之島地精靈王：50%
        'nm_038': { '中毒': 0.3 },  // 夢幻之島蘑菇：30%
        'nm_042': { '冰錐': 0.3 },  // 夢幻之島暴走兔：30%
        'ice_queen': { '冰雪暴': 0.3, '寒冰吐息': 0.2, '冰錐': 0.5 },  // 冰之女王：30% + 20% + 50%
        'ice_demon': { '冰裂術': 0.3, '雷霆風暴': 0.2, '衝擊之暈': 0.5 },  // 冰魔：30% + 20% + 50%
        'batus': { '地裂術': 0.5 },  // 巴土瑟：50%
        'casper': { '燃燒的火球': 0.5 },  // 卡士柏：50%
        'marcus': { '光箭': 0.5 },  // 馬庫爾：50%
        'ifrit': { '火之矛': 0.5 },  // 伊弗利特：50%
        'fire_beast': { '火焰噴吐': 0.5 },  // 烈炎獸：50%
        'wyvern': { '火焰噴吐': 0.5 },  // 飛龍：50%
        'blackelder': { '龍捲風': 0.3, '靈光箭': 0.7 },  // 黑長者：30% + 70%
        'baphomet': { '地裂術': 0.5, '震裂術': 0.4 },  // 巴風特：50% + 40%
        'kurt': { '盾擊': 0.3, '極道落雷': 0.2 },  // 克特：30% + 20%
        'dk': { '地面震裂': 0.2, '吸血鬼之吻': 0.3, '光球': 0.2 },  // 死亡騎士：20% + 30% + 20%
        'ant_queen': { '震裂術': 0.5 },  // 巨蟻女皇：50%
        'phoenix': { '火焰雨': 0.2, '流星雨': 0.2 },  // 不死鳥：20% + 20%
        'nm_034': { '火焰之舞': 0.3, '禁地封印': 0.3, '地面震裂': 0.2 },  // 惡魔：30% + 30% + 20%
        'antaras': { '毒氣風暴': 0.2, '地裂術': 0.5, '大地怒吼': 0.3 },  // 安塔瑞斯：20% + 50% + 30%
        'fafurion': { '巨水炮': 0.5, '寒冰噴吐': 0.3, '冰裂術': 0.5 },  // 法利昂：50% + 30% + 50%
        'valakas': { '火牢': 0.1, '流星雨': 0.2, '火焰噴吐': 0.2 },  // 巴拉卡斯：10% + 20% + 20%
        'lindvior': { '封印禁地': 0.1, '閃電風暴': 0.5, '電擊': 0.5 },  // 林德拜爾：10% + 50% + 50%
        'sema': { '極光雷電': 0.5 },  // 西瑪：50%
        'thebes_kebis_b': { '中毒': 0.5 },  // 底比斯 凱比斯(黑)：50%
        'thebes_kebis_r': { '中毒': 0.5 },  // 底比斯 凱比斯(紅)：50%
        'thebes_obelisk': { '龍捲風': 0.5 },  // 底比斯 尖碑石奴：50%
        'thebes_obelisk_b': { '龍捲風': 0.5 },  // 底比斯 尖碑石奴(黑)：50%
        'thebes_sphinx': { '彩虹波動': 0.5 },  // 底比斯 斯芬克斯：50%
        'thebes_sphinx_b': { '彩虹波動': 0.5 },  // 底比斯 斯芬克斯(黑)：50%
        'thebes_nehos': { '火球': 0.5 },  // 底比斯 尼荷斯：50%
        'thebes_nehos_b': { '火球': 0.5 },  // 底比斯 尼荷斯(藍)：50%
        'thebes_bas': { '雷霆風暴': 0.5 },  // 底比斯 巴斯：50%
        'thebes_bas_r': { '雷霆風暴': 0.5 },  // 底比斯 巴斯(紅)：50%
        'thebes_anubis': { '震裂踏擊': 0.5, '審判之雷': 0.5 },  // 底比斯 阿努比斯：50% + 50%
        'thebes_horus': { '火焰放射': 0.5, '火球': 0.5 },  // 底比斯 賀洛斯：50% + 50%
        'de_remnant_mage': { '冰錐': 0.5, '龍捲風': 0.2 },  // 黑暗妖精殘兵(法師)：50% + 20%
        'dark_spirit_caller': { '邪靈之氣': 0.3, '召喚闇之精靈': 0.5 },  // 黑暗精靈使：30% + 50%
        'de_gate_apprentice': { '冰錐': 0.5 },  // 黑暗妖精魔法學徒：50%
        'de_train_hellhound': { '火焰噴吐': 0.5 },  // 地獄束縛犬：50%
        'de_train_soulknight': { '地面震裂': 0.5 },  // 魂騎士：50%
        'de_lab_mage': { '冰錐': 0.5, '龍捲風': 0.5 },  // 黑暗妖精法師：50% + 50%
        'de_lab_blackmage': { '極寒冰錐': 0.5 },  // 黑法師：50%
        'de_necro_warlock': { '黑霧': 0.5 },  // 血色術士：50%
        'de_necro_darklord': { '火焰氣息': 0.5 },  // 闇黑君王：50%
        'de_necro_bloodknight': { '迴旋斬': 0.4 },  // 血騎士：40%
        'de_elder_captain': { '放射斬': 0.5 },  // 拉斯塔巴德近衛隊隊長：50%
        'de_elder_follower': { '光球．闇': 0.5 },  // 長老隨從：50%
        'de_elder_kina': { '迴旋鞭打': 0.5, '光球．闇': 0.6 },  // 長老．琪娜：50% + 60%
        'de_elder_andis': { '衝擊波動': 0.5 },  // 長老．安迪斯：50%
    };

    // ========== 技能名稱對應表 ==========
    // 格式：{ [referenceSiteName]: internalSkillName }
    const SKILL_NAME_MAP = {
        // 參考站技能名 → 遊戲內技能名
        '木乃伊的咀咒': '木乃伊的詛咒',  // 參考站用「咀咒」，遊戲用「詛咒」
        '妖魔法師-燃燒的火球': '燃燒的火球',
        '哈維-木乃伊的咀咒': '木乃伊的詛咒',
        '哈維-吸血鬼之吻': '吸血鬼之吻',
        '黑暗精靈-龍捲風': '龍捲風',
        '變形怪首領-冰雪暴': '冰雪暴',
        '變形怪首領-火風暴': '火風暴',
    };

    // ========== 冷卻時間平衡 ==========
    // 狀態異常技能：固定冷卻 100 tick（10 秒）
    const STATUS_COOLDOWNS = {
        poison: 100, paralyze: 100, magicseal: 100,
        stone: 100, stun: 100, freeze: 100,
        burn: 100, scald: 100, slowatk: 100
    };

    /**
     * 計算技能冷卻時間（tick）
     * 原則：傷害越高冷卻越長，狀態異常固定 10 秒
     * @param {Object} skill - 技能物件（mag/mag2/mag3）
     * @returns {number} 冷卻時間（tick，100 = 10 秒）
     */
    function calculateCooldown(skill) {
        // 1. 狀態異常技能：固定冷卻
        if (skill.type && STATUS_COOLDOWNS[skill.type]) {
            return STATUS_COOLDOWNS[skill.type];
        }
        // 2. 自身增益：較長冷卻
        if (skill.type === 'self_haste') return 140;
        if (skill.type === 'self_buff') return 180;
        if (skill.type === 'pledge_bless') return 120;
        // 3. 傷害技能：依 dice 數分級
        if (skill.dmg) {
            const diceCount = skill.dmg[0] || 1;
            if (diceCount <= 2) return 30;   // 3 秒
            if (diceCount <= 4) return 50;   // 5 秒
            if (diceCount <= 6) return 70;   // 7 秒
            return 90;                        // 9 秒
        }
        // 4. 預設
        return 50;
    }

    // ========== 隨機打亂技能順序 ==========
    /**
     * Fisher-Yates 洗牌：打亂 mag/mag2/mag3 順序
     * 同步打亂冷卻計數器，確保每個技能的冷卻獨立
     * @param {Object} mob - 怪物物件
     */
    function shuffleMonsterSkills(mob) {
        const slots = ['mag', 'mag2', 'mag3'];
        // 收集已定義的技能和冷卻
        const skills = slots.map(s => mob[s]);
        const cooldowns = slots.map(s => mob._magCd[s]);
        // Fisher-Yates 洗牌（同步打亂技能和冷卻）
        for (let i = skills.length - 1; i > 0; i--) {
            if (!skills[i]) continue;
            const j = Math.floor(Math.random() * (i + 1));
            [skills[i], skills[j]] = [skills[j], skills[i]];
            [cooldowns[i], cooldowns[j]] = [cooldowns[j], cooldowns[i]];
        }
        // 寫回
        slots.forEach((s, i) => {
            mob[s] = skills[i];
            mob._magCd[s] = cooldowns[i];
        });
    }

    // ========== 更新怪物技能使用率 ==========
    /**
     * 更新怪物的技能使用率，並平衡冷卻時間、打亂技能順序
     * @param {Object} mob - 怪物物件
     * @returns {boolean} 是否有更新
     */
    function updateMonsterSkillRates(mob) {
        if (!mob || !mob.key) return false;
        
        const rates = USAGE_RATE_MAP[mob.key];
        if (!rates) return false;
        
        let updated = false;
        
        // 1. 更新使用率
        if (mob.mag && mob.mag.skn) {
            const skillName = SKILL_NAME_MAP[mob.mag.skn] || mob.mag.skn;
            if (rates[skillName] !== undefined) {
                mob.mag.chance = rates[skillName];
                updated = true;
            }
        }
        if (mob.mag2 && mob.mag2.skn) {
            const skillName = SKILL_NAME_MAP[mob.mag2.skn] || mob.mag2.skn;
            if (rates[skillName] !== undefined) {
                mob.mag2.chance = rates[skillName];
                updated = true;
            }
        }
        if (mob.mag3 && mob.mag3.skn) {
            const skillName = SKILL_NAME_MAP[mob.mag3.skn] || mob.mag3.skn;
            if (rates[skillName] !== undefined) {
                mob.mag3.chance = rates[skillName];
                updated = true;
            }
        }
        
        // 2. 平衡冷卻時間（僅有技能的怪物）
        if (mob.mag && mob.mag.skn) mob.mag.cd = calculateCooldown(mob.mag);
        if (mob.mag2 && mob.mag2.skn) mob.mag2.cd = calculateCooldown(mob.mag2);
        if (mob.mag3 && mob.mag3.skn) mob.mag3.cd = calculateCooldown(mob.mag3);
        
        // 3. 打亂技能順序（隨機施放）
        shuffleMonsterSkills(mob);
        
        return updated;
    }

    // ========== 查詢怪物技能 ==========
    /**
     * 取得怪物的技能使用率資料
     * @param {string} monsterKey - 怪物 key
     * @returns {Object|null} 技能使用率資料
     */
    function getMonsterSkillRates(monsterKey) {
        return USAGE_RATE_MAP[monsterKey] || null;
    }

    /**
     * 取得所有有技能資料的怪物列表
     * @returns {Array} 怪物 key 陣列
     */
    function getMonstersWithSkills() {
        return Object.keys(USAGE_RATE_MAP);
    }

    // ========== 包裹 spawnMob ==========
    // 在怪物生成時套用：更新使用率 + 平衡冷卻 + 打亂技能順序
    if (typeof window.spawnMob === 'function') {
        const _origSpawnMob = window.spawnMob;
        window.spawnMob = function(idx) {
            _origSpawnMob.apply(this, arguments);
            try {
                if (typeof mapState !== 'undefined' && mapState.mobs && mapState.mobs[idx]) {
                    const mob = mapState.mobs[idx];
                    // 初始化冷卻槽位（確保 _magCd 有對應 key，供洗牌同步）
                    if (mob.mag) mob._magCd.mag = mob._magCd.mag ?? mob.mag.cd;
                    if (mob.mag2) mob._magCd.mag2 = mob._magCd.mag2 ?? mob.mag2.cd;
                    if (mob.mag3) mob._magCd.mag3 = mob._magCd.mag3 ?? mob.mag3.cd;
                    // 更新使用率 + 平衡冷卻 + 打亂技能順序
                    updateMonsterSkillRates(mob);
                }
            } catch(e) {
                console.error('[MonsterSkills] 更新怪物技能時發生錯誤:', e);
            }
        };
        console.log('[MonsterSkills] spawnMob 已包裹，怪物技能使用率/冷卻/順序將自動更新');
    }

    // ========== 匯出 API ==========
    window.MonsterSkills = {
        updateMonsterSkillRates,
        getMonsterSkillRates,
        getMonstersWithSkills,
        calculateCooldown,
        shuffleMonsterSkills,
        USAGE_RATE_MAP,
        SKILL_NAME_MAP,
        STATUS_COOLDOWNS,
    };

    console.log('[MonsterSkills] 怪物技能系統已載入，共定義 ' + Object.keys(USAGE_RATE_MAP).length + ' 隻怪物的技能使用率');
})();
