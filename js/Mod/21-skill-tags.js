// 技能標籤系統（模組化）
// 於 00-data.js 載入後執行，動態注入 tags 至 DB.SKILL_DATA
// 可獨立修改/擴充，不影響上游 00-data.js

const SKILL_TAGS = {
  // ================= 【法師魔法】 =================
  // 一階 (Lv 4)
  "sk_sunlight": ["持續時間"],
  "sk_shield": ["守護", "持續時間"],
  "sk_lightarrow": ["法術", "神聖", "投射物", "攻擊"],
  "sk_teleport": ["閃現"],
  "sk_icearrow": ["法術", "冰冷", "投射物", "攻擊"],
  "sk_windblade": ["法術", "閃電", "攻擊"],
  "sk_holy_wpn": ["神聖", "守護", "持續時間"],
  // 二階 (Lv 8)
  "sk_cold_shiver": ["法術", "冰冷", "攻擊"],
  "sk_poison_curse": ["法術", "詛咒", "混沌", "攻擊"],
  "sk_ench_wpn": ["守護", "持續時間"],
  "sk_reveal": ["持續時間"],
  "sk_load_up": ["守護", "持續時間"],
  "sk_firearrow": ["法術", "火焰", "投射物", "攻擊"],
  "sk_hell_fang": ["法術", "打擊", "攻擊"],
  // 三階 (Lv 12)
  "sk_aurora": ["法術", "閃電", "範圍效果", "攻擊"],
  "sk_undead_bane": ["法術", "神聖", "攻擊"],
  "sk_dark_blind": ["法術", "詛咒", "攻擊"],
  "sk_shield2": ["守護", "持續時間"],
  "sk_chill": ["法術", "冰冷", "範圍效果", "攻擊"],
  "sk_energy_sense": ["秘能"],
  // 四階 (Lv 16)
  "sk_fireball": ["法術", "火焰", "範圍效果", "攻擊"],
  "sk_dex_up": ["持續時間"],
  "sk_break": ["法術", "詛咒", "攻擊"],
  "sk_vampire": ["法術", "攻擊"],
  "sk_slow": ["法術", "詛咒", "攻擊"],
  "sk_holy_lightning": ["法術", "神聖", "閃電", "觸發", "攻擊"],
  "sk_rock_prison": ["法術", "打擊", "範圍效果", "攻擊"],
  "sk_magic_shield": ["守護", "持續時間"],
  "sk_meditation": ["持續時間"],
  // 五階 (Lv 20)
  "sk_mummy_curse": ["法術", "詛咒", "攻擊"],
  "sk_charm": ["混沌"],
  "sk_thunder": ["法術", "閃電", "攻擊"],
  "sk_holy_light": ["神聖"],
  "sk_ice_spike": ["法術", "冰冷", "攻擊"],
  "sk_demon_kiss": ["法術", "打擊", "觸發", "攻擊"],
  "sk_mana_drain": ["法術", "秘能"],
  "sk_dark_shadow": ["法術", "詛咒", "攻擊"],
  // 六階 (Lv 24)
  "sk_zombie": ["召喚物", "持續時間"],
  "sk_haste_spell": ["閃現", "持續時間"],
  "sk_cancel": ["法術"],
  "sk_earthquake": ["法術", "打擊", "攻擊"],
  "sk_blaze": ["法術", "火焰", "攻擊"],
  "sk_str_up": ["持續時間"],
  "sk_bless_wpn": ["神聖", "守護", "持續時間"],
  "sk_weaken": ["法術", "詛咒", "攻擊"],
  // 七階 (Lv 28)
  "sk_regen": ["持續時間"],
  "sk_greater_haste": ["閃現", "持續時間"],
  "sk_ice_lance": ["法術", "冰冷", "攻擊"],
  "sk_tornado": ["法術", "閃電", "範圍效果", "新星", "攻擊"],
  "sk_berserk": ["暴擊", "持續時間"],
  "sk_summon": ["召喚物", "持續時間"],
  "sk_holy_dash": ["神聖", "閃現", "持續時間"],
  "sk_disease": ["法術", "詛咒", "攻擊"],
  // 八階 (Lv 32)
  "sk_blizzard": ["法術", "冰冷", "範圍效果", "新星", "攻擊"],
  "sk_blizzard_storm": ["法術", "冰冷", "範圍效果", "持續時間", "攻擊"],
  "sk_fire_prison": ["法術", "火焰", "範圍效果", "持續時間", "攻擊"],
  "sk_quake": ["法術", "打擊", "範圍效果", "攻擊"],
  "sk_invisible": ["持續時間"],
  "sk_resurrection": ["神聖"],
  "sk_seal": ["法術", "詛咒", "攻擊"],
  // 九階 (Lv 36)
  "sk_holy_barrier": ["神聖", "守護", "持續時間"],
  "sk_sleep_mist": ["法術", "混沌", "範圍效果", "攻擊"],
  "sk_thunder_storm": ["法術", "閃電", "範圍效果", "連鎖", "攻擊"],
  "sk_fire_storm": ["法術", "火焰", "範圍效果", "新星", "攻擊"],
  // 十階 (Lv 40)
  "sk_meteor": ["法術", "火焰", "範圍效果", "攻擊"],
  "sk_soul_up": ["持續時間"],
  "sk_abs_barrier": ["守護", "持續時間"],
  "sk_disintegrate": ["法術", "神聖", "攻擊"],

  // ================= 【騎士技術】 =================
  "sk_solid_shield": ["守護", "持續時間"],
  "sk_reduction_armor": ["守護", "持續時間"],
  "sk_shock_stun": ["物理", "攻擊", "持續時間"],
  "sk_spike_armor": ["復仇", "持續時間"],
  "sk_counter_barrier": ["復仇", "持續時間"],

  // ================= 【妖精精靈魔法】 =================
  // 一階 (Lv 10)
  "sk_elf_mr": ["守護", "持續時間"],
  "sk_elf_mind": ["秘能"],
  "sk_elf_worldtree": ["守護"],
  "sk_elf_triple": ["物理", "弓箭", "攻擊", "連鎖"],
  // 二階 (Lv 20)
  "sk_elf_purify": ["持續時間"],
  "sk_elf_eleres": ["守護", "持續時間"],
  "sk_elf_release": ["法術", "攻擊"],
  "sk_elf_soul": ["秘能"],
  // 三階 (Lv 30)
  "sk_elf_singleres": ["守護", "持續時間"],
  "sk_elf_firewpn": ["火焰", "守護", "持續時間"],
  "sk_elf_windshot": ["閃電", "弓箭", "持續時間"],
  "sk_elf_winddash": ["閃現", "持續時間"],
  "sk_elf_earthguard": ["打擊", "守護", "持續時間"],
  "sk_elf_groundtrap": ["法術", "打擊", "範圍效果", "詛咒", "攻擊"],
  "sk_elf_watervital": ["冰冷", "守護", "持續時間"],
  // 四階 (Lv 40)
  "sk_elf_magicerase": ["法術", "詛咒", "攻擊"],
  "sk_elf_summon": ["召喚物", "持續時間"],
  "sk_elf_dancefire": ["火焰", "守護", "持續時間"],
  "sk_elf_stormeye": ["閃電", "弓箭", "持續時間"],
  "sk_elf_earthshield": ["打擊", "守護", "持續時間"],
  "sk_elf_lifespring": ["冰冷"],
  "sk_elf_earthbless": ["打擊", "守護", "持續時間"],
  // 五階 (Lv 50)
  "sk_elf_summon2": ["召喚物", "持續時間"],
  "sk_elf_lifebless": ["冰冷", "持續時間"],
  "sk_elf_seal": ["法術", "詛咒", "攻擊"],
  "sk_elf_blazewpn": ["火焰", "守護", "持續時間"],
  "sk_elf_flamesoul": ["火焰", "暴擊", "持續時間"],
  "sk_elf_stormshot": ["物理", "閃電", "弓箭", "持續時間"],
  "sk_elf_preciseshot": ["物理", "弓箭", "持續時間"],
  "sk_elf_steelguard": ["守護", "光環", "持續時間"],
  "sk_elf_attrfire": ["火焰", "暴擊", "持續時間"],
  "sk_elf_physboost": ["持續時間"],
  "sk_elf_energyboost": ["持續時間"],
  "sk_elf_mirror": ["復仇", "持續時間"],

  // ================= 【黑暗妖精魔法】 =================
  // 一階 (Lv 15)
  "sk_dark_str": ["持續時間"],
  "sk_dark_mrup": ["守護", "持續時間"],
  "sk_dark_stealth": ["持續時間"],
  "sk_dark_poison": ["詛咒", "混沌", "持續時間"],
  // 二階 (Lv 30)
  "sk_dark_dex": ["持續時間"],
  "sk_dark_poisonres": ["守護", "持續時間"],
  "sk_dark_burn": ["暴擊", "持續時間"],
  "sk_dark_walkhaste": ["閃現", "持續時間"],
  // 三階 (Lv 45)
  "sk_dark_fang": ["守護", "持續時間"],
  "sk_dark_dodge": ["守護", "持續時間"],
  "sk_dark_crit": ["物理", "暴擊", "攻擊"],
  "sk_dark_erup": ["守護", "持續時間"],
  "sk_dark_double": ["暴擊", "持續時間"],
  "sk_dark_armorbreak": ["物理", "詛咒", "攻擊"],

  // ================= 【幻術士 記憶水晶法術】 =================
  // 一階
  "sk_illu_ogre": ["召喚物", "秘能", "持續時間"],
  "sk_illu_confuse": ["法術", "混沌", "攻擊"],
  "sk_illu_cube_burn": ["秘能", "火焰", "持續時間"],
  "sk_illu_crush": ["秘能", "物理", "攻擊"],
  "sk_illu_mirror": ["秘能", "守護", "持續時間"],
  // 二階
  "sk_illu_focus": ["秘能", "持續時間"],
  "sk_illu_lich": ["召喚物", "秘能", "持續時間"],
  "sk_illu_mindbreak": ["法術", "秘能", "攻擊"],
  "sk_illu_cube_quake": ["秘能", "打擊", "持續時間"],
  "sk_illu_skullbreak": ["物理", "神聖", "攻擊"],
  // 三階
  "sk_illu_fantasy": ["法術", "混沌", "攻擊"],
  "sk_illu_golem": ["召喚物", "秘能", "守護", "持續時間"],
  "sk_illu_cube_shock": ["秘能", "詛咒", "持續時間"],
  "sk_illu_endure": ["秘能", "守護", "持續時間"],
  // 四階
  "sk_illu_avatar": ["秘能", "光環", "持續時間"],
  "sk_illu_panic": ["法術", "混沌", "攻擊"],
  "sk_illu_insight": ["秘能", "持續時間"],
  "sk_illu_cube_harmony": ["秘能", "火焰", "持續時間"],
  "sk_illu_pain": ["秘能", "復仇", "持續時間"],

  // ================= 【龍騎士 龍魔法】 =================
  // 一階 (Lv 15)
  "sk_dragon_armor": ["守護", "持續時間"],
  "sk_dragon_flameslash": ["火焰", "持續時間"],
  "sk_dragon_guardbreak": ["物理", "攻擊"],
  "sk_dragon_lavaspit": ["法術", "火焰", "範圍效果", "攻擊"],
  "sk_dragon_awaken_antares": ["守護", "持續時間"],
  // 二階 (Lv 30)
  "sk_dragon_bloodlust": ["持續時間"],
  "sk_dragon_slaughter": ["物理", "連鎖", "攻擊"],
  "sk_dragon_terror": ["混沌", "攻擊"],
  "sk_dragon_lavabolt": ["法術", "火焰", "攻擊"],
  "sk_dragon_awaken_falion": ["守護", "持續時間"],
  // 三階 (Lv 45)
  "sk_dragon_deadlybody": ["復仇", "持續時間"],
  "sk_dragon_deathlightning": ["法術", "閃電", "範圍效果", "攻擊"],
  "sk_dragon_reaper": ["混沌", "攻擊"],
  "sk_dragon_awaken_baraka": ["持續時間"],

  // ================= 【戰士技能】 =================
  // 熱血 blood
  "sk_warrior_dualaxe": ["物理"],
  "sk_warrior_crush": ["物理"],
  "sk_warrior_armorbody": ["守護"],
  "sk_warrior_berserk": ["暴擊"],
  // 忍耐 endure
  "sk_warrior_titan_rock": ["復仇", "守護"],
  "sk_warrior_titan_magic": ["復仇", "守護"],
  "sk_warrior_titan_bullet": ["守護"],
  // 憤怒 rage
  "sk_warrior_throwaxe": ["物理", "投射物", "持續時間"],
  "sk_warrior_roar": ["物理", "範圍效果", "攻擊"],
  "sk_warrior_endurance": ["守護", "持續時間"],
  "sk_warrior_outlaw": ["持續時間"],

  // ================= 【王族魔法】 =================
  "sk_royal_precise": ["持續時間"],
  "sk_royal_callally": ["召喚物", "攻擊"],
  "sk_royal_burnweapon": ["火焰", "守護", "持續時間"],
  "sk_royal_bravewill": ["持續時間"],
  "sk_royal_shield": ["守護", "持續時間"],
  "sk_royal_kingguard": ["守護"],

  // ================= 【魔法頭盔技能】 =================
  "sk_helm_dex1": ["持續時間"],
  "sk_helm_dex2": ["閃現", "持續時間"],
  "sk_helm_str1": ["守護", "持續時間"],
  "sk_helm_str2": ["持續時間"],
  "sk_helm_str3": ["持續時間"],
};

// 注入 tags：在 DB.SKILL_DATA 已存在的項目加上 tags
if (typeof DB !== "undefined" && DB.SKILL_DATA) {
  for (const [key, tags] of Object.entries(SKILL_TAGS)) {
    if (DB.SKILL_DATA[key]) {
      DB.SKILL_DATA[key].tags = tags;
    }
  }
}
