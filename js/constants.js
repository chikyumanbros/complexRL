const GAME_CONSTANTS = {
    TILES: {
        FLOOR: ['.', '^', '~'],
        WALL: ['#', '|', '=', '+', '*'],
    },
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
    },
    COLORS: {
        FLOOR: '#444',
        WALL: '#335',
        MONSTER: {
            RAT: '#a33',
            BAT: '#c66',
            SNAKE: '#6a6',
            GOBLIN: '#3a3',
            SPIDER: '#939',
            SKELETON: '#eee',
            ZOMBIE: '#6a6',
            GHOST: '#6cf',
            TROLL: '#383',
            DRAGON_WHELP: '#d33'
        },
    },
    
    MODES: {
        GAME: 'game',
        CODEX: 'codex'
    },
    
    DIMENSIONS: {
        WIDTH: 60,
        HEIGHT: 40
    },
    
    ROOM: {
        MIN_SIZE: 6,
        MAX_SIZE: 15,
        MIN_COUNT: 8,
        MAX_COUNT: 15,
        PADDING: 2
    },

    MONSTERS: {
        RAT: {
            char: 'r',
            name: 'Rat',
            stats: {
                str: 8,
                dex: 14,
                con: 8,
                int: 2,
                wis: 8
            },
            level: 1,
            codexPoints: 2
        },
        BAT: {
            char: 'b',
            name: 'Bat',
            stats: {
                str: 6,
                dex: 16,
                con: 6,
                int: 3,
                wis: 10
            },
            level: 2,
            codexPoints: 3
        },
        SNAKE: {
            char: 's',
            name: 'Snake',
            stats: {
                str: 12,
                dex: 12,
                con: 10,
                int: 4,
                wis: 12
            },
            level: 3,
            codexPoints: 4
        },
        GOBLIN: {
            char: 'g',
            name: 'Goblin',
            stats: {
                str: 10,
                dex: 14,
                con: 12,
                int: 8,
                wis: 6
            },
            level: 2,
            codexPoints: 3
        },
        SPIDER: {
            char: 'a',
            name: 'Giant Spider',
            stats: {
                str: 8,
                dex: 18,
                con: 8,
                int: 5,
                wis: 14
            },
            level: 3,
            codexPoints: 4
        },
        SKELETON: {
            char: 'k',
            name: 'Skeleton',
            stats: {
                str: 14,
                dex: 8,
                con: 14,
                int: 4,
                wis: 6
            },
            level: 4,
            codexPoints: 5
        },
        ZOMBIE: {
            char: 'z',
            name: 'Zombie',
            stats: {
                str: 12,
                dex: 6,
                con: 16,
                int: 2,
                wis: 4
            },
            level: 4,
            codexPoints: 5
        },
        GHOST: {
            char: 'h',
            name: 'Ghost',
            stats: {
                str: 4,
                dex: 12,
                con: 4,
                int: 14,
                wis: 16
            },
            level: 5,
            codexPoints: 6
        },
        TROLL: {
            char: 'T',
            name: 'Troll',
            stats: {
                str: 18,
                dex: 6,
                con: 18,
                int: 3,
                wis: 8
            },
            level: 6,
            codexPoints: 8
        },
        DRAGON_WHELP: {
            char: 'D',
            name: 'Dragon Whelp',
            stats: {
                str: 16,
                dex: 14,
                con: 16,
                int: 12,
                wis: 14
            },
            level: 7,
            codexPoints: 10
        }
    },

    FORMULAS: {
        MAX_HP: (stats, level) => Math.floor((stats.con * 2 + stats.str / 2) * (1 + level * 0.2)),
        ATTACK: (stats) => ({
            base: Math.floor(stats.str - stats.dex / 2),
            diceCount: Math.floor(stats.dex / 5),
            diceSides: Math.floor(stats.str / 5) * 3
        }),
        DEFENSE: (stats) => ({
            base: Math.floor(stats.con - stats.str / 2),
            diceCount: Math.floor(stats.str / 5),
            diceSides: Math.floor(stats.con / 5) * 3
        }),
        ACCURACY: (stats) => Math.floor(60 + stats.dex * 1.5),
        EVASION: (stats) => Math.floor(stats.dex * 1.2),
        PERCEPTION: (stats) => Math.floor(3 + stats.wis * 0.4),
        rollDamage: (attack, defense) => {
            let damage = attack.base;
            for (let i = 0; i < attack.diceCount; i++) {
                damage += Math.floor(Math.random() * attack.diceSides) + 1;
            }

            let def = defense.base;
            for (let i = 0; i < defense.diceCount; i++) {
                def += Math.floor(Math.random() * defense.diceSides) + 1;
            }

            return Math.max(1, damage - def);
        },
        HEALING_DICE: (stats) => ({
            count: Math.floor(1 + stats.con / 20),
            sides: Math.floor(1 + stats.con / 20)
        }),
        HEAL_MODIFIER: (stats) => Math.floor((stats.con - stats.str) / 2),
        SLEEP_CHANCE: (stats) => {
            // intが低いほど眠りやすい。最大50%の確率で眠る
            return Math.min(50, Math.max(0, 50 - stats.int * 8));
        },
    }
}; 