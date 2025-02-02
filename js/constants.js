const GAME_CONSTANTS = {
    TILES: {
        FLOOR: ['.', '^', '~'],
        WALL: ['#','?', '=', '$', '*'],
        DOOR: {
            OPEN: '/',
            CLOSED: '+'
        }
    },
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
    },
    COLORS: {
        FLOOR: '#222',
        WALL_VARIATIONS: [
            '#445',  // 基本の青灰色
            '#544',  // 赤灰色
            '#454',  // 緑灰色
            '#455',  // 青緑灰色
            '#554',  // 黄灰色
            '#545',  // 紫灰色
            '#556',  // 水色がかった灰色
            '#655',  // オレンジがかった灰色
            '#565',  // エメラルドがかった灰色
            '#665',  // 金がかった灰色
        ],
        WALL: '#445',  // デフォルトの壁の色（後方互換性のため残す）
        DOOR: '#8B4513',
        HEAL: '#2ed573',
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
        HEIGHT: 35
    },
    
    ROOM: {
        MIN_SIZE: 5,
        MAX_SIZE: 15,
        MIN_COUNT: 10,
        MAX_COUNT: 15,
        PADDING: 2,
        SAFE_RADIUS: 3
    },

    FORMULAS: {
        MAX_HP: (stats, level) => Math.floor((stats.con * 2 + stats.str / 5) * (1 + level * 0.2)),
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
            pack: {
                chance: 0.7,    // 70%の確率で群れ生成
                min: 5,         // 最小2匹
                max: 15          // 最大4匹
            }
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
            pack: {
                chance: 0.6,
                min: 5,
                max: 15
            }
        },
        SNAKE: {
            char: 's',
            name: 'Snake',
            stats: {
                str: 12,
                dex: 12,
                con: 7,
                int: 4,
                wis: 12
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
            stats: {
                str: 10,
                dex: 14,
                con: 9,
                int: 8,
                wis: 6
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
            stats: {
                str: 8,
                dex: 18,
                con: 8,
                int: 5,
                wis: 14
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
            stats: {
                str: 14,
                dex: 8,
                con: 12,
                int: 4,
                wis: 6
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
            stats: {
                str: 12,
                dex: 6,
                con: 11,
                int: 2,
                wis: 4
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
            stats: {
                str: 4,
                dex: 12,
                con: 4,
                int: 14,
                wis: 16
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
            stats: {
                str: 18,
                dex: 6,
                con: 18,
                int: 3,
                wis: 8
            },
            level: 6,
            pack: {
                chance: 0.1,    // トロルは稀にしか群れを作らない
                min: 2,
                max: 3
            }
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
            pack: {
                chance: 0.15,   // ドラゴンの子供も稀にペアで現れる
                min: 2,
                max: 2
            }
        }
    },

    DANGER_LEVELS: {
        SAFE: { 
            name: 'Serene', 
            levelModifier: -1, 
            color: '#2ecc71',
            flavor: "A gentle breeze carries the scent of ancient stone. The air feels unusually peaceful, almost protective."
        },
        NORMAL: { 
            name: 'Neutral', 
            levelModifier: 0, 
            color: '#f1c40f',
            flavor: "The familiar musty scent of the dungeon fills the air. Distant echoes remind you to remain vigilant."
        },
        DANGEROUS: { 
            name: 'Perilous', 
            levelModifier: 1, 
            color: '#e74c3c',
            flavor: "The shadows seem to writhe with malicious intent. Every sound carries an undertone of danger."
        },
        DEADLY: { 
            name: 'Fatal', 
            levelModifier: 2, 
            color: '#8e44ad',
            flavor: "An oppressive darkness weighs heavily on your soul. The very air seems to pulse with deadly energy."
        }
    }
}; 