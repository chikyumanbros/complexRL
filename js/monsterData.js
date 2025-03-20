const MONSTER_CATEGORIES = {
    // メインカテゴリ
    PRIMARY: {
        ORGANIC: 'organic',        // 生物
        UNDEAD: 'undead',          // アンデッド
        MECHANICAL: 'mechanical',  // 機械
        ETHEREAL: 'ethereal'       // 霊体/幽体
    },
    
    // サブカテゴリ
    SECONDARY: {
        // ORGANIC サブカテゴリ
        MAMMAL: 'mammal',          // 哺乳類
        REPTILE: 'reptile',        // 爬虫類
        INSECTOID: 'insectoid',    // 昆虫/節足動物
        HUMANOID: 'humanoid',      // 人型生物
        
        // UNDEAD サブカテゴリ
        CORPOREAL: 'corporeal',    // 実体系
        INCORPOREAL: 'incorporeal', // 非実体系
        
        // MECHANICAL サブカテゴリ
        DRONE: 'drone',            // ドローン
        CONSTRUCT: 'construct',    // 人工構造物
        CYBORG: 'cyborg',          // サイボーグ
        
        // ETHEREAL サブカテゴリ
        SPIRIT: 'spirit',          // 霊魂
        ELEMENTAL: 'elemental'     // 元素体
    }
};

const MONSTERS = {
    RAT: {
        char: 'r',
        name: 'Rat',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.RAT);
        },
        stats: {
            str: 4,    // 弱い攻撃力
            dex: 12,   // 素早い
            con: 4,    // 脆弱
            int: 2,    // 非常に低い知性
            wis: 8     // 本能的な警戒心
        },
        level: 1,
        pack: {
            chance: 0.7,    // 70% chance to form a pack
            min: 5,         // Minimum 2 creatures
            max: 15         // Maximum 4 creatures
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.MAMMAL
        }
    },
    BAT: {
        char: 'b',
        name: 'Bat',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.BAT);
        },
        stats: {
            str: 4,    // さらに弱い攻撃力
            dex: 14,   // とても素早い
            con: 3,    // とても脆弱
            int: 2,    // 非常に低い知性
            wis: 12     // 良好な空間認識
        },
        level: 1,
        pack: {
            chance: 0.6,
            min: 5,
            max: 15
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.MAMMAL
        }
    },
    G_VIPER: {
        char: 's',
        name: 'Green Pit Viper',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.G_VIPER);
        },
        stats: {
            str: 9,    // 中程度の攻撃力
            dex: 13,   // 素早い
            con: 7,    // やや脆弱
            int: 3,    // 低い知性
            wis: 10    // 優れた感覚
        },
        level: 2,
        pack: {
            chance: 0.4,
            min: 2,
            max: 7
        },
        abilities: {
            canJump: true,
            jumpCooldown: 10,     // ジャンプのクールダウン（ターン数）
            jumpChance: 0.4,     // ジャンプを試みる確率
            jumpRange: 3         // ジャンプの最大距離
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.REPTILE
        }
    },
    GOBLIN: {
        char: 'g',
        name: 'Goblin',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.GOBLIN);
        },
        stats: {
            str: 7,    // 弱い攻撃力
            dex: 11,   // 高い敏捷性
            con: 9,   // 平均的な体力
            int: 6,    // やや低い知性
            wis: 8     // 平均的な判断力
        },
        level: 2,
        pack: {
            chance: 0.5,
            min: 2,
            max: 4
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.HUMANOID
        }
    },
    MECH_DRONE: {
        char: 'Ω',
        name: 'Mech Drone',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.MECH_DRONE);
        },
        stats: {
            str: 8,    // 中程度の攻撃力
            dex: 11,   // やや素早い
            con: 9,    // 中程度の耐久力
            int: 12,   // 高い知性（プログラミング）
            wis: 10    // 優れたセンサー類
        },
        level: 3,
        pack: {
            chance: 0.4,    // 時々グループで活動
            min: 2,
            max: 5
        },
        // 遠距離攻撃能力
        abilities: {
            canUseRangedAttack: true,
            rangedAttackCooldown: 3,     // 遠距離攻撃のクールダウン（ターン数）
            rangedAttackChance: 0.7,     // 遠距離攻撃を試みる確率
            rangedAttackRange: 5,        // 攻撃の最大距離
            rangedAttackDamage: {        // 攻撃ダメージ
                base: 6,
                diceCount: 2,
                diceSides: 3
            },
            rangedAttackAccuracy: 70     // 命中率（%）
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.MECHANICAL,
            secondary: MONSTER_CATEGORIES.SECONDARY.DRONE
        }
    },
    G_SPIDER: {
        char: 'a',
        name: 'Giant Spider',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.G_SPIDER);
        },
        stats: {
            str: 9,    // 中程度の攻撃力
            dex: 14,   // とても素早い
            con: 10,    // やや脆弱
            int: 4,    // 低い知性
            wis: 12    // 優れた感覚
        },
        level: 3,
        pack: {
            chance: 0.4,
            min: 2,
            max: 10
        },
        // 特殊能力: 蜘蛛の巣
        abilities: {
            canCreateWeb: true,
            webCooldown: 8,       // 蜘蛛の巣生成のクールダウン（ターン数）
            webChance: 0.3,       // 蜘蛛の巣を生成する確率
            webDuration: 20,      // 蜘蛛の巣の持続ターン数
            webTrapChance: 0.75   // プレイヤーが罠にかかる確率
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.INSECTOID
        }
    },
    SKELETON: {
        char: 'k',
        name: 'Skeleton',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SKELETON);
        },
        stats: {
            str: 10,   // 高い攻撃力
            dex: 8,    // 遅い
            con: 12,    // 頑丈
            int: 3,    // 低い知性
            wis: 4     // 乏しい判断力
        },
        level: 4,
        pack: {
            chance: 0.3,
            min: 2,
            max: 5
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.UNDEAD,
            secondary: MONSTER_CATEGORIES.SECONDARY.CORPOREAL
        }
    },
    ZOMBIE: {
        char: 'z',
        name: 'Zombie',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.ZOMBIE);
        },
        stats: {
            str: 9,    // やや高い攻撃力
            dex: 4,    // とても遅い
            con: 12,   // とても頑丈
            int: 2,    // 非常に低い知性
            wis: 3     // 非常に低い判断力
        },
        level: 4,
        pack: {
            chance: 0.4,
            min: 2,
            max: 10
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.UNDEAD,
            secondary: MONSTER_CATEGORIES.SECONDARY.CORPOREAL
        }
    },
    GHOST: {
        char: 'h',
        name: 'Ghost',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.GHOST);
        },
        stats: {
            str: 12,    // 非常に弱い攻撃力
            dex: 13,   // 素早い
            con: 8,    // 非常に脆弱
            int: 10,   // 高い知性
            wis: 15    // 優れた感覚
        },
        level: 5,
        pack: {
            chance: 0.2,
            min: 2,
            max: 5
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ETHEREAL,
            secondary: MONSTER_CATEGORIES.SECONDARY.SPIRIT
        }
    },
    TROLL: {
        char: 'T',
        name: 'Troll',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.TROLL);
        },
        stats: {
            str: 15,   // 非常に高い攻撃力
            dex: 12,    // 遅い
            con: 16,   // 非常に頑丈
            int: 3,    // 低い知性
            wis: 4     // 低い判断力
        },
        level: 5,
        pack: {
            chance: 0.1,    // Trolls rarely form packs
            min: 2,
            max: 3
        },
        category: {
            primary: MONSTER_CATEGORIES.PRIMARY.ORGANIC,
            secondary: MONSTER_CATEGORIES.SECONDARY.HUMANOID
        }
    },
};
