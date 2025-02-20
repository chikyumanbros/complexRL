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
            wis: 6     // 本能的な警戒心
        },
        level: 1,
        pack: {
            chance: 0.7,    // 70% chance to form a pack
            min: 5,         // Minimum 2 creatures
            max: 15         // Maximum 4 creatures
        }
    },
    BAT: {
        char: 'b',
        name: 'Bat',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.BAT);
        },
        stats: {
            str: 3,    // さらに弱い攻撃力
            dex: 14,   // とても素早い
            con: 3,    // とても脆弱
            int: 2,    // 非常に低い知性
            wis: 8     // 良好な空間認識
        },
        level: 2,
        pack: {
            chance: 0.6,
            min: 5,
            max: 15
        }
    },
    SNAKE: {
        char: 's',
        name: 'Snake',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SNAKE);
        },
        stats: {
            str: 7,    // 中程度の攻撃力
            dex: 10,   // 素早い
            con: 7,    // やや脆弱
            int: 3,    // 低い知性
            wis: 10    // 優れた感覚
        },
        level: 3,
        pack: {
            chance: 0.4,
            min: 2,
            max: 7
        }
    },
    GOBLIN: {
        char: 'g',
        name: 'Goblin',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.GOBLIN);
        },
        stats: {
            str: 7,    // 平均的な攻撃力
            dex: 8,    // 平均的な素早さ
            con: 7,    // 平均的な体力
            int: 3,    // やや低い知性
            wis: 6     // 低い判断力
        },
        level: 2,
        pack: {
            chance: 0.5,
            min: 2,
            max: 4
        }
    },
    SPIDER: {
        char: 'a',
        name: 'Giant Spider',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SPIDER);
        },
        stats: {
            str: 8,    // 中程度の攻撃力
            dex: 14,   // とても素早い
            con: 6,    // やや脆弱
            int: 4,    // 低い知性
            wis: 12    // 優れた感覚
        },
        level: 3,
        pack: {
            chance: 0.4,
            min: 2,
            max: 10
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
            dex: 6,    // 遅い
            con: 8,    // 頑丈
            int: 3,    // 低い知性
            wis: 4     // 乏しい判断力
        },
        level: 4,
        pack: {
            chance: 0.3,
            min: 2,
            max: 5
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
            con: 10,   // とても頑丈
            int: 2,    // 非常に低い知性
            wis: 3     // 非常に低い判断力
        },
        level: 4,
        pack: {
            chance: 0.4,
            min: 2,
            max: 10
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
        }
    },
    TROLL: {
        char: 'T',
        name: 'Troll',
        get color() {
            return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.TROLL);
        },
        stats: {
            str: 13,   // 非常に高い攻撃力
            dex: 8,    // 遅い
            con: 14,   // 非常に頑丈
            int: 3,    // 低い知性
            wis: 4     // 低い判断力
        },
        level: 6,
        pack: {
            chance: 0.1,    // Trolls rarely form packs
            min: 2,
            max: 3
        }
    },
};
